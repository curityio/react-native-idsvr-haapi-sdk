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

/// Defines how the OAuth client authenticates when calling the token endpoint.
///
/// This is a "flat" Record that captures every iOS-relevant field from the TypeScript
/// discriminated union `ClientAuthenticationMethodConfiguration`. The `kind` field
/// determines which variant was sent; all other fields are optional and only populated
/// for the relevant variant.
///
/// | `kind`             | Relevant iOS fields                                                                          |
/// |--------------------|----------------------------------------------------------------------------------------------|
/// | `"none"`           | *(none)*                                                                                     |
/// | `"secret"`         | `secret`                                                                                     |
/// | `"mtls"`           | `pkcs12Filename`, `pkcs12Passphrase`, `serverPEMFilename`, `isValidatingHostname`, `bundleOption` |
/// | `"mtlsKeyPinning"` | `pkcs12Filename`, `pkcs12Passphrase`, `serverKeyPinnings`, `bundleOption`                    |
/// | `"jwtAsymmetric"`  | `asymmetricAlgorithm`, `pemFilename`, `bundleOption`                                         |
/// | `"jwtSymmetric"`   | `symmetricAlgorithm`, `secretKey`                                                            |
struct ClientAuthenticationMethodConfigurationRecord: Record {
    /// Discriminator identifying which authentication method variant was sent from TypeScript.
    @Field var kind: ClientAuthenticationKind = .none

    // MARK: Secret
    /// The shared client secret (when `kind == "secret"`).
    @Field var secret: String?

    // MARK: MTLS / MTLS Key Pinning (shared)
    /// PKCS#12 filename (without extension) containing the client certificate and key.
    @Field var pkcs12Filename: String?
    /// Passphrase for the PKCS#12 file.
    @Field var pkcs12Passphrase: String?

    // MARK: MTLS only
    /// Server PEM filename (without extension) for trust evaluation (when `kind == "mtls"`).
    @Field var serverPEMFilename: String?
    /// Whether the server certificate should be validated against the hostname (when `kind == "mtls"`).
    @Field var isValidatingHostname: Bool

    // MARK: MTLS Key Pinning only
    /// Key pinnings for the server public key (when `kind == "mtlsKeyPinning"`).
    @Field var serverKeyPinnings: [KeyPinningRecord]?

    // MARK: JWT Asymmetric only
    /// Asymmetric signing algorithm, e.g. `.es256` (when `kind == "jwtAsymmetric"`).
    @Field var asymmetricAlgorithm: RNJWTAsymmetricAlgorithm?
    /// PEM filename (without extension) containing the private key (when `kind == "jwtAsymmetric"`).
    @Field var pemFilename: String?
    /// Alias to use in the KeyStore (when `kind == "jwtAsymmetric"`). Android-only; ignored on iOS.
    @Field var alias: String?

    // MARK: JWT Symmetric only
    /// Symmetric signing algorithm, e.g. `.hs256` (when `kind == "jwtSymmetric"`).
    @Field var symmetricAlgorithm: RNJWTSymmetricAlgorithm?
    /// The shared secret key used for signing (when `kind == "jwtSymmetric"`).
    @Field var secretKey: String?

    /// The bundle option used to resolve certificate/key files (when `kind` is MTLS or JWT asymmetric).
    @Field var bundleOption: BundleOption?
}

extension ClientAuthenticationMethodConfigurationRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        return "ClientAuthenticationMethodConfigurationRecord(kind: \(kind))"
    }
}

/// A single server key pinning entry for MTLS key pinning authentication.
///
/// Maps to the TypeScript `KeyPinning` interface.
struct KeyPinningRecord: Record {
    /// The hostname to pin.
    @Field var hostname: String = ""
    /// The Base64-encoded SHA-256 hash of the server's public key.
    @Field var publicKeyHash: String = ""
}

extension KeyPinningRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        return "KeyPinningRecord(hostname: \(hostname))"
    }
}
