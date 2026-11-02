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

/// The HAAPI representation type identifier.
///
/// Maps to the TypeScript `RepresentationType` enum.
enum RNRepresentationType: String, Enumerable {
    case authenticationStep = "authentication-step"
    case redirectionStep = "redirection-step"
    case registrationStep = "registration-step"
    case pollingStep = "polling-step"
    case continueSameStep = "continue-same-step"
    case oauthAuthorizationResponse = "oauth-authorization-response"
    case consentorStep = "consentor-step"
    case userConsentStep = "user-consent-step"
}
