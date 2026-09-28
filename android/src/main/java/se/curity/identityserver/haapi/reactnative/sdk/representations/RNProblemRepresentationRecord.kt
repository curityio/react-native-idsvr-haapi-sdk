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
 * A HAAPI problem representation (RFC 7807).
 *
 * Maps to the TypeScript `ProblemRepresentation` discriminated union.
 * The [problemKind] field is the discriminator.
 */
class RNProblemRepresentationRecord : Record {
    /** Discriminator: "problem", "invalidInput", or "authorization". */
    @Field var problemKind: String = "problem"

    /** The problem type URI. */
    @Field var type: RNProblemType = RNProblemType.UNEXPECTED

    /** Optional metadata. */
    @Field var metadata: RNMetadataRecord? = null

    /** Optional title message. */
    @Field var title: RNMessageRecord? = null

    /** User-facing messages. */
    @Field var messages: List<RNUserMessageRecord> = emptyList()

    /** Available links. */
    @Field var links: List<RNLinkRecord> = emptyList()

    // InvalidInputProblem

    /** The fields that failed validation. */
    @Field var invalidFields: List<RNInvalidFieldRecord>? = null

    /** Optional error description. */
    @Field var errorDescription: String? = null

    // AuthorizationProblem

    /** The OAuth error code. */
    @Field var error: String? = null

    /** The issuer identifier of the authorization server. */
    @Field var iss: String? = null

    override fun toString(): String =
        buildRecordString("RNProblemRepresentationRecord") {
            put("problemKind", problemKind)
            put("type", type)
            put("metadata", metadata?.let { JSONObject(it.toString()) })
            put("title", title?.let { JSONObject(it.toString()) })
            put("messages", messages.size)
            put("links", links.size)
            put("invalidFields", invalidFields?.size)
            put("errorDescription", errorDescription)
            put("error", error)
            put("iss", iss)
        }
}
