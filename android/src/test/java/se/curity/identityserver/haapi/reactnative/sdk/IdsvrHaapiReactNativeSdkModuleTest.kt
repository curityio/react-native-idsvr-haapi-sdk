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
package se.curity.identityserver.haapi.reactnative.sdk

import android.content.Context
import android.os.Parcel
import expo.modules.kotlin.exception.CodedException
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import se.curity.identityserver.haapi.android.driver.HaapiLogger
import se.curity.identityserver.haapi.android.sdk.HaapiAccessor
import se.curity.identityserver.haapi.android.sdk.HaapiManager
import se.curity.identityserver.haapi.android.sdk.OAuthAccessor
import se.curity.identityserver.haapi.android.sdk.OAuthTokenManager
import se.curity.identityserver.haapi.reactnative.sdk.configurations.RNHaapiConfigurationRecord
import se.curity.identityserver.haapi.reactnative.sdk.internal.HaapiAccessorFactoryProvider
import se.curity.identityserver.haapi.reactnative.sdk.internal.HaapiAccessorStore
import se.curity.identityserver.haapi.reactnative.sdk.logging.RNLogLevel
import se.curity.identityserver.haapi.reactnative.sdk.logging.RNLoggerConfigurationRecord
import se.curity.identityserver.haapi.reactnative.sdk.logging.RNModuleLogger
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNFormActionModelRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNLinkRecord

// Module-level integration tests for HSRN-8 § 11.5.
//
// Coverage strategy:
//   - Happy-path init (cases 1, 2, 11, 12) goes through the real
//     `handleInitializeForHaapi` / `handleInitializeForOAuth` code paths,
//     using a MockK [HaapiAccessor] / [OAuthAccessor] returned by a stub
//     [HaapiAccessorFactoryProvider]. The bridge wiring reads `haapiManager`
//     / `oAuthTokenManager` from the accessor — both are MockK final-class
//     stubs (relaxed) since the SDK constructors are `internal`.
//   - Pre-init error paths (cases 7, 9, 10) call handlers without any prior
//     init — the store is empty, so the `require*` helpers throw before
//     touching any accessor.
//   - Wrong-kind paths (case 8) pre-populate the store with a hand-rolled
//     fake accessor — the `require*` helpers throw before touching
//     `oAuthTokenManager`, so the fake's getter (which throws) is never read.
//   - Already-initialized paths (cases 3-6) successfully complete a first
//     init via MockK, then call the second init which fails at
//     `accessorStore.setHaapi/setOAuth`.
//
// All errors thrown from handlers are asserted to be
// [HaapiAccessorBridgeException] with the expected stable code from
// [HaapiAccessorStore]. JS callers will see the same code on `error.code`
// — that's the contract HSRN-22 builds on.

// region Hand-rolled fakes

private class FakeOAuthAccessor : OAuthAccessor {
    override val oAuthTokenManager: OAuthTokenManager
        get() = throw UnsupportedOperationException(
            "FakeOAuthAccessor.oAuthTokenManager is not available in JVM unit tests.",
        )

    override fun describeContents(): Int = 0

    override fun writeToParcel(
        dest: Parcel,
        flags: Int,
    ) = throw UnsupportedOperationException("FakeOAuthAccessor is not parcelable in tests.")
}

// endregion

class IdsvrHaapiReactNativeSdkModuleTest {
    private lateinit var module: IdsvrHaapiReactNativeSdkModule
    private lateinit var store: HaapiAccessorStore
    private lateinit var factoryProvider: HaapiAccessorFactoryProvider
    private lateinit var mockContext: Context
    private val closedAccessors = mutableListOf<HaapiAccessor>()

    @Before
    fun setUp() {
        closedAccessors.clear()
        mockContext = mockk(relaxed = true)
        factoryProvider = mockk()
        store = HaapiAccessorStore(closeHaapi = { closedAccessors.add(it) })
        module =
            IdsvrHaapiReactNativeSdkModule().apply {
                this.factoryProvider = this@IdsvrHaapiReactNativeSdkModuleTest.factoryProvider
                this.accessorStore = store
                this.applicationContextProvider = { mockContext }
                this.coroutineContextProvider = { Dispatchers.Unconfined }
                // Stub the logger — production sends through `appContext`, which
                // is uninitialized without a live Expo runtime.
                this.log = mockk<RNModuleLogger>(relaxed = true)
            }
    }

    private fun makeMockHaapiAccessor(): HaapiAccessor =
        mockk<HaapiAccessor>(relaxed = true) {
            every { haapiManager } returns mockk<HaapiManager>(relaxed = true)
            every { oAuthTokenManager } returns mockk<OAuthTokenManager>(relaxed = true)
        }

    private fun makeMockOAuthAccessor(): OAuthAccessor =
        mockk<OAuthAccessor>(relaxed = true) {
            every { oAuthTokenManager } returns mockk<OAuthTokenManager>(relaxed = true)
        }

    private fun assertBridgeError(
        block: () -> Unit,
        expectedCode: String,
        expectedCategory: String? = null,
    ) {
        try {
            block()
            fail("Expected CodedException with code $expectedCode, got success.")
        } catch (e: CodedException) {
            assertNormalizedEnvelope(e, expectedCode, expectedCategory)
        }
    }

    private suspend fun assertSuspendingBridgeError(
        block: suspend () -> Unit,
        expectedCode: String,
        expectedCategory: String? = null,
    ) {
        try {
            block()
            fail("Expected CodedException with code $expectedCode, got success.")
        } catch (e: CodedException) {
            assertNormalizedEnvelope(e, expectedCode, expectedCategory)
        }
    }

    private fun assertNormalizedEnvelope(
        error: CodedException,
        expectedCode: String,
        expectedCategory: String? = null,
    ) {
        assertEquals(expectedCode, error.code)
        assertTrue(error.message?.contains("INIT_FAILED") != true)
        val envelope = decodeEnvelope(error)
        assertEquals(expectedCode, envelope.getString("code"))
        if (expectedCategory != null) {
            assertEquals(expectedCategory, envelope.getString("category"))
        }
    }

    private fun decodeEnvelope(error: CodedException): JSONObject {
        val message = requireNotNull(error.message) { "Expected normalized envelope message." }
        val prefix = "HAAPI_ERROR_V1::"
        assertTrue("Expected normalized envelope prefix.", message.startsWith(prefix))
        return JSONObject(message.removePrefix(prefix))
    }

    // region § 11.5 — Happy-path lifecycle (cases 1, 2)

    @Test
    fun `case 1 - initializeForHaapi happy stores accessor and wires both bridges`() =
        runTest {
            val accessor = makeMockHaapiAccessor()
            coEvery { factoryProvider.createForHaapi(any(), any(), any()) } returns accessor

            module.handleInitializeForHaapi(RNHaapiConfigurationRecord())

            assertSame(accessor, store.requireHaapi())
            assertNotNull("haapiManagerBridge should be set after init", module.haapiManagerBridge)
            assertNotNull("oauthTokenManagerBridge should be set after init", module.oauthTokenManagerBridge)
        }

    @Test
    fun `case 2 - initializeForOAuth happy stores accessor and wires only oauth bridge`() =
        runTest {
            val accessor = makeMockOAuthAccessor()
            every { factoryProvider.createForOAuth(any(), any()) } returns accessor

            module.handleInitializeForOAuth(RNHaapiConfigurationRecord())

            assertSame(accessor, store.requireOAuth())
            assertNull("haapiManagerBridge should be null in OAuth-only mode", module.haapiManagerBridge)
            assertNotNull("oauthTokenManagerBridge should be set after init", module.oauthTokenManagerBridge)
        }

    @Test
    fun `initializeForHaapi build failure is normalized and not INIT_FAILED`() =
        runTest {
            coEvery { factoryProvider.createForHaapi(any(), any(), any()) } throws IllegalStateException("boom")

            assertSuspendingBridgeError(
                block = { module.handleInitializeForHaapi(RNHaapiConfigurationRecord()) },
                expectedCode = "HAAPI_UNEXPECTED",
                expectedCategory = "unexpected",
            )
        }

    @Test
    fun `initializeForOAuth build failure is normalized and not INIT_FAILED`() =
        runTest {
            every { factoryProvider.createForOAuth(any(), any()) } throws IllegalStateException("boom")

            assertSuspendingBridgeError(
                block = { module.handleInitializeForOAuth(RNHaapiConfigurationRecord()) },
                expectedCode = "HAAPI_UNEXPECTED",
                expectedCategory = "unexpected",
            )
        }

    // endregion

    // region § 11.5 — ALREADY_INITIALIZED (cases 3-6)

    @Test
    fun `case 3 - initializeForHaapi twice without close throws ALREADY_INITIALIZED`() =
        runTest {
            coEvery { factoryProvider.createForHaapi(any(), any(), any()) } returns makeMockHaapiAccessor()
            module.handleInitializeForHaapi(RNHaapiConfigurationRecord())

            assertSuspendingBridgeError(
                block = { module.handleInitializeForHaapi(RNHaapiConfigurationRecord()) },
                expectedCode = HaapiAccessorStore.ERROR_ALREADY_INITIALIZED,
            )

            coVerify(exactly = 1) { factoryProvider.createForHaapi(any(), any(), any()) }
        }

    @Test
    fun `case 4 - initializeForOAuth twice without close throws ALREADY_INITIALIZED`() =
        runTest {
            every { factoryProvider.createForOAuth(any(), any()) } returns makeMockOAuthAccessor()
            module.handleInitializeForOAuth(RNHaapiConfigurationRecord())

            assertSuspendingBridgeError(
                block = { module.handleInitializeForOAuth(RNHaapiConfigurationRecord()) },
                expectedCode = HaapiAccessorStore.ERROR_ALREADY_INITIALIZED,
            )

            verify(exactly = 1) { factoryProvider.createForOAuth(any(), any()) }
        }

    @Test
    fun `case 5 - initializeForOAuth after initializeForHaapi without close throws ALREADY_INITIALIZED`() =
        runTest {
            coEvery { factoryProvider.createForHaapi(any(), any(), any()) } returns makeMockHaapiAccessor()
            every { factoryProvider.createForOAuth(any(), any()) } returns makeMockOAuthAccessor()

            module.handleInitializeForHaapi(RNHaapiConfigurationRecord())

            assertSuspendingBridgeError(
                block = { module.handleInitializeForOAuth(RNHaapiConfigurationRecord()) },
                expectedCode = HaapiAccessorStore.ERROR_ALREADY_INITIALIZED,
            )

            verify(exactly = 0) { factoryProvider.createForOAuth(any(), any()) }
        }

    @Test
    fun `case 6 - initializeForHaapi after initializeForOAuth without close throws ALREADY_INITIALIZED`() =
        runTest {
            every { factoryProvider.createForOAuth(any(), any()) } returns makeMockOAuthAccessor()
            coEvery { factoryProvider.createForHaapi(any(), any(), any()) } returns makeMockHaapiAccessor()

            module.handleInitializeForOAuth(RNHaapiConfigurationRecord())

            assertSuspendingBridgeError(
                block = { module.handleInitializeForHaapi(RNHaapiConfigurationRecord()) },
                expectedCode = HaapiAccessorStore.ERROR_ALREADY_INITIALIZED,
            )

            coVerify(exactly = 0) { factoryProvider.createForHaapi(any(), any(), any()) }
        }

    // endregion

    // region Reservation ordering (HSRN-42)

    /**
     * A failed build must hand the slot back, so the next initialization gets
     * a clean bridge rather than ALREADY_INITIALIZED against a reservation
     * nobody owns any more.
     */
    @Test
    fun `initializeForHaapi after a build failure can initialize again`() =
        runTest {
            val accessor = makeMockHaapiAccessor()
            var firstCall = true
            coEvery { factoryProvider.createForHaapi(any(), any(), any()) } coAnswers {
                if (firstCall) {
                    firstCall = false
                    throw IllegalStateException("boom")
                }
                accessor
            }

            assertSuspendingBridgeError(
                block = { module.handleInitializeForHaapi(RNHaapiConfigurationRecord()) },
                expectedCode = "HAAPI_UNEXPECTED",
            )
            module.handleInitializeForHaapi(RNHaapiConfigurationRecord())

            assertSame("a failed build must not brick the bridge", accessor, store.requireHaapi())
        }

    /**
     * The store-rejection rollback still has a job after HSRN-42. A refused
     * re-init no longer builds anything, but a *rival* initialization can
     * still claim the slot while our build is in flight — and the accessor we
     * built by then must be closed rather than leaked, releasing its native
     * resources (DCR registration, attestation state, etc.).
     */
    @Test
    fun `initializeForHaapi closes the accessor it built when the slot is claimed mid-build`() =
        runTest {
            val losingHaapiManager = mockk<HaapiManager>(relaxed = true)
            val losingAccessor =
                mockk<HaapiAccessor>(relaxed = true) {
                    every { haapiManager } returns losingHaapiManager
                    every { oAuthTokenManager } returns mockk<OAuthTokenManager>(relaxed = true)
                }
            coEvery { factoryProvider.createForHaapi(any(), any(), any()) } coAnswers {
                // A rival init commits while this build runs: close() releases
                // the reservation, then the rival takes the slot for itself.
                store.clear()
                store.setHaapi(makeMockHaapiAccessor())
                losingAccessor
            }

            assertSuspendingBridgeError(
                block = { module.handleInitializeForHaapi(RNHaapiConfigurationRecord()) },
                expectedCode = HaapiAccessorStore.ERROR_ALREADY_INITIALIZED,
            )

            verify(exactly = 1) { losingHaapiManager.close() }
        }

    // endregion

    // region § 11.5 — NOT_INITIALIZED (case 7, 9 + their siblings)

    @Test
    fun `case 7 - start before init throws NOT_INITIALIZED`() =
        runTest {
            assertSuspendingBridgeError(
                block = { module.handleStart() },
                expectedCode = HaapiAccessorStore.ERROR_NOT_INITIALIZED,
            )
        }

    @Test
    fun `submitForm before init throws NOT_INITIALIZED`() =
        runTest {
            assertSuspendingBridgeError(
                block = { module.handleSubmitForm(RNFormActionModelRecord(), emptyMap()) },
                expectedCode = HaapiAccessorStore.ERROR_NOT_INITIALIZED,
            )
        }

    @Test
    fun `followLink before init throws NOT_INITIALIZED`() =
        runTest {
            assertSuspendingBridgeError(
                block = { module.handleFollowLink(RNLinkRecord()) },
                expectedCode = HaapiAccessorStore.ERROR_NOT_INITIALIZED,
            )
        }

    @Test
    fun `case 9 - oauthFetchAccessToken before init throws NOT_INITIALIZED`() =
        runTest {
            assertSuspendingBridgeError(
                block = { module.handleOAuthFetchAccessToken("abc", null) },
                expectedCode = HaapiAccessorStore.ERROR_NOT_INITIALIZED,
            )
        }

    @Test
    fun `oauthRefreshAccessToken before init throws NOT_INITIALIZED`() =
        runTest {
            assertSuspendingBridgeError(
                block = { module.handleOAuthRefreshAccessToken("rt", null) },
                expectedCode = HaapiAccessorStore.ERROR_NOT_INITIALIZED,
            )
        }

    @Test
    fun `oauthRevokeAccessToken before init throws NOT_INITIALIZED`() =
        runTest {
            assertSuspendingBridgeError(
                block = { module.handleOAuthRevokeAccessToken("tok") },
                expectedCode = HaapiAccessorStore.ERROR_NOT_INITIALIZED,
            )
        }

    @Test
    fun `oauthRevokeRefreshToken before init throws NOT_INITIALIZED`() =
        runTest {
            assertSuspendingBridgeError(
                block = { module.handleOAuthRevokeRefreshToken("tok") },
                expectedCode = HaapiAccessorStore.ERROR_NOT_INITIALIZED,
            )
        }

    // endregion

    // region § 11.5 — WRONG_KIND (case 8 + sibling)

    @Test
    fun `case 8 - start after initializeForOAuth throws WRONG_KIND`() =
        runTest {
            // Pre-populate store with OAuth accessor — bypasses init internals,
            // since we only need the store to refuse `requireHaapi`.
            store.setOAuth(FakeOAuthAccessor())

            assertSuspendingBridgeError(
                block = { module.handleStart() },
                expectedCode = HaapiAccessorStore.ERROR_WRONG_KIND,
            )
        }

    @Test
    fun `submitForm after initializeForOAuth throws WRONG_KIND`() =
        runTest {
            store.setOAuth(FakeOAuthAccessor())

            assertSuspendingBridgeError(
                block = { module.handleSubmitForm(RNFormActionModelRecord(), emptyMap()) },
                expectedCode = HaapiAccessorStore.ERROR_WRONG_KIND,
            )
        }

    // endregion

    // region § 11.5 — close semantics (case 10 + variants)

    @Test
    fun `case 10 - close before init is no-op`() {
        module.handleClose()
        // Store remained empty; subsequent init should succeed.
        store.setOAuth(FakeOAuthAccessor())
        assertSame(
            "Empty store should accept setOAuth after close.",
            store.requireOAuth()::class,
            FakeOAuthAccessor::class,
        )
    }

    @Test
    fun `close after initializeForHaapi clears store and bridges and triggers haapiManager close`() =
        runTest {
            val accessor = makeMockHaapiAccessor()
            coEvery { factoryProvider.createForHaapi(any(), any(), any()) } returns accessor
            module.handleInitializeForHaapi(RNHaapiConfigurationRecord())

            module.handleClose()

            assertNull(module.haapiManagerBridge)
            assertNull(module.oauthTokenManagerBridge)
            assertEquals(
                "closeHaapi closure should be invoked once with the stored accessor.",
                listOf(accessor),
                closedAccessors,
            )
        }

    @Test
    fun `close after initializeForOAuth clears store and bridges without invoking closeHaapi`() =
        runTest {
            every { factoryProvider.createForOAuth(any(), any()) } returns makeMockOAuthAccessor()
            module.handleInitializeForOAuth(RNHaapiConfigurationRecord())

            module.handleClose()

            assertNull(module.haapiManagerBridge)
            assertNull(module.oauthTokenManagerBridge)
            assertTrue(
                "closeHaapi must not be invoked for OAuth-only accessors.",
                closedAccessors.isEmpty(),
            )
        }

    // endregion

    // region HSRN-34 — native log valve

    /**
     * Regression for HSRN-34: `OnCreate` installs an [RNLogSink] and sets
     * the level, but the native [HaapiLogger.enabled] valve defaults to
     * `false` in the release driver AAR (it tracks `BuildConfig.DEBUG`).
     * With the valve closed `HaapiLogger.shouldLog(...)` is `false` for
     * every level, so the just-installed sink never fires and JS sees no
     * native SDK logs. `installNativeLogBridge` must open it.
     */
    @Test
    fun `installNativeLogBridge opens the native HaapiLogger valve`() {
        // Simulate the release-AAR default where the valve is closed.
        HaapiLogger.enabled = false

        module.installNativeLogBridge()

        assertTrue(
            "HaapiLogger must be enabled so the installed RNLogSink receives native SDK logs.",
            HaapiLogger.enabled,
        )
        assertTrue(
            "Sensitive values must be masked by default.",
            HaapiLogger.isSensitiveValueMasked,
        )
    }

    /**
     * `configureLogger` is the host's only logging-control entry point and
     * `RNLogLevel` has no "off" value, so it must keep the native valve open
     * (not just forward the level/masking). Were the shared global
     * [HaapiLogger.enabled] ever flipped off, this is the call a host would
     * use to recover — it must not silently no-op. (HSRN-34)
     */
    @Test
    fun `configureLogger keeps the native HaapiLogger valve open and forwards masking`() {
        // Valve closed, masking on — opposite of what the config below requests.
        HaapiLogger.enabled = false
        val configuration =
            RNLoggerConfigurationRecord().apply {
                logLevel = RNLogLevel.DEBUG
                isSensitiveValueMasked = false
            }

        module.handleConfigureLogger(configuration)

        assertTrue(
            "configureLogger must keep the native valve open so the chosen level takes effect.",
            HaapiLogger.enabled,
        )
        assertEquals(
            "configureLogger must forward the requested masking flag.",
            false,
            HaapiLogger.isSensitiveValueMasked,
        )
    }

    // endregion

    // region § 11.5 — Round-trip lifecycle (cases 11, 12)

    @Test
    fun `case 11 - initializeForHaapi then close then initializeForHaapi succeeds`() =
        runTest {
            val accessor1 = makeMockHaapiAccessor()
            val accessor2 = makeMockHaapiAccessor()
            coEvery { factoryProvider.createForHaapi(any(), any(), any()) } returnsMany listOf(accessor1, accessor2)

            module.handleInitializeForHaapi(RNHaapiConfigurationRecord())
            assertSame(accessor1, store.requireHaapi())

            module.handleClose()
            assertNull(module.haapiManagerBridge)

            module.handleInitializeForHaapi(RNHaapiConfigurationRecord())
            assertSame(accessor2, store.requireHaapi())
            assertNotNull(module.haapiManagerBridge)
            assertNotNull(module.oauthTokenManagerBridge)
        }

    @Test
    fun `case 12 - initializeForOAuth then close then initializeForOAuth succeeds`() =
        runTest {
            val accessor1 = makeMockOAuthAccessor()
            val accessor2 = makeMockOAuthAccessor()
            every { factoryProvider.createForOAuth(any(), any()) } returnsMany listOf(accessor1, accessor2)

            module.handleInitializeForOAuth(RNHaapiConfigurationRecord())
            assertSame(accessor1, store.requireOAuth())

            module.handleClose()
            assertNull(module.oauthTokenManagerBridge)

            module.handleInitializeForOAuth(RNHaapiConfigurationRecord())
            assertSame(accessor2, store.requireOAuth())
            assertNull(module.haapiManagerBridge)
            assertNotNull(module.oauthTokenManagerBridge)
        }

    // endregion
}
