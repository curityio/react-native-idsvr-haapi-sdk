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
import { normalizeHttpMethod, validateDpopProofInput } from "./internal/dpop-proof-input";

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
 * The SDK handles DPoP for its own requests to the authorization
 * server. To call a DPoP-protected API of your own, use
 * ``createDpopProof``.
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

    /**
     * Creates a DPoP proof (RFC 9449) for calling a resource server with
     * a DPoP-bound access token.
     *
     * @remarks
     * The proof is a signed JWT for one request: it binds ``httpMethod``,
     * ``url`` (without its query and fragment) and a hash of
     * ``accessToken``, and carries ``nonce`` when one is given. It is
     * signed with the key the access token is bound to, which never leaves
     * the device's key store. Send it in the ``DPoP`` header with the
     * token as ``Authorization: DPoP <accessToken>``, and create a new
     * proof for every request.
     *
     * An access token is DPoP-bound — its token response's ``tokenType``
     * is ``DPoP`` — only when the accessor uses token binding and the
     * server issues DPoP-bound access tokens to the client: the client's
     * HAAPI capability setting ``issue-dpop-bound-access-tokens``, in the
     * Curity Identity Server 11.5 or later.
     *
     * A resource server can require a nonce of its own: it answers ``401``
     * with a ``DPoP-Nonce`` header, and the request is repeated with a
     * proof carrying that nonce. The SDK never adds a nonce and keeps none.
     *
     * Resolves ``null`` when no key is bound to ``accessToken``: the
     * accessor doesn't use token binding (the default), or the token was
     * superseded by a refresh, was revoked, is a refresh token, or wasn't
     * issued to this app.
     *
     * Android older-key exception: on Android, a token the SDK doesn't
     * track can still get a proof, signed with an older key left on the
     * device; a resource server refuses that proof.
     *
     * The method is signed as the server receives it: ``delete``, ``get``,
     * ``head``, ``options``, ``post`` and ``put`` are upper-cased in any
     * case, as ``fetch`` does; any other method is used as given.
     *
     * Rejects with a ``HaapiError``:
     * - ``HAAPI_INVALID_ARGUMENT`` — ``accessToken`` is not a non-empty
     *   string; ``httpMethod`` is empty or not an HTTP method token; ``url``
     *   is not an absolute ``http`` or ``https`` URL with a host, carries
     *   user credentials, has an empty or invalid port, or has characters
     *   that aren't percent-encoded; ``nonce`` is given but is not a
     *   non-empty string.
     * - ``HAAPI_STORAGE_UNAVAILABLE`` — the key store is locked; retry
     *   when the app is in the foreground.
     * - ``HAAPI_DPOP_PROOF_FAILURE`` — the key store couldn't be read.
     * - ``HAAPI_DPOP_PROOF_CREATION_FAILURE`` — the proof couldn't be
     *   signed.
     * - ``HAAPI_ACCESSOR_NOT_INITIALIZED`` — the accessor is no longer
     *   initialized on the native side.
     *
     * Once the accessor is closed, it throws
     * ``HAAPI_ACCESSOR_NOT_INITIALIZED`` synchronously.
     *
     * @param accessToken - The access token to present; the proof is bound
     *   to it.
     * @param httpMethod - The method of the request the proof is for.
     * @param url - The percent-encoded URL of the request the proof is for.
     * @param nonce - The nonce the resource server asked for. Omit it on the
     *   first request; with no nonce, the proof carries none.
     * @returns The proof, a compact JWS, or ``null`` when no key is bound to
     *   the access token.
     *
     * @example
     * ```ts
     * let nonce: string | undefined;
     * for (let attempt = 0; attempt < 2; attempt++) {
     *     const proof = await accessor.oauthTokenManager.createDpopProof(accessToken, 'GET', url, nonce);
     *     if (proof === null) {
     *         break; // no key for this token: refresh it, or sign in again
     *     }
     *     const response = await fetch(url, {
     *         method: 'GET',
     *         headers: { Authorization: `DPoP ${accessToken}`, DPoP: proof },
     *     });
     *     const challenge = response.headers.get('DPoP-Nonce');
     *     if (response.status === 401 && challenge !== null && attempt === 0) {
     *         nonce = challenge; // retry once, with the resource server's nonce
     *         continue;
     *     }
     *     // handle the response
     *     break;
     * }
     * ```
     */
    createDpopProof(
        accessToken: string,
        httpMethod: string,
        url: string,
        nonce?: string,
    ): Promise<string | null>;
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
    oauthCreateDpopProof(
        accessToken: string,
        httpMethod: string,
        url: string,
        nonce?: string,
    ): Promise<string | null>;
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

    // The token, URL and nonce are never logged: the URL may carry credentials.
    async createDpopProof(
        accessToken: string,
        httpMethod: string,
        url: string,
        nonce?: string,
    ): Promise<string | null> {
        this.logger.info("createDpopProof", TAG);
        validateDpopProofInput(accessToken, httpMethod, url, nonce);
        try {
            return await this.nativeModule.oauthCreateDpopProof(
                accessToken,
                normalizeHttpMethod(httpMethod),
                url,
                nonce,
            );
        } catch (e: unknown) {
            rethrowAsHaapiError(e);
        }
    }
}

const TAG = "OAuthTokenManager";