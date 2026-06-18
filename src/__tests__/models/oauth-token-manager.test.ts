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

import { OAuthTokenManagerImpl } from '../../oauth-token-manager';

// ---------------------------------------------------------------------------
// § 11.11 canonical TokenResponse fixtures
//
// Loaded from the cross-platform fixture file (OAuth RFC 6749 § 5.1 / § 5.2
// wire format, snake_case) so iOS / Android / TS bridge tests all assert
// against identical server output. Each platform's loader translates wire →
// bridge-Record shape at the test boundary, mirroring the production decode
// pipeline (iOS uses SDK Codable on the snake_case JSON, Android stubs the
// SDK response interface with values read from snake_case keys, TS does the
// rename here).
// ---------------------------------------------------------------------------

var rawFixtures = require('../../../__fixtures__/token-responses.json');

// Translate OAuth wire (snake_case) into the TS bridge-output shape
// (camelCase). `success` vs `error` variants are discriminated by presence
// of `access_token` vs `error` per RFC 6749 § 5.2 — no synthetic
// discriminator on the wire. Fields absent from the JSON stay absent in
// the returned object so the existing `undefined`-vs-value assertions hold.
function loadFixture(name) {
    var raw = rawFixtures[name];
    if (raw.access_token !== undefined) {
        return {
            responseType: 'success',
            accessToken: raw.access_token,
            tokenType: raw.token_type,
            scope: raw.scope,
            expiresIn: raw.expires_in,
            refreshToken: raw.refresh_token,
            idToken: raw.id_token,
        };
    }
    return {
        responseType: 'error',
        error: raw.error,
        errorDescription: raw.error_description,
        errorUri: raw.error_uri,
    };
}

var FIXTURE_A_BEARER = loadFixture('successBearer');
var FIXTURE_B_OIDC = loadFixture('successOidc');
var FIXTURE_C_DPOP = loadFixture('successDpop');
var FIXTURE_D_INVALID_SCOPE = loadFixture('errorInvalidScope');
var FIXTURE_E_INVALID_GRANT = loadFixture('errorInvalidGrant');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createNativeMock() {
    return {
        oauthFetchAccessToken: jest.fn(),
        oauthRefreshAccessToken: jest.fn(),
        oauthRevokeAccessToken: jest.fn(),
        oauthRevokeRefreshToken: jest.fn(),
    };
}

function createLoggerMock() {
    return {
        debug: jest.fn(),
        info: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
    };
}

function envelopeError(payload) {
    return new Error('HAAPI_ERROR_V1::' + JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OAuthTokenManager', () => {
    var native;
    var logger;
    var manager;

    beforeEach(() => {
        native = createNativeMock();
        logger = createLoggerMock();
        manager = new OAuthTokenManagerImpl(native, logger);
    });

    describe('fetchAccessToken', () => {
        it('forwards authorizationCode positionally to the native call', async () => {
            native.oauthFetchAccessToken.mockResolvedValue(FIXTURE_A_BEARER);

            await manager.fetchAccessToken('abc');

            expect(native.oauthFetchAccessToken).toHaveBeenCalledWith('abc', undefined);
        });

        it('forwards additionalParameters when populated', async () => {
            native.oauthFetchAccessToken.mockResolvedValue(FIXTURE_A_BEARER);

            await manager.fetchAccessToken('abc', { foo: 'bar', baz: 'qux' });

            expect(native.oauthFetchAccessToken).toHaveBeenCalledWith('abc', {
                foo: 'bar',
                baz: 'qux',
            });
        });

        it('forwards an empty additionalParameters map untouched', async () => {
            native.oauthFetchAccessToken.mockResolvedValue(FIXTURE_A_BEARER);

            await manager.fetchAccessToken('abc', {});

            expect(native.oauthFetchAccessToken).toHaveBeenCalledWith('abc', {});
        });

        it('passes through Fixture A (success bearer) untouched', async () => {
            native.oauthFetchAccessToken.mockResolvedValue(FIXTURE_A_BEARER);

            var result = await manager.fetchAccessToken('abc');

            expect(result).toBe(FIXTURE_A_BEARER);
            expect(result.responseType).toBe('success');
            expect(result.accessToken).toBe('c2f1bd4c-a1bf-49b8-aa64-1535fa5161a6');
            expect(result.tokenType).toBe('bearer');
            expect(result.scope).toBe('');
            expect(result.expiresIn).toBe(299);
            expect(result.refreshToken).toBe('e57b7017-3fdd-40a9-97c4-97d26c500c8f');
            expect(result.idToken).toBeUndefined();
        });

        it('passes through Fixture B (OIDC success with id_token) untouched', async () => {
            native.oauthFetchAccessToken.mockResolvedValue(FIXTURE_B_OIDC);

            var result = await manager.fetchAccessToken('abc');

            expect(result).toBe(FIXTURE_B_OIDC);
            expect(result.idToken).toBe('eyJraWQiOiItMzgwNzQ4MTIi');
            expect(result.scope).toBe('address openid');
        });

        it('passes through Fixture C (DPoP-bound, no refresh token) untouched', async () => {
            native.oauthFetchAccessToken.mockResolvedValue(FIXTURE_C_DPOP);

            var result = await manager.fetchAccessToken('abc');

            expect(result).toBe(FIXTURE_C_DPOP);
            expect(result.tokenType).toBe('DPoP');
            expect(result.scope).toBe('urn:se:curity:scopes:haapi');
            expect(result.expiresIn).toBe(600);
            expect(result.refreshToken).toBeUndefined();
        });

        it('passes through Fixture D (invalid_scope error) untouched', async () => {
            native.oauthFetchAccessToken.mockResolvedValue(FIXTURE_D_INVALID_SCOPE);

            var result = await manager.fetchAccessToken('abc');

            expect(result).toBe(FIXTURE_D_INVALID_SCOPE);
            expect(result.responseType).toBe('error');
            expect(result.error).toBe('invalid_scope');
            expect(result.errorDescription).toBe('No valid scope was requested.');
            expect(result.errorUri).toBeUndefined();
        });

        it('rejects when the native call rejects (transport error)', async () => {
            var failure = new Error('network down');
            native.oauthFetchAccessToken.mockRejectedValue(failure);

            await expect(
                manager.fetchAccessToken('abc'),
            ).rejects.toBe(failure);
        });

        it('preserves error.code on rejection', async () => {
            var failure = Object.assign(new Error('not init'), {
                code: 'HAAPI_ACCESSOR_NOT_INITIALIZED',
            });
            native.oauthFetchAccessToken.mockRejectedValue(failure);

            await expect(
                manager.fetchAccessToken('abc'),
            ).rejects.toMatchObject({ code: 'HAAPI_ACCESSOR_NOT_INITIALIZED' });
        });

        it('normalizes envelope rejections on fetchAccessToken', async () => {
            native.oauthFetchAccessToken.mockRejectedValue(
                envelopeError({
                    code: 'HAAPI_SERVER_ERROR',
                    category: 'networking',
                    errorDescription: 'token endpoint rejected request',
                    serverError: {
                        error: 'invalid_client',
                        errorDescription: 'invalid client',
                    },
                }),
            );

            await expect(manager.fetchAccessToken('abc')).rejects.toMatchObject({
                code: 'HAAPI_SERVER_ERROR',
                category: 'networking',
                message: 'token endpoint rejected request',
            });
        });

        it('emits one info-level log per call', async () => {
            native.oauthFetchAccessToken.mockResolvedValue(FIXTURE_A_BEARER);

            await manager.fetchAccessToken('abc');

            // Severity + arity only — message content is incidental.
            expect(logger.info).toHaveBeenCalledTimes(1);
        });
    });

    describe('refreshAccessToken', () => {
        it('forwards refreshToken positionally to the native call', async () => {
            native.oauthRefreshAccessToken.mockResolvedValue(FIXTURE_A_BEARER);

            await manager.refreshAccessToken('rt-1');

            expect(native.oauthRefreshAccessToken).toHaveBeenCalledWith('rt-1', undefined);
        });

        it('forwards additionalParameters when populated', async () => {
            native.oauthRefreshAccessToken.mockResolvedValue(FIXTURE_A_BEARER);

            await manager.refreshAccessToken('rt-1', { audience: 'api' });

            expect(native.oauthRefreshAccessToken).toHaveBeenCalledWith('rt-1', {
                audience: 'api',
            });
        });

        it('forwards an empty additionalParameters map untouched', async () => {
            native.oauthRefreshAccessToken.mockResolvedValue(FIXTURE_A_BEARER);

            await manager.refreshAccessToken('rt-1', {});

            expect(native.oauthRefreshAccessToken).toHaveBeenCalledWith('rt-1', {});
        });

        it('passes through Fixture A (success bearer) untouched', async () => {
            native.oauthRefreshAccessToken.mockResolvedValue(FIXTURE_A_BEARER);

            var result = await manager.refreshAccessToken('rt-1');

            expect(result).toBe(FIXTURE_A_BEARER);
        });

        it('passes through Fixture B (OIDC success) untouched', async () => {
            native.oauthRefreshAccessToken.mockResolvedValue(FIXTURE_B_OIDC);

            var result = await manager.refreshAccessToken('rt-1');

            expect(result).toBe(FIXTURE_B_OIDC);
        });

        it('passes through Fixture C (DPoP-bound) untouched', async () => {
            native.oauthRefreshAccessToken.mockResolvedValue(FIXTURE_C_DPOP);

            var result = await manager.refreshAccessToken('rt-1');

            expect(result).toBe(FIXTURE_C_DPOP);
        });

        it('passes through Fixture E (invalid_grant — canonical refresh failure) untouched', async () => {
            native.oauthRefreshAccessToken.mockResolvedValue(FIXTURE_E_INVALID_GRANT);

            var result = await manager.refreshAccessToken('rt-1');

            expect(result).toBe(FIXTURE_E_INVALID_GRANT);
            expect(result.responseType).toBe('error');
            expect(result.error).toBe('invalid_grant');
            expect(result.errorDescription).toBe('Invalid or unknown refresh token provided.');
        });

        it('rejects when the native call rejects (transport error)', async () => {
            var failure = new Error('boom');
            native.oauthRefreshAccessToken.mockRejectedValue(failure);

            await expect(
                manager.refreshAccessToken('rt-1'),
            ).rejects.toBe(failure);
        });

        it('normalizes envelope rejections on refreshAccessToken', async () => {
            native.oauthRefreshAccessToken.mockRejectedValue(
                envelopeError({
                    code: 'HAAPI_COMMUNICATION',
                    category: 'networking',
                    errorDescription: 'connection reset',
                }),
            );

            await expect(manager.refreshAccessToken('rt-1')).rejects.toMatchObject({
                code: 'HAAPI_COMMUNICATION',
                category: 'networking',
            });
        });

        it('emits one info-level log per call', async () => {
            native.oauthRefreshAccessToken.mockResolvedValue(FIXTURE_A_BEARER);

            await manager.refreshAccessToken('rt-1');

            expect(logger.info).toHaveBeenCalledTimes(1);
        });
    });

    describe('revokeAccessToken', () => {
        it('forwards the token to the native call', async () => {
            native.oauthRevokeAccessToken.mockResolvedValue(undefined);

            await manager.revokeAccessToken('tok-1');

            expect(native.oauthRevokeAccessToken).toHaveBeenCalledWith('tok-1');
        });

        it('resolves with no value when native resolves', async () => {
            native.oauthRevokeAccessToken.mockResolvedValue(undefined);

            var result = await manager.revokeAccessToken('tok-1');

            expect(result).toBeUndefined();
        });

        it('rejects when the native call rejects', async () => {
            var failure = new Error('boom');
            native.oauthRevokeAccessToken.mockRejectedValue(failure);

            await expect(manager.revokeAccessToken('tok-1')).rejects.toBe(failure);
        });

        it('normalizes envelope rejections on revokeAccessToken', async () => {
            native.oauthRevokeAccessToken.mockRejectedValue(
                envelopeError({
                    code: 'HAAPI_UNEXPECTED',
                    category: 'unexpected',
                    failureReason: 'revocation failed unexpectedly',
                }),
            );

            await expect(manager.revokeAccessToken('tok-1')).rejects.toMatchObject({
                code: 'HAAPI_UNEXPECTED',
                category: 'unexpected',
                message: 'revocation failed unexpectedly',
            });
        });

        it('emits one info-level log per call', async () => {
            native.oauthRevokeAccessToken.mockResolvedValue(undefined);

            await manager.revokeAccessToken('tok-1');

            expect(logger.info).toHaveBeenCalledTimes(1);
        });
    });

    describe('revokeRefreshToken', () => {
        it('forwards the token to the native call', async () => {
            native.oauthRevokeRefreshToken.mockResolvedValue(undefined);

            await manager.revokeRefreshToken('rt-1');

            expect(native.oauthRevokeRefreshToken).toHaveBeenCalledWith('rt-1');
        });

        it('resolves with no value when native resolves', async () => {
            native.oauthRevokeRefreshToken.mockResolvedValue(undefined);

            var result = await manager.revokeRefreshToken('rt-1');

            expect(result).toBeUndefined();
        });

        it('rejects when the native call rejects', async () => {
            var failure = new Error('boom');
            native.oauthRevokeRefreshToken.mockRejectedValue(failure);

            await expect(manager.revokeRefreshToken('rt-1')).rejects.toBe(failure);
        });

        it('normalizes envelope rejections on revokeRefreshToken', async () => {
            native.oauthRevokeRefreshToken.mockRejectedValue(
                envelopeError({
                    code: 'HAAPI_ACCESSOR_NOT_INITIALIZED',
                    category: 'bridge',
                    errorDescription: 'initialize first',
                }),
            );

            await expect(manager.revokeRefreshToken('rt-1')).rejects.toMatchObject({
                code: 'HAAPI_ACCESSOR_NOT_INITIALIZED',
                category: 'bridge',
            });
        });

        it('emits one info-level log per call', async () => {
            native.oauthRevokeRefreshToken.mockResolvedValue(undefined);

            await manager.revokeRefreshToken('rt-1');

            expect(logger.info).toHaveBeenCalledTimes(1);
        });
    });
});
