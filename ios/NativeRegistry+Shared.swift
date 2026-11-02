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

/// Extends ``NativeRegistry`` with the default ``shared`` singleton.
///
/// This file is intentionally separate from `NativeRegistry.swift` so that
/// the core class can be compiled by the standalone Swift Package (`Package.swift`)
/// without pulling in `URLSessionResolver` and its transitive dependencies
/// (`IdsvrHaapiSdk`, `ExpoModulesCore`).  CocoaPods compiles all Swift files
/// together, so `shared` is always available in the framework build.
extension NativeRegistry {
    /// The shared registry, pre-loaded with the built-in ``URLSessionResolver``.
    public static let shared = NativeRegistry([
        URLSessionResolver(),
        DefaultBundleResolver()
    ])
}
