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

/// Discriminator for the type of form field.
///
/// Maps to the TypeScript `FormFieldType` enum.
enum RNFormFieldType: String, Enumerable {
    case hidden = "hidden"
    case text = "text"
    case username = "username"
    case password = "password"
    case select = "select"
    case checkbox = "checkbox"
    case context = "context"
}
