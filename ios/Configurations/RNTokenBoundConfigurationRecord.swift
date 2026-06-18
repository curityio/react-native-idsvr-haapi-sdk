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
struct RNTokenBoundConfigurationRecord: Record {
    /// Key type used for token binding.
    @Field var keyPairType: RNCryptoKeyType = .p256

    init() {}
    init(keyPairType: RNCryptoKeyType) {
        self.keyPairType = keyPairType
    }
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
