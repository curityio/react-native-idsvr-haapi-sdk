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
 * An option within a select form field.
 *
 * Maps to the TypeScript `SelectOption` interface.
 */
class RNSelectOptionRecord : Record {
    /** Display label for the option. */
    @Field var label: String = ""

    /** The value submitted when this option is selected. */
    @Field var value: String = ""

    /** Whether this option is pre-selected. */
    @Field var selected: Boolean = false

    override fun toString(): String =
        buildRecordString("RNSelectOptionRecord") {
            put("label", label)
            put("value", value)
            put("selected", selected)
        }
}
