//
// Copyright (C) 2026 Curity AB. All rights reserved.
//
// The contents of this file are the property of Curity AB.
// You may not copy or use this file, in either source code
// or executable form, except in compliance with terms
// set by Curity AB.
//
// For further information, please contact Curity AB.
//
package se.curity.identityserver.haapi.reactnative.sdk.internal

import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Test
import se.curity.identityserver.haapi.android.sdk.models.oauth.ErrorTokenResponse
import se.curity.identityserver.haapi.android.sdk.models.oauth.SuccessfulTokenResponse
import se.curity.identityserver.haapi.android.sdk.models.oauth.TokenResponse
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNTokenResponseType
import java.time.Duration

// Fixture values are loaded from `__fixtures__/token-responses.json` (exposed
// to the JVM unit-test classpath via `sourceSets.test.resources.srcDirs` in
// `android/build.gradle`). The same JSON is consumed by the iOS and TS
// suites, so all three platforms assert against identical server output.
//
// The native `SuccessfulTokenResponse` / `ErrorTokenResponse` data classes
// have `internal` constructors, so MockK stands in for them — we mock just
// the `accessToken` / `error` / etc. getters the bridge reads.

// region Stubs

private class RecordingOAuthInvoker : OAuthTokenInvoker {
    var fetchAccessTokenCalls = mutableListOf<Pair<String, Map<String, String>?>>()
    var refreshAccessTokenCalls = mutableListOf<Pair<String, Map<String, String>?>>()
    var revokeAccessTokenCalls = mutableListOf<String>()
    var revokeRefreshTokenCalls = mutableListOf<String>()

    var stubbedTokenResponse: TokenResponse = mockk(relaxed = true)
    var fetchThrows: Throwable? = null
    var refreshThrows: Throwable? = null
    var revokeAccessThrows: Throwable? = null
    var revokeRefreshThrows: Throwable? = null

    override suspend fun fetchAccessToken(
        authorizationCode: String,
        additionalParameters: Map<String, String>?,
    ): TokenResponse {
        fetchAccessTokenCalls += authorizationCode to additionalParameters
        fetchThrows?.let { throw it }
        return stubbedTokenResponse
    }

    override suspend fun refreshAccessToken(
        refreshToken: String,
        additionalParameters: Map<String, String>?,
    ): TokenResponse {
        refreshAccessTokenCalls += refreshToken to additionalParameters
        refreshThrows?.let { throw it }
        return stubbedTokenResponse
    }

    override suspend fun revokeAccessToken(token: String) {
        revokeAccessTokenCalls += token
        revokeAccessThrows?.let { throw it }
    }

    override suspend fun revokeRefreshToken(token: String) {
        revokeRefreshTokenCalls += token
        revokeRefreshThrows?.let { throw it }
    }
}

// endregion

// region Fixtures

private object Fixtures {
    /**
     * Loaded once per JVM. Lives at SDK-root `__fixtures__/token-responses.json`;
     * gradle exposes the directory on the test classpath via
     * `sourceSets.test.resources.srcDirs` so the same file is available
     * to TS via `require` and to Swift via `Bundle.url`.
     */
    private val rawFixtures: JSONObject by lazy {
        val stream =
            requireNotNull(
                Fixtures::class.java.getResourceAsStream("/token-responses.json"),
            ) {
                "token-responses.json missing from the test classpath — check " +
                    "`android/build.gradle::sourceSets.test.resources.srcDirs`."
            }
        JSONObject(stream.bufferedReader().use { it.readText() })
    }

    private fun successFromJson(name: String): SuccessfulTokenResponse {
        val o = rawFixtures.getJSONObject(name)
        // Fixture uses OAuth RFC 6749 wire format (snake_case). MockK stubs the
        // SDK's SuccessfulTokenResponse interface (camelCase) — the snake_case →
        // camelCase asymmetry is contained at this read boundary, mirroring the
        // SDK's wire-decode step in production.
        return mockk {
            every { accessToken } returns o.getString("access_token")
            every { tokenType } returns o.getString("token_type")
            every { scope } returns o.getString("scope")
            every { expiresIn } returns Duration.ofSeconds(o.getLong("expires_in"))
            every { refreshToken } returns if (o.has("refresh_token")) o.getString("refresh_token") else null
            every { idToken } returns if (o.has("id_token")) o.getString("id_token") else null
        }
    }

    private fun errorFromJson(name: String): ErrorTokenResponse {
        val o = rawFixtures.getJSONObject(name)
        return mockk {
            every { error } returns o.getString("error")
            every { errorDescription } returns
                if (o.has("error_description")) o.getString("error_description") else null
            every { errorUri } returns if (o.has("error_uri")) o.getString("error_uri") else null
        }
    }

    /** Fixture A — basic bearer (no OIDC). */
    fun successBearer(): SuccessfulTokenResponse = successFromJson("successBearer")

    /** Fixture B — OIDC success with id_token + non-empty scope. */
    fun successOidc(): SuccessfulTokenResponse = successFromJson("successOidc")

    /** Fixture C — DPoP-bound token (no refresh token issued). */
    fun successDpop(): SuccessfulTokenResponse = successFromJson("successDpop")

    /** Fixture D — invalid_scope error token. */
    fun errorInvalidScope(): ErrorTokenResponse = errorFromJson("errorInvalidScope")

    /** Fixture E — invalid_grant error token (canonical refresh-token failure). */
    fun errorInvalidGrant(): ErrorTokenResponse = errorFromJson("errorInvalidGrant")

    /**
     * Sub-second `expiresIn` regression guard. **Not** in the shared JSON
     * because it's a Kotlin-only fixture covering the
     * `Duration.seconds.toDouble()` truncation contract — TS sees the
     * post-truncation `expiresIn` (whole seconds) so the test wouldn't
     * mean the same thing on the JS side. Kept as a literal here.
     *
     * OAuth `expires_in` is whole seconds per RFC 6749 § 5.1, but
     * `Duration` carries sub-second precision. The bridge uses
     * `Duration.seconds.toDouble()` which truncates to the whole-second
     * component (`Duration.ofMillis(900) → 0.0`); a `toMillis() / 1000.0`
     * formula would leak the sub-second remainder (`0.9`) and break the
     * spec contract.
     */
    fun successSubSecondExpiresIn(): SuccessfulTokenResponse =
        mockk {
            every { accessToken } returns "tok-sub-second"
            every { tokenType } returns "bearer"
            every { scope } returns ""
            every { expiresIn } returns Duration.ofMillis(900)
            every { refreshToken } returns null
            every { idToken } returns null
        }
}

// endregion

class RNOAuthTokenManagerBridgeTest {
    // region fetchAccessToken happy paths

    @Test
    fun fetchAccessTokenSuccessBearerReturnsSuccessRecord() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { stubbedTokenResponse = Fixtures.successBearer() }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            val record = bridge.fetchAccessToken("abc", null)

            assertEquals(1, invoker.fetchAccessTokenCalls.size)
            assertEquals("abc", invoker.fetchAccessTokenCalls.first().first)
            assertNull(invoker.fetchAccessTokenCalls.first().second)
            assertEquals(RNTokenResponseType.SUCCESS, record.responseType)
            assertEquals("c2f1bd4c-a1bf-49b8-aa64-1535fa5161a6", record.accessToken)
            assertEquals("bearer", record.tokenType)
            assertEquals("", record.scope)
            assertEquals(299.0, record.expiresIn!!, 0.0)
            assertEquals("e57b7017-3fdd-40a9-97c4-97d26c500c8f", record.refreshToken)
            assertNull(record.idToken)
        }

    @Test
    fun fetchAccessTokenSuccessOidcReturnsSuccessRecordWithIdToken() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { stubbedTokenResponse = Fixtures.successOidc() }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            val record = bridge.fetchAccessToken("abc", null)

            assertEquals(RNTokenResponseType.SUCCESS, record.responseType)
            assertEquals("24605f8a-b558-4527-adcc-99f7d401d4c5", record.accessToken)
            assertEquals("eyJraWQiOiItMzgwNzQ4MTIi", record.idToken)
            assertEquals("address openid", record.scope)
        }

    @Test
    fun fetchAccessTokenSuccessDpopReturnsRecordWithoutRefreshToken() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { stubbedTokenResponse = Fixtures.successDpop() }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            val record = bridge.fetchAccessToken("abc", null)

            assertEquals(RNTokenResponseType.SUCCESS, record.responseType)
            assertEquals("DPoP", record.tokenType)
            assertEquals(600.0, record.expiresIn!!, 0.0)
            assertNull(record.refreshToken)
            assertNull(record.idToken)
        }

    @Test
    fun fetchAccessTokenErrorInvalidScopeReturnsErrorRecord() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { stubbedTokenResponse = Fixtures.errorInvalidScope() }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            val record = bridge.fetchAccessToken("abc", null)

            assertEquals(RNTokenResponseType.ERROR, record.responseType)
            assertEquals("invalid_scope", record.error)
            assertEquals("No valid scope was requested.", record.errorDescription)
            assertNull(record.errorUri)
        }

    @Test
    fun fetchAccessTokenErrorInvalidGrantReturnsErrorRecord() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { stubbedTokenResponse = Fixtures.errorInvalidGrant() }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            val record = bridge.fetchAccessToken("abc", null)

            assertEquals(RNTokenResponseType.ERROR, record.responseType)
            assertEquals("invalid_grant", record.error)
        }

    /**
     * `expiresIn` is whole seconds per RFC 6749 § 5.1. The bridge
     * truncates sub-second precision via `Duration.seconds.toDouble()`,
     * so a `Duration.ofMillis(900)` token response surfaces as `0.0`.
     * Guards against regressions to a `toMillis() / 1000.0` formula that
     * would leak the sub-second remainder (`0.9`).
     */
    @Test
    fun fetchAccessTokenSubSecondExpiresInTruncatesToWholeSeconds() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { stubbedTokenResponse = Fixtures.successSubSecondExpiresIn() }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            val record = bridge.fetchAccessToken("abc", null)

            assertEquals(RNTokenResponseType.SUCCESS, record.responseType)
            assertEquals(0.0, record.expiresIn!!, 0.0)
        }

    // endregion

    // region fetchAccessToken transport error

    @Test
    fun fetchAccessTokenTransportErrorRethrows() =
        runTest {
            val invoker =
                RecordingOAuthInvoker().apply {
                    fetchThrows = RuntimeException("network down")
                }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            try {
                bridge.fetchAccessToken("abc", null)
                fail("expected RuntimeException to rethrow")
            } catch (e: RuntimeException) {
                assertEquals("network down", e.message)
            }
        }

    // endregion

    // region additionalParameters forwarding

    @Test
    fun fetchAccessTokenMissingAdditionalParametersForwardsNull() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { stubbedTokenResponse = Fixtures.successBearer() }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            bridge.fetchAccessToken("abc", null)

            assertNull(invoker.fetchAccessTokenCalls.first().second)
        }

    @Test
    fun fetchAccessTokenEmptyAdditionalParametersForwardsEmptyMap() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { stubbedTokenResponse = Fixtures.successBearer() }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            bridge.fetchAccessToken("abc", emptyMap())

            assertEquals(emptyMap<String, String>(), invoker.fetchAccessTokenCalls.first().second)
        }

    @Test
    fun fetchAccessTokenPopulatedAdditionalParametersForwardsMap() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { stubbedTokenResponse = Fixtures.successBearer() }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            bridge.fetchAccessToken("abc", mapOf("foo" to "bar"))

            assertEquals(mapOf("foo" to "bar"), invoker.fetchAccessTokenCalls.first().second)
        }

    // endregion

    // region refreshAccessToken (mirrors fetchAccessToken)

    @Test
    fun refreshAccessTokenSuccessBearerReturnsSuccessRecord() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { stubbedTokenResponse = Fixtures.successBearer() }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            val record = bridge.refreshAccessToken("rt", null)

            assertEquals(1, invoker.refreshAccessTokenCalls.size)
            assertEquals("rt", invoker.refreshAccessTokenCalls.first().first)
            assertEquals(RNTokenResponseType.SUCCESS, record.responseType)
            assertEquals("c2f1bd4c-a1bf-49b8-aa64-1535fa5161a6", record.accessToken)
        }

    @Test
    fun refreshAccessTokenErrorInvalidGrantReturnsErrorRecord() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { stubbedTokenResponse = Fixtures.errorInvalidGrant() }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            val record = bridge.refreshAccessToken("rt", null)

            assertEquals(RNTokenResponseType.ERROR, record.responseType)
            assertEquals("invalid_grant", record.error)
        }

    @Test
    fun refreshAccessTokenTransportErrorRethrows() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { refreshThrows = RuntimeException("refresh failed") }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            try {
                bridge.refreshAccessToken("rt", null)
                fail("expected RuntimeException to rethrow")
            } catch (e: RuntimeException) {
                assertEquals("refresh failed", e.message)
            }
        }

    // endregion

    // region revokeAccessToken / revokeRefreshToken

    @Test
    fun revokeAccessTokenSuccessResolves() =
        runTest {
            val invoker = RecordingOAuthInvoker()
            val bridge = RNOAuthTokenManagerBridge(invoker)

            bridge.revokeAccessToken("tok")

            assertEquals(listOf("tok"), invoker.revokeAccessTokenCalls)
        }

    @Test
    fun revokeAccessTokenErrorRethrows() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { revokeAccessThrows = RuntimeException("revoke failed") }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            try {
                bridge.revokeAccessToken("tok")
                fail("expected rethrow")
            } catch (e: RuntimeException) {
                assertEquals("revoke failed", e.message)
            }
        }

    @Test
    fun revokeRefreshTokenSuccessResolves() =
        runTest {
            val invoker = RecordingOAuthInvoker()
            val bridge = RNOAuthTokenManagerBridge(invoker)

            bridge.revokeRefreshToken("tok")

            assertEquals(listOf("tok"), invoker.revokeRefreshTokenCalls)
        }

    @Test
    fun revokeRefreshTokenErrorRethrows() =
        runTest {
            val invoker =
                RecordingOAuthInvoker().apply {
                    revokeRefreshThrows = RuntimeException("revoke refresh failed")
                }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            try {
                bridge.revokeRefreshToken("tok")
                fail("expected rethrow")
            } catch (e: RuntimeException) {
                assertEquals("revoke refresh failed", e.message)
            }
        }

    // endregion
}
