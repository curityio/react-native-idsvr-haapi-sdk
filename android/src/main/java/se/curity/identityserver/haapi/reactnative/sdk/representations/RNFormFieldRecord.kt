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
 * A form field within a form action model.
 *
 * Maps to the TypeScript `FormField` discriminated union.
 * The [fieldType] field is the discriminator.
 */
class RNFormFieldRecord : Record {
    /** Discriminator: "hidden", "text", "username", "password", "select", "checkbox", "context". */
    @Field var fieldType: RNFormFieldType = RNFormFieldType.TEXT

    /** The field name used as the parameter key on submission. */
    @Field var name: String = ""

    /** The current or default value. */
    @Field var value: String? = null

    /** Optional label message. */
    @Field var label: RNMessageRecord? = null

    /** Optional placeholder message. */
    @Field var placeholder: RNMessageRecord? = null

    /** Whether the field is required for form submission. */
    @Field var isRequired: Boolean = true

    // Text/Username/Password fields

    /** Input kind hint for text fields (e.g., "email", "tel"). */
    @Field var kind: String? = null

    /** Minimum character length. */
    @Field var minLength: Double? = null

    /** Maximum character length. */
    @Field var maxLength: Double? = null

    // Select fields

    /** Available options for a select field. */
    @Field var options: List<RNSelectOptionRecord>? = null

    // Checkbox fields

    /** Whether the checkbox is currently checked. */
    @Field var checked: Boolean? = null

    /** Whether the checkbox is read-only. */
    @Field var readOnly: Boolean? = null

    override fun toString(): String =
        buildRecordString("RNFormFieldRecord") {
            put("fieldType", fieldType)
            put("name", name)
            put("value", value)
            put("label", label?.let { JSONObject(it.toString()) })
            put("placeholder", placeholder?.let { JSONObject(it.toString()) })
            put("isRequired", isRequired)
            put("kind", kind)
            put("minLength", minLength)
            put("maxLength", maxLength)
            put("options", options?.size)
            put("checked", checked)
            put("readOnly", readOnly)
        }
}
