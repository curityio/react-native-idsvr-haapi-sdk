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

// From the how-to "Migrate an Android app to React Native", as published, with TokenBindingStorageMigration.

import android.content.Context
import se.curity.identityserver.haapi.reactnative.sdk.NativeRegistry
import se.curity.identityserver.haapi.reactnative.sdk.RNStorage
import se.curity.identityserver.haapi.reactnative.sdk.Resolver
import se.curity.identityserver.haapi.reactnative.sdk.configurations.StorageOption

class MigratingStorageResolver(
    private val context: Context,
    private val previous: RNStorage,
) : Resolver<RNStorage> {
    override fun resolve(key: String): RNStorage? =
        when {
            key != StorageOption.CUSTOM.value -> null
            TokenBindingStorageMigration.useDefaultStorage(context) ->
                NativeRegistry.shared.storage(StorageOption.DEFAULT.value)
            else -> previous
        }
}
