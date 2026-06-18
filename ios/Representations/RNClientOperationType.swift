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

/// Discriminator for the type of client operation.
///
/// Maps to the TypeScript `ClientOperationType` enum.
enum RNClientOperationType: String, Enumerable {
    case externalBrowserFlow = "external-browser-flow"
    case bankid = "bankid"
    case encapAutoActivation = "encap-auto-activation"
    case webauthnRegistration = "webauthn-registration"
    case webauthnAuthentication = "webauthn-authentication"
    case generic = "generic"
}
