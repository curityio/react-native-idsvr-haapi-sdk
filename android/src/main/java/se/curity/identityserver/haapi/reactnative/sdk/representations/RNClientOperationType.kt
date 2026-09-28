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

import expo.modules.kotlin.types.Enumerable

/**
 * Discriminator for the type of client operation.
 *
 * Maps to the TypeScript `ClientOperationType` enum.
 */
enum class RNClientOperationType(
    val value: String,
) : Enumerable {
    EXTERNAL_BROWSER_FLOW("external-browser-flow"),
    BANKID("bankid"),
    ENCAP_AUTO_ACTIVATION("encap-auto-activation"),
    WEBAUTHN_REGISTRATION("webauthn-registration"),
    WEBAUTHN_AUTHENTICATION("webauthn-authentication"),
    GENERIC("generic"),
}
