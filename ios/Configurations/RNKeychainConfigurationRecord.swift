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

/// Keychain access group and accessibility level for the SDK's keychain items.
///
/// Maps to the TypeScript `IOSKeychainConfiguration` interface.
struct RNKeychainConfigurationRecord: Record {
    /// Keychain access group the SDK stores its items in; `nil` keeps the app's default access group.
    @Field var accessGroup: String?
    /// When the SDK's keychain items can be read; `nil` keeps the native default level.
    @Field var accessibility: RNKeychainAccessibility?

    init() {}
    init(accessGroup: String?, accessibility: RNKeychainAccessibility? = nil) {
        self.accessGroup = accessGroup
        self.accessibility = accessibility
    }
}

extension RNKeychainConfigurationRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "accessGroup": accessGroup ?? "nil",
            "accessibility": accessibility?.rawValue ?? "nil",
        ].debugDescription
    }
}
