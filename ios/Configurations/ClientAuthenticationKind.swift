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

/// Discriminator for `ClientAuthenticationMethodConfigurationRecord`.
///
/// Maps to the TypeScript `ClientAuthenticationKind` enum.
enum ClientAuthenticationKind: String, Enumerable {
    /// No client authentication.
    case none = "none"
    /// Shared secret (client_secret_post).
    case secret = "secret"
    /// Mutual TLS with a server trust store or PEM certificate.
    case mtls = "mtls"
    /// Mutual TLS with server public key pinning.
    case mtlsKeyPinning = "mtlsKeyPinning"
    /// Signed JWT using an asymmetric key pair (private_key_jwt).
    case jwtAsymmetric = "jwtAsymmetric"
    /// Signed JWT using a symmetric secret (client_secret_jwt).
    case jwtSymmetric = "jwtSymmetric"
}
