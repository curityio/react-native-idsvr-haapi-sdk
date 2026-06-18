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
import Foundation

#if canImport(ExpoModulesCore)
internal import ExpoModulesCore

/// Expo `Exception` subclass that carries the stable HAAPI bridge error
/// codes (`HAAPI_ACCESSOR_*`) through to JavaScript via `error.code`.
///
/// Wraps the bridge-originated ``HaapiAccessorStore/StoreError`` cases at
/// the AsyncFunction boundary so the store stays Expo-agnostic while JS
/// callers can still branch on `error.code`. Canonical normalized code values
/// and envelope shape are documented in HSRN-22 plan § 8.1 (code constants)
/// and § 9 (wire format).
internal final class HaapiAccessorBridgeException: Exception, @unchecked Sendable {
    init(code: String, reason: String) {
        super.init(name: "HaapiAccessorBridgeException", description: reason, code: code)
    }

    /// Convenience initializer that maps a ``HaapiAccessorStore/StoreError``
    /// to the matching error code + human-readable reason.
    convenience init(_ error: HaapiAccessorStore.StoreError) {
        self.init(code: error.code, reason: error.bridgeReason)
    }
}
#else
internal final class HaapiAccessorBridgeException: Error, CustomStringConvertible {
    let code: String
    let description: String

    init(code: String, reason: String) {
        self.code = code
        self.description = reason
    }

    /// Convenience initializer that maps a ``HaapiAccessorStore/StoreError``
    /// to the matching error code + human-readable reason.
    convenience init(_ error: HaapiAccessorStore.StoreError) {
        self.init(code: error.code, reason: error.bridgeReason)
    }
}
#endif

extension HaapiAccessorStore.StoreError {
    /// Human-readable reason surfaced in `error.message` on the JS side.
    /// Pairs with the stable `code` from ``HaapiAccessorStore/StoreError/code``.
    var bridgeReason: String {
        switch self {
        case .alreadyInitialized:
            return "An accessor is already initialized. Call close() before re-initializing."
        case .notInitialized:
            return "Bridge not initialized. Call initializeForHaapi() or initializeForOAuth() first."
        case .wrongKind:
            return "Stored accessor does not support this operation. Call close() and re-initialize in the required mode."
        case let .flowCacheMiss(reason):
            return reason
        }
    }
}
