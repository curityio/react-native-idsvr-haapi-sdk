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

import se.curity.identityserver.haapi.android.driver.DpopKeyPolicy

/**
 * Whether a Keystore failure from the HAAPI flow is the DPoP key's rather than attestation's.
 *
 * The native SDK throws the same `HaapiUnrecoverableException.KeyStoreException` for both. It can only
 * come from the DPoP key when attestation is not in effect and the key policy is
 * [DpopKeyPolicy.Hardware]: `Auto` falls back to a software key and `Software` never uses the Keystore.
 * The values must be the manager's effective ones — the native SDK runs without attestation when it falls
 * back to dynamic client registration, whatever the configuration asked for.
 */
internal fun isDpopKeyFailure(
    useAttestation: Boolean,
    keyType: DpopKeyPolicy?,
): Boolean = !useAttestation && keyType == DpopKeyPolicy.Hardware

/**
 * The device couldn't create the hardware-backed DPoP key a hardware-only binding requires. Raised by the
 * HAAPI bridge in place of the native Keystore exception ([cause]), whose text blames attestation, so the
 * normalizer reports it as the DPoP key-creation failure iOS reports for the same case.
 */
internal class DpopKeyCreationException(
    cause: Throwable,
) : IllegalStateException("The device could not create the hardware-backed token-binding key.", cause)
