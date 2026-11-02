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
 * Maps to the TypeScript `AndroidTokenBindingConfiguration` discriminated union. [kind] selects the mode;
 * a record without it is rejected at conversion rather than read as "no binding". [keyType],
 * [keyPairAlgorithmConfiguration] and [storageOption] are required when [kind] is [TokenBindingKind.BOUND];
 * [migrateFromLegacyAlias] is optional.
 */
class AndroidTokenBindingConfigurationRecord : Record {
    /** Token-binding mode. */
    @Field var kind: TokenBindingKind? = null

    /** How the device key is protected; maps to the native `DpopKeyPolicy`. */
    @Field var keyType: RNDpopKeyPolicy? = null

    /** Key pair algorithm configuration (algorithm, curve, type). */
    @Field var keyPairAlgorithmConfiguration: KeyPairAlgorithmConfigurationRecord? = null

    /** Keystore alias of a key from an earlier SDK version to adopt; null or blank adopts none. */
    @Field var migrateFromLegacyAlias: String? = null

    /** Selects the persistent storage implementation for token binding data. */
    @Field var storageOption: StorageOption? = null

    override fun toString(): String =
        JSONObject()
            .put("kind", kind?.value)
            .put("keyType", keyType?.value)
            .put("keyPairAlgorithmConfiguration", keyPairAlgorithmConfiguration?.let { JSONObject(it.toString()) })
            .put("migrateFromLegacyAlias", migrateFromLegacyAlias)
            .put("storageOption", storageOption?.value)
            .toString()
}

/**
 * How the token-binding key is protected; values match the TypeScript `DpopKeyPolicy` enum and map to the
 * native `DpopKeyPolicy`.
 */
enum class RNDpopKeyPolicy(
    val value: String,
) : Enumerable {
    /** Hardware-backed key first, software key if the device can't create one. */
    AUTO("auto"),

    /** Hardware-backed key only; the sign-in fails if the device can't create one. */
    HARDWARE("hardware"),

    /** Software key. */
    SOFTWARE("software"),
}

/**
 * Token-binding modes; values match the TypeScript `TokenBindingKind` enum.
 */
enum class TokenBindingKind(
    val value: String,
) : Enumerable {
    /** No token binding. */
    UNBOUND("unbound"),

    /** Token binding with the configured key parameters. */
    BOUND("bound"),
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
    /**
     * Uses the SDK's default storage: the native encrypted store (`StorageBuilder.encrypted`),
     * with values from the plaintext store of earlier SDK versions migrated on open.
     */
    DEFAULT("default"),

    /** Allows injecting a custom `Storage` implementation via `NativeRegistry`. */
    CUSTOM("custom"),
}
