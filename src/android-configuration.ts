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
import {TokenBindingKind, noTokenBinding} from "./token-binding";
import type {NoTokenBinding} from "./token-binding";

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
     * Token binding configuration.
     *
     * **Default: no token binding** (`noTokenBinding()`). Pass
     * `AndroidTokenBinding()` when your client issues token-bound authorization codes.
     * Maps to `HaapiConfiguration.dpopTokenBinding` on Android.
     */
    readonly tokenBindingConfiguration?: AndroidTokenBindingConfiguration;

    /**
     * @deprecated Use {@link AndroidConfiguration.tokenBindingConfiguration}. Still read when a
     * configuration built without {@link createAndroidConfiguration} carries it: it then keeps binding and
     * adopts the key at its `keyAlias` (default `"haapi_token_bound_key"`) with its algorithm (default
     * ES256) and storage (default `StorageOption.Default`). Setting both is an invalid configuration.
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
 * Android token binding (DPoP): the authorization code and refresh token are bound to a device key.
 *
 * Create it with {@link AndroidTokenBinding}.
 */
export interface AndroidTokenBinding {
    /** Always {@link TokenBindingKind.Bound}: tokens are bound to a device key. */
    readonly kind: TokenBindingKind.Bound;

    /**
     * How the device key is protected. See {@link DpopKeyPolicy}.
     *
     * @remarks
     * Ignored while attestation is in effect (`attestationConfiguration.useAttestation`, on by default):
     * attestation always uses a hardware-backed key. Applies whenever attestation is off — including when
     * the SDK falls back to dynamic client registration on a device that can't attest, where `Hardware`
     * fails sign-in if the device can't create a hardware-backed key. Applies only to keys the SDK
     * creates — a key adopted through {@link AndroidTokenBinding.migrateFromLegacyAlias} keeps its own
     * protection.
     */
    readonly keyType: DpopKeyPolicy;

    /**
     * Algorithm of the device key. One of the entries of {@link KeyPairAlgorithmConfig}.
     *
     * @remarks
     * A key adopted through {@link AndroidTokenBinding.migrateFromLegacyAlias} must use the same
     * algorithm it was created with.
     */
    readonly keyPairAlgorithmConfiguration: KeyPairAlgorithmConfiguration;

    /**
     * Android Keystore alias of a device key created by an earlier SDK version, to adopt so the sign-ins
     * bound to it keep refreshing without signing in again; `null` adopts no key.
     *
     * @remarks
     * A key stored under the configuration's `keyStoreAlias` is adopted without setting this.
     */
    readonly migrateFromLegacyAlias: string | null;

    /**
     * Where the binding's key material and records are stored.
     *
     * @remarks
     * - {@link StorageOption.Default}: the SDK's built-in storage, encrypted at rest under a
     *   non-exportable Android Keystore key.
     * - {@link StorageOption.Custom}: your own storage, registered on the native side. A software key is
     *   stored in it as serialized key material, so it must encrypt and integrity-protect what it stores.
     *
     * Keep the same storage for an installation: switching it without moving the stored values ends
     * existing sign-ins.
     */
    readonly storageOption: StorageOption;
}

/**
 * Token binding configuration for Android: no binding (`noTokenBinding()`, the default)
 * or binding (`AndroidTokenBinding()`).
 */
export type AndroidTokenBindingConfiguration = NoTokenBinding | AndroidTokenBinding;

/**
 * Creates an Android token-binding configuration that binds tokens to a device key.
 *
 * Use it when your client issues token-bound authorization codes
 * (`issue-token-bound-authorization-code`). New device keys are named after the configuration's
 * `keyStoreAlias`, so keep that alias stable across app updates.
 *
 * @param keyType - How the device key is protected. **Default: `DpopKeyPolicy.Auto`** (hardware-backed,
 * with a software fallback). Ignored while attestation is in effect; applies when attestation is off,
 * including when the SDK falls back to dynamic client registration.
 * @param keyPairAlgorithmConfiguration - Key algorithm. **Default: `KeyPairAlgorithmConfig.ES256`.**
 * @param migrateFromLegacyAlias - Keystore alias of a key from an earlier SDK version to adopt.
 * **Default: none.** Earlier versions of this SDK bound to `"haapi_token_bound_key"` unless configured
 * otherwise; pass that alias to keep their users signed in.
 * @param storageOption - Where key material is stored. **Default: `StorageOption.Default`** (encrypted at
 * rest under a non-exportable Android Keystore key).
 *
 * @example
 * // Bind tokens with the defaults.
 * createAndroidConfiguration({
 *   clientId: "my-android-client",
 *   appRedirect: "myapp://callback",
 *   tokenBindingConfiguration: AndroidTokenBinding(),
 * });
 *
 * @example
 * // Keep users signed in after upgrading from a version that bound tokens by default.
 * createAndroidConfiguration({
 *   clientId: "my-android-client",
 *   appRedirect: "myapp://callback",
 *   tokenBindingConfiguration: AndroidTokenBinding({ migrateFromLegacyAlias: "haapi_token_bound_key" }),
 * });
 */
export function AndroidTokenBinding({
    keyType = DpopKeyPolicy.Auto,
    keyPairAlgorithmConfiguration = KeyPairAlgorithmConfig.ES256,
    migrateFromLegacyAlias = null,
    storageOption = StorageOption.Default,
}: {
    keyType?: DpopKeyPolicy;
    keyPairAlgorithmConfiguration?: KeyPairAlgorithmConfiguration;
    migrateFromLegacyAlias?: string | null;
    storageOption?: StorageOption;
} = {}): AndroidTokenBinding {
    return {
        kind: TokenBindingKind.Bound,
        keyType,
        keyPairAlgorithmConfiguration,
        // A blank alias names no key, as in the native SDK; a real alias is passed as given.
        migrateFromLegacyAlias: migrateFromLegacyAlias?.trim() ? migrateFromLegacyAlias : null,
        storageOption,
    };
}

/**
 * Android token binding configuration, in the shape used before `tokenBindingConfiguration`.
 *
 * @deprecated Use {@link AndroidTokenBindingConfiguration}: `AndroidTokenBinding({ migrateFromLegacyAlias:
 * keyAlias, keyPairAlgorithmConfiguration, storageOption })` (or `noTokenBinding()`), passed as
 * `tokenBindingConfiguration`. Still accepted as `tokenBoundConfiguration` by
 * {@link createAndroidConfiguration}, which keeps binding and adopts the key at `keyAlias` with the
 * same algorithm and storage; will be removed in the next major version.
 */
export interface AndroidTokenBoundConfiguration {
    /** Alias used to identify the generated key pair in the Android Keystore. */
    readonly keyAlias: string;
    /** Algorithm configuration for the key pair used in token binding JWTs. */
    readonly keyPairAlgorithmConfiguration: KeyPairAlgorithmConfiguration;
    /** Storage strategy for the token binding key material. */
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
    /**
     * The SDK's built-in storage (the default). Values are encrypted at rest under a
     * non-exportable Android Keystore key and are bound to the device that wrote them; values
     * stored by earlier SDK versions are moved into it automatically.
     */
    Default = 'default',
    /** Allows injecting a custom storage provider on the native side. */
    Custom = 'custom',
}

/**
 * How the Android token-binding (DPoP) key is protected. Used by {@link AndroidTokenBinding}.
 *
 * @remarks
 * Ignored while attestation is in effect: attestation always uses a hardware-backed key. Applies when
 * attestation is off, including when the SDK falls back to dynamic client registration on a device that
 * can't attest.
 */
export enum DpopKeyPolicy {
    /**
     * The default. A hardware-backed Android Keystore key; if the device can't create one, a software
     * key instead, kept in the binding's storage (encrypted at rest with {@link StorageOption.Default}).
     */
    Auto = 'auto',
    /**
     * A hardware-backed Android Keystore key only. On a device that can't create one, sign-in fails with
     * `HaapiErrorCode.DpopKeyCreationFailure` — it never falls back to a software key.
     */
    Hardware = 'hardware',
    /**
     * A software key, even where a hardware-backed key is available, kept in the binding's storage
     * (encrypted at rest with {@link StorageOption.Default}).
     */
    Software = 'software',
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
 * - `tokenBindingConfiguration`: no token binding (`noTokenBinding()`)
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
 * @param tokenBindingConfiguration - Token binding configuration. Default: no token binding.
 * @param tokenBoundConfiguration - Deprecated: use `tokenBindingConfiguration`. Mapped onto it.
 * @param clientAuthenticationMethodConfig - Client authentication method.
 * @param useRiskAssessmentConfiguration - Whether to enable risk assessment.
 * @param tokenEndpointResponseListenerOption - Token endpoint response listener option.
 * @param applicationContextOption - Application context provider for DCR/BankID flows.
 *
 * @throws Error If `clientId` or `appRedirect` is missing or empty, or if both
 * `tokenBindingConfiguration` and the deprecated `tokenBoundConfiguration` are passed.
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
 *   tokenBindingConfiguration: AndroidTokenBinding({
 *     keyType: DpopKeyPolicy.Hardware,
 *     keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES384,
 *   }),
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
    tokenBindingConfiguration,
    tokenBoundConfiguration,
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
    tokenBindingConfiguration?: AndroidTokenBindingConfiguration;
    /** @deprecated Use `tokenBindingConfiguration`. Mapped onto it; see {@link AndroidTokenBoundConfiguration}. */
    tokenBoundConfiguration?: AndroidTokenBoundConfiguration | null;
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
    // `null` was the pre-deprecation way to turn binding off, so it means "no binding" here too.
    if (tokenBindingConfiguration !== undefined && tokenBoundConfiguration != null) {
        throw new Error(
            "AndroidConfiguration: both `tokenBindingConfiguration` and the deprecated `tokenBoundConfiguration` " +
                "are set; pass only `tokenBindingConfiguration`."
        );
    }

    return {
        keyStoreAlias,
        clientId,
        appRedirect,
        httpUrlConnectionProviderOption,
        currentTimeMillisProviderOption,
        attestationConfiguration,
        // The deprecated shape was always bound; keep it bound, adopting the key at its alias with the
        // same algorithm and storage so its sign-ins keep refreshing.
        tokenBindingConfiguration: tokenBindingConfiguration
            ?? (tokenBoundConfiguration == null
                ? noTokenBinding()
                : AndroidTokenBinding({
                    // A missing alias was the released default.
                    migrateFromLegacyAlias: tokenBoundConfiguration.keyAlias ?? 'haapi_token_bound_key',
                    keyPairAlgorithmConfiguration: tokenBoundConfiguration.keyPairAlgorithmConfiguration,
                    storageOption: tokenBoundConfiguration.storageOption,
                })),
        clientAuthenticationMethodConfiguration: clientAuthenticationMethodConfig,
        dcrConfiguration,
        useRiskAssessmentConfiguration,
        tokenEndpointResponseListenerOption,
        applicationContextOption,
    };
}
