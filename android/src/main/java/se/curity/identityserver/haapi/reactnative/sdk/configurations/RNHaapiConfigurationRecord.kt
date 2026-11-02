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
import se.curity.identityserver.haapi.android.driver.ClientAuthenticationMethodConfiguration

/**
 * Top-level configuration record received from JavaScript.
 *
 * Maps to the TypeScript `RNHaapiConfiguration` interface.
 * Fields are deserialized automatically by the Expo Modules bridge.
 */
class RNHaapiConfigurationRecord : Record {
    /** Base URL of the Curity Identity Server (e.g. `"https://idsvr.example.com"`). */
    @Field var baseUrl: String = ""

    /** Token endpoint URL. */
    @Field var tokenEndpointUrl: String = ""

    /** Authorization endpoint URL. */
    @Field var authorizationEndpointUrl: String = ""

    /** Optional revocation endpoint URL. */
    @Field var revocationEndpointUrl: String? = null

    /** Whether to automatically follow redirects during the HAAPI flow. */
    @Field var isAutoRedirect: Boolean = true

    /** Minimum token time-to-live in seconds before proactive refresh. */
    @Field var minTokenTtl: Double = 60.0

    /** Android-specific configuration. */
    @Field var androidConfig: AndroidConfigurationRecord = AndroidConfigurationRecord()

    /** Optional per-platform override of authorization request parameters. */
    @Field var authorizationParameters: RNOAuthAuthorizationParametersRecord? = null

    /** Optional per-platform override of HTTP headers applied to SDK network calls. */
    @Field var httpHeaders: Map<String, String>? = null

    override fun toString(): String =
        JSONObject()
            .put("baseUrl", baseUrl)
            .put("tokenEndpointUrl", tokenEndpointUrl)
            .put("authorizationEndpointUrl", authorizationEndpointUrl)
            .put("revocationEndpointUrl", revocationEndpointUrl)
            .put("isAutoRedirect", isAutoRedirect)
            .put("minTokenTtl", minTokenTtl)
            .put("androidConfig", JSONObject(androidConfig.toString()))
            .put("authorizationParameters", authorizationParameters?.let { JSONObject(it.toString()) })
            .put("httpHeaders", httpHeaders?.let { JSONObject(it) })
            .toString()
}

/**
 * Android-specific configuration record.
 *
 * Maps to the TypeScript `AndroidConfiguration` interface.
 */
class AndroidConfigurationRecord : Record {
    /** Alias for the Android KeyStore entry used by the HAAPI SDK. */
    @Field var keyStoreAlias: String = "default_keystore_alias"

    /** Client identifier registered in the Curity Identity Server. */
    @Field var clientId: String = ""

    /** Redirect URI (deep link) registered for the Android application. */
    @Field var appRedirect: String = ""

    /** Selects the HTTP connection provider implementation. */
    @Field var httpUrlConnectionProviderOption: HttpUrlConnectionProviderOption =
        HttpUrlConnectionProviderOption.DEFAULT

    /** Selects the time provider implementation. */
    @Field var currentTimeMillisProviderOption: CurrentTimeMillisProviderOption =
        CurrentTimeMillisProviderOption.DEFAULT

    /** Attestation configuration. */
    @Field var attestationConfiguration: RNAttestationConfigurationRecord = RNAttestationConfigurationRecord()

    /** Token binding configuration. */
    @Field var tokenBindingConfiguration: AndroidTokenBindingConfigurationRecord? = null

    /**
     * Deprecated `{ keyAlias, keyPairAlgorithmConfiguration, storageOption }` setting, read only when a
     * configuration built without the factories still carries it (the factories map it onto
     * [tokenBindingConfiguration]). See [effectiveTokenBinding].
     */
    @Deprecated(
        "Use tokenBindingConfiguration; read only for configurations built without the factories.",
        ReplaceWith("tokenBindingConfiguration"),
    )
    @Field
    var tokenBoundConfiguration: AndroidTokenBoundConfigurationRecord? = null

    /** Client authentication method configuration. */
    @Field var clientAuthenticationMethodConfiguration: ClientAuthenticationMethodConfigurationRecord =
        ClientAuthenticationMethodConfigurationRecord()

    /** Optional Dynamic Client Registration (DCR) configuration. */
    @Field var dcrConfiguration: AndroidDcrConfigurationRecord? = null

    /** Whether risk assessment is enabled for the authentication flow. */
    @Field var useRiskAssessmentConfiguration: Boolean = false

    /** Selects the token endpoint response listener option. */
    @Field var tokenEndpointResponseListenerOption: TokenEndpointResponseListenerOption =
        TokenEndpointResponseListenerOption.NONE

    override fun toString(): String {
        val clientAuth = JSONObject(clientAuthenticationMethodConfiguration.toString())
        return JSONObject()
            .put("keyStoreAlias", keyStoreAlias)
            .put("clientId", clientId)
            .put("appRedirect", appRedirect)
            .put("httpUrlConnectionProviderOption", httpUrlConnectionProviderOption.value)
            .put("currentTimeMillisProviderOption", currentTimeMillisProviderOption.value)
            .put("attestationConfiguration", JSONObject(attestationConfiguration.toString()))
            .put("tokenBindingConfiguration", tokenBindingConfiguration?.let { JSONObject(it.toString()) })
            .put("clientAuthenticationMethodConfiguration", clientAuth)
            .put("dcrConfiguration", dcrConfiguration?.let { JSONObject(it.toString()) })
            .put("useRiskAssessmentConfiguration", useRiskAssessmentConfiguration)
            .put("tokenEndpointResponseListenerOption", tokenEndpointResponseListenerOption.value)
            .toString()
    }

    /**
     * Resolves the [clientAuthenticationMethodConfiguration] record into a native
     * [ClientAuthenticationMethodConfiguration] ready for the SDK.
     */
    val resolvedClientAuthenticationMethodConfiguration: ClientAuthenticationMethodConfiguration
        get() {
            return clientAuthenticationMethodConfiguration.toClientAuthenticationMethod()
        }
}
