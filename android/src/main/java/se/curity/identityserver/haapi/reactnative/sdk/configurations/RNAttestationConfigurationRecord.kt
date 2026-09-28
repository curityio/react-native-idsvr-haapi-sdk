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
package se.curity.identityserver.haapi.reactnative.sdk.configurations

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.json.JSONObject

/**
 * Attestation configuration record.
 *
 * Maps to the TypeScript `AndroidAttestationConfiguration` interface.
 */
class RNAttestationConfigurationRecord : Record {
    /** Whether attestation is enabled for the HAAPI flow. */
    @Field var useAttestation: Boolean = true

    override fun toString(): String =
        JSONObject()
            .put("useAttestation", useAttestation)
            .toString()
}
