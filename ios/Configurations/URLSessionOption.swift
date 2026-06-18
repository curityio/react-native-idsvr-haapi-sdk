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

/// Selects the `URLSession` behavior used for network calls on iOS.
///
/// Maps to the TypeScript `URLSessionOption` enum.
enum URLSessionOption: String, Enumerable {
    /// Default session behavior.
    case `default` = "default"
    /// Ephemeral session (no persistent cookies/cache).
    case ephemeral = "ephemeral"
    /// Custom session.
    case custom = "custom"
}
