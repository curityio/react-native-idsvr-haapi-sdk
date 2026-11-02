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

/// JWT asymmetric signing algorithms supported by the module.
///
/// Raw values are the uppercase JOSE names the TypeScript `JwtAsymmetricAlgorithm` enum sends
/// (e.g. `"ES256"`); Expo matches them exactly, so they must stay identical to the TS values.
enum RNJWTAsymmetricAlgorithm: String, Enumerable {
    /// RSASSA-PKCS1-v1_5 using SHA-256
    case rs256 = "RS256"
    /// RSASSA-PKCS1-v1_5 using SHA-384
    case rs384 = "RS384"
    /// RSASSA-PKCS1-v1_5 using SHA-512
    case rs512 = "RS512"
    /// RSASSA-PSS using SHA-256 and MGF1 with SHA-256
    case ps256 = "PS256"
    /// RSASSA-PSS using SHA-384 and MGF1 with SHA-384
    case ps384 = "PS384"
    /// RSASSA-PSS using SHA-512 and MGF1 with SHA-512
    case ps512 = "PS512"
    /// ECDSA P-256 using SHA-256
    case es256 = "ES256"
    /// ECDSA P-384 using SHA-384
    case es384 = "ES384"
    /// ECDSA P-521 using SHA-512
    case es512 = "ES512"
}
