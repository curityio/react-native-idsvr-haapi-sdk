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
enum RNJWTSymmetricAlgorithm: String, Enumerable {
    /// HMAC using SHA-256
    case hs256
    /// HMAC using SHA-384
    case hs384
    /// HMAC using SHA-512
    case hs512
}
