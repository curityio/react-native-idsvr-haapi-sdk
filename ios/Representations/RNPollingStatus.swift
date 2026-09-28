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

/// The status of a polling step.
///
/// Maps to the TypeScript `PollingStatus` enum.
enum RNPollingStatus: String, Enumerable {
    case pending = "pending"
    case done = "done"
    case failed = "failed"
}
