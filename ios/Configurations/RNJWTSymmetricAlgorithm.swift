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

/// JWT symmetric signing algorithms supported by the module.
///
/// Raw values are the uppercase JOSE names the TypeScript `JwtSymmetricAlgorithm` enum sends
/// (e.g. `"HS256"`); Expo matches them exactly, so they must stay identical to the TS values.
enum RNJWTSymmetricAlgorithm: String, Enumerable {
    /// HMAC using SHA-256
    case hs256 = "HS256"
    /// HMAC using SHA-384
    case hs384 = "HS384"
    /// HMAC using SHA-512
    case hs512 = "HS512"
}
