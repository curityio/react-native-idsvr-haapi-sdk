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

import type { RNHaapiConfiguration } from "./haapi-configuration";
import type { Logger } from "./logging";
import { NO_OP_LOGGER } from "./logging/logger";
import {
    type HaapiManager,
    HaapiManagerImpl,
} from "./haapi-manager";
import {
    type OAuthTokenManager,
    OAuthTokenManagerImpl,
} from "./oauth-token-manager";
import { getHaapiNativeModule } from "./IdsvrHaapiReactNativeSdkModule";
import type { HaapiError } from "./errors";
import { rethrowAsHaapiError } from "./internal/envelope";
import { makeBridgeError } from "./internal/bridge-errors";

/**
 * Token-management-only accessor returned by ``initializeForOAuth``.
 *
 * @remarks
 * Exposes the ``oauthTokenManager`` only. Use this when the host app
 * has a persisted refresh token and wants to refresh access without
 * re-running the HAAPI flow.
 */
export interface OAuthAccessor {
    readonly oauthTokenManager: OAuthTokenManager;

    /**
     * Clears the native accessor and releases any held resources.
     *
     * @remarks
     * After ``close()``, callers must invoke ``initializeForHaapi`` or
     * ``initializeForOAuth`` again before performing any token
     * operations. Calling a manager method on a closed accessor rejects
     * with ``error.code === "HAAPI_ACCESSOR_NOT_INITIALIZED"``.
     */
    close(): void;
}

/**
 * Full HAAPI flow + token-management accessor returned by
 * ``initializeForHaapi``.
 *
 * @remarks
 * Exposes both the ``haapiManager`` (flow operations) and the inherited
 * ``oauthTokenManager`` (token operations).
 */
export interface HaapiAccessor extends OAuthAccessor {
    readonly haapiManager: HaapiManager;
}

/**
 * Builds the synchronous "accessor is closed" error.
 *
 * @internal
 */
function makeAccessorClosedError(): HaapiError {
    return makeBridgeError({
        code: "HAAPI_ACCESSOR_NOT_INITIALIZED",
        message:
            "Accessor is closed. Call initializeForHaapi() or initializeForOAuth() " +
            "to start a new session.",
        recovery: {
            kind: "unrecoverable",
            action: {
                kind: "modifyConfiguration",
                reason: "Call initializeForHaapi() or initializeForOAuth() first.",
            },
        },
    });
}

/**
 * Builds an accessor for a full HAAPI authentication flow.
 *
 * @param configuration - The complete HAAPI configuration.
 * @param logger - Optional logger. Omit to disable SDK-side logging
 *   entirely (the SDK substitutes an internal no-op). Pass a
 *   configured ``RNLogger`` (or any custom ``Logger`` implementation)
 *   to receive log events.
 * @throws If an accessor is already held by the native store —
 *   ``error.code === "HAAPI_ACCESSOR_ALREADY_INITIALIZED"``. Call
 *   ``accessor.close()`` before re-initializing.
 *
 * @remarks
 * After ``accessor.close()`` returns, every method on the returned
 * managers throws **synchronously** with
 * ``error.code === "HAAPI_ACCESSOR_NOT_INITIALIZED"``. ``close()``
 * itself is idempotent — calling it more than once is a no-op and the
 * underlying native ``close`` is invoked exactly once.
 */
export async function initializeForHaapi(
    configuration: RNHaapiConfiguration,
    logger: Logger = NO_OP_LOGGER,
): Promise<HaapiAccessor> {
    const native = getHaapiNativeModule();
    try {
        await native.initializeForHaapi(configuration);
    } catch (e: unknown) {
        rethrowAsHaapiError(e);
    }

    const haapiImpl = new HaapiManagerImpl(native, logger);
    const oauthImpl = new OAuthTokenManagerImpl(native, logger);
    let closed = false;
    const ensureOpen = (): void => {
        if (closed) {
            throw makeAccessorClosedError();
        }
    };

    const haapiManager: HaapiManager = {
        start() {
            ensureOpen();
            return haapiImpl.start();
        },
        submitForm(action, parameters) {
            ensureOpen();
            return haapiImpl.submitForm(action, parameters);
        },
        followLink(link) {
            ensureOpen();
            return haapiImpl.followLink(link);
        },
    };

    const oauthTokenManager: OAuthTokenManager = {
        fetchAccessToken(authorizationCode, additionalParameters) {
            ensureOpen();
            return oauthImpl.fetchAccessToken(authorizationCode, additionalParameters);
        },
        refreshAccessToken(refreshToken, additionalParameters) {
            ensureOpen();
            return oauthImpl.refreshAccessToken(refreshToken, additionalParameters);
        },
        revokeAccessToken(token) {
            ensureOpen();
            return oauthImpl.revokeAccessToken(token);
        },
        revokeRefreshToken(token) {
            ensureOpen();
            return oauthImpl.revokeRefreshToken(token);
        },
    };

    return {
        haapiManager,
        oauthTokenManager,
        close() {
            if (closed) {
                return;
            }
            closed = true;
            native.close();
        },
    } satisfies HaapiAccessor;
}

/**
 * Builds an accessor for OAuth-only operation (no HAAPI flow).
 *
 * @param configuration - The complete HAAPI configuration.
 * @param logger - Optional logger; defaults to no-op (see
 *   ``initializeForHaapi`` for details).
 * @throws If an accessor is already held by the native store —
 *   ``error.code === "HAAPI_ACCESSOR_ALREADY_INITIALIZED"``.
 *
 * @remarks
 * After ``accessor.close()`` returns, every method on
 * ``oauthTokenManager`` throws synchronously with
 * ``error.code === "HAAPI_ACCESSOR_NOT_INITIALIZED"``. ``close()``
 * itself is idempotent.
 */
export async function initializeForOAuth(
    configuration: RNHaapiConfiguration,
    logger: Logger = NO_OP_LOGGER,
): Promise<OAuthAccessor> {
    const native = getHaapiNativeModule();
    try {
        await native.initializeForOAuth(configuration);
    } catch (e: unknown) {
        rethrowAsHaapiError(e);
    }

    const oauthImpl = new OAuthTokenManagerImpl(native, logger);
    let closed = false;
    const ensureOpen = (): void => {
        if (closed) {
            throw makeAccessorClosedError();
        }
    };

    const oauthTokenManager: OAuthTokenManager = {
        fetchAccessToken(authorizationCode, additionalParameters) {
            ensureOpen();
            return oauthImpl.fetchAccessToken(authorizationCode, additionalParameters);
        },
        refreshAccessToken(refreshToken, additionalParameters) {
            ensureOpen();
            return oauthImpl.refreshAccessToken(refreshToken, additionalParameters);
        },
        revokeAccessToken(token) {
            ensureOpen();
            return oauthImpl.revokeAccessToken(token);
        },
        revokeRefreshToken(token) {
            ensureOpen();
            return oauthImpl.revokeRefreshToken(token);
        },
    };

    return {
        oauthTokenManager,
        close() {
            if (closed) {
                return;
            }
            closed = true;
            native.close();
        },
    } satisfies OAuthAccessor;
}
