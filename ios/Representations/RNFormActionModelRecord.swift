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

/// The model of a form action, describing the HTTP request and its fields.
///
/// Maps to the TypeScript `FormActionModel` interface.
///
/// `@unchecked Sendable`: this Record crosses the `RNHaapiManagerBridge`
/// actor boundary as the `submitForm` parameter. Expo's `@Field` is
/// class-backed (mutable internally), so the compiler can't prove
/// Sendability — but in this codebase the Record is constructed by the
/// Expo deserializer, handed straight into the bridge call, and never
/// mutated again. Same opt-out as `RNLinkRecord` and `RNHaapiResponseRecord`.
struct RNFormActionModelRecord: Record, @unchecked Sendable {
    /// Optional title for the form action.
    @Field var actionTitle: RNMessageRecord?
    /// The form fields to render.
    @Field var fields: [RNFormFieldRecord] = []
    /// The media type of the form submission.
    @Field var type: String = ""
    /// The HTTP method for submission (e.g., "POST").
    @Field var method: String = ""
    /// The target URI for form submission.
    @Field var href: String = ""

    init() {}
}

extension RNFormActionModelRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNFormActionModelRecord",
            "actionTitle": actionTitle as Any,
            "fields": fields.count,
            "type": type,
            "method": method,
            "href": href
        ].debugDescription
    }
}
