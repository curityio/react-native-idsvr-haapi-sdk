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
package se.curity.identityserver.haapi.reactnative.sdk.configurations

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.Enumerable
import org.json.JSONObject

/**
 * Android-specific token binding configuration record.
 *
 * Maps to the TypeScript `AndroidTokenBoundConfiguration` interface.
 */
class AndroidTokenBoundConfigurationRecord : Record {
    /** Alias for the key pair used for token binding in the Android KeyStore. */
    @Field var keyAlias: String = "haapi_token_bound_key"

    /** Key pair algorithm configuration (algorithm, curve, type). */
    @Field var keyPairAlgorithmConfiguration: KeyPairAlgorithmConfigurationRecord =
        KeyPairAlgorithmConfigurationRecord()

    /** Selects the persistent storage implementation for token binding data. */
    @Field var storageOption: StorageOption = StorageOption.DEFAULT

    override fun toString(): String =
        JSONObject()
            .put("keyAlias", keyAlias)
            .put("keyPairAlgorithmConfiguration", JSONObject(keyPairAlgorithmConfiguration.toString()))
            .put("storageOption", storageOption.value)
            .toString()
}

/**
 * Key pair algorithm configuration record.
 *
 * Maps to the TypeScript `KeyPairAlgorithmConfiguration` interface.
 */
class KeyPairAlgorithmConfigurationRecord : Record {
    /** JWT algorithm identifier (e.g. `"ES256"`). Mapped to `KeyPairAlgorithmConfig` on the native side. */
    @Field var jwtAlgorithm: String = "ES256"

    /** Elliptic curve name (e.g. `"secp256r1"`). */
    @Field var curve: String = "secp256r1"

    /** Key algorithm type (e.g. `"EC"` for elliptic curve). */
    @Field var algorithmType: String = "EC"

    override fun toString(): String =
        JSONObject()
            .put("jwtAlgorithm", jwtAlgorithm)
            .put("curve", curve)
            .put("algorithmType", algorithmType)
            .toString()
}

/**
 * Storage strategy for token binding key material on Android.
 *
 * Maps to the TypeScript `StorageOption` enum.
 */
enum class StorageOption(
    val value: String,
) : Enumerable {
    /** Uses the SDK's default `SharedPreferences`-backed storage. */
    DEFAULT("default"),

    /** Allows injecting a custom `Storage` implementation via `NativeRegistry`. */
    CUSTOM("custom"),
}
