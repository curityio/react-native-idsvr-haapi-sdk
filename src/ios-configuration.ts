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
import {TokenBindingKind, noTokenBinding} from "./token-binding";
import type {NoTokenBinding} from "./token-binding";
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
    * Token binding configuration.
    *
    * **Default: no token binding** (`noTokenBinding()`). Pass
    * `iOSTokenBinding()` when your client issues token-bound authorization codes.
    * Maps to `HaapiConfiguration.tokenBoundConfiguration` on iOS.
    */
    readonly tokenBindingConfiguration?: IOSTokenBindingConfiguration;
    /**
    * @deprecated Use {@link IOSConfiguration.tokenBindingConfiguration}. Still read when a configuration
    * built without {@link createIOSConfiguration} carries it: it then binds, with its `keyPairType`.
    * Setting both is an invalid configuration.
    */
    readonly tokenBoundConfiguration?: IOSTokenBoundConfiguration;
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
    * Where the SDK keeps its keychain items on iOS (token-binding keys and the dynamic client
    * registration), and when they can be read.
    *
    * **Default: not set** — the items stay in the app's own keychain area, readable after the first
    * unlock since the device restarted, as in earlier versions. Set an access group to share the
    * session with a native app extension, or choose a stricter accessibility level.
    *
    * Maps to `HaapiConfiguration.storage` on iOS. Not used on Android.
    */
    readonly keychainConfiguration?: IOSKeychainConfiguration;
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
 * The keychain access group and accessibility level for the SDK's keychain items on iOS.
 *
 * Both values are optional. An empty object behaves as if no keychain configuration were given.
 */
export interface IOSKeychainConfiguration {
    /**
     * Keychain access group the SDK stores its items in, so that your app's extensions in the same group
     * can use the session — for example a widget that uses the iOS HAAPI SDK with the same access group.
     * Every target entitled to the group can use the session's keys, so keep the group to the app and its
     * own extensions.
     *
     * **Default: not set** — the app's own keychain area.
     *
     * Pass the identifier exactly as it appears in your entitlements: a Keychain Sharing group with its
     * team prefix (`"ABCDE12345.com.example.shared"`) or an App Group (`"group.com.example.shared"`). The
     * app and the extension both need the group in their entitlements; in `keychain-access-groups`, keep
     * the app's own group first. An empty or blank value is rejected.
     *
     * If the app is not entitled to the group, the SDK can't keep its items there and never falls back to
     * the app's own keychain area; "Things to know" under "Share the session with an iOS app extension" in
     * the integration guide describes how that shows.
     */
    readonly accessGroup?: string;
    /**
     * When the SDK's keychain items can be read.
     *
     * **Default: {@link KeychainAccessibility.AfterFirstUnlockThisDeviceOnly}.**
     */
    readonly accessibility?: KeychainAccessibility;
}

/**
 * When the SDK's keychain items can be read on iOS. Both levels keep the items on this device: they
 * never move to another device through a backup or iCloud Keychain.
 */
export enum KeychainAccessibility {
    /**
     * After the first unlock since the device restarted, including while the device is locked again
     * later. The default.
     */
    AfterFirstUnlockThisDeviceOnly = "afterFirstUnlockThisDeviceOnly",
    /**
     * Only while the device is unlocked. A token-bound refresh while the device is locked — in the
     * background, for example — can't read the stored key and is refused with an `invalid_dpop_proof`
     * error response. The refresh token stays valid: refresh again once the device is unlocked.
     */
    WhenUnlockedThisDeviceOnly = "whenUnlockedThisDeviceOnly",
}

/**
 * iOS token binding (DPoP): the authorization code and refresh token are bound to a device key.
 *
 * Create it with {@link iOSTokenBinding}.
 */
export interface IOSTokenBinding {
    /** Always {@link TokenBindingKind.Bound}: tokens are bound to a device key of {@link keyPairType}. */
    readonly kind: TokenBindingKind.Bound;
    /** Key type of the device key used for proof of possession. */
    readonly keyPairType: CryptoKeyType;
}

/**
 * Token binding configuration for iOS: no binding (`noTokenBinding()`, the default) or
 * binding (`iOSTokenBinding()`).
 */
export type IOSTokenBindingConfiguration = NoTokenBinding | IOSTokenBinding;

/**
 * Creates an iOS token-binding configuration that binds tokens to a device key.
 *
 * Use it when your client issues token-bound authorization codes
 * (`issue-token-bound-authorization-code`). Called with no options it binds exactly as earlier SDK
 * versions did by default, so existing sessions keep their key.
 *
 * @param keyPairType - Key type. **Default: `CryptoKeyType.SecureEnclave`**. On a simulator, which has
 * no Secure Enclave, the native SDK falls back to a software key.
 *
 * @example
 * createIOSConfiguration({
 *   clientId: "my-ios-client",
 *   appRedirect: "myapp://callback",
 *   tokenBindingConfiguration: iOSTokenBinding(),
 * });
 */
export function iOSTokenBinding({
    keyPairType = CryptoKeyType.SecureEnclave,
}: {
    keyPairType?: CryptoKeyType;
} = {}): IOSTokenBinding {
    return { kind: TokenBindingKind.Bound, keyPairType };
}

/**
 * Token binding configuration for iOS, in the shape used before `tokenBindingConfiguration`.
 *
 * @deprecated Use {@link IOSTokenBindingConfiguration}: `noTokenBinding()` or `iOSTokenBinding()`,
 * passed as `tokenBindingConfiguration`. Still accepted as `tokenBoundConfiguration` by
 * {@link createIOSConfiguration}; will be removed in the next major version.
 */
export interface IOSTokenBoundConfiguration {
    /**
    * Cryptographic key type used for token binding proof-of-possession.
    */
    readonly keyPairType: CryptoKeyType
}

/**
 * No token binding.
 *
 * @deprecated Use `noTokenBinding()` as `tokenBindingConfiguration` (or omit it — no binding is the
 * default). Passed as `tokenBoundConfiguration`, {@link createIOSConfiguration} maps it to
 * `noTokenBinding()`. Will be removed in the next major version.
 */
export class UnboundedTokenConfiguration implements IOSTokenBoundConfiguration {
    readonly keyPairType = CryptoKeyType.SecureEnclave;
}

/**
 * Token binding (DPoP) with a device key of the given type.
 *
 * @deprecated Use `iOSTokenBinding({ keyPairType })` as `tokenBindingConfiguration`. Passed as
 * `tokenBoundConfiguration`, {@link createIOSConfiguration} maps it to `iOSTokenBinding()` with the
 * same key type. Will be removed in the next major version.
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
 * Maps the deprecated shape onto the current one. Only here can the two classes be told apart —
 * they serialise identically. Anything but an `UnboundedTokenConfiguration` binds, as the bridge
 * always did with it.
 */
function fromTokenBoundConfiguration(value: IOSTokenBoundConfiguration): IOSTokenBindingConfiguration {
    return value instanceof UnboundedTokenConfiguration
        ? noTokenBinding()
        : iOSTokenBinding({ keyPairType: value.keyPairType });
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
 * - `tokenBindingConfiguration`: no token binding (`noTokenBinding()`)
 * - `clientAuthenticationMethodConfig`:
 *   `noAuthentication()` ({@link ClientAuthenticationMethodConfiguration} with `kind: "none"`)
 * - `useRiskAssessmentConfiguration`: `false`
 * - `keychainConfiguration`: not set — the app's own keychain area, at
 *   {@link KeychainAccessibility.AfterFirstUnlockThisDeviceOnly}
 *
 * @param clientId - Client identifier registered in the Curity Identity Server.
 * @param appRedirect - Redirect URI (deep link) registered for the iOS application.
 * @param name - Configuration name.
 * @param urlSessionOption - URLSession behavior for network calls.
 * @param attestationConfiguration - Attestation configuration.
 * @param tokenBindingConfiguration - Token binding configuration. Default: no token binding.
 * @param tokenBoundConfiguration - Deprecated: use `tokenBindingConfiguration`. Mapped onto it.
 * @param clientAuthenticationMethodConfig - Client authentication method.
 * @param dcrConfiguration - Dynamic Client Registration configuration.
 * @param keychainConfiguration - Keychain access group and accessibility level for the SDK's keychain
 * items. Default: not set.
 * @param useRiskAssessmentConfiguration - Whether to enable risk assessment (OS + device info).
 * @param hasTokenEndpointResponseListener - Whether a token endpoint response listener is registered.
 * @param authorizationParameters - Optional per-platform authorization parameter overrides.
 * @param httpHeaders - Optional per-platform HTTP header overrides.
 *
 * @throws Error If `clientId` or `appRedirect` is missing or empty, if both
 * `tokenBindingConfiguration` and the deprecated `tokenBoundConfiguration` are passed, or if
 * `keychainConfiguration.accessGroup` is set but is not a string, or is empty or blank.
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
 *
 * @example
 * // Share the session with a native app extension in the same Keychain Sharing group
 * const iosConfig = createIOSConfiguration({
 *   clientId: "my-ios-client",
 *   appRedirect: "myapp://callback",
 *   keychainConfiguration: {
 *     accessGroup: "ABCDE12345.com.example.shared",
 *     accessibility: KeychainAccessibility.WhenUnlockedThisDeviceOnly,
 *   },
 * });
 */
export function createIOSConfiguration({
    clientId,
    appRedirect,
    name = "default-ios-configuration",
    urlSessionOption = URLSessionOption.Default,
    attestationConfiguration = { useAttestation: true, attestationMaxRetries: 3 },
    tokenBindingConfiguration,
    tokenBoundConfiguration,
    clientAuthenticationMethodConfig = noAuthentication(),
    dcrConfiguration,
    keychainConfiguration,
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
    tokenBindingConfiguration?: IOSTokenBindingConfiguration;
    /** @deprecated Use `tokenBindingConfiguration`. Mapped onto it; see {@link IOSTokenBoundConfiguration}. */
    tokenBoundConfiguration?: IOSTokenBoundConfiguration | null;
    clientAuthenticationMethodConfig?: ClientAuthenticationMethodConfiguration;
    dcrConfiguration?: IOSDcrConfiguration;
    keychainConfiguration?: IOSKeychainConfiguration;
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
    // `null` was the pre-deprecation way to turn binding off, so it means "no binding" here too.
    if (tokenBindingConfiguration !== undefined && tokenBoundConfiguration != null) {
        throw new Error(
            "IOSConfiguration: both `tokenBindingConfiguration` and the deprecated `tokenBoundConfiguration` " +
                "are set; pass only `tokenBindingConfiguration`."
        );
    }
    // `null` means no group, as the initialisation check treats it.
    const accessGroup: unknown = keychainConfiguration?.accessGroup;
    if (accessGroup != null && (typeof accessGroup !== 'string' || !accessGroup.trim())) {
        throw new Error("IOSConfiguration: `keychainConfiguration.accessGroup` must be a non-empty string");
    }

    return {
        name,
        clientId,
        appRedirect,
        urlSessionOption,
        attestationConfiguration,
        tokenBindingConfiguration: tokenBindingConfiguration
            ?? (tokenBoundConfiguration == null
                ? noTokenBinding()
                : fromTokenBoundConfiguration(tokenBoundConfiguration)),
        clientAuthenticationMethodConfiguration: clientAuthenticationMethodConfig,
        dcrConfiguration,
        keychainConfiguration,
        useRiskAssessmentConfiguration,
        hasTokenEndpointResponseListener,
        authorizationParameters,
        httpHeaders,
    };
}
