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

/**
 * The type of a HAAPI problem response (RFC 7807).
 *
 * @remarks
 * These correspond to the problem type URIs defined by the Curity Identity Server.
 * Unknown problem types from future server versions are represented as {@link ProblemType.Other}.
 */
export enum ProblemType {
    AuthenticationFailedProblem = "https://curity.se/problems/authentication-failed",
    InvalidInputProblem = "https://curity.se/problems/invalid-input",
    IncorrectCredentialsProblem = "https://curity.se/problems/incorrect-credentials",
    ErrorAuthorizationResponseProblem = "https://curity.se/problems/error-authorization-response",
    UnexpectedProblem = "https://curity.se/problems/unexpected",
    TooManyAttemptsProblem = "https://curity.se/problems/too-many-attempts",
    GenericUserProblem = "https://curity.se/problems/generic-user-error",
    SessionAndAccessTokenMismatchProblem = "https://curity.se/problems/mismatch-between-session-and-access-token",
    Other = "other",
}
