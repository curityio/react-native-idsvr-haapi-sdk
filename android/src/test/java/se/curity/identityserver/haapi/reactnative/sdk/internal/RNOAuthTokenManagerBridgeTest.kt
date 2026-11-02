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
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import se.curity.identityserver.haapi.android.driver.internal.DpopHelper
import se.curity.identityserver.haapi.android.driver.internal.HaapiUnrecoverableException
import se.curity.identityserver.haapi.android.sdk.models.oauth.ErrorTokenResponse
import se.curity.identityserver.haapi.android.sdk.models.oauth.SuccessfulTokenResponse
import se.curity.identityserver.haapi.android.sdk.models.oauth.TokenResponse
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNTokenResponseType
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStoreException
import java.security.MessageDigest
import java.security.PublicKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.time.Duration
import java.util.Base64
import java.util.concurrent.CancellationException

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

    val dpopHelperCalls = mutableListOf<String>()
    var stubbedDpopHelper: DpopHelper? = null
    var dpopHelperThrows: Throwable? = null

    override suspend fun dpopHelper(accessToken: String): DpopHelper? {
        dpopHelperCalls += accessToken
        dpopHelperThrows?.let { throw it }
        return stubbedDpopHelper
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

    // region createDpopProof

    private val accessToken = "eyJhbGciOiJFUzI1NiJ9.a-bound-access-token.sig"
    private val keyPair: KeyPair =
        KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
    private val issuedAtMillis = 1_761_200_000_000

    private fun helperFor(keys: KeyPair) = DpopHelper(keys, "ES256") { issuedAtMillis }

    @Test
    fun createDpopProofSignsWithTheKeyTheAccessTokenIsBoundTo() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { stubbedDpopHelper = helperFor(keyPair) }

            val proof = RNOAuthTokenManagerBridge(invoker).createDpopProof(accessToken, "GET", URL, null)

            requireNotNull(proof)
            assertTrue("the proof must verify with the bound key", signatureVerifies(proof, keyPair.public))
            val header = part(proof, 0)
            assertEquals("dpop+jwt", header.getString("typ"))
            assertEquals("ES256", header.getString("alg"))
            assertEquals(listOf(accessToken), invoker.dpopHelperCalls)
        }

    @Test
    fun createDpopProofBindsTheRequestAndTheAccessToken() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { stubbedDpopHelper = helperFor(keyPair) }

            val claims =
                part(
                    requireNotNull(RNOAuthTokenManagerBridge(invoker).createDpopProof(accessToken, "GET", URL, null)),
                    1,
                )

            assertEquals("GET", claims.getString("htm"))
            // Query and fragment are not part of what a proof binds.
            assertEquals("https://api.example.com/orders", claims.getString("htu"))
            assertEquals(sha256Base64Url(accessToken), claims.getString("ath"))
            assertEquals(issuedAtMillis / 1000, claims.getLong("iat"))
            assertFalse("no nonce was passed", claims.has("nonce"))
        }

    // A resource server's own nonce: the proof carries exactly the one the app was given.
    @Test
    fun createDpopProofCarriesTheResourceServerNonceItIsGiven() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { stubbedDpopHelper = helperFor(keyPair) }
            val bridge = RNOAuthTokenManagerBridge(invoker)

            val proof = bridge.createDpopProof(accessToken, "GET", URL, "eyJ7S_zG.rs-nonce-1")

            assertEquals("eyJ7S_zG.rs-nonce-1", part(requireNotNull(proof), 1).getString("nonce"))
        }

    @Test
    fun createDpopProofIsFreshOnEveryCallAlsoWhenConcurrent() =
        runTest {
            val bridge =
                RNOAuthTokenManagerBridge(
                    RecordingOAuthInvoker().apply {
                        stubbedDpopHelper =
                            helperFor(keyPair)
                    },
                )

            val sequential =
                listOf(
                    bridge.createDpopProof(accessToken, "GET", URL, null),
                    bridge.createDpopProof(accessToken, "GET", URL, null),
                )
            val concurrent =
                listOf(
                    async { bridge.createDpopProof(accessToken, "GET", URL, null) },
                    async { bridge.createDpopProof(accessToken, "GET", URL, null) },
                ).map { it.await() }

            val identifiers = (sequential + concurrent).map { part(requireNotNull(it), 1).getString("jti") }
            assertEquals("every proof has its own jti", 4, identifiers.toSet().size)
        }

    @Test
    fun createDpopProofIsNullWhenNoKeyIsBoundToTheToken() =
        runTest {
            val invoker = RecordingOAuthInvoker().apply { stubbedDpopHelper = null }

            assertNull(RNOAuthTokenManagerBridge(invoker).createDpopProof(accessToken, "GET", URL, null))
            assertEquals(listOf(accessToken), invoker.dpopHelperCalls)
        }

    // TypeScript refuses such a URL first; the bridge re-checks, so nothing can reach signing with a URL it
    // can't use. Same inputs and description as the iOS bridge test.
    @Test
    fun createDpopProofRefusesAUrlItCannotUseBeforeAnyLookup() =
        runTest {
            val notAbsolute = "url must be an absolute http or https URL."
            val credentials = "url must not carry user credentials."
            listOf(
                "http://[::1" to notAbsolute,
                "https:/orders" to notAbsolute,
                "ftp://api.example.com/orders" to notAbsolute,
                "https://:8443/x" to notAbsolute,
                "https://u:p@h/x" to credentials,
                "https://u@h/x" to credentials,
            ).forEach { (unusable, description) ->
                val invoker = RecordingOAuthInvoker().apply { stubbedDpopHelper = helperFor(keyPair) }

                val thrown =
                    try {
                        RNOAuthTokenManagerBridge(invoker).createDpopProof(accessToken, "GET", unusable, null)
                        null
                    } catch (e: Exception) {
                        e
                    }

                assertTrue("$unusable: got $thrown", thrown is InvalidArgumentException)
                assertEquals(unusable, description, thrown?.message)
                assertTrue("$unusable: the key store is not read", invoker.dpopHelperCalls.isEmpty())
            }
        }

    // What the native SDK throws when the Keystore can't hand out the key.
    private fun keyStoreFailure(cause: Exception) =
        HaapiUnrecoverableException.UnexpectedException(cause, "keystore_exception", "Unable to load the DPoP key.")

    @Test
    fun createDpopProofReportsAnUnreadableKeyAsALookupFailure() =
        runTest {
            val unreadable = keyStoreFailure(KeyStoreException("Keystore operation failed"))
            val invoker = RecordingOAuthInvoker().apply { dpopHelperThrows = unreadable }

            val thrown = createDpopProofFailure(RNOAuthTokenManagerBridge(invoker))

            assertTrue(thrown is DpopProofLookupException)
            assertSame(unreadable, thrown.cause)
            assertEquals("HAAPI_DPOP_PROOF_FAILURE", normalizedWithoutSecrets(thrown).getString("code"))
        }

    @Test
    fun createDpopProofReportsALockedKeyStoreAsStorageUnavailable() =
        runTest {
            val locked = keyStoreFailure(DefaultStorageUnavailableException(KeyStoreException("KEK locked")))
            val invoker = RecordingOAuthInvoker().apply { dpopHelperThrows = locked }

            val thrown = createDpopProofFailure(RNOAuthTokenManagerBridge(invoker))

            assertEquals("HAAPI_STORAGE_UNAVAILABLE", normalizedWithoutSecrets(thrown).getString("code"))
        }

    @Test
    fun createDpopProofLetsCancellationThroughUnwrapped() =
        runTest {
            val cancelled = CancellationException("the caller's scope was cancelled")
            val invoker = RecordingOAuthInvoker().apply { dpopHelperThrows = cancelled }

            assertSame(cancelled, createDpopProofFailure(RNOAuthTokenManagerBridge(invoker)))
        }

    @Test
    fun createDpopProofReportsASigningFailureAsACreationFailure() =
        runTest {
            // A key the configured algorithm can't sign with.
            val rsaKeys = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
            val invoker = RecordingOAuthInvoker().apply { stubbedDpopHelper = helperFor(rsaKeys) }

            val thrown = createDpopProofFailure(RNOAuthTokenManagerBridge(invoker))

            assertTrue("got $thrown", thrown is DpopProofCreationException)
            assertEquals("HAAPI_DPOP_PROOF_CREATION_FAILURE", normalizedWithoutSecrets(thrown).getString("code"))
        }

    private suspend fun createDpopProofFailure(bridge: RNOAuthTokenManagerBridge): Throwable {
        try {
            bridge.createDpopProof(accessToken, "GET", URL, NONCE)
        } catch (e: Throwable) {
            return e
        }
        fail("expected createDpopProof to fail")
        throw AssertionError()
    }

    /** The envelope JS receives for [thrown], checked to carry none of the token, URL or nonce. */
    private fun normalizedWithoutSecrets(thrown: Throwable): JSONObject {
        val message = requireNotNull(HaapiErrorNormalizer.normalize(thrown).message)
        listOf(accessToken, URL, "api.example.com", NONCE).forEach {
            assertFalse("the envelope must not carry $it", message.contains(it))
        }
        return JSONObject(message.removePrefix("HAAPI_ERROR_V1::"))
    }

    private fun part(
        jws: String,
        index: Int,
    ) = JSONObject(String(Base64.getUrlDecoder().decode(jws.split(".")[index])))

    private fun sha256Base64Url(value: String) =
        Base64.getUrlEncoder().withoutPadding().encodeToString(
            MessageDigest.getInstance("SHA-256").digest(value.toByteArray()),
        )

    /** Verifies an ES256 JWS with plain JCA: its signature is the raw `r || s`, JCA wants DER. */
    private fun signatureVerifies(
        jws: String,
        publicKey: PublicKey,
    ): Boolean {
        val (header, payload, signature) = jws.split(".")
        return Signature.getInstance("SHA256withECDSA").run {
            initVerify(publicKey)
            update("$header.$payload".toByteArray())
            verify(rawEcdsaToDer(Base64.getUrlDecoder().decode(signature)))
        }
    }

    private fun rawEcdsaToDer(raw: ByteArray): ByteArray {
        fun integer(bytes: ByteArray): ByteArray {
            val trimmed = bytes.dropWhile { it == 0.toByte() }.toByteArray()
            val value = if (trimmed.isEmpty() || trimmed[0] < 0) byteArrayOf(0) + trimmed else trimmed
            return byteArrayOf(0x02, value.size.toByte()) + value
        }
        val r = integer(raw.copyOfRange(0, 32))
        val s = integer(raw.copyOfRange(32, 64))
        return byteArrayOf(0x30, (r.size + s.size).toByte()) + r + s
    }

    private companion object {
        const val URL = "https://api.example.com/orders?page=2#top"
        const val NONCE = "a-resource-server-nonce"
    }

    // endregion
}
