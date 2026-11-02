/*
 * Copyright (C) 2026 Curity AB. All rights reserved.
 *
 * The contents of this file are the property of Curity AB.
 * You may not copy or use this file, in either source code
 * or executable form, except in compliance with terms
 * set by Curity AB.
 *
 * For further information, please contact Curity AB.
 */

// MARK: - JWT Algorithm Types

import {BundleOption} from "./ios-configuration";

/**
 * Supported asymmetric signing algorithms for JWT-based client authentication.
 *
 * Values are the uppercase JOSE names (e.g. `'ES256'`).
 */
export enum JwtAsymmetricAlgorithm {
    /** RSASSA-PKCS1-v1_5 using SHA-256 */
    RS256 = 'RS256',
    /** RSASSA-PKCS1-v1_5 using SHA-384 */
    RS384 = 'RS384',
    /** RSASSA-PKCS1-v1_5 using SHA-512 */
    RS512 = 'RS512',
    /** RSASSA-PSS using SHA-256 and MGF1 with SHA-256 */
    PS256 = 'PS256',
    /** RSASSA-PSS using SHA-384 and MGF1 with SHA-384 */
    PS384 = 'PS384',
    /** RSASSA-PSS using SHA-512 and MGF1 with SHA-512 */
    PS512 = 'PS512',
    /** ECDSA P-256 using SHA-256 */
    ES256 = 'ES256',
    /** ECDSA P-384 using SHA-384 */
    ES384 = 'ES384',
    /** ECDSA P-521 using SHA-512 */
    ES512 = 'ES512',
}

/**
 * Supported symmetric signing algorithms for JWT-based client authentication.
 *
 * Values are the uppercase JOSE names (e.g. `'HS256'`).
 */
export enum JwtSymmetricAlgorithm {
    /** HMAC using SHA-256 */
    HS256 = 'HS256',
    /** HMAC using SHA-384 */
    HS384 = 'HS384',
    /** HMAC using SHA-512 */
    HS512 = 'HS512',
}

// MARK: - Key Pinning

/**
 * Configuration used to pin the server public key for a defined hostname.
 *
 * To retrieve the public key hash, execute:
 * ```
 * openssl x509 -in your_PEM_FILE.pem -pubkey -noout \
 *   | openssl pkey -pubin -outform der \
 *   | openssl dgst -sha256 -binary \
 *   | openssl enc -base64
 * ```
 */
export interface KeyPinning {
    /** The hostname. */
    hostname: string;
    /** The public key hash for the hostname. */
    publicKeyHash: string;
}

// MARK: - Client Authentication Method Configurations

/**
 * No client authentication. Use when the client is a public client
 * or authentication is handled outside the SDK.
 */
export interface ClientAuthenticationMethodNone {
    kind: ClientAuthenticationKind.None;
}

/**
 * Secret-based client authentication (client_secret_post).
 *
 * @property secret - The client secret as configured in the Curity Identity Server.
 */
export interface ClientAuthenticationMethodSecret {
    kind: ClientAuthenticationKind.Secret;
    secret: string;
}

/**
 * Discriminator for {@link ClientAuthenticationMethodConfiguration}.
 *
 * Each value selects one variant of the discriminated union and determines
 * which fields the SDK reads from the configuration object.
 */
export enum ClientAuthenticationKind {
    /** No client authentication. */
    None = 'none',
    /** Shared secret (client_secret_post). */
    Secret = 'secret',
    /** Mutual TLS with a server trust store or PEM certificate. */
    Mtls = 'mtls',
    /** Mutual TLS with server public key pinning. */
    MtlsKeyPinning = 'mtlsKeyPinning',
    /** Signed JWT using an asymmetric key pair (private_key_jwt). */
    JwtAsymmetric = 'jwtAsymmetric',
    /** Signed JWT using a symmetric secret (client_secret_jwt). */
    JwtSymmetric = 'jwtSymmetric',
}

/**
 * Mutual TLS (MTLS) client authentication using a server trust store or PEM certificate.
 *
 * This is a cross-platform interface — each platform reads different fields:
 *
 * **iOS fields:**
 * @property pkcs12Filename - The PKCS#12 filename (without extension) containing the client certificate and key.
 * @property pkcs12Passphrase - The passphrase for the PKCS#12 file.
 * @property serverPEMFilename - The server PEM filename (without extension) for trust evaluation.
 * @property isValidatingHostname - Whether the server certificate should be validated against the hostname.
 *   Defaults to `true`. Set to `false` only for testing (e.g. localhost or IP address).
 * @property bundleOption - Which app bundle to load the certificate files from.
 *
 * **Android fields:**
 * @property clientKeyStoreOption - Identifies the client `KeyStore` provider registered with the SDK on the native side.
 * @property serverKeyStoreOption - Identifies the server trust store provider registered with the SDK on the native side.
 */
export interface ClientAuthenticationMethodMTLS {
    kind: ClientAuthenticationKind.Mtls;
    // iOS
    pkcs12Filename?: string;
    pkcs12Passphrase?: string;
    serverPEMFilename?: string;
    isValidatingHostname?: boolean;
    bundleOption?: BundleOption;
    // Android
    clientKeyStoreOption?: KeyStoreOption;
    serverKeyStoreOption?: KeyStoreOption;
}

/**
 * Identifies a `KeyStore` provider registered with the SDK on the
 * Android side. Host apps wire their own `KeyStore` instances by
 * registering a provider against one of these keys; consult the
 * Android integration guide for the registration API.
 */
export enum KeyStoreOption {
    Client = 'client',
    Server = 'server',
    AlternateClient = 'alternateClient',
    AlternateServer = 'alternateServer',
}

/**
 * Mutual TLS (MTLS) client authentication with server public key pinning.
 *
 * Instead of trusting a full certificate chain, the server's public key hash is
 * pinned directly. See {@link KeyPinning} for how to obtain the hash.
 *
 * **iOS fields:**
 * @property pkcs12Filename - The PKCS#12 filename (without extension) containing the client certificate and key.
 * @property pkcs12Passphrase - The passphrase for the PKCS#12 file.
 * @property bundleOption - Which app bundle to load the certificate files from.
 *
 * **Android fields:**
 * @property clientKeyStoreOption - Identifies the client `KeyStore` provider registered with the SDK on the native side.
 * @property isValidatingHostname - Whether the server certificate hostname should be validated.
 *
 * **Shared fields:**
 * @property serverKeyPinnings - One or more {@link KeyPinning} entries. Must not be empty.
 */
export interface ClientAuthenticationMethodMtlsKeyPinning {
    kind: ClientAuthenticationKind.MtlsKeyPinning;
    // iOS
    pkcs12Filename?: string;
    pkcs12Passphrase?: string;
    bundleOption?: BundleOption;
    // Android
    clientKeyStoreOption?: KeyStoreOption;
    isValidatingHostname?: boolean;
    // Shared
    serverKeyPinnings: KeyPinning[];
}

/**
 * Asymmetric signed JWT client authentication (private_key_jwt).
 *
 * On iOS, the private key is read from a PEM file in the app bundle
 * (selected via `bundleOption`). On Android, the private key is loaded
 * from a `KeyStore` provider registered with the SDK on the native side.
 *
 * **Shared fields:**
 * @property asymmetricAlgorithm - The signing algorithm (e.g. `JWTAsymmetricAlgorithm.ES256`).
 *
 * **iOS fields:**
 * @property pemFilename - The PEM filename (without extension) containing the private key.
 * @property bundleOption - Which app bundle to load the PEM file from.
 *
 * **Android fields:**
 * @property clientKeyStoreOption - Identifies the client `KeyStore` provider registered with the SDK on the native side.
 * @property alias - The alias to use in the `KeyStore`.
 */
export interface ClientAuthenticationMethodJWTAsymmetric {
    // Shared
    kind: ClientAuthenticationKind.JwtAsymmetric;
    asymmetricAlgorithm: JwtAsymmetricAlgorithm;
    // iOS
    pemFilename?: string;
    bundleOption?: BundleOption;
    // Android
    clientKeyStoreOption?: KeyStoreOption;
    alias?: string;
}

/**
 * Symmetric signed JWT client authentication (client_secret_jwt).
 *
 * @property symmetricAlgorithm - The signing algorithm (e.g. `JWTSymmetricAlgorithm.HS256`).
 * @property secretKey - The shared secret key used for HMAC signing.
 */
export interface ClientAuthenticationMethodJwtSymmetric {
    kind: ClientAuthenticationKind.JwtSymmetric;
    symmetricAlgorithm: JwtSymmetricAlgorithm;
    secretKey: string;
}

/**
 * Discriminated union of all client authentication methods supported by the HAAPI SDK.
 *
 * The `kind` field ({@link ClientAuthenticationKind}) determines which variant is active.
 * Each variant is a cross-platform interface containing both iOS and Android fields;
 * each platform reads only the fields it needs and silently ignores the rest.
 *
 * Use the platform-specific factory functions (e.g. {@link iOSMtlsAuthentication},
 * {@link AndroidMtlsAuthentication}) to construct instances with correct defaults.
 *
 * @example
 * ```ts
 * // Secret authentication (both platforms)
 * const auth = secretAuthentication('my-client-secret');
 *
 * // MTLS with key pinning (iOS)
 * const auth = iOSMTLSKeyPinningAuthentication({
 *   pkcs12Filename: 'client-certificate',
 *   pkcs12Passphrase: 'changeit',
 *   serverKeyPinnings: [
 *     { hostname: 'idsvr.example.com', publicKeyHash: 'abc123...' },
 *   ],
 * });
 * ```
 */
export type ClientAuthenticationMethodConfiguration =
    | ClientAuthenticationMethodNone
    | ClientAuthenticationMethodSecret
    | ClientAuthenticationMethodMTLS
    | ClientAuthenticationMethodMtlsKeyPinning
    | ClientAuthenticationMethodJWTAsymmetric
    | ClientAuthenticationMethodJwtSymmetric;

// MARK: - Factory helpers

/**
 * Creates a "no authentication" configuration. Used for public clients.
 */
export function noAuthentication(): ClientAuthenticationMethodNone {
    return { kind: ClientAuthenticationKind.None };
}

/**
 * Creates a secret-based authentication configuration.
 * Works on both iOS and Android.
 *
 * @param secret - The client secret as configured in the Curity Identity Server.
 */
export function secretAuthentication(
    secret: string,
): ClientAuthenticationMethodSecret {
    return { kind: ClientAuthenticationKind.Secret, secret };
}

/**
 * Creates an MTLS authentication configuration for iOS.
 *
 * Loads the client PKCS#12 certificate and server PEM from the app bundle.
 *
 * @param params.pkcs12Filename - PKCS#12 filename (without extension).
 * @param params.pkcs12Passphrase - Passphrase for the PKCS#12 file.
 * @param params.serverPEMFilename - Server PEM filename (without extension) for trust evaluation.
 * @param params.isValidatingHostname - Validate server hostname. Defaults to `true`.
 * @param params.bundleOption - App bundle to load files from. Defaults to `BundleOption.Main`.
 */
export function iOSMtlsAuthentication(params: {
    pkcs12Filename: string;
    pkcs12Passphrase: string;
    serverPEMFilename: string;
    isValidatingHostname?: boolean;
    bundleOption?: BundleOption;
}): ClientAuthenticationMethodMTLS {
    return {
        kind: ClientAuthenticationKind.Mtls,
        ...params,
        isValidatingHostname: params.isValidatingHostname ?? true,
        bundleOption: params.bundleOption ?? BundleOption.Main,
    };
}

/**
 * Creates an MTLS authentication configuration for Android.
 *
 * Resolves the client certificate and server trust store from `KeyStore`
 * providers registered with the SDK on the native side.
 *
 * @param params.clientKeyStoreOption - Selects the registered client `KeyStore` provider. Defaults to `KeyStoreOption.Client`.
 * @param params.serverKeyStoreOption - Selects the registered server trust-store provider. Defaults to `KeyStoreOption.Server`.
 */
export function AndroidMtlsAuthentication(params: {
    clientKeyStoreOption?: KeyStoreOption;
    serverKeyStoreOption?: KeyStoreOption;
}): ClientAuthenticationMethodMTLS {
    return {
        kind: ClientAuthenticationKind.Mtls,
        ...params,
        clientKeyStoreOption: params.clientKeyStoreOption ?? KeyStoreOption.Client,
        serverKeyStoreOption: params.serverKeyStoreOption ?? KeyStoreOption.Server,
    };
}

/**
 * Creates an MTLS key pinning authentication configuration for iOS.
 *
 * @param params.pkcs12Filename - PKCS#12 filename (without extension).
 * @param params.pkcs12Passphrase - Passphrase for the PKCS#12 file.
 * @param params.serverKeyPinnings - Server public key pinnings. Must not be empty.
 * @param params.bundleOption - App bundle to load files from. Defaults to `BundleOption.Main`.
 * @throws If `serverKeyPinnings` is empty.
 */
export function iOSMtlsKeyPinningAuthentication(params: {
    pkcs12Filename: string;
    pkcs12Passphrase: string;
    serverKeyPinnings: KeyPinning[];
    bundleOption?: BundleOption;
}): ClientAuthenticationMethodMtlsKeyPinning {
    if (params.serverKeyPinnings.length === 0) {
        throw new Error('serverKeyPinnings cannot be empty.');
    }
    return {
        kind: ClientAuthenticationKind.MtlsKeyPinning,
        ...params,
        bundleOption: params.bundleOption ?? BundleOption.Main,
    };
}

/**
 * Creates an MTLS key pinning authentication configuration for Android.
 *
 * @param params.clientKeyStoreOption - Selects the registered client `KeyStore` provider. Defaults to `KeyStoreOption.Client`.
 * @param params.isValidatingHostname - Validate server hostname. Defaults to `true`.
 * @param params.serverKeyPinnings - Server public key pinnings. Must not be empty.
 * @throws If `serverKeyPinnings` is empty.
 */
export function AndroidMtlsKeyPinningAuthentication(params: {
    clientKeyStoreOption?: KeyStoreOption;
    isValidatingHostname?: boolean;
    serverKeyPinnings: KeyPinning[];
}): ClientAuthenticationMethodMtlsKeyPinning {
    if (params.serverKeyPinnings.length === 0) {
        throw new Error('serverKeyPinnings cannot be empty.');
    }
    return {
        kind: ClientAuthenticationKind.MtlsKeyPinning,
        ...params,
        clientKeyStoreOption: params.clientKeyStoreOption ?? KeyStoreOption.Client,
        isValidatingHostname: params.isValidatingHostname ?? true,
    };
}

/**
 * Creates an asymmetric JWT authentication configuration for iOS (private_key_jwt).
 *
 * The private key is loaded from a PEM file in the app bundle.
 *
 * @param params.asymmetricAlgorithm - The signing algorithm (e.g. `JWTAsymmetricAlgorithm.ES256`).
 * @param params.pemFilename - PEM filename (without extension) containing the private key.
 * @param params.bundleOption - App bundle to load the PEM from. Defaults to `BundleOption.Main`.
 */
export function iOSJwtAsymmetricAuthentication(params: {
    asymmetricAlgorithm: JwtAsymmetricAlgorithm;
    pemFilename: string;
    bundleOption?: BundleOption;
}): ClientAuthenticationMethodJWTAsymmetric {
    return {
        kind: ClientAuthenticationKind.JwtAsymmetric,
        ...params,
        bundleOption: params.bundleOption ?? BundleOption.Main,
    };
}

/**
 * Creates an asymmetric JWT authentication configuration for Android (private_key_jwt).
 *
 * The private key is loaded from a `KeyStore` provider registered with
 * the SDK on the native side.
 *
 * @param params.asymmetricAlgorithm - The signing algorithm (e.g. `JWTAsymmetricAlgorithm.ES256`).
 * @param params.alias - The alias to look up in the `KeyStore`.
 * @param params.clientKeyStoreOption - Selects the registered client `KeyStore` provider. Defaults to `KeyStoreOption.Client`.
 */
export function AndroidJwtAsymmetricAuthentication(params: {
    asymmetricAlgorithm: JwtAsymmetricAlgorithm;
    alias: string;
    clientKeyStoreOption?: KeyStoreOption;
}): ClientAuthenticationMethodJWTAsymmetric {
    return {
        kind: ClientAuthenticationKind.JwtAsymmetric,
        ...params,
        clientKeyStoreOption: params.clientKeyStoreOption ?? KeyStoreOption.Client,
    };
}

/**
 * Creates a symmetric signed JWT authentication configuration.
 *
 * Cross-platform — works on both iOS and Android with the same configuration.
 */
export function jwtSymmetricAuthentication(params: {
    symmetricAlgorithm: JwtSymmetricAlgorithm;
    secretKey: string;
}): ClientAuthenticationMethodJwtSymmetric {
    return { kind: ClientAuthenticationKind.JwtSymmetric, ...params };
}
