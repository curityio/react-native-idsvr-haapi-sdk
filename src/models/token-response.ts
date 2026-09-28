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
 * A successful OAuth 2.0 token response (RFC 6749).
 */
export interface SuccessfulTokenResponse {
    readonly responseType: "success";
    /** The access token string. */
    readonly accessToken: string;
    /** The token type (e.g., "bearer"). */
    readonly tokenType?: string;
    /** The granted scope. */
    readonly scope?: string;
    /** Token lifetime in seconds. */
    readonly expiresIn: number;
    /** The refresh token, if issued. */
    readonly refreshToken?: string;
    /** The OpenID Connect ID token, if issued. */
    readonly idToken?: string;
}

/**
 * An error OAuth 2.0 token response (RFC 6749).
 */
export interface ErrorTokenResponse {
    readonly responseType: "error";
    /** The error code (e.g., "invalid_grant"). */
    readonly error: string;
    /** Optional human-readable error description. */
    readonly errorDescription?: string;
    /** Optional URI for additional error information. */
    readonly errorUri?: string;
}

/**
 * An OAuth 2.0 token response.
 *
 * @remarks
 * Discriminated union on `responseType`.
 */
export type TokenResponse = SuccessfulTokenResponse | ErrorTokenResponse;
