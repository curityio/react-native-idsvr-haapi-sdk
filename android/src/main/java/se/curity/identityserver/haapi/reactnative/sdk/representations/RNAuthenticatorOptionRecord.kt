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
import org.json.JSONObject

/**
 * An authenticator option within an authenticator selector step.
 *
 * Maps to the TypeScript `AuthenticatorOption` interface.
 */
class RNAuthenticatorOptionRecord : Record {
    /** Display title for the authenticator. */
    @Field var title: RNMessageRecord = RNMessageRecord()

    /** Authenticator type identifier (e.g., "html-form", "bankid"). */
    @Field var type: String? = null

    /** The action to select this authenticator. */
    @Field var action: RNActionRecord = RNActionRecord()

    override fun toString(): String =
        buildRecordString("RNAuthenticatorOptionRecord") {
            put("title", JSONObject(title.toString()))
            put("type", type)
            put("action", JSONObject(action.toString()))
        }
}
