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
import type {OAuthAuthorizationParameters} from "./haapi-configuration"
import type {IOSAttestationConfiguration, DcrConfiguration} from "./shared";
import {
    type ClientAuthenticationMethodConfiguration,
    noAuthentication,
} from "./clientAuthenticationMethods";

/**
 * iOS-specific configuration for the HAAPI client.
 *
 * Maps to the `HaapiConfigurable` protocol and `HaapiConfiguration` class
 * in the native iOS SDK (`IdsvrHaapiSdk`).
 *
 * These fields are extracted from `RNHaapiConfiguration.iosConfig` on the
 * native side via `iOSConfigurationRecord` and forwarded to
 * `HaapiConfiguration.init(...)`.
 */
export interface IOSConfiguration {
    /**
    * Display name for the client configuration.
    *
    * Maps to `HaapiConfiguration.name` on iOS. Must be unique per `HaapiManager`.
    *
    * @example "ios_app_configuration"
    */
    readonly name: string;
    /**
    * Client identifier registered in the Curity Identity Server.
    *
    * Maps to `HaapiConfiguration.clientId` on iOS.
    *
    * @example "my-ios-client"
    */
    readonly clientId: string;
    /**
    * Redirect URI (deep link) registered for the iOS application.
    *
    * Maps to `HaapiConfiguration.appRedirect` on iOS.
    *
    * @remarks
    * Must match the redirect URI configured on the server and in the app's
    * iOS URL Types / universal link configuration.
    *
    * @example "myapp://callback"
    */
    readonly appRedirect: string;

    /**
    * URLSession behavior used for network calls on iOS.
    *
    * Maps to `HaapiConfiguration.urlSession` on iOS. The native bridge
    * creates the appropriate `URLSession` based on this option.
    *
    * @remarks
    * - `default`: Uses `URLSessionConfiguration.haapi` (ephemeral, 20s timeout, no cache).
    * - `ephemeral`: Uses an ephemeral session (no persistent cookies/cache).
    * - `custom`: Requires additional custom configuration on the native side.
    */
    readonly urlSessionOption: URLSessionOption;

    /**
    * Attestation configuration (DeviceCheck / App Attest).
    *
    * Maps to `HaapiConfiguration.attestationConfiguration` on iOS.
    * Only applicable to physical devices; attestation does not work on simulators.
    */
    readonly attestationConfiguration: IOSAttestationConfiguration;
    /**
    * Token binding configuration (key material + storage strategy).
    *
    * Maps to `HaapiConfiguration.tokenBoundConfiguration` on iOS.
    * Default on the native side is `UnboundedTokenConfiguration`.
    */
    readonly tokenBoundConfiguration: IOSTokenBoundConfiguration;
    /**
    * Client authentication method used when calling the token endpoint.
    *
    * Maps to `HaapiConfiguration.clientAuthenticationMethod` on iOS.
    * Deserialized on the native side via `ClientAuthenticationMethodConfigurationRecord`
    * (a flat Record whose `kind` field selects the variant).
    * Default is `noAuthentication()` (`{ kind: "none" }`).
    *
    * @see {@link ClientAuthenticationMethodConfiguration} for available variants.
    * @see {@link noAuthentication}, {@link secretAuthentication},
    *      {@link iOSMTLSAuthentication}, {@link iOSMTLSKeyPinningAuthentication},
    *      {@link iOSJWTAsymmetricAuthentication}, {@link jwtSymmetricAuthentication}
    *      for factory helpers.
    */
    readonly clientAuthenticationMethodConfiguration: ClientAuthenticationMethodConfiguration;

    /**
    * Optional Dynamic Client Registration (DCR) configuration.
    *
    * @remarks
    * DCR is handled outside the `HaapiConfiguration` on the native side.
    */
    readonly dcrConfiguration?: IOSDcrConfiguration;
    /**
    * Whether to enable risk assessment (OS + device info).
    *
    * Maps to `HaapiConfiguration.riskAssessmentConfiguration` on iOS.
    * When `true`, the native side creates a `RiskAssessmentConfiguration`.
    * When `false` or omitted, `riskAssessmentConfiguration` is `nil`.
    *
    * @remarks
    * Server support for risk assessment requires Curity Identity Server >= 9.7.0.
    */
    readonly useRiskAssessmentConfiguration?: boolean;


    /**
    * Whether a token endpoint response listener is registered on the native side.
    *
    * When `true`, the native module will forward token endpoint responses to the
    * registered listener. When `false`, responses are not observed.
    *
    * @default false
    */
    readonly hasTokenEndpointResponseListener: boolean;

    /**
    * Optional per-platform override of authorization request parameters.
    *
    * @remarks
    * These parameters are appended to the authorization request. Useful for
    * injecting `prompt`, `ui_locales`, `acr_values`, etc.
    */
    readonly authorizationParameters?: OAuthAuthorizationParameters;
    /**
    * Optional per-platform override of HTTP headers applied to SDK network calls.
    *
    * @remarks
    * Must be a simple key-value map (JSON-serializable).
    * Useful for correlation IDs, app version headers, etc.
    */
    readonly httpHeaders?: Record<string, string>;
}

/**
 * Selects the URLSession behavior used for network calls on iOS.
 */
export enum URLSessionOption {
    /** Default session behavior. */
    Default = 'default',
    /** Ephemeral session (no persistent cookies/cache). */
    Ephemeral = 'ephemeral',
    /** Custom session — requires additional configuration on the native side. */
    Custom = 'custom',
}

/**
 * Selects which app bundle to load certificate/key files from on iOS.
 */
export enum BundleOption {
    /** The main application bundle (`Bundle.main`). */
    Main = 'main',
    /** A custom bundle — requires additional configuration on the native side. */
    Custom = 'custom',
}

/**
 * iOS Dynamic Client Registration configuration.
 *
 * @remarks
 * Inherits `templateClientId` and `clientRegistrationEndpointUrl` from
 * the shared {@link DcrConfiguration} interface. No additional iOS-specific
 * fields are required at this time.
 */
export interface IOSDcrConfiguration extends DcrConfiguration {}

/**
 * Token binding configuration for iOS.
 *
 * Maps to `HaapiConfiguration.tokenBoundConfiguration` on the native side.
 * Use {@link UnboundedTokenConfiguration} for the default (no sender-constrained tokens)
 * or {@link BoundTokenConfiguration} for DPoP / sender-constrained flows.
 */
export interface IOSTokenBoundConfiguration {
    /**
    * Cryptographic key type used for token binding proof-of-possession.
    */
    readonly keyPairType: CryptoKeyType
}

/**
 * Default token binding configuration — no sender-constrained tokens.
 *
 * Uses `CryptoKeyType.SecureEnclave` as the key type. On the native side this
 * maps to `UnboundedTokenConfiguration` in the HAAPI iOS SDK.
 */
export class UnboundedTokenConfiguration implements IOSTokenBoundConfiguration {
    readonly keyPairType = CryptoKeyType.SecureEnclave;
}

/**
 * Token binding configuration for DPoP or sender-constrained token flows.
 *
 * On the native side this maps to `BoundTokenConfiguration` in the HAAPI iOS SDK.
 *
 * @param keyPairType - The cryptographic key type. Defaults to `CryptoKeyType.SecureEnclave`.
 */
export class BoundTokenConfiguration implements IOSTokenBoundConfiguration {
    readonly keyPairType: CryptoKeyType;

    constructor(keyPairType: CryptoKeyType = CryptoKeyType.SecureEnclave) {
        this.keyPairType = keyPairType;
    }
}

/**
 * Cryptographic key types for token binding on iOS.
 */
export enum CryptoKeyType {
    /** Standard P-256 key pair. */
    P256 = "p256",
    /** Store private key in Secure Enclave (iOS device capability dependent). */
    SecureEnclave = "secureEnclave",
    /** Store key material using Security framework / Keychain. */
    Security = "security"
}

/**
 * Creates a normalized {@link IOSConfiguration} object for the HAAPI iOS client.
 *
 * @remarks
 * This helper applies sensible defaults for optional parameters and ensures that
 * required properties (`clientId` and `appRedirect`) are provided.
 *
 * The returned object is plain and JSON-serializable, making it safe to pass
 * across the Expo Modules bridge to the native Swift implementation.
 *
 * ### Default Values
 * - `name`: `"default-ios-configuration"`
 * - `urlSessionOption`: {@link URLSessionOption.Default}
 * - `attestationConfiguration`:
 *   `{ useAttestation: true, attestationMaxRetries: 3 }`
 * - `tokenBoundConfiguration`:
 *   `{ keyPairType: CryptoKeyType.SecureEnclave }`
 * - `clientAuthenticationMethodConfig`:
 *   `noAuthentication()` ({@link ClientAuthenticationMethodConfiguration} with `kind: "none"`)
 * - `useRiskAssessmentConfiguration`: `false`
 *
 * @param clientId - Client identifier registered in the Curity Identity Server.
 * @param appRedirect - Redirect URI (deep link) registered for the iOS application.
 * @param name - Configuration name.
 * @param urlSessionOption - URLSession behavior for network calls.
 * @param attestationConfiguration - Attestation configuration.
 * @param tokenBoundConfiguration - Token binding configuration.
 * @param clientAuthenticationMethodConfig - Client authentication method.
 * @param dcrConfiguration - Dynamic Client Registration configuration.
 * @param useRiskAssessmentConfiguration - Whether to enable risk assessment (OS + device info).
 * @param hasTokenEndpointResponseListener - Whether a token endpoint response listener is registered.
 * @param authorizationParameters - Optional per-platform authorization parameter overrides.
 * @param httpHeaders - Optional per-platform HTTP header overrides.
 *
 * @throws Error If `clientId` or `appRedirect` is missing or empty.
 *
 * @returns A fully constructed {@link IOSConfiguration}.
 *
 * @example
 * const iosConfig = createIOSConfiguration({
 *   clientId: "my-ios-client",
 *   appRedirect: "myapp://callback"
 * });
 *
 * @example
 * const iosConfig = createIOSConfiguration({
 *   clientId: "my-ios-client",
 *   appRedirect: "myapp://callback",
 *   urlSessionOption: URLSessionOption.Ephemeral,
 *   clientAuthenticationMethodConfig: iOSJWTAsymmetricAuthentication({
 *     asymmetricAlgorithm: JWTAsymmetricAlgorithm.ES256,
 *     pemFilename: "client-key",
 *   }),
 * });
 */
export function createIOSConfiguration({
    clientId,
    appRedirect,
    name = "default-ios-configuration",
    urlSessionOption = URLSessionOption.Default,
    attestationConfiguration = { useAttestation: true, attestationMaxRetries: 3 },
    tokenBoundConfiguration = new UnboundedTokenConfiguration(),
    clientAuthenticationMethodConfig = noAuthentication(),
    dcrConfiguration,
    useRiskAssessmentConfiguration = false,
    hasTokenEndpointResponseListener = false,
    authorizationParameters,
    httpHeaders,

}: {
    clientId: string;
    appRedirect: string;
    name?: string;
    urlSessionOption?: URLSessionOption;
    attestationConfiguration?: IOSAttestationConfiguration;
    tokenBoundConfiguration?: IOSTokenBoundConfiguration;
    clientAuthenticationMethodConfig?: ClientAuthenticationMethodConfiguration;
    dcrConfiguration?: IOSDcrConfiguration;
    useRiskAssessmentConfiguration?: boolean;
    hasTokenEndpointResponseListener?: boolean;
    authorizationParameters?: OAuthAuthorizationParameters;
    httpHeaders?: Record<string, string>;
}): IOSConfiguration {
    if (!clientId) {
        throw new Error("IOSConfiguration: `clientId` is required");
    }
    if (!appRedirect) {
        throw new Error("IOSConfiguration: `appRedirect` is required");
    }

    return {
        name,
        clientId,
        appRedirect,
        urlSessionOption,
        attestationConfiguration,
        tokenBoundConfiguration,
        clientAuthenticationMethodConfiguration: clientAuthenticationMethodConfig,
        dcrConfiguration,
        useRiskAssessmentConfiguration,
        hasTokenEndpointResponseListener,
        authorizationParameters,
        httpHeaders,
    };
}
