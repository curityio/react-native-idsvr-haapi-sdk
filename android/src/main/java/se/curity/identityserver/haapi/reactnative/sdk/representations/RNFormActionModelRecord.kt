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
 * The model of a form action, describing the HTTP request and its fields.
 *
 * Maps to the TypeScript `FormActionModel` interface.
 */
class RNFormActionModelRecord : Record {
    /** Optional title for the form action. */
    @Field var actionTitle: RNMessageRecord? = null

    /** The form fields to render. */
    @Field var fields: List<RNFormFieldRecord> = emptyList()

    /** The media type of the form submission. */
    @Field var type: String = ""

    /** The HTTP method for submission (e.g., "POST"). */
    @Field var method: String = ""

    /** The target URI for form submission. */
    @Field var href: String = ""

    override fun toString(): String =
        buildRecordString("RNFormActionModelRecord") {
            put("actionTitle", actionTitle?.let { JSONObject(it.toString()) })
            put("fields", fields.size)
            put("type", type)
            put("method", method)
            put("href", href)
        }
}
