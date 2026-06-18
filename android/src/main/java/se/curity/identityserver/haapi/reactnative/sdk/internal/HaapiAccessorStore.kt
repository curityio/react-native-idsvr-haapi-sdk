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

import se.curity.identityserver.haapi.android.sdk.HaapiAccessor
import se.curity.identityserver.haapi.android.sdk.HaapiManagerAccessor
import se.curity.identityserver.haapi.android.sdk.OAuthAccessor

/**
 * Thread-safe singleton that owns the currently-active [HaapiManagerAccessor].
 *
 * The store is the single source of truth for "is the bridge initialized?".
 * It is written by `initializeForHaapi` / `initializeForOAuth` / `close` on
 * the Expo module, and read by every flow / OAuth bridge method to obtain
 * the current accessor. Access is guarded by `@Synchronized`, mirroring the
 * thread-safety pattern used by [se.curity.identityserver.haapi.reactnative.sdk.NativeRegistry].
 *
 * The [closeHaapi] constructor parameter is an injection point so tests can
 * observe the close-on-clear behavior without constructing a real native
 * [se.curity.identityserver.haapi.android.sdk.HaapiManager] (whose constructor
 * is internal to the HAAPI SDK). Production code uses the default closure,
 * which delegates to `haapiManager.close()` as specified by HSRN-8 § 7.
 */
internal class HaapiAccessorStore(
    private val closeHaapi: (HaapiAccessor) -> Unit = { it.haapiManager.close() },
) {
    /**
     * Stable error codes surfaced to JS via `error.code`. These must stay
     * backwards-compatible once shipped. Follow-up structured-error work
     * extends this taxonomy.
     */
    companion object {
        const val ERROR_ALREADY_INITIALIZED = "HAAPI_ACCESSOR_ALREADY_INITIALIZED"
        const val ERROR_NOT_INITIALIZED = "HAAPI_ACCESSOR_NOT_INITIALIZED"
        const val ERROR_WRONG_KIND = "HAAPI_ACCESSOR_WRONG_KIND"

        /**
         * Raised by the flow bridge when a `submitForm` / `followLink`
         * record can't be matched to a cached native model — typically
         * because the host kept a `FormAction` / `Link` from a previous
         * accessor lifecycle (after `close()` or before re-init).
         */
        const val ERROR_FLOW_CACHE_MISS = "HAAPI_FLOW_CACHE_MISS"

        /** Process-wide singleton. Tests should construct their own instance. */
        internal val shared = HaapiAccessorStore()
    }

    /**
     * Errors thrown by the store. The stable [code] on each instance is what
     * the Expo module forwards to JS so callers can branch on `error.code`.
     *
     * The optional [cause] preserves any wrapped underlying [Throwable] so
     * stack traces survive the wrap — useful when the bridge layer wraps a
     * downstream failure (e.g. an SDK or runtime exception) in a stable
     * code rather than swallowing it.
     */
    class StoreException(
        val code: String,
        message: String,
        cause: Throwable? = null,
    ) : Exception(message, cause)

    private var current: HaapiManagerAccessor? = null

    /**
     * Stores a full-flow [HaapiAccessor].
     *
     * @throws StoreException with code [ERROR_ALREADY_INITIALIZED] if the
     *   store already holds an accessor. Callers must invoke [clear] first.
     */
    @Synchronized
    fun setHaapi(accessor: HaapiAccessor) {
        if (current != null) {
            throw StoreException(
                ERROR_ALREADY_INITIALIZED,
                "HaapiAccessor already initialized. Call close() before re-initializing.",
            )
        }
        current = accessor
    }

    /**
     * Stores a token-management-only [OAuthAccessor].
     *
     * @throws StoreException with code [ERROR_ALREADY_INITIALIZED] if the
     *   store already holds an accessor. Callers must invoke [clear] first.
     */
    @Synchronized
    fun setOAuth(accessor: OAuthAccessor) {
        if (current != null) {
            throw StoreException(
                ERROR_ALREADY_INITIALIZED,
                "OAuthAccessor already initialized. Call close() before re-initializing.",
            )
        }
        current = accessor
    }

    /**
     * Returns the current accessor as a [HaapiAccessor] (the full-flow kind).
     *
     * @throws StoreException with code [ERROR_NOT_INITIALIZED] if the store is empty.
     * @throws StoreException with code [ERROR_WRONG_KIND] if the store holds an
     *   OAuth-only accessor.
     */
    @Synchronized
    fun requireHaapi(): HaapiAccessor {
        val snapshot =
            current
                ?: throw StoreException(
                    ERROR_NOT_INITIALIZED,
                    "Bridge not initialized. Call initializeForHaapi() first.",
                )
        return snapshot as? HaapiAccessor
            ?: throw StoreException(
                ERROR_WRONG_KIND,
                "Bridge is in OAuth-only mode. Call close() and initializeForHaapi() to run HAAPI flow methods.",
            )
    }

    /**
     * Returns the current accessor as an [OAuthAccessor]. Succeeds for both
     * [HaapiAccessor] (which extends [OAuthAccessor]) and plain
     * [OAuthAccessor].
     *
     * @throws StoreException with code [ERROR_NOT_INITIALIZED] if the store is empty.
     */
    @Synchronized
    fun requireOAuth(): OAuthAccessor {
        val snapshot =
            current
                ?: throw StoreException(
                    ERROR_NOT_INITIALIZED,
                    "Bridge not initialized. Call initializeForHaapi() or initializeForOAuth() first.",
                )
        // Every value reachable here was set via `setHaapi(HaapiAccessor)`
        // (which extends `OAuthAccessor`) or `setOAuth(OAuthAccessor)` —
        // both branches of the kind discriminator land on `OAuthAccessor`,
        // so the unchecked cast is safe. There is no `WRONG_KIND` outcome
        // for `requireOAuth` (it's the catch-all read).
        return snapshot as OAuthAccessor
    }

    /**
     * Closes the underlying [se.curity.identityserver.haapi.android.sdk.HaapiManager]
     * (only if the stored accessor is a [HaapiAccessor]) and drops the reference.
     * Safe to call when the store is empty. Safe for [OAuthAccessor] — nothing to close.
     *
     * The monitor is released **before** [closeHaapi] runs: the synchronized
     * block snapshots and nulls [current], then exits, and only then does
     * the close callback fire. This avoids holding the store's monitor
     * across an SDK callback that may itself acquire other locks (or, in
     * the future, call back into the store) — which would otherwise risk
     * a lock-ordering deadlock.
     */
    fun clear() {
        val snapshot =
            synchronized(this) {
                val s = current
                current = null
                s
            }
        if (snapshot is HaapiAccessor) {
            closeHaapi(snapshot)
        }
    }
}
