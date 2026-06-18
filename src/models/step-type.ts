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
 * Discriminator for the {@link HaapiRepresentation} union type.
 *
 * @remarks
 * Each value identifies a specific step type in the HAAPI authentication flow.
 * The native SDKs (iOS/Android) determine the step type from the HAAPI response
 * and set this discriminator accordingly.
 */
export enum StepType {
    AuthenticatorSelector = "authenticatorSelector",
    InteractiveForm = "interactiveForm",
    UserConsent = "userConsent",
    Redirection = "redirection",
    Polling = "polling",
    ContinueSame = "continueSame",
    OAuthAuthorizationResponse = "oAuthAuthorizationResponse",
    ExternalBrowserClientOperation = "externalBrowserClientOperation",
    BankIdClientOperation = "bankIdClientOperation",
    EncapClientOperation = "encapClientOperation",
    WebAuthnRegistrationClientOperation = "webAuthnRegistrationClientOperation",
    WebAuthnAuthenticationClientOperation = "webAuthnAuthenticationClientOperation",
    GenericClientOperation = "genericClientOperation",
    GenericRepresentation = "genericRepresentation",
}
