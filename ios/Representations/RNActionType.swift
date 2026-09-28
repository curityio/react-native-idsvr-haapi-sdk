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

/// Discriminator for the type of action within a HAAPI step.
///
/// Maps to the TypeScript `ActionType` enum.
enum RNActionType: String, Enumerable {
    case form = "form"
    case clientOperation = "clientOperation"
    case selector = "selector"
}
