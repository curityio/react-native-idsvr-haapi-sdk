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

/// Selects which app bundle to load certificate and key files from on iOS.
///
/// Maps to the TypeScript `BundleOption` enum.
enum BundleOption: String, Enumerable {
    /// The main application bundle (`Bundle.main`).
    case main = "main"
    /// A custom bundle — requires a resolver registered in `NativeRegistry`.
    case custom = "custom"
}
