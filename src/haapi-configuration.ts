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
import type {AndroidConfiguration} from "./android-configuration";
import type {IOSConfiguration} from "./ios-configuration";

/**
 * Configuration for the React Native HAAPI client.
 *
 * This object is provided by the app and forwarded to the native iOS/Android
 * implementations via the Expo Modules bridge. String URL values are converted
 * to `URL` (iOS) / `URI` (Android) on the native side.
 *
 * **Native SDK mapping:**
 * - iOS: {@link https://github.com/nicklasaven HaapiConfiguration} (`IdsvrHaapiSdk.HaapiConfiguration`)
 * - Android: `se.curity.identityserver.haapi.android.sdk.HaapiConfiguration`
 *
 * Shared fields (`baseUrl`, endpoint URLs, `isAutoRedirect`, `minTokenTtl`,
 * `authorizationParameters`, `httpHeaders`) are extracted from this top-level
 * object. Platform-specific fields live in `iosConfig` / `androidConfig`.
 *
 * @remarks
 * - Prefer HTTPS endpoints in production.
 * - Closure/function-typed native properties (e.g., `httpHeadersProvider`,
 *   `authorizationParametersProvider`) are derived on the native side by wrapping
 *   the plain objects from this configuration in closures.
 */
export interface RNHaapiConfiguration {
    /**
     * The base URL of the Curity Identity Server.
     *
     * Converted to `URL` on iOS (`HaapiConfiguration.baseURL`) and
     * `URI` on Android (`HaapiConfiguration.baseUri`).
     *
     * @example "https://login.example.com"
     */
    readonly baseUrl: string;
    /**
     * The authorization endpoint URL.
     *
     * Maps to `authorizationEndpointURL` (iOS) / `authorizationEndpointUri` (Android).
     *
     * @example "https://login.example.com/oauth/oauth-authorize"
     */
    readonly authorizationEndpointUrl: string;
    /**
     * The token endpoint URL.
     *
     * Maps to `tokenEndpointURL` (iOS) / `tokenEndpointUri` (Android).
     *
     * @example "https://login.example.com/oauth/oauth-token"
     */
    readonly tokenEndpointUrl: string;
    /**
     * The revocation endpoint URL.
     *
     * Maps to `revocationEndpointURL` (iOS, optional) / `revocationEndpointUri` (Android, optional).
     *
     * @example "https://login.example.com/oauth/oauth-revoke"
     */
    readonly revocationEndpointUrl?: string;
    /**
     * Whether the native layer should automatically follow intermediate redirection steps during HAAPI flows.
     *
     * Maps to `isAutoRedirect` on both iOS and Android native SDKs.
     *
     * @defaultValue true
     */
    readonly isAutoRedirect: boolean;
    /**
     * Minimum time to live for an access token (in seconds).
     *
     * Maps to `minTokenTtl: TimeInterval` (iOS, seconds) / `minTokenTtl: Duration` (Android, converted via `.seconds`).
     *
     * @remarks
     * Must be >= 0. The SDK will attempt to refresh tokens before they expire
     * by this margin.
     *
     * @defaultValue 60
     */
    readonly minTokenTtl: number;
    /**
     * Android-specific configuration.
     *
     * Optional, but at least one of `androidConfig` or `iosConfig` must be provided.
     * The native Android module reads this to build `HaapiConfiguration` via
     * `toHaapiConfiguration()`.
     *
     * @see {@link createAndroidConfiguration}
     */
    readonly androidConfig?: AndroidConfiguration;
    /**
     * iOS-specific configuration.
     *
     * Optional, but at least one of `iosConfig` or `androidConfig` must be provided.
     * The native iOS module reads this via `iOSConfigurationRecord` and forwards it
     * to `HaapiConfiguration.init(...)`.
     *
     * @see {@link createIOSConfiguration}
     */
    readonly iosConfig?: IOSConfiguration;
    /**
     * Optional OAuth authorization parameters appended to the authorization request.
     *
     * Wrapped in a provider closure on the native side:
     * - iOS: `authorizationParametersProvider: OAuthAuthorizationParametersProvider?`
     * - Android: `authorizationParametersProvider: AuthorizationParametersProvider?`
     *
     * @remarks
     * Use this to inject parameters like `prompt`, `ui_locales`, `acr_values`
     * or custom parameters required by the server.
     * Platform-specific `authorizationParameters` on {@link IOSConfiguration} or
     * {@link AndroidConfiguration} are not currently supported; use this shared field.
     */
    readonly authorizationParameters?: OAuthAuthorizationParameters;
    /**
     * Optional HTTP headers applied to all SDK network calls.
     *
     * Wrapped in a provider closure on the native side:
     * - iOS: `httpHeadersProvider: HttpHeadersProvider?`
     * - Android: `httpHeadersProvider: HttpHeadersProvider?`
     *
     * @remarks
     * Use this for headers such as correlation IDs, app version headers
     * or custom headers required by gateways.
     */
    readonly httpHeaders?: Record<string, string>;
}

/**
 * OAuth authorization parameters that will be appended to the
 * authorization request.
 *
 * @remarks
 * All properties are optional and will default to empty values
 * if not provided. The SDK may normalize these values before
 * forwarding them to the native layer.
 */
export interface OAuthAuthorizationParameters {
    /**
    * OAuth scopes to request.
    *
    * @example ["openid", "profile", "offline_access"]
    * @defaultValue []
     */
    scope?: string[];
    /**
    * Optional nonce value for OpenID Connect flows.
    *
    * @remarks
    * Recommended when performing implicit or hybrid flows to prevent replay attacks.
    */
    nonce?: string | null;
    /**
    * Optional ACR (Authentication Context Class Reference) values.
    *
    * @example ["urn:se:curity:authentication:html-form:html1"]
    * @defaultValue []
    */
    acrValues?: string[];
    /**
    * Additional custom authorization request parameters.
    *
    * @remarks
    * These values will be appended to the authorization request
    * as query parameters.
    *
    * @example { prompt: "login", ui_locales: "en" }
    * @defaultValue {}
    */
    extraRequestParameters?: Record<string, string>
}

/**
 * Creates a normalized {@link RNHaapiConfiguration}.
 *
 * @remarks
 * - Validates required properties (`baseUrl`, endpoint URLs).
 * - At least one of `iosConfig` or `androidConfig` must be provided.
 * - Applies default values for optional properties (`isAutoRedirect`, `minTokenTtl`).
 * - Returns a plain JSON-serializable object suitable for Expo module bridging.
 *
 * @param baseUrl - The base URL of the Curity Identity Server.
 * @param authorizationEndpointUrl - The authorization endpoint URL.
 * @param tokenEndpointUrl - The token endpoint URL.
 * @param revocationEndpointUrl - Optional revocation endpoint URL.
 * @param androidConfig - Optional Android-specific configuration. At least one of `androidConfig` or `iosConfig` is required.
 * @param iosConfig - Optional iOS-specific configuration. At least one of `iosConfig` or `androidConfig` is required.
 * @param isAutoRedirect - Whether to automatically follow redirections.
 * @param minTokenTtl - Minimum access token TTL in seconds.
 * @param authorizationParameters - Optional OAuth authorization parameters.
 * @param httpHeaders - Optional HTTP headers for SDK network calls.
 *
 * @throws Error If any required property is missing or invalid.
 *
 * @returns A fully constructed {@link RNHaapiConfiguration}.
 */
export function createHaapiConfiguration({
    baseUrl,
    authorizationEndpointUrl,
    tokenEndpointUrl,
    revocationEndpointUrl = undefined,
    androidConfig,
    iosConfig,
    isAutoRedirect = true,
    minTokenTtl = 60,
    authorizationParameters = undefined,
    httpHeaders = undefined,
}: {
    baseUrl: string;
    authorizationEndpointUrl: string;
    tokenEndpointUrl: string;
    revocationEndpointUrl?: string;
    androidConfig?: AndroidConfiguration;
    iosConfig?: IOSConfiguration;
    isAutoRedirect?: boolean;
    minTokenTtl?: number;
    authorizationParameters?: OAuthAuthorizationParameters;
    httpHeaders?: Record<string, string>;
}): RNHaapiConfiguration {
    if (!baseUrl) {
        throw new Error("RNHaapiConfiguration: `baseUrl` is required.");
    }

    if (!androidConfig && !iosConfig) {
        throw new Error("RNHaapiConfiguration: `androidConfig` or `iosConfig` is required.");
    }

    if (!authorizationEndpointUrl) {
        throw new Error("RNHaapiConfiguration: `authorizationEndpointUrl` is required.");
    }

    if (!tokenEndpointUrl) {
        throw new Error("RNHaapiConfiguration: `tokenEndpointUrl` is required.");
    }

    if (!Number.isFinite(minTokenTtl) || minTokenTtl < 0) {
        throw new Error("RNHaapiConfiguration: `minTokenTtl` must be >= 0.");
    }

    return {
        baseUrl,
        authorizationEndpointUrl,
        tokenEndpointUrl,
        revocationEndpointUrl,
        isAutoRedirect,
        minTokenTtl,
        androidConfig,
        iosConfig,
        authorizationParameters,
        httpHeaders,
    };
}