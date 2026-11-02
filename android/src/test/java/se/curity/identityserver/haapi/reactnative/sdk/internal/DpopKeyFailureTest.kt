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
package se.curity.identityserver.haapi.reactnative.sdk.internal

import org.junit.Assert.assertEquals
import org.junit.Test
import se.curity.identityserver.haapi.android.driver.DpopKeyPolicy

/**
 * The native SDK throws the same Keystore exception for the attestation key and for a hardware-only DPoP
 * key. Only the second is a DPoP key failure, and attestation being in effect is what tells them apart.
 */
class DpopKeyFailureTest {
    @Test
    fun keystoreFailureIsADpopKeyFailureOnlyForAHardwareOnlyKeyWithoutAttestation() {
        val cases =
            listOf(
                Triple(false, DpopKeyPolicy.Hardware, true),
                // Auto falls back to a software key and Software never uses the Keystore, so their
                // Keystore failures can only come from attestation.
                Triple(false, DpopKeyPolicy.Auto, false),
                Triple(false, DpopKeyPolicy.Software, false),
                Triple(false, null, false),
                // With attestation in effect the key policy is not used: the failure is attestation's.
                Triple(true, DpopKeyPolicy.Hardware, false),
                Triple(true, DpopKeyPolicy.Auto, false),
                Triple(true, null, false),
            )

        cases.forEach { (useAttestation, keyType, expected) ->
            assertEquals(
                "useAttestation=$useAttestation keyType=$keyType",
                expected,
                isDpopKeyFailure(useAttestation, keyType),
            )
        }
    }
}
