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

/// Token binding configuration.
///
/// Deserialized from the TypeScript `IOSTokenBindingConfiguration` discriminated union. `kind` selects the
/// mode; a record without it is rejected at conversion rather than read as "no binding".
struct RNTokenBindingConfigurationRecord: Record {
    /// Token-binding mode.
    @Field var kind: RNTokenBindingKind?
    /// Key type used for token binding; required when `kind` is `.bound`.
    @Field var keyPairType: RNCryptoKeyType?

    init() {}
    init(kind: RNTokenBindingKind?, keyPairType: RNCryptoKeyType? = nil) {
        self.kind = kind
        self.keyPairType = keyPairType
    }
}

extension RNTokenBindingConfigurationRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "kind": kind?.rawValue ?? "nil",
            "keyPairType": keyPairType?.rawValue ?? "nil",
        ].debugDescription
    }
}

/// Token-binding modes; raw values match the TypeScript `TokenBindingKind` enum.
enum RNTokenBindingKind: String, Enumerable {
    /// No token binding.
    case unbound = "unbound"
    /// Token binding with the configured key type.
    case bound = "bound"
}

/// Key types used for token binding on iOS.
enum RNCryptoKeyType: String, Enumerable {
    /// Standard P-256 key pair.
    case p256 = "p256"
    /// Store private key in Secure Enclave (device capability dependent).
    case secureEnclave = "secureEnclave"
    /// Store key material using Security framework / Keychain.
    case security = "security"
}
