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
import org.json.JSONArray
import org.json.JSONObject

/**
 * OAuth authorization parameters record.
 *
 * Maps to the TypeScript `OAuthAuthorizationParameters` interface.
 * All fields are optional and default to null.
 */
class RNOAuthAuthorizationParametersRecord : Record {
    /** OAuth scopes to request. */
    @Field var scope: List<String>? = null

    /** Optional nonce value for OpenID Connect flows. */
    @Field var nonce: String? = null

    /** Optional Authentication Context Class Reference values. */
    @Field var acrValues: List<String>? = null

    /** Additional custom authorization request parameters. */
    @Field var extraRequestParameters: Map<String, String>? = null

    override fun toString(): String =
        JSONObject()
            .put("scope", scope?.let { JSONArray(it) })
            .put("nonce", nonce)
            .put("acrValues", acrValues?.let { JSONArray(it) })
            .put("extraRequestParameters", extraRequestParameters?.let { JSONObject(it) })
            .toString()
}
