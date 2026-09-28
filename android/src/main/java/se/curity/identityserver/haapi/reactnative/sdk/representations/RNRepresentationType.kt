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
 * The representation type of a HAAPI step.
 *
 * Maps to the TypeScript `RepresentationType` enum.
 */
enum class RNRepresentationType(
    val value: String,
) : Enumerable {
    AUTHENTICATION_STEP("authentication-step"),
    REDIRECTION_STEP("redirection-step"),
    REGISTRATION_STEP("registration-step"),
    POLLING_STEP("polling-step"),
    CONTINUE_SAME_STEP("continue-same-step"),
    OAUTH_AUTHORIZATION_RESPONSE("oauth-authorization-response"),
    CONSENTOR_STEP("consentor-step"),
    USER_CONSENT_STEP("user-consent-step"),
}
