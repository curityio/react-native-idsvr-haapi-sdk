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

import android.os.Parcel
import se.curity.identityserver.haapi.android.driver.Storage

/**
 * Proxy interface for persistent storage used by the HAAPI SDK for token binding.
 *
 * Implement this interface to provide custom storage and register it via a
 * custom [Resolver] in [NativeRegistry.shared].
 */
interface RNStorage {
    /** Deletes the value associated with [key]. */
    fun delete(key: String)

    /** Returns the value associated with [key], or `null` if not found. */
    fun get(key: String): String?

    /** Returns all stored key–value pairs. */
    fun getAll(): Map<String, String>

    /** Stores [value] under the given [key]. */
    fun set(
        value: String,
        key: String,
    )
}

internal fun RNStorage.toStorage(): Storage =
    object : Storage {
        override fun set(
            value: String,
            key: String,
        ) = this@toStorage.set(value, key)

        override fun get(key: String): String? = this@toStorage.get(key)

        override fun delete(key: String) = this@toStorage.delete(key)

        override fun getAll(): Map<String, String> = this@toStorage.getAll()

        override fun describeContents(): Int = 0

        override fun writeToParcel(
            p0: Parcel,
            p1: Int,
        ) {
            // Proxy-backed storage; nothing to parcel.
        }
    }
