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

import android.content.Context
import android.content.SharedPreferences
import android.os.Parcel
import se.curity.identityserver.haapi.android.driver.Storage
import se.curity.identityserver.haapi.reactnative.sdk.RNStorage
import se.curity.identityserver.haapi.reactnative.sdk.Resolver
import se.curity.identityserver.haapi.reactnative.sdk.configurations.StorageOption

internal class StorageResolver(
    context: Context,
) : Resolver<RNStorage> {
    private val defaultInstance = DefaultStorage(context)

    override fun resolve(key: String): RNStorage? =
        if (key == StorageOption.DEFAULT.value) {
            defaultInstance
        } else {
            null
        }
}

/**
 * Default [SharedPreferences]-based implementation of the HAAPI SDK [Storage] interface.
 *
 * Used when `storageOption` is set to `"default"` in the TypeScript configuration.
 */
private class DefaultStorage(
    context: Context,
    name: String = "haapi_token_bound_storage",
) : RNStorage {
    private val prefs: SharedPreferences =
        context.getSharedPreferences(
            name,
            Context.MODE_PRIVATE,
        )

    override fun delete(key: String) {
        prefs.edit().remove(key).apply()
    }

    override fun get(key: String): String? = prefs.getString(key, null)

    override fun getAll(): Map<String, String> =
        prefs.all.filterValues { it is String }.mapValues { it.value as String }

    override fun set(
        value: String,
        key: String,
    ) {
        prefs.edit().putString(key, value).apply()
    }
}
