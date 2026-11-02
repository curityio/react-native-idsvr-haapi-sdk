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
 * Step-specific properties attached to a HAAPI representation.
 *
 * Maps to the TypeScript `Properties` discriminated union.
 * The [kind] field is the discriminator: "generic", "oauthAuthorizationResponse", or "polling".
 */
class RNPropertiesRecord : Record {
    /** Discriminator: "generic", "oauthAuthorizationResponse", or "polling". */
    @Field var kind: String = "generic"

    // Generic properties

    /** The raw JSON string of the properties object. */
    @Field var rawJsonString: String? = null

    // OAuth authorization response properties

    /** The authorization code. */
    @Field var code: String? = null

    /** The OpenID Connect ID token. */
    @Field var idToken: String? = null

    /** The granted scope. */
    @Field var scope: String? = null

    /** The OAuth state parameter. */
    @Field var state: String? = null

    // Polling properties

    /** Description of who/what is being communicated with. */
    @Field var recipientOfCommunication: String? = null

    /** Current polling status ("pending", "done", "failed"). */
    @Field var status: RNPollingStatus? = null

    /** The amount of time in milliseconds that the client should wait between polling requests. */
    @Field var interval: String? = null

    /** Maximum wait time. */
    @Field var maxWaitTime: String? = null

    /** Remaining wait time. */
    @Field var maxWaitRemainingTime: String? = null

    override fun toString(): String =
        buildRecordString("RNPropertiesRecord") {
            put("kind", kind)
            put("rawJsonString", rawJsonString)
            put("code", code)
            put("idToken", idToken)
            put("scope", scope)
            put("state", state)
            put("recipientOfCommunication", recipientOfCommunication)
            put("status", status)
            put("interval", interval)
            put("maxWaitTime", maxWaitTime)
            put("maxWaitRemainingTime", maxWaitRemainingTime)
        }
}
