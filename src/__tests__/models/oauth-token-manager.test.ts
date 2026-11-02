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
import { isHaapiError } from '../../errors';

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
        oauthCreateDpopProof: jest.fn(),
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

    describe('createDpopProof', () => {
        var TOKEN = 'eyJhbGciOiJFUzI1NiJ9.bound-access-token';
        var URL = 'https://api.example.com/orders?page=2';
        var PROOF = 'eyJ0eXAiOiJkcG9wK2p3dCJ9.proof.signature';

        it('forwards the access token, method, URL and nonce positionally to the native call', async () => {
            native.oauthCreateDpopProof.mockResolvedValue(PROOF);

            await manager.createDpopProof(TOKEN, 'GET', URL, 'rs-nonce-1');

            expect(native.oauthCreateDpopProof).toHaveBeenCalledWith(TOKEN, 'GET', URL, 'rs-nonce-1');
        });

        it('resolves the proof the native SDK signed, untouched', async () => {
            native.oauthCreateDpopProof.mockResolvedValue(PROOF);

            await expect(manager.createDpopProof(TOKEN, 'GET', URL)).resolves.toBe(PROOF);
        });

        it('resolves null when no key is bound to the token', async () => {
            native.oauthCreateDpopProof.mockResolvedValue(null);

            await expect(manager.createDpopProof(TOKEN, 'GET', URL)).resolves.toBeNull();
        });

        it('passes no nonce when none is given', async () => {
            native.oauthCreateDpopProof.mockResolvedValue(PROOF);

            await manager.createDpopProof(TOKEN, 'GET', URL);

            expect(native.oauthCreateDpopProof.mock.calls[0][3]).toBeUndefined();
        });

        // Plain JavaScript can pass null where TypeScript says optional; the bridge reads it as no nonce.
        it('takes a null nonce as no nonce', async () => {
            native.oauthCreateDpopProof.mockResolvedValue(PROOF);

            await expect(manager.createDpopProof(TOKEN, 'GET', URL, null)).resolves.toBe(PROOF);
            expect(native.oauthCreateDpopProof).toHaveBeenCalledWith(TOKEN, 'GET', URL, null);
        });

        // The six methods fetch upper-cases before sending; the proof must name the method the server sees.
        it.each([
            ['get', 'GET'],
            ['Post', 'POST'],
            ['oPtIoNs', 'OPTIONS'],
            ['delete', 'DELETE'],
            ['head', 'HEAD'],
            ['put', 'PUT'],
            ['GET', 'GET'],
        ])('signs the standard method %s as %s', async (given, signed) => {
            native.oauthCreateDpopProof.mockResolvedValue(PROOF);

            await manager.createDpopProof(TOKEN, given, URL);

            expect(native.oauthCreateDpopProof.mock.calls[0][1]).toBe(signed);
        });

        // fetch sends any other method exactly as written, so the proof must too.
        it.each(['PATCH', 'patch', 'PROPFIND'])('signs the non-standard method %s verbatim', async (method) => {
            native.oauthCreateDpopProof.mockResolvedValue(PROOF);

            await manager.createDpopProof(TOKEN, method, URL);

            expect(native.oauthCreateDpopProof.mock.calls[0][1]).toBe(method);
        });

        // The three failures both natives report for a proof: a locked key store, a key that can't be read,
        // and a proof that can't be signed.
        it.each([
            [
                'HAAPI_STORAGE_UNAVAILABLE',
                'haapi',
                {kind: 'retryable', condition: 'whenAppInForeground'},
            ],
            [
                'HAAPI_DPOP_PROOF_FAILURE',
                'dpop',
                {kind: 'unrecoverable', action: {kind: 'modifyConfiguration', reason: 'Introspect the `cause`.'}},
            ],
            [
                'HAAPI_DPOP_PROOF_CREATION_FAILURE',
                'dpop',
                {kind: 'unrecoverable', action: {kind: 'modifyConfiguration', reason: 'Introspect the `cause`.'}},
            ],
        ])('rejects with a %s HaapiError, category and recovery intact', async (code, category, recovery) => {
            native.oauthCreateDpopProof.mockRejectedValue(
                envelopeError({code: code, category: category, errorDescription: 'The proof failed.', recovery: recovery}),
            );

            var thrown = await manager.createDpopProof(TOKEN, 'GET', URL).catch((e) => e);

            expect(isHaapiError(thrown)).toBe(true);
            expect(thrown).toMatchObject({code: code, category: category, recovery: recovery});
        });

        // Input no proof can be made for is refused before the native call, the same way on both platforms;
        // the description names the parameter and the rule, never the value.
        var NOT_ABSOLUTE = 'url must be an absolute http or https URL.';
        var NOT_ENCODED = 'url must contain only URL characters; percent-encode anything else.';
        var BAD_PORT = 'url must have no port, or a port of 1 to 5 digits.';
        var METHOD = 'httpMethod must be an HTTP method token.';
        it.each([
            ['an empty access token', '', 'GET', URL, undefined, 'accessToken must be a non-empty string.'],
            ['an empty method', TOKEN, '', URL, undefined, METHOD],
            ['a method with a space', TOKEN, 'GE T', URL, undefined, METHOD],
            ['a method with a line break', TOKEN, 'GET\n', URL, undefined, METHOD],
            ['a method with a separator', TOKEN, 'GET:', URL, undefined, METHOD],
            ['a relative URL', TOKEN, 'GET', '/userinfo', undefined, NOT_ABSOLUTE],
            ['a URL that is not http or https', TOKEN, 'GET', 'ftp://h/x', undefined, NOT_ABSOLUTE],
            ['a URL without a host', TOKEN, 'GET', 'https://', undefined, NOT_ABSOLUTE],
            ['a URL with an empty host', TOKEN, 'GET', 'https:///x', undefined, NOT_ABSOLUTE],
            ['a URL with a port but no host', TOKEN, 'GET', 'https://:8443/x', undefined, NOT_ABSOLUTE],
            ['a URL with an unclosed IP literal', TOKEN, 'GET', 'http://[::1', undefined, NOT_ABSOLUTE],
            ['a URL with an empty port', TOKEN, 'GET', 'https://h:', undefined, BAD_PORT],
            ['a URL with a six-digit port', TOKEN, 'GET', 'https://h:123456', undefined, BAD_PORT],
            ['a URL with a user and password', TOKEN, 'GET', 'https://u:p@h/x', undefined, 'url must not carry user credentials.'],
            ['a URL with a user', TOKEN, 'GET', 'https://u@h/x', undefined, 'url must not carry user credentials.'],
            ['a URL with a raw space', TOKEN, 'GET', 'https://h/a b', undefined, NOT_ENCODED],
            ['a URL with a non-ASCII host', TOKEN, 'GET', 'https://hé.example/x', undefined, NOT_ENCODED],
            ['a URL with a broken percent-escape', TOKEN, 'GET', 'https://h/%zz', undefined, NOT_ENCODED],
            ['an empty nonce', TOKEN, 'GET', URL, '', 'nonce must be a non-empty string; leave it out instead.'],
        ])('rejects %s as HAAPI_INVALID_ARGUMENT before the native call', async (_label, accessToken, method, url, nonce, description) => {
            var thrown = await manager.createDpopProof(accessToken, method, url, nonce).catch((e) => e);

            expect(isHaapiError(thrown)).toBe(true);
            expect(thrown).toMatchObject({
                code: 'HAAPI_INVALID_ARGUMENT',
                category: 'bridge',
                recovery: {kind: 'unrecoverable', action: {kind: 'introspectCause'}},
            });
            expect(thrown.errorDescription).toBe(description);
            [accessToken, method, url, nonce].forEach((value) => {
                if (value) {
                    expect(thrown.errorDescription).not.toContain(value);
                    expect(thrown.message).not.toContain(value);
                }
            });
            expect(native.oauthCreateDpopProof).not.toHaveBeenCalled();
        });

        // A JavaScript caller isn't held to the signature: a wrong type is refused the same way, not as a
        // plain TypeError from the method normalization or a raw error from the bridge.
        it.each([
            ['an access token that is not a string', undefined, 'GET', URL, undefined, 'accessToken must be a non-empty string.'],
            ['a method that is not a string', TOKEN, undefined, URL, undefined, METHOD],
            ['a URL that is not a string', TOKEN, 'GET', 42, undefined, NOT_ABSOLUTE],
            ['a nonce that is not a string', TOKEN, 'GET', URL, 7, 'nonce must be a non-empty string; leave it out instead.'],
        ])('rejects %s as HAAPI_INVALID_ARGUMENT before the native call', async (_label, accessToken, method, url, nonce, description) => {
            var callAsJavaScript = manager.createDpopProof.bind(manager) as (...args: unknown[]) => Promise<string | null>;

            var thrown = await callAsJavaScript(accessToken, method, url, nonce).catch((e) => e);

            expect(isHaapiError(thrown)).toBe(true);
            expect(thrown).toMatchObject({code: 'HAAPI_INVALID_ARGUMENT', category: 'bridge'});
            expect(thrown.errorDescription).toBe(description);
            expect(native.oauthCreateDpopProof).not.toHaveBeenCalled();
        });

        it.each([
            'HTTPS://H.example:8443/a%20b?q=1#f',
            'https://[::1]:8443/x',
            'http://10.0.2.2:8443/x',
            'https://api.example.com',
        ])('accepts the URL %s', async (url) => {
            native.oauthCreateDpopProof.mockResolvedValue(PROOF);

            await expect(manager.createDpopProof(TOKEN, 'GET', url)).resolves.toBe(PROOF);
            expect(native.oauthCreateDpopProof).toHaveBeenCalledWith(TOKEN, 'GET', url, undefined);
        });

        it('logs the call once, without the access token or the URL', async () => {
            native.oauthCreateDpopProof.mockResolvedValue(PROOF);

            await manager.createDpopProof(TOKEN, 'GET', URL, 'rs-nonce-1');

            expect(logger.info).toHaveBeenCalledTimes(1);
            var logged = JSON.stringify(logger.info.mock.calls);
            expect(logged).not.toContain(TOKEN);
            expect(logged).not.toContain('api.example.com');
            expect(logged).not.toContain('rs-nonce-1');
        });
    });
});
