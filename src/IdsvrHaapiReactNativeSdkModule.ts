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
import { requireNativeModule } from 'expo-modules-core';
import type { RNHaapiConfiguration } from "./haapi-configuration";
import type { HaapiResponse } from "./models/haapi-response";
import type { FormActionModel } from "./models/form-action-model";
import type { Link } from "./models/link";
import type { TokenResponse } from "./models/token-response";
import type { RNLoggerConfiguration } from "./logging/rn-logger-configuration";

// Internal — this interface mirrors the `AsyncFunction` / `Function`
// declarations on the native iOS (Swift) and Android (Kotlin) modules.
// Host apps consume the SDK via the `initializeForHaapi` /
// `initializeForOAuth` factories and the `HaapiAccessor` / `OAuthAccessor`
// they return; this surface is not exported from the package entry.
//
// Surface:
//   - `initializeForHaapi` / `initializeForOAuth` — async builders.
//   - Flow methods (`start`, `submitForm`, `followLink`) — require a
//     HAAPI accessor.
//   - OAuth token methods (`oauthFetchAccessToken` /
//     `oauthRefreshAccessToken` / `oauthRevokeAccessToken` /
//     `oauthRevokeRefreshToken`) — require an OAuth or HAAPI accessor.
//
// Errors carry stable `error.code` values:
// `HAAPI_ACCESSOR_ALREADY_INITIALIZED` / `HAAPI_ACCESSOR_NOT_INITIALIZED` /
// `HAAPI_ACCESSOR_WRONG_KIND`.
//
// `submitForm` takes the bare `FormActionModel`, not a `FormAction` —
// the named→positional adaptation lives in `HaapiManagerImpl` so this
// surface mirrors what the native bridges actually consume.
export interface IdsvrHaapiReactNativeSdkModule {
    /**
     * Builds a HAAPI accessor (full flow + OAuth) and stores it on the native
     * `HaapiAccessorStore`. Throws with `code === "HAAPI_ACCESSOR_ALREADY_INITIALIZED"`
     * if an accessor is already held — call `close()` first.
     */
    initializeForHaapi(configuration: RNHaapiConfiguration): Promise<void>;

    /**
     * Builds an OAuth-only accessor (no HAAPI flow) and stores it on the
     * native `HaapiAccessorStore`. Throws with `code === "HAAPI_ACCESSOR_ALREADY_INITIALIZED"`
     * if an accessor is already held.
     */
    initializeForOAuth(configuration: RNHaapiConfiguration): Promise<void>;

    /**
     * Starts the HAAPI authentication flow.
     *
     * @throws If the bridge is not initialized for HAAPI mode (codes
     *   `HAAPI_ACCESSOR_NOT_INITIALIZED` / `HAAPI_ACCESSOR_WRONG_KIND`).
     */
    start(): Promise<HaapiResponse>;

    /**
     * Submits a form action from the current HAAPI step.
     *
     * @param model - The bare `FormActionModel` (not a wrapping `FormAction`).
     * @param parameters - Key-value map of form field values. Values may be any
     *   JSON-serialisable type (`string`, `number`, `boolean`, `null`, nested
     *   objects, arrays) to match the native iOS / Android signatures. For
     *   `GET` form actions, the native side rejects non-string values.
     */
    submitForm(model: FormActionModel, parameters: Record<string, unknown>): Promise<HaapiResponse>;

    /**
     * Follows a link from the current HAAPI step.
     */
    followLink(link: Link): Promise<HaapiResponse>;

    /**
     * Exchanges an authorization code (obtained from a completed HAAPI flow)
     * for an OAuth `TokenResponse`.
     *
     * @remarks
     * DPoP is handled internally by the SDK and is never crossed through
     * the JS bridge. On iOS, when the host initialised via
     * `initializeForHaapi` the active `HaapiManager`'s `dpop` is forwarded
     * automatically; when the host initialised via `initializeForOAuth`
     * (no flow accessor), no `dpop` is passed. On Android, the DPoP nonce
     * is stored in SDK-managed state regardless of the accessor kind, so
     * neither path needs JS-side wiring.
     */
    oauthFetchAccessToken(
        authorizationCode: string,
        additionalParameters?: Record<string, string>,
    ): Promise<TokenResponse>;

    /**
     * Refreshes an access token using a refresh token.
     *
     * @remarks
     * DPoP is handled internally by the SDK and is never crossed through
     * the JS bridge. On iOS, when the host initialised via
     * `initializeForHaapi` the active `HaapiManager`'s `dpop` is forwarded
     * automatically; when the host initialised via `initializeForOAuth`
     * (no flow accessor), no `dpop` is passed. On Android, the DPoP nonce
     * is stored in SDK-managed state regardless of the accessor kind, so
     * neither path needs JS-side wiring.
     */
    oauthRefreshAccessToken(
        refreshToken: string,
        additionalParameters?: Record<string, string>,
    ): Promise<TokenResponse>;

    /**
     * Revokes an access token. Resolves on success; rejects on transport error.
     */
    oauthRevokeAccessToken(token: string): Promise<void>;

    /**
     * Revokes a refresh token. Resolves on success; rejects on transport error.
     */
    oauthRevokeRefreshToken(token: string): Promise<void>;

    /**
     * Clears the native accessor store and releases native resources.
     *
     * @remarks
     * Synchronous. After calling `close()`, callers must invoke
     * `initializeForHaapi` / `initializeForOAuth` again before performing
     * any flow or token operations.
     */
    close(): void;

    /**
     * Applies the given configuration to the native HAAPI logger.
     *
     * @remarks
     * Sets the minimum severity level and the sensitive-value masking flag
     * in a single bridge call so the values are applied atomically.
     *
     * @internal Called by {@link RNLogger} at construction time only.
     */
    configureLogger(configuration: RNLoggerConfiguration): Promise<void>;
}

// Internal helper consumed by the `initializeForHaapi` /
// `initializeForOAuth` factories. Typed pass-through to
// `requireNativeModule`.
export function getHaapiNativeModule(): IdsvrHaapiReactNativeSdkModule {
    return requireNativeModule("IdsvrHaapiReactNativeSdk");
}
