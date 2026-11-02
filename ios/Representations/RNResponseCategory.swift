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

/// The category of a HAAPI response.
///
/// Maps to the TypeScript `HaapiResponse` discriminator field `responseCategory`.
/// Flow failures are surfaced as thrown `HaapiError` values, not as
/// additional cases in this enum.
enum RNResponseCategory: String, Enumerable {
    /// A successful HAAPI representation step.
    case representation
    /// A HAAPI problem response.
    case problem
}
