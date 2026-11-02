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

import type { StepType } from "./step-type";
import type { OAuthAuthorizationResponseProperties } from "./properties";
import type { RepresentationBase } from "./representation-base";

// ─── OAuth Step ──────────────────────────────────────────────────────────────

/**
 * Step containing the OAuth 2.0 authorization response (authorization code, etc.).
 */
export interface OAuthAuthorizationResponseStep extends RepresentationBase {
    readonly stepType: StepType.OAuthAuthorizationResponse;
    /** The OAuth authorization response properties. */
    readonly oauthProperties: OAuthAuthorizationResponseProperties;
}
