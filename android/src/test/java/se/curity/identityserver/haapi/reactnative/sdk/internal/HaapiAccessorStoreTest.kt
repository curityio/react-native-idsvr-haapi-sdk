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

import android.os.Parcel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.fail
import org.junit.Test
import se.curity.identityserver.haapi.android.sdk.HaapiAccessor
import se.curity.identityserver.haapi.android.sdk.HaapiManager
import se.curity.identityserver.haapi.android.sdk.OAuthAccessor
import se.curity.identityserver.haapi.android.sdk.OAuthTokenManager
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

// region Fakes
//
// HaapiAccessor / OAuthAccessor are interfaces in the native SDK. We can implement
// them in tests, but the underlying HaapiManager and OAuthTokenManager are concrete
// classes with `internal` constructors — we cannot instantiate them here. The store
// never reads `haapiManager` / `oAuthTokenManager` itself (the close-on-clear path
// runs through the injected `closeHaapi` closure), so throwing when those getters
// are touched is the right failure mode for unit tests.

private class FakeHaapiAccessor : HaapiAccessor {
    override val haapiManager: HaapiManager
        get() = throw UnsupportedOperationException(
            "FakeHaapiAccessor.haapiManager is not available in JVM unit tests.",
        )
    override val oAuthTokenManager: OAuthTokenManager
        get() = throw UnsupportedOperationException(
            "FakeHaapiAccessor.oAuthTokenManager is not available in JVM unit tests.",
        )

    override fun describeContents(): Int = 0

    override fun writeToParcel(
        dest: Parcel,
        flags: Int,
    ) = throw UnsupportedOperationException(
        "FakeHaapiAccessor is not intended to be parcelized.",
    )
}

private class FakeOAuthAccessor : OAuthAccessor {
    override val oAuthTokenManager: OAuthTokenManager
        get() = throw UnsupportedOperationException(
            "FakeOAuthAccessor.oAuthTokenManager is not available in JVM unit tests.",
        )

    override fun describeContents(): Int = 0

    override fun writeToParcel(
        dest: Parcel,
        flags: Int,
    ) = throw UnsupportedOperationException(
        "FakeOAuthAccessor is not intended to be parcelized.",
    )
}

// endregion

class HaapiAccessorStoreTest {
    // region Happy-path

    @Test
    fun setHaapiThenRequireHaapiReturnsSameInstance() {
        val store = HaapiAccessorStore(closeHaapi = {})
        val accessor = FakeHaapiAccessor()

        store.setHaapi(accessor)

        assertSame(accessor, store.requireHaapi())
    }

    @Test
    fun setOAuthThenRequireOAuthReturnsSameInstance() {
        val store = HaapiAccessorStore(closeHaapi = {})
        val accessor = FakeOAuthAccessor()

        store.setOAuth(accessor)

        assertSame(accessor, store.requireOAuth())
    }

    @Test
    fun setHaapiThenRequireOAuthSucceedsBecauseHaapiAccessorIsAnOAuthAccessor() {
        val store = HaapiAccessorStore(closeHaapi = {})
        val accessor = FakeHaapiAccessor()

        store.setHaapi(accessor)

        assertSame(accessor, store.requireOAuth())
    }

    @Test
    fun setOAuthThenRequireHaapiThrowsWrongKind() {
        val store = HaapiAccessorStore(closeHaapi = {})
        store.setOAuth(FakeOAuthAccessor())

        val ex =
            assertThrows(HaapiAccessorStore.StoreException::class.java) {
                store.requireHaapi()
            }

        assertEquals(HaapiAccessorStore.ERROR_WRONG_KIND, ex.code)
    }

    // endregion

    // region Already-initialized errors

    @Test
    fun setHaapiTwiceWithoutClearThrowsAlreadyInitialized() {
        val store = HaapiAccessorStore(closeHaapi = {})
        store.setHaapi(FakeHaapiAccessor())

        val ex =
            assertThrows(HaapiAccessorStore.StoreException::class.java) {
                store.setHaapi(FakeHaapiAccessor())
            }

        assertEquals(HaapiAccessorStore.ERROR_ALREADY_INITIALIZED, ex.code)
    }

    @Test
    fun setOAuthAfterSetHaapiWithoutClearThrowsAlreadyInitialized() {
        val store = HaapiAccessorStore(closeHaapi = {})
        store.setHaapi(FakeHaapiAccessor())

        val ex =
            assertThrows(HaapiAccessorStore.StoreException::class.java) {
                store.setOAuth(FakeOAuthAccessor())
            }

        assertEquals(HaapiAccessorStore.ERROR_ALREADY_INITIALIZED, ex.code)
    }

    @Test
    fun setHaapiAfterSetOAuthWithoutClearThrowsAlreadyInitialized() {
        val store = HaapiAccessorStore(closeHaapi = {})
        store.setOAuth(FakeOAuthAccessor())

        val ex =
            assertThrows(HaapiAccessorStore.StoreException::class.java) {
                store.setHaapi(FakeHaapiAccessor())
            }

        assertEquals(HaapiAccessorStore.ERROR_ALREADY_INITIALIZED, ex.code)
    }

    // endregion

    // region Not-initialized errors

    @Test
    fun requireHaapiOnEmptyStoreThrowsNotInitialized() {
        val store = HaapiAccessorStore(closeHaapi = {})

        val ex =
            assertThrows(HaapiAccessorStore.StoreException::class.java) {
                store.requireHaapi()
            }

        assertEquals(HaapiAccessorStore.ERROR_NOT_INITIALIZED, ex.code)
    }

    @Test
    fun requireOAuthOnEmptyStoreThrowsNotInitialized() {
        val store = HaapiAccessorStore(closeHaapi = {})

        val ex =
            assertThrows(HaapiAccessorStore.StoreException::class.java) {
                store.requireOAuth()
            }

        assertEquals(HaapiAccessorStore.ERROR_NOT_INITIALIZED, ex.code)
    }

    // endregion

    // region Lifecycle

    @Test
    fun clearOnEmptyStoreIsNoOp() {
        val store = HaapiAccessorStore(closeHaapi = { fail("closeHaapi must not run on an empty store") })

        store.clear() // must not throw
    }

    @Test
    fun clearAfterSetHaapiInvokesCloseHaapiAndAllowsReinit() {
        val closeCount = AtomicInteger(0)
        val store = HaapiAccessorStore(closeHaapi = { closeCount.incrementAndGet() })
        val first = FakeHaapiAccessor()
        val second = FakeHaapiAccessor()

        store.setHaapi(first)
        store.clear()

        assertEquals(1, closeCount.get())

        // Re-init must succeed now that the store is empty.
        store.setHaapi(second)
        assertSame(second, store.requireHaapi())
    }

    @Test
    fun clearAfterSetOAuthDoesNotInvokeCloseHaapi() {
        val closeCount = AtomicInteger(0)
        val store = HaapiAccessorStore(closeHaapi = { closeCount.incrementAndGet() })
        store.setOAuth(FakeOAuthAccessor())

        store.clear()

        assertEquals("OAuth-only path has no HaapiManager to close", 0, closeCount.get())
    }

    @Test
    fun clearLetsTheStoreSwitchModes() {
        val store = HaapiAccessorStore(closeHaapi = {})
        store.setHaapi(FakeHaapiAccessor())
        store.clear()

        // Mode switch is permitted only after clear().
        store.setOAuth(FakeOAuthAccessor())
    }

    // endregion

    // region Lock-release ordering

    /**
     * `clear()` must snapshot and null `current` **before** invoking
     * `closeHaapi`. From inside the callback, the store should already
     * report itself as empty.
     *
     * This guards two related properties:
     *   1. The callback never sees the accessor it's about to close also
     *      reachable through `requireHaapi()` — no double-close opportunity.
     *   2. The store's monitor is released before `closeHaapi` fires, so a
     *      re-entrant callback (or an SDK callback that itself acquires
     *      another lock) won't deadlock against the store.
     */
    @Test
    fun clearCallbackSeesEmptyStoreBeforeClosingHaapi() {
        var observedRequireException: HaapiAccessorStore.StoreException? = null
        lateinit var store: HaapiAccessorStore
        store =
            HaapiAccessorStore(
                closeHaapi = { _ ->
                    try {
                        store.requireHaapi()
                    } catch (e: HaapiAccessorStore.StoreException) {
                        observedRequireException = e
                    }
                },
            )
        store.setHaapi(FakeHaapiAccessor())

        store.clear()

        assertEquals(
            "closeHaapi callback must observe the store as already empty",
            HaapiAccessorStore.ERROR_NOT_INITIALIZED,
            observedRequireException?.code,
        )
    }

    /**
     * A re-entrant `setHaapi` call from inside `closeHaapi` must succeed —
     * proving the store's monitor was released before the callback fired
     * (Java monitors are reentrant so this isn't strictly deadlock-prone,
     * but the test pins the contract that the callback runs **after**
     * `current` has been nulled, leaving the store ready for immediate
     * re-init).
     */
    @Test
    fun clearCallbackCanReinitTheStore() {
        val replacementAccessor = FakeHaapiAccessor()
        lateinit var store: HaapiAccessorStore
        store =
            HaapiAccessorStore(
                closeHaapi = { _ ->
                    // Re-init from inside the close callback would either
                    // deadlock (on a non-reentrant lock) or corrupt state
                    // (callback observing the still-stored accessor) if the
                    // monitor were held across the callback.
                    store.setHaapi(replacementAccessor)
                },
            )
        store.setHaapi(FakeHaapiAccessor())

        store.clear()

        assertSame(
            "Re-init from inside closeHaapi must take effect",
            replacementAccessor,
            store.requireHaapi(),
        )
    }

    // endregion

    // region Concurrency smoke test

    @Test
    fun concurrentSetAndClearDoesNotDeadlockOrCorruptState() {
        val store = HaapiAccessorStore(closeHaapi = {})
        val iterations = 1000
        val executor = Executors.newFixedThreadPool(8)
        val latch = CountDownLatch(iterations)

        repeat(iterations) { i ->
            executor.submit {
                try {
                    if (i % 2 == 0) {
                        try {
                            store.setHaapi(FakeHaapiAccessor())
                        } catch (_: HaapiAccessorStore.StoreException) {
                            // already-initialized races are expected here
                        }
                    } else {
                        store.clear()
                    }
                } finally {
                    latch.countDown()
                }
            }
        }

        latch.await()
        executor.shutdown()
        // Reaching here without a crash or deadlock is the assertion.
        // Final state must be consistent — either empty or holding one accessor.
        store.clear()
    }

    // endregion
}
