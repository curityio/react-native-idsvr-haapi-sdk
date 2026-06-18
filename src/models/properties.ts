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

import type { PollingStatus } from "./polling-status";

/**
 * Generic properties containing the raw JSON string.
 */
export interface GenericProperties {
    readonly kind: "generic";
    /** The raw JSON string of the properties object. */
    readonly rawJsonString: string;
}

/**
 * Properties from an OAuth 2.0 authorization response step.
 */
export interface OAuthAuthorizationResponseProperties {
    readonly kind: "oauthAuthorizationResponse";
    /** The authorization code. */
    readonly code?: string;
    /** The OpenID Connect ID token. */
    readonly idToken?: string;
    /** The granted scope. */
    readonly scope?: string;
    /** The OAuth state parameter. */
    readonly state?: string;
}

/**
 * Properties from a polling step.
 */
export interface PollingProperties {
    readonly kind: "polling";
    /** Description of who/what is being communicated with (e.g., phone number). */
    readonly recipientOfCommunication?: string;
    /** Current polling status. */
    readonly status: PollingStatus;
    /** The amount of time in milliseconds that the client should wait between polling requests. */
    readonly interval?: string;
    /** Maximum wait time (ISO 8601 duration or seconds string). */
    readonly maxWaitTime?: string;
    /** Remaining wait time. */
    readonly maxWaitRemainingTime?: string;
}

/**
 * Step-specific properties attached to a HAAPI representation.
 */
export type Properties =
    | GenericProperties
    | OAuthAuthorizationResponseProperties
    | PollingProperties;
