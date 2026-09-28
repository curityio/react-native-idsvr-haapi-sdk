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

import type { TokenResponse } from "./models/token-response";
import type { Logger } from "./logging";
import { rethrowAsHaapiError } from "./internal/envelope";

/**
 * Manager for OAuth 2.0 token operations (RFC 6749).
 *
 * @remarks
 * Returned from the ``OAuthAccessor.oauthTokenManager`` getter on
 * accessors produced by ``initializeForHaapi`` / ``initializeForOAuth``.
 *
 * Successful token responses surface as ``TokenResponse`` (a
 * discriminated union on ``responseType``) — both the success and
 * server-error variants resolve the Promise. Transport errors
 * (network failure, etc.) reject the Promise so callers handle them
 * with standard ``try`` / ``catch``.
 *
 * DPoP is handled internally by the SDK and is not surfaced on this
 * interface.
 */
export interface OAuthTokenManager {
    /**
     * Exchanges an authorization code for an access token.
     */
    fetchAccessToken(
        authorizationCode: string,
        additionalParameters?: Record<string, string>,
    ): Promise<TokenResponse>;

    /**
     * Refreshes an access token using a refresh token.
     */
    refreshAccessToken(
        refreshToken: string,
        additionalParameters?: Record<string, string>,
    ): Promise<TokenResponse>;

    /**
     * Revokes an access token (RFC 7009).
     *
     * @remarks
     * Resolves on RFC 7009 success (HTTP 200). Rejects on transport
     * failure **or** server-side rejection — both surface as Promise
     * rejections (revocation has no spec-defined "soft error" success
     * shape, unlike the token endpoint). Inspect ``error.code`` for
     * diagnostics; bridge-originated errors carry the
     * ``HAAPI_ACCESSOR_*`` codes, transport errors do not.
     */
    revokeAccessToken(token: string): Promise<void>;

    /**
     * Revokes a refresh token (RFC 7009).
     *
     * @remarks
     * Resolves on RFC 7009 success (HTTP 200). Rejects on transport
     * failure **or** server-side rejection — both surface as Promise
     * rejections. Inspect ``error.code`` for diagnostics; bridge-originated
     * errors carry the ``HAAPI_ACCESSOR_*`` codes, transport errors
     * do not.
     */
    revokeRefreshToken(token: string): Promise<void>;
}

// Internal slice of the native module surface that
// `OAuthTokenManagerImpl` depends on. Methods are positional to mirror
// the native SDKs' own signatures.
interface NativeOAuthSurface {
    oauthFetchAccessToken(
        authorizationCode: string,
        additionalParameters?: Record<string, string>,
    ): Promise<TokenResponse>;
    oauthRefreshAccessToken(
        refreshToken: string,
        additionalParameters?: Record<string, string>,
    ): Promise<TokenResponse>;
    oauthRevokeAccessToken(token: string): Promise<void>;
    oauthRevokeRefreshToken(token: string): Promise<void>;
}

// Default `OAuthTokenManager` implementation. Internal — instantiated
// by the accessor factories; not exported from the package entry.
export class OAuthTokenManagerImpl implements OAuthTokenManager {
    constructor(
        private readonly nativeModule: NativeOAuthSurface,
        private readonly logger: Logger,
    ) {}

    async fetchAccessToken(
        authorizationCode: string,
        additionalParameters?: Record<string, string>,
    ): Promise<TokenResponse> {
        this.logger.info("fetchAccessToken", TAG);
        try {
            return await this.nativeModule.oauthFetchAccessToken(authorizationCode, additionalParameters);
        } catch (e: unknown) {
            rethrowAsHaapiError(e);
        }
    }

    async refreshAccessToken(
        refreshToken: string,
        additionalParameters?: Record<string, string>,
    ): Promise<TokenResponse> {
        this.logger.info("refreshAccessToken", TAG);
        try {
            return await this.nativeModule.oauthRefreshAccessToken(refreshToken, additionalParameters);
        } catch (e: unknown) {
            rethrowAsHaapiError(e);
        }
    }

    async revokeAccessToken(token: string): Promise<void> {
        this.logger.info("revokeAccessToken", TAG);
        try {
            await this.nativeModule.oauthRevokeAccessToken(token);
        } catch (e: unknown) {
            rethrowAsHaapiError(e);
        }
    }

    async revokeRefreshToken(token: string): Promise<void> {
        this.logger.info("revokeRefreshToken", TAG);
        try {
            await this.nativeModule.oauthRevokeRefreshToken(token);
        } catch (e: unknown) {
            rethrowAsHaapiError(e);
        }
    }
}

const TAG = "OAuthTokenManager";