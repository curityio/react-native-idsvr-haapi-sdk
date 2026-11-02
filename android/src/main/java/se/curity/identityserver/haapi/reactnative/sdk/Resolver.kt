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

/**
 * A type that can resolve a dependency for a given string key.
 *
 * Conforming types declare the concrete [T] they provide and return
 * `null` when the key is unrecognised or unsupported.
 *
 * Resolvers are stored as type-erased `Resolver<*>` in [NativeRegistry],
 * which iterates them and casts the result to the expected type at the call site.
 */
interface Resolver<T> {
    /**
     * Returns the resolved item for [key], or `null` if this resolver
     * cannot handle the given key.
     */
    fun resolve(key: String): T?
}
