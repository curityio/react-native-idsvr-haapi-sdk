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

/// When the SDK's keychain items can be read on iOS.
///
/// Raw values are the TypeScript `KeychainAccessibility` values, character for character.
enum RNKeychainAccessibility: String, Enumerable {
    /// After the first unlock since the device restarted, on this device only.
    case afterFirstUnlockThisDeviceOnly = "afterFirstUnlockThisDeviceOnly"
    /// Only while the device is unlocked, on this device only.
    case whenUnlockedThisDeviceOnly = "whenUnlockedThisDeviceOnly"
}
