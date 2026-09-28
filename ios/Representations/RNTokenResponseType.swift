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

/// Discriminator for ``RNTokenResponseRecord``.
///
/// Maps to the TypeScript `'success' | 'error'` literal union on
/// `TokenResponse` (`SuccessfulTokenResponse` vs `ErrorTokenResponse`).
/// The raw values are the wire format the host TS code switches on.
enum RNTokenResponseType: String, Enumerable {
    case success = "success"
    case error = "error"
}
