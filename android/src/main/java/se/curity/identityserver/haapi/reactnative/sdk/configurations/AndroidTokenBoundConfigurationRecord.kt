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
import org.json.JSONObject

/**
 * The deprecated `tokenBoundConfiguration` setting, in its released shape
 * (`{ keyAlias, keyPairAlgorithmConfiguration, storageOption }`).
 *
 * Read only for configurations built without the factories, which map it onto
 * [AndroidTokenBindingConfigurationRecord]. Removed with the setting in the next major version.
 */
class AndroidTokenBoundConfigurationRecord : Record {
    /** Keystore alias of the key the released SDK created; adopted by the binding. */
    @Field var keyAlias: String? = null

    /** Key pair algorithm configuration (algorithm, curve, type). */
    @Field var keyPairAlgorithmConfiguration: KeyPairAlgorithmConfigurationRecord? = null

    /** Selects the persistent storage implementation for token binding data. */
    @Field var storageOption: StorageOption? = null

    override fun toString(): String =
        JSONObject()
            .put("keyAlias", keyAlias)
            .put("keyPairAlgorithmConfiguration", keyPairAlgorithmConfiguration?.let { JSONObject(it.toString()) })
            .put("storageOption", storageOption?.value)
            .toString()
}
