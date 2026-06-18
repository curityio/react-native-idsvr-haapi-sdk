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

/**
 * Optional metadata attached to a HAAPI response.
 *
 * Maps to the TypeScript `Metadata` interface.
 */
class RNMetadataRecord : Record {
    /** Custom template area identifier. */
    @Field var templateArea: String? = null

    /** The server-side view name that produced this response. */
    @Field var viewName: String? = null

    override fun toString(): String =
        buildRecordString("RNMetadataRecord") {
            put("templateArea", templateArea)
            put("viewName", viewName)
        }
}
