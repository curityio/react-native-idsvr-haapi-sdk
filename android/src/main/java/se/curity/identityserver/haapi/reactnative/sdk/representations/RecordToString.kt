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

import org.json.JSONObject

/**
 * Builds a JSON string for Record [toString] implementations.
 *
 * Catches any [org.json.JSONException] from malformed field values and
 * falls back to `{"class": "<className>", "error": "<message>"}`.
 */
internal inline fun buildRecordString(
    className: String,
    block: JSONObject.() -> JSONObject,
): String =
    try {
        JSONObject().put("class", className).block().toString()
    } catch (e: Exception) {
        """{"class":"$className","error":"${e.message}"}"""
    }
