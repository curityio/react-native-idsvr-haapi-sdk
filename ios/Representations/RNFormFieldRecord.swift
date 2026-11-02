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

/// An option within a select form field.
///
/// Maps to the TypeScript `SelectOption` interface.
struct RNSelectOptionRecord: Record {
    /// Display label for the option.
    @Field var label: String = ""
    /// The value submitted when this option is selected.
    @Field var value: String = ""
    /// Whether this option is pre-selected.
    @Field var selected: Bool = false

    init() {}
    init(label: String, value: String, selected: Bool) {
        self.label = label
        self.value = value
        self.selected = selected
    }
}

extension RNSelectOptionRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNSelectOptionRecord",
            "label": label,
            "value": value,
            "selected": selected
        ].debugDescription
    }
}

/// A form field within a form action model.
///
/// Maps to the TypeScript `FormField` discriminated union.
/// The `fieldType` field is the discriminator.
struct RNFormFieldRecord: Record {
    /// Discriminator: "hidden", "text", "username", "password", "select", "checkbox", "context".
    @Field var fieldType: RNFormFieldType = .text
    /// The field name used as the parameter key on submission.
    @Field var name: String = ""
    /// The current or default value.
    @Field var value: String?
    /// Optional label message.
    @Field var label: RNMessageRecord?
    /// Optional placeholder message.
    @Field var placeholder: RNMessageRecord?
    /// Whether the field is required for form submission.
    @Field var isRequired: Bool = true

    // Text/Username/Password fields
    /// Input kind hint for text fields (e.g., "email", "tel").
    @Field var kind: String?
    /// Minimum character length.
    @Field var minLength: Double?
    /// Maximum character length.
    @Field var maxLength: Double?

    // Select fields
    /// Available options for a select field.
    @Field var options: [RNSelectOptionRecord]?

    // Checkbox fields
    /// Whether the checkbox is currently checked.
    @Field var checked: Bool?
    /// Whether the checkbox is read-only.
    @Field var readOnly: Bool?

    init() {}
}

extension RNFormFieldRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNFormFieldRecord",
            "fieldType": fieldType,
            "name": name,
            "value": value as Any,
            "label": label as Any,
            "placeholder": placeholder as Any,
            "isRequired": isRequired,
            "kind": kind as Any,
            "minLength": minLength as Any,
            "maxLength": maxLength as Any,
            "options": options as Any,
            "checked": checked as Any,
            "readOnly": readOnly as Any
        ].debugDescription
    }
}
