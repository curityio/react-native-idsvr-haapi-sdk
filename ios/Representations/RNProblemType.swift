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
internal import ExpoModulesCore

/// The problem type URI for a HAAPI problem representation.
///
/// Maps to the TypeScript `ProblemType` enum.
enum RNProblemType: String, Enumerable {
    case authenticationFailed = "https://curity.se/problems/authentication-failed"
    case invalidInput = "https://curity.se/problems/invalid-input"
    case incorrectCredentials = "https://curity.se/problems/incorrect-credentials"
    case errorAuthorizationResponse = "https://curity.se/problems/error-authorization-response"
    case unexpected = "https://curity.se/problems/unexpected"
    case tooManyAttempts = "https://curity.se/problems/too-many-attempts"
    case genericUserError = "https://curity.se/problems/generic-user-error"
    case sessionAndAccessTokenMismatch = "https://curity.se/problems/mismatch-between-session-and-access-token"
    case other = "other"
}
