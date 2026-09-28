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

/// An authenticator option within an authenticator selector step.
///
/// Maps to the TypeScript `AuthenticatorOption` interface.
struct RNAuthenticatorOptionRecord: Record {
    /// Display title for the authenticator.
    @Field var title: RNMessageRecord = RNMessageRecord()
    /// Authenticator type identifier (e.g., "html-form", "bankid").
    @Field var type: String?
    /// The action to select this authenticator.
    @Field var action: RNActionRecord = RNActionRecord()

    init() {}
    init(title: RNMessageRecord, type: String?, action: RNActionRecord) {
        self.title = title
        self.type = type
        self.action = action
    }
}

extension RNAuthenticatorOptionRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNAuthenticatorOptionRecord",
            "title": title,
            "type": type as Any,
            "action": action
        ].debugDescription
    }
}
