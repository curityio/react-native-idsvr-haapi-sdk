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
 * Android Dynamic Client Registration configuration record.
 *
 * Maps to the TypeScript `AndroidDcrConfiguration` interface
 * (which extends `DcrConfiguration`).
 */
class AndroidDcrConfigurationRecord : Record {
    /** A template client ID used as a base when registering a new dynamic client. */
    @Field var templateClientId: String = ""

    /** The DCR endpoint URL on the Curity Identity Server. */
    @Field var clientRegistrationEndpointUrl: String = ""

    /** Selects the Android application context provider for DCR operations. */
    @Field var contextOption: ApplicationContextOption = ApplicationContextOption.DEFAULT

    override fun toString(): String =
        JSONObject()
            .put("templateClientId", templateClientId)
            .put("clientRegistrationEndpointUrl", clientRegistrationEndpointUrl)
            .put("contextOption", contextOption.value)
            .toString()
}

/**
 * Selects the application context provider for Android DCR operations.
 *
 * Maps to the TypeScript `ApplicationContextOption` enum.
 */
enum class ApplicationContextOption(
    val value: String,
) : Enumerable {
    /** Uses the application context provided by the Expo module runtime. */
    DEFAULT("default"),

    /** Allows injecting a custom application context via `NativeRegistry`. */
    CUSTOM("custom"),
}
