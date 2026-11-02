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

/// A localizable message from the HAAPI response.
///
/// Maps to the TypeScript `Message` interface.
struct RNMessageRecord: Record {
    /// Optional message key for client-side localization.
    @Field var key: String?
    /// Human-readable text suitable for display.
    @Field var literal: String = ""

    init() {}
    init(key: String?, literal: String) {
        self.key = key
        self.literal = literal
    }
}

extension RNMessageRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNMessageRecord",
            "key": key as Any,
            "literal": literal
        ].debugDescription
    }
}

/// A user-facing message with optional styling hints.
///
/// Maps to the TypeScript `UserMessage` interface.
struct RNUserMessageRecord: Record {
    /// The message content.
    @Field var text: RNMessageRecord = RNMessageRecord()
    /// CSS-like class names for styling hints.
    @Field var classList: [String] = []

    init() {}
    init(text: RNMessageRecord, classList: [String]) {
        self.text = text
        self.classList = classList
    }
}

extension RNUserMessageRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNUserMessageRecord",
            "text": text,
            "classList": classList.count
        ].debugDescription
    }
}
