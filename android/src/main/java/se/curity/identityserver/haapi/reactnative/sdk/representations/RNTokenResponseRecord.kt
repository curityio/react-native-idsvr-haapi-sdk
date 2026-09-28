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
package se.curity.identityserver.haapi.reactnative.sdk.representations

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/**
 * An OAuth 2.0 token response.
 *
 * Maps to the TypeScript `TokenResponse` discriminated union.
 * The [responseType] field is the discriminator: "success" or "error".
 */
class RNTokenResponseRecord : Record {
    /**
     * Discriminator: [RNTokenResponseType.SUCCESS] or
     * [RNTokenResponseType.ERROR]. Serialised to the wire as the raw
     * string ("success" / "error") that host TS code switches on.
     */
    @Field var responseType: RNTokenResponseType = RNTokenResponseType.SUCCESS

    // SuccessfulTokenResponse fields

    /** The access token string. */
    @Field var accessToken: String? = null

    /** The token type (e.g., "bearer"). */
    @Field var tokenType: String? = null

    /** The granted scope. */
    @Field var scope: String? = null

    /**
     * Token lifetime in seconds. Optional — populated only on the success
     * branch (the error branch has no spec field for it).
     */
    @Field var expiresIn: Double? = null

    /** The refresh token, if issued. */
    @Field var refreshToken: String? = null

    /** The OpenID Connect ID token, if issued. */
    @Field var idToken: String? = null

    // ErrorTokenResponse fields

    /** The error code. */
    @Field var error: String? = null

    /** Optional human-readable error description. */
    @Field var errorDescription: String? = null

    /** Optional URI for additional error information. */
    @Field var errorUri: String? = null

    override fun toString(): String =
        buildRecordString("RNTokenResponseRecord") {
            put("responseType", responseType)
            put("accessToken", accessToken)
            put("tokenType", tokenType)
            put("scope", scope)
            put("expiresIn", expiresIn)
            put("refreshToken", refreshToken)
            put("idToken", idToken)
            put("error", error)
            put("errorDescription", errorDescription)
            put("errorUri", errorUri)
        }
}
