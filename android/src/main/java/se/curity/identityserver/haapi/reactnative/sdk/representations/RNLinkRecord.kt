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
 * A navigable link within a HAAPI response.
 *
 * Maps to the TypeScript `Link` interface.
 */
class RNLinkRecord : Record {
    /** Target URI of the link. */
    @Field var href: String = ""

    /** Link relation type (e.g., "cancel", "restart"). */
    @Field var rel: String = ""

    /** Optional display title for the link. */
    @Field var title: RNMessageRecord? = null

    /** Optional media type hint. */
    @Field var type: String? = null

    override fun toString(): String =
        buildRecordString("RNLinkRecord") {
            put("href", href)
            put("rel", rel)
            put("title", title?.let { JSONObject(it.toString()) })
            put("type", type)
        }
}
