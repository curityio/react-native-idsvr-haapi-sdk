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

/// Discriminator for the type of HAAPI step.
///
/// Maps to the TypeScript `StepType` enum.
enum RNStepType: String, Enumerable {
    case authenticatorSelector = "authenticatorSelector"
    case interactiveForm = "interactiveForm"
    case userConsent = "userConsent"
    case redirection = "redirection"
    case polling = "polling"
    case continueSame = "continueSame"
    case oAuthAuthorizationResponse = "oAuthAuthorizationResponse"
    case externalBrowserClientOperation = "externalBrowserClientOperation"
    case bankIdClientOperation = "bankIdClientOperation"
    case encapClientOperation = "encapClientOperation"
    case webAuthnRegistrationClientOperation = "webAuthnRegistrationClientOperation"
    case webAuthnAuthenticationClientOperation = "webAuthnAuthenticationClientOperation"
    case genericClientOperation = "genericClientOperation"
    case genericRepresentation = "genericRepresentation"
}
