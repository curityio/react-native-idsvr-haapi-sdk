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
package se.curity.identityserver.haapi.reactnative.sdk.example.e2e

import android.content.Context
import se.curity.identityserver.haapi.reactnative.sdk.RNStorage

/**
 * The app's existing token-binding store, the one the migration how-to moves out of — standing
 * in for an integrator's `AccountManager`-backed store.
 *
 * TEST ONLY — DO NOT COPY. It keeps key material in private preferences in clear, which a real
 * store must never do. Integrators keep their own existing store; only the recipe files in this
 * module (`TokenBindingStorageMigration`, `MigratingStorageResolver`, `NativeStorageAdapter`) are
 * the how-to's code.
 */
class E2eExistingStore(
    context: Context,
) : RNStorage {
    private val prefs = context.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    override fun delete(key: String) {
        prefs.edit().remove(key).commit()
    }

    override fun get(key: String): String? = prefs.getString(key, null)

    override fun getAll(): Map<String, String> =
        prefs.all.filterValues { it is String }.mapValues { it.value as String }

    override fun set(
        value: String,
        key: String,
    ) {
        prefs.edit().putString(key, value).commit()
    }

    private companion object {
        const val NAME = "e2e_existing_token_binding_store"
    }
}
