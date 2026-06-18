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
 * A localizable message from the HAAPI response.
 *
 * Maps to the TypeScript `Message` interface.
 */
class RNMessageRecord : Record {
    /** Optional message key for client-side localization. */
    @Field var key: String? = null

    /** Human-readable text suitable for display. */
    @Field var literal: String = ""

    override fun toString(): String =
        buildRecordString("RNMessageRecord") {
            put("key", key)
            put("literal", literal)
        }
}

/**
 * A user-facing message with optional styling hints.
 *
 * Maps to the TypeScript `UserMessage` interface.
 */
class RNUserMessageRecord : Record {
    /** The message content. */
    @Field var text: RNMessageRecord = RNMessageRecord()

    /** CSS-like class names for styling hints. */
    @Field var classList: List<String> = emptyList()

    override fun toString(): String =
        buildRecordString("RNUserMessageRecord") {
            put("text", JSONObject(text.toString()))
            put("classList", classList.size)
        }
}
