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

import se.curity.identityserver.haapi.android.driver.Storage
import se.curity.identityserver.haapi.reactnative.sdk.RNStorage

class NativeStorageAdapter(private val storage: Storage) : RNStorage {
    override fun delete(key: String) = storage.delete(key)
    override fun get(key: String): String? = storage.get(key)
    override fun getAll(): Map<String, String> = storage.getAll()
    override fun set(value: String, key: String) = storage.set(value, key)
}
