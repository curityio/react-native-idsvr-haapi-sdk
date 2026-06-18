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
 * The top-level response from a HAAPI operation.
 *
 * Maps to the TypeScript `HaapiResponse` discriminated union.
 * The [responseCategory] field is the discriminator: "representation" or "problem".
 * Flow failures are surfaced as thrown `HaapiError` values, not as
 * response variants.
 */
class RNHaapiResponseRecord : Record {
    /** Discriminator: "representation" or "problem". */
    @Field var responseCategory: RNResponseCategory = RNResponseCategory.REPRESENTATION

    /** The typed representation step (present when [responseCategory] is "representation"). */
    @Field var representation: RNHaapiRepresentationRecord? = null

    /** The typed problem representation (present when [responseCategory] is "problem"). */
    @Field var problem: RNProblemRepresentationRecord? = null

    override fun toString(): String =
        buildRecordString("RNHaapiResponseRecord") {
            put("responseCategory", responseCategory)
            put("representation", representation?.let { JSONObject(it.toString()) })
            put("problem", problem?.let { JSONObject(it.toString()) })
        }
}
