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
 * The problem type URI for a HAAPI problem representation.
 *
 * Maps to the TypeScript `ProblemType` enum.
 */
enum class RNProblemType(
    val value: String,
) : Enumerable {
    AUTHENTICATION_FAILED("https://curity.se/problems/authentication-failed"),
    INVALID_INPUT("https://curity.se/problems/invalid-input"),
    INCORRECT_CREDENTIALS("https://curity.se/problems/incorrect-credentials"),
    ERROR_AUTHORIZATION_RESPONSE("https://curity.se/problems/error-authorization-response"),
    UNEXPECTED("https://curity.se/problems/unexpected"),
    TOO_MANY_ATTEMPTS("https://curity.se/problems/too-many-attempts"),
    GENERIC_USER_ERROR("https://curity.se/problems/generic-user-error"),
    SESSION_AND_ACCESS_TOKEN_MISMATCH("https://curity.se/problems/mismatch-between-session-and-access-token"),
    OTHER("other"),
}
