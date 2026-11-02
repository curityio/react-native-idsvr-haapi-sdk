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
import se.curity.identityserver.haapi.reactnative.sdk.internal.CurrentTimeMillisResolver
import se.curity.identityserver.haapi.reactnative.sdk.internal.HttpURLConnectionResolver
import se.curity.identityserver.haapi.reactnative.sdk.internal.RNHttpURLConnectionProvider

/**
 * A thread-safe service locator that holds type-erased [Resolver] instances
 * and provides convenience look-ups for platform-specific dependencies.
 *
 * Host apps can call [addResolver] to register additional resolvers at
 * runtime (e.g., a custom `OkHttpClient` backed by a pinned TLS configuration).
 *
 * All access is guarded by a lock, making the registry safe to read and
 * mutate from any thread or coroutine context.
 */
class NativeRegistry(
    resolvers: List<Resolver<*>> = emptyList(),
) {
    private val resolvers = resolvers.toMutableList()

    /**
     * Inserts a resolver at the front of the registry so it takes
     * priority over previously registered (default) resolvers.
     */
    @Synchronized
    fun addResolver(resolver: Resolver<*>) {
        resolvers.add(0, resolver)
    }

    /**
     * Replaces any previously-registered resolver of the same concrete
     * class with [resolver], or inserts at the front if none exists.
     *
     * Useful for re-registration paths (e.g. the SDK's
     * `registerDefaultResolvers` running on each `initializeForHaapi`/
     * `initializeForOAuth` call) so the registry doesn't grow unbounded
     * with duplicate copies of the same default resolver. Host-app
     * resolvers registered via [addResolver] are untouched as long as
     * they're a different concrete class.
     */
    @Synchronized
    fun replaceResolver(resolver: Resolver<*>) {
        resolvers.removeAll { it::class == resolver::class }
        resolvers.add(0, resolver)
    }

    /**
     * Returns the first resolved value of type [type] for the given [key], or `null`
     * if no registered resolver can provide one.
     */
    @Synchronized
    fun <T : Any> resolve(
        key: String,
        type: Class<T>,
    ): T? {
        for (resolver in resolvers) {
            val result = resolver.resolve(key)
            if (result != null && type.isInstance(result)) {
                return type.cast(result)
            }
        }
        return null
    }

    // region Convenience look-ups

    /** Returns the first [Context] resolved for the given [key], or `null`. */
    fun applicationContext(key: String): Context? = resolve(key, Context::class.java)

    /** Returns the first [RNStorage] resolved for the given [key], or `null`. */
    fun storage(key: String): RNStorage? = resolve(key, RNStorage::class.java)

    /** Returns the first [RNHttpURLConnectionProvider] resolved for the given [key], or `null`. */
    fun httpURLConnectionProvider(key: String): RNHttpURLConnectionProvider? =
        resolve(key, RNHttpURLConnectionProvider::class.java)

    /** Returns the first [CurrentTimeMillisProvider] resolved for the given [key], or `null`. */
    fun currentTimeMillisProvider(key: String): CurrentTimeMillisProvider? =
        resolve(key, CurrentTimeMillisProvider::class.java)

    /** Returns the first [KeyStore][java.security.KeyStore] resolved for the given [key], or `null`. */
    fun keyStore(key: String): java.security.KeyStore? = resolve(key, java.security.KeyStore::class.java)

    // endregion

    companion object {
        val shared =
            NativeRegistry(
                listOf(
                    HttpURLConnectionResolver(),
                    CurrentTimeMillisResolver(),
                ),
            )
    }
}
