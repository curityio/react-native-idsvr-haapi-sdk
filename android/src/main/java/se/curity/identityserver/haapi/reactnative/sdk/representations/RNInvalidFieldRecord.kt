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
 * An invalid field reported by an invalid input problem.
 *
 * Maps to the TypeScript `InvalidField` interface.
 */
class RNInvalidFieldRecord : Record {
    /** The name of the invalid field. */
    @Field var name: String = ""

    /** Machine-readable reason for invalidity. */
    @Field var reason: String? = null

    /** Human-readable error detail message. */
    @Field var detail: RNMessageRecord = RNMessageRecord()

    override fun toString(): String =
        buildRecordString("RNInvalidFieldRecord") {
            put("name", name)
            put("reason", reason)
            put("detail", JSONObject(detail.toString()))
        }
}
