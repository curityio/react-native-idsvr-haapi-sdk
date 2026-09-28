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
 * Discriminator for the step type of a HAAPI representation.
 *
 * Maps to the TypeScript `StepType` enum.
 */
enum class RNStepType(
    val value: String,
) : Enumerable {
    AUTHENTICATOR_SELECTOR("authenticatorSelector"),
    INTERACTIVE_FORM("interactiveForm"),
    USER_CONSENT("userConsent"),
    REDIRECTION("redirection"),
    POLLING("polling"),
    CONTINUE_SAME("continueSame"),
    OAUTH_AUTHORIZATION_RESPONSE("oAuthAuthorizationResponse"),
    EXTERNAL_BROWSER_CLIENT_OPERATION("externalBrowserClientOperation"),
    BANK_ID_CLIENT_OPERATION("bankIdClientOperation"),
    ENCAP_CLIENT_OPERATION("encapClientOperation"),
    WEB_AUTHN_REGISTRATION_CLIENT_OPERATION("webAuthnRegistrationClientOperation"),
    WEB_AUTHN_AUTHENTICATION_CLIENT_OPERATION("webAuthnAuthenticationClientOperation"),
    GENERIC_CLIENT_OPERATION("genericClientOperation"),
    GENERIC_REPRESENTATION("genericRepresentation"),
}
