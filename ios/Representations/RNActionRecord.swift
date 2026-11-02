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

/// An action within a HAAPI step.
///
/// Maps to the TypeScript `Action` discriminated union.
/// The `actionType` field is the discriminator: "form", "clientOperation", or "selector".
struct RNActionRecord: Record {
    /// Discriminator: "form", "clientOperation", or "selector".
    @Field var actionType: RNActionType = .form
    /// The kind of action (e.g., "login", "cancel", "redirect").
    @Field var kind: RNActionKind = .other
    /// Optional display title.
    @Field var title: RNMessageRecord?

    // Form action
    /// The form model (present when `actionType` is "form").
    @Field var model: RNFormActionModelRecord?

    // Client operation action
    /// The client operation model (present when `actionType` is "clientOperation").
    @Field var clientOperationModel: RNClientOperationActionModelRecord?

    // Selector action
    /// The available options to select from (present when `actionType` is "selector").
    @Field var options: [RNActionRecord]?

    init() {}
}

extension RNActionRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNActionRecord",
            "actionType": actionType,
            "kind": kind,
            "title": title as Any,
            "model": model as Any,
            "clientOperationModel": clientOperationModel as Any,
            "options": options as Any
        ].debugDescription
    }
}
