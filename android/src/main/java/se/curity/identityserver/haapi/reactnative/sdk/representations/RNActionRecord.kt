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
 * An action within a HAAPI step.
 *
 * Maps to the TypeScript `Action` discriminated union.
 * The [actionType] field is the discriminator: "form", "clientOperation", or "selector".
 */
class RNActionRecord : Record {
    /** Discriminator: "form", "clientOperation", or "selector". */
    @Field var actionType: RNActionType = RNActionType.FORM

    /** The kind of action (e.g., "login", "cancel", "redirect"). */
    @Field var kind: RNActionKind = RNActionKind.OTHER

    /** Optional display title. */
    @Field var title: RNMessageRecord? = null

    // Form action

    /** The form model (present when [actionType] is "form"). */
    @Field var model: RNFormActionModelRecord? = null

    // Client operation action

    /** The client operation model (present when [actionType] is "clientOperation"). */
    @Field var clientOperationModel: RNClientOperationActionModelRecord? = null

    // Selector action

    /** The available options to select from (present when [actionType] is "selector"). */
    @Field var options: List<RNActionRecord>? = null

    override fun toString(): String =
        buildRecordString("RNActionRecord") {
            put("actionType", actionType)
            put("kind", kind)
            put("title", title?.let { JSONObject(it.toString()) })
            put("model", model?.let { JSONObject(it.toString()) })
            put("clientOperationModel", clientOperationModel?.let { JSONObject(it.toString()) })
            put("options", options?.size)
        }
}
