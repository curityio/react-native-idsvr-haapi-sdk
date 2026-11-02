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
 * The type of a HAAPI representation step.
 *
 * @remarks
 * These values match the `type` field in the HAAPI protocol JSON responses
 * sent by the Curity Identity Server.
 */
export enum RepresentationType {
    AuthenticationStep = "authentication-step",
    RedirectionStep = "redirection-step",
    RegistrationStep = "registration-step",
    PollingStep = "polling-step",
    ContinueSameStep = "continue-same-step",
    OAuthAuthorizationResponse = "oauth-authorization-response",
    ConsentorStep = "consentor-step",
    UserConsentStep = "user-consent-step",
}
