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
import type {DcrConfiguration} from "./shared";
import {type ClientAuthenticationMethodConfiguration, noAuthentication} from "./clientAuthenticationMethods";

/**
 * Android-specific configuration for the HAAPI client.
 *
 * Maps to the `HaapiConfigurable` interface and `HaapiConfiguration` data class
 * in the native Android SDK (`se.curity.identityserver.haapi.android.sdk`).
 *
 * These fields are extracted from `RNHaapiConfiguration.androidConfig` on the
 * native side via `AndroidConfigurationRecord` and forwarded to
 * `HaapiConfiguration(...)` in `toHaapiConfiguration()`.
 *
 * @remarks
 * String values representing URLs are converted to `java.net.URI` on the native side.
 * Closure/function-typed native properties (e.g., `httpUrlConnectionProvider`,
 * `currentTimeMillisProvider`) are selected via option enums and instantiated natively.
 *
 * Use {@link createAndroidConfiguration} to construct this object with
 * sensible defaults.
 */
export interface AndroidConfiguration {
    /**
     * Key store alias used for secure key storage in the Android Keystore.
     *
     * Maps to `HaapiConfiguration.keyStoreAlias` on Android.
     * Must be unique per `HaapiManager` instance.
     *
     * @default "default_keystore_alias"
     */
    readonly keyStoreAlias: string;

    /**
     * Client identifier registered in the Curity Identity Server.
     *
     * Maps to `HaapiConfiguration.clientId` on Android.
     *
     * @example "my-android-client"
     */
    readonly clientId: string;

    /**
     * App redirect URI (deep link) registered for the Android application.
     *
     * Maps to `HaapiConfiguration.appRedirect` on Android.
     *
     * @remarks
     * Must match the redirect URI configured on the server and in the app's
     * intent filter / App Links configuration.
     *
     * @example "myapp://callback"
     */
    readonly appRedirect: string;

    /**
     * Selects the HTTP connection provider used for HAAPI network calls.
     *
     * Maps to `HaapiConfiguration.httpUrlConnectionProvider` on Android.
     * The native bridge creates the appropriate `HttpURLConnection` lambda
     * based on this option.
     *
     * @remarks
     * - `"default"`: Uses the SDK's built-in `HttpURLConnection` provider with adjusted timeouts.
     * - `"custom"`: Allows injecting a custom provider on the native side.
     *
     * @default "default"
     */
    readonly httpUrlConnectionProviderOption: HttpUrlConnectionProviderOption;

    /**
     * Selects the time provider used for token TTL and replay-protection checks.
     *
     * Maps to `HaapiConfiguration.currentTimeMillisProvider` on Android.
     * The native bridge creates the appropriate lambda based on this option.
     *
     * @remarks
     * - `"default"`: Uses `System.currentTimeMillis()`.
     * - `"custom"`: Allows injecting a custom time provider on the native side
     *   (useful for testing or clock-skew compensation).
     *
     * @default "default"
     */
    readonly currentTimeMillisProviderOption: CurrentTimeMillisProviderOption;

    /**
     * Attestation configuration (key attestation on Android).
     *
     * Maps to `HaapiConfiguration.useAttestation` on Android.
     * The Android native SDK only uses `useAttestation: Boolean`.
     * For iOS attestation with retry support, see {@link IOSAttestationConfiguration}.
     */
    readonly attestationConfiguration: AndroidAttestationConfiguration;

    /**
     * Token binding configuration (key material + storage strategy).
     *
     * Maps to `HaapiConfiguration.tokenBoundConfiguration` on Android.
     * Converted via `toTokenBoundConfiguration()` with `ECGenParameterSpec`,
     * `KeyPairAlgorithmConfig`, and a `SharedPreferences`-backed `Storage`.
     *
     * @remarks
     * Defines how cryptographic key pairs are generated and stored for
     * DPoP or sender-constrained token flows on Android.
     */
    readonly tokenBoundConfiguration?: AndroidTokenBoundConfiguration;

    /**
     * Client authentication method used when calling the token endpoint.
     *
     * Deserialized on the native side via `ClientAuthenticationMethodConfigurationRecord`
     * (a flat Record whose `kind` field selects the variant).
     * Default is `noAuthentication()` (`{ kind: "none" }`).
     *
     * @see {@link ClientAuthenticationMethodConfiguration} for available variants.
     * @see {@link noAuthentication}, {@link secretAuthentication},
     *      {@link AndroidMTLSAuthentication}, {@link AndroidMTLSKeyPinningAuthentication},
     *      {@link AndroidJWTAsymmetricAuthentication}, {@link jwtSymmetricAuthentication}
     *      for factory helpers.
     */
    readonly clientAuthenticationMethodConfiguration: ClientAuthenticationMethodConfiguration;

    /**
     * Dynamic Client Registration (DCR) configuration.
     *
     * @remarks
     * Required when DCR is enabled for the client in the Curity Identity Server.
     * Includes the template client ID and the registration endpoint.
     */
    readonly dcrConfiguration?: AndroidDcrConfiguration;

    /**
     * Whether to enable risk assessment for the authentication flow.
     *
     * When `true`, the native side provides the application context to the
     * HAAPI SDK so it can collect device and environment signals.
     * When `false`, risk assessment is disabled.
     *
     * @default false
     */
    readonly useRiskAssessmentConfiguration: boolean;

    /**
     * Selects the token endpoint response listener implementation.
     *
     * Maps to `HaapiConfiguration.tokenEndpointResponseListener` on Android.
     * Currently the native bridge passes `null` for the default option.
     *
     * @remarks
     * - {@link TokenEndpointResponseListenerOption.None}: No-op listener (null).
     * - {@link TokenEndpointResponseListenerOption.Custom}: Allows injecting a custom
     *   listener on the native side for observing token responses.
     */
    readonly tokenEndpointResponseListenerOption?: TokenEndpointResponseListenerOption;

    /**
     * Optional application context selector for BankID v6 or similar flows
     * that require additional app context information.
     *
     * Maps to `HaapiConfiguration.applicationContext` on Android.
     * The actual `android.content.Context` is resolved on the native side;
     * this option controls which context is used.
     */
    readonly applicationContextOption?: ApplicationContextOption;
}


/**
 * Android-specific token binding configuration.
 *
 * @remarks
 * This configuration defines how cryptographic key material is generated,
 * stored, and managed when using token binding (e.g., DPoP or sender-constrained tokens)
 * on Android.
 */
export interface AndroidTokenBoundConfiguration {
    /**
     * Alias used to identify the generated key pair in the Android Keystore.
     *
     * @remarks
     * - Must be unique per application installation.
     * - If the alias already exists, the native layer may reuse or overwrite
     *   the existing key depending on implementation.
     *
     * @example "haapi_key_alias"
     */
    readonly keyAlias: string;

    /**
     * Algorithm configuration for the key pair used in token binding JWTs.
     *
     * @remarks
     * Use one of the pre-defined entries from {@link KeyPairAlgorithmConfig}:
     * `KeyPairAlgorithmConfig.ES256`, `.ES384`, or `.ES512`.
     */
    readonly keyPairAlgorithmConfiguration: KeyPairAlgorithmConfiguration;

    /**
     * Storage strategy for the token binding key material.
     *
     * @remarks
     * - {@link StorageOption.Default}: Uses the SDK's built-in storage (Android Keystore).
     * - {@link StorageOption.Custom}: Allows injecting a custom storage provider.
     */
    readonly storageOption: StorageOption;
}

/**
 * Attestation configuration for Android.
 *
 * Unlike the iOS {@link IOSAttestationConfiguration}, Android only supports
 * a boolean toggle — the native SDK does not expose a retry count.
 */
export interface AndroidAttestationConfiguration {
    /** Whether attestation is enabled. */
    readonly useAttestation: boolean;
}

export enum HttpUrlConnectionProviderOption {
    /** Uses the SDK's built-in HttpURLConnection provider. */
    Default = 'default',
    /** Allows injecting a custom provider on the native side. */
    Custom = 'custom',
}

export enum CurrentTimeMillisProviderOption {
    /** Uses System.currentTimeMillis() on the native side. */
    Default = 'default',
    /** Allows injecting a custom time provider on the native side. */
    Custom = 'custom',
}

/**
 * Pre-defined key pair algorithm configurations for Android token binding.
 *
 * Mirrors the Kotlin `KeyPairAlgorithmConfig` enum which has exactly three entries:
 * `ES256`, `ES384`, and `ES512`. Each entry pairs a JWT algorithm name with
 * its corresponding EC curve and algorithm type.
 *
 * @remarks
 * Use one of the three pre-built entries instead of constructing a configuration
 * manually. This prevents invalid algorithm/curve combinations.
 *
 * @example
 * ```typescript
 * const tokenBound = {
 *     keyAlias: "my_key",
 *     keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES256,
 *     storageOption: StorageOption.Default,
 * };
 * ```
 */
export const KeyPairAlgorithmConfig = {
    /** ES256 algorithm with secp256r1 curve (NIST P-256). */
    ES256: { jwtAlgorithm: "ES256", curve: "secp256r1", algorithmType: "EC" },
    /** ES384 algorithm with secp384r1 curve (NIST P-384). */
    ES384: { jwtAlgorithm: "ES384", curve: "secp384r1", algorithmType: "EC" },
    /** ES512 algorithm with secp521r1 curve (NIST P-521). */
    ES512: { jwtAlgorithm: "ES512", curve: "secp521r1", algorithmType: "EC" },
} as const;

/**
 * A valid key pair algorithm configuration for Android token binding.
 *
 * This type is a union of the three pre-defined entries in {@link KeyPairAlgorithmConfig},
 * ensuring only valid algorithm/curve pairs are accepted:
 *
 * | Entry   | `jwtAlgorithm` | `curve`     | `algorithmType` |
 * |---------|----------------|-------------|-----------------|
 * | `ES256` | `"ES256"`      | `"secp256r1"` | `"EC"`        |
 * | `ES384` | `"ES384"`      | `"secp384r1"` | `"EC"`        |
 * | `ES512` | `"ES512"`      | `"secp521r1"` | `"EC"`        |
 *
 * @remarks
 * Maps to the Kotlin `KeyPairAlgorithmConfig` enum in the native Android SDK.
 */
export type KeyPairAlgorithmConfiguration =
    typeof KeyPairAlgorithmConfig[keyof typeof KeyPairAlgorithmConfig];

/**
 * Storage strategy for token binding key material on Android.
 */
export enum StorageOption {
    /** Uses the SDK's built-in storage strategy (Android Keystore). */
    Default = 'default',
    /** Allows injecting a custom storage provider on the native side. */
    Custom = 'custom',
}

/**
 * Selects the token endpoint response listener on Android.
 *
 * @remarks
 * The listener receives callbacks when the SDK obtains a token response,
 * enabling custom logging, analytics, or side effects.
 */
export enum TokenEndpointResponseListenerOption {
    /** No listener — token endpoint responses are not observed. */
    None = 'none',
    /** Allows injecting a custom listener on the native side. */
    Custom = 'custom',
}

/**
 * Android Dynamic Client Registration configuration.
 *
 * @remarks
 * Extends the shared {@link DcrConfiguration} with an Android-specific
 * application context option.
 */
export interface AndroidDcrConfiguration extends DcrConfiguration {
    /**
     * Selects the application context provider for DCR operations.
     *
     * @remarks
     * - {@link ApplicationContextOption.Default}: Uses the host application's context.
     * - {@link ApplicationContextOption.Custom}: Allows injecting a custom context
     *   on the native side.
     */
    readonly contextOption: ApplicationContextOption;
}

/**
 * Selects the application context provider for Android DCR operations.
 */
export enum ApplicationContextOption {
    /** Uses the host application's context. */
    Default = 'default',
    /** Allows injecting a custom context on the native side. */
    Custom = 'custom'
}

/**
 * Creates a normalized {@link AndroidConfiguration} object for the HAAPI Android client.
 *
 * @remarks
 * This helper applies sensible defaults for optional parameters and ensures that
 * required properties (`clientId` and `appRedirect`) are provided.
 *
 * The returned object is plain and JSON-serializable, making it safe to pass
 * across the Expo Modules bridge to the native Kotlin implementation.
 *
 * ### Default Values
 * - `keyStoreAlias`: `"default_keystore_alias"`
 * - `httpUrlConnectionProviderOption`: `"default"`
 * - `currentTimeMillisProviderOption`: `"default"`
 * - `attestationConfiguration`:
 *   `{ useAttestation: true }`
 * - `tokenBoundConfiguration`:
 *   `{ keyAlias: "haapi_token_bound_key", keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES256, storageOption: StorageOption.Default }`
 * - `clientAuthenticationMethodConfig`:
 *   `noAuthentication()` ({@link ClientAuthenticationMethodConfiguration} with `kind: "none"`)
 * - `tokenEndpointResponseListenerOption`:
 *   {@link TokenEndpointResponseListenerOption.None}
 *
 * @param clientId - Client identifier registered in the Curity Identity Server.
 * @param appRedirect - Redirect URI (deep link) registered for the Android application.
 * @param dcrConfiguration - Optional Dynamic Client Registration configuration.
 * @param keyStoreAlias - Android Keystore alias for secure key storage.
 * @param httpUrlConnectionProviderOption - HTTP connection provider option.
 * @param currentTimeMillisProviderOption - Time provider option.
 * @param attestationConfiguration - Attestation configuration.
 * @param tokenBoundConfiguration - Token binding configuration.
 * @param clientAuthenticationMethodConfig - Client authentication method.
 * @param useRiskAssessmentConfiguration - Whether to enable risk assessment.
 * @param tokenEndpointResponseListenerOption - Token endpoint response listener option.
 * @param applicationContextOption - Application context provider for DCR/BankID flows.
 *
 * @throws Error If `clientId` or `appRedirect` is missing or empty.
 *
 * @returns A fully constructed {@link AndroidConfiguration}.
 *
 * @example
 * const androidConfig = createAndroidConfiguration({
 *   clientId: "my-android-client",
 *   appRedirect: "myapp://callback",
 *   dcrConfiguration: {
 *     templateClientId: "dcr-template",
 *     clientRegistrationEndpointUrl: "https://login.example.com/oauth/oauth-client-registration",
 *     contextOption: ApplicationContextOption.Default,
 *   },
 * });
 *
 * @example
 * const androidConfig = createAndroidConfiguration({
 *   clientId: "my-android-client",
 *   appRedirect: "myapp://callback",
 *   dcrConfiguration: {
 *     templateClientId: "dcr-template",
 *     clientRegistrationEndpointUrl: "https://login.example.com/oauth/oauth-client-registration",
 *     contextOption: ApplicationContextOption.Default,
 *   },
 *   clientAuthenticationMethodConfig: AndroidJWTAsymmetricAuthentication({
 *     asymmetricAlgorithm: JWTAsymmetricAlgorithm.ES256,
 *     alias: "my-key-alias",
 *   }),
 *   tokenBoundConfiguration: {
 *     keyAlias: "custom_key",
 *     keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES384,
 *     storageOption: StorageOption.Default,
 *   },
 * });
 */
export function createAndroidConfiguration({
    clientId,
    appRedirect,
    dcrConfiguration,
    keyStoreAlias = "default_keystore_alias",
    httpUrlConnectionProviderOption = HttpUrlConnectionProviderOption.Default,
    currentTimeMillisProviderOption = CurrentTimeMillisProviderOption.Default,
    attestationConfiguration = { useAttestation: true },
    tokenBoundConfiguration = {
        keyAlias: "haapi_token_bound_key",
        keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES256,
        storageOption: StorageOption.Default,
    },
    clientAuthenticationMethodConfig = noAuthentication(),
    useRiskAssessmentConfiguration = false,
    tokenEndpointResponseListenerOption = TokenEndpointResponseListenerOption.None,
    applicationContextOption = undefined
}: {
    clientId: string;
    appRedirect: string;
    dcrConfiguration?: AndroidDcrConfiguration;
    keyStoreAlias?: string;
    httpUrlConnectionProviderOption?: HttpUrlConnectionProviderOption;
    currentTimeMillisProviderOption?: CurrentTimeMillisProviderOption;
    attestationConfiguration?: AndroidAttestationConfiguration;
    tokenBoundConfiguration?: AndroidTokenBoundConfiguration;
    clientAuthenticationMethodConfig?: ClientAuthenticationMethodConfiguration;
    useRiskAssessmentConfiguration?: boolean;
    tokenEndpointResponseListenerOption?: TokenEndpointResponseListenerOption;
    applicationContextOption?: ApplicationContextOption;
}): AndroidConfiguration {
    if (!clientId) {
        throw new Error("AndroidConfiguration: `clientId` is required.");
    }
    if (!appRedirect) {
        throw new Error("AndroidConfiguration: `appRedirect` is required.");
    }

    return {
        keyStoreAlias,
        clientId,
        appRedirect,
        httpUrlConnectionProviderOption,
        currentTimeMillisProviderOption,
        attestationConfiguration,
        tokenBoundConfiguration,
        clientAuthenticationMethodConfiguration: clientAuthenticationMethodConfig,
        dcrConfiguration,
        useRiskAssessmentConfiguration,
        tokenEndpointResponseListenerOption,
        applicationContextOption,
    };
}
