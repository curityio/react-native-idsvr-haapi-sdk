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

// Mock the internal native-module helper before importing the factories.
// The factories call `getHaapiNativeModule()` to acquire the typed native
// surface — replacing it with a jest mock lets these tests drive the
// factories end-to-end without touching `expo-modules-core` (and without
// disturbing the unrelated `RNLogger` subscription path that lives in
// `src/logging/rn-logger.ts`).
const mockGetHaapiNativeModule = jest.fn();
jest.mock('../IdsvrHaapiReactNativeSdkModule', () => ({
    getHaapiNativeModule: mockGetHaapiNativeModule,
}));

import { initializeForHaapi, initializeForOAuth } from '../haapi-accessor';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createNativeMock() {
    return {
        initializeForHaapi: jest.fn().mockResolvedValue(undefined),
        initializeForOAuth: jest.fn().mockResolvedValue(undefined),
        start: jest.fn(),
        submitForm: jest.fn(),
        followLink: jest.fn(),
        oauthFetchAccessToken: jest.fn(),
        oauthRefreshAccessToken: jest.fn(),
        oauthRevokeAccessToken: jest.fn(),
        oauthRevokeRefreshToken: jest.fn(),
        close: jest.fn(),
        setLogLevel: jest.fn().mockResolvedValue(undefined),
        setSensitiveValueMasked: jest.fn().mockResolvedValue(undefined),
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

function createConfig() {
    return { baseUrl: 'https://example.com/auth' };
}

function envelopeError(payload) {
    return new Error('HAAPI_ERROR_V1::' + JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initializeForHaapi', () => {
    var native;

    beforeEach(() => {
        native = createNativeMock();
        mockGetHaapiNativeModule.mockReturnValue(native);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('calls native initializeForHaapi with the configuration', async () => {
        var config = createConfig();

        await initializeForHaapi(config);

        expect(native.initializeForHaapi).toHaveBeenCalledTimes(1);
        expect(native.initializeForHaapi).toHaveBeenCalledWith(config);
    });

    it('resolves to a HaapiAccessor exposing both managers', async () => {
        var accessor = await initializeForHaapi(createConfig());

        expect(accessor.haapiManager).toBeDefined();
        expect(accessor.oauthTokenManager).toBeDefined();
        expect(typeof accessor.close).toBe('function');
    });

    it('passes the provided logger through to the managers', async () => {
        var logger = createLoggerMock();

        var accessor = await initializeForHaapi(createConfig(), logger);
        await accessor.haapiManager.start();
        await accessor.oauthTokenManager.revokeAccessToken('tok');

        // Severity + arity only — message content is incidental and would
        // make the test brittle to wording changes. start() emits one info
        // log on HaapiManager; revokeAccessToken emits one on OAuthTokenManager.
        expect(logger.info).toHaveBeenCalledTimes(2);
    });

    it('defaults to a no-op logger when none is provided', async () => {
        var consoleInfo = jest.spyOn(console, 'info').mockImplementation(() => {});
        var consoleDebug = jest.spyOn(console, 'debug').mockImplementation(() => {});
        try {
            var accessor = await initializeForHaapi(createConfig());
            await accessor.haapiManager.start();
            await accessor.oauthTokenManager.revokeAccessToken('tok');

            // The default no-op logger writes nowhere — neither method
            // should produce a console.* side effect.
            expect(consoleInfo).not.toHaveBeenCalled();
            expect(consoleDebug).not.toHaveBeenCalled();
        } finally {
            consoleInfo.mockRestore();
            consoleDebug.mockRestore();
        }
    });

    it('accessor.close() forwards to native close', async () => {
        var accessor = await initializeForHaapi(createConfig());

        accessor.close();

        expect(native.close).toHaveBeenCalledTimes(1);
    });

    it('rejects with the native error code preserved (ALREADY_INITIALIZED)', async () => {
        native.initializeForHaapi.mockRejectedValue(
            envelopeError({
                code: 'HAAPI_ACCESSOR_ALREADY_INITIALIZED',
                category: 'bridge',
                errorDescription: 'already there',
                recovery: {
                    kind: 'unrecoverable',
                    action: {
                        kind: 'modifyConfiguration',
                        reason: 'close first',
                    },
                },
            }),
        );

        await expect(initializeForHaapi(createConfig())).rejects.toMatchObject({
            code: 'HAAPI_ACCESSOR_ALREADY_INITIALIZED',
            category: 'bridge',
            message: 'already there',
        });
    });

    it('rejects when native rejects with a generic error', async () => {
        var failure = new Error('network down');
        native.initializeForHaapi.mockRejectedValue(failure);

        await expect(initializeForHaapi(createConfig())).rejects.toBe(failure);
    });

    it('haapiManager.start() normalizes envelope-bearing rejections into typed HaapiError', async () => {
        // Replaces the legacy identity-only assertion: previously the test
        // rejected with `bridgeError(...)` (no envelope) and verified the
        // same `code` came back — that path bypassed `rethrowAsHaapiError`
        // entirely. Real native errors carry the `HAAPI_ERROR_V1::` envelope,
        // which the bridge wrapper must parse + rethrow as a typed
        // `HaapiError`. This test exercises that pipeline.
        var accessor = await initializeForHaapi(createConfig());
        native.start.mockRejectedValue(
            envelopeError({
                code: 'HAAPI_COMMUNICATION',
                category: 'networking',
                errorDescription: 'host unreachable',
                recovery: { kind: 'retryable', condition: 'now' },
                nativeCause: 'HostConnectionException',
            }),
        );

        await expect(accessor.haapiManager.start()).rejects.toMatchObject({
            code: 'HAAPI_COMMUNICATION',
            category: 'networking',
            message: 'host unreachable',
            recovery: { kind: 'retryable', condition: 'now' },
            nativeCause: 'HostConnectionException',
        });
    });

          it('routes all HaapiAccessor manager methods to native while open', async () => {
            var accessor = await initializeForHaapi(createConfig());
            var action = { model: { href: '/submit', method: 'POST' } };
            var params = { a: '1' };
            var link = { href: '/cancel', rel: 'cancel' };

            await accessor.haapiManager.submitForm(action, params);
            await accessor.haapiManager.followLink(link);
            await accessor.oauthTokenManager.fetchAccessToken('code-1', { scope: 'openid' });
            await accessor.oauthTokenManager.refreshAccessToken('rt-1', { prompt: 'none' });
            await accessor.oauthTokenManager.revokeRefreshToken('rt-1');

                    expect(native.submitForm).toHaveBeenCalledWith(action.model, params);
            expect(native.followLink).toHaveBeenCalledWith(link);
            expect(native.oauthFetchAccessToken).toHaveBeenCalledWith('code-1', { scope: 'openid' });
            expect(native.oauthRefreshAccessToken).toHaveBeenCalledWith('rt-1', { prompt: 'none' });
            expect(native.oauthRevokeRefreshToken).toHaveBeenCalledWith('rt-1');
          });

    it('after close, a fresh initializeForHaapi succeeds', async () => {
        var firstAccessor = await initializeForHaapi(createConfig());
        firstAccessor.close();

        // Reset to simulate the native side accepting a fresh init.
        native.initializeForHaapi.mockClear();

        var secondAccessor = await initializeForHaapi(createConfig());

        expect(native.initializeForHaapi).toHaveBeenCalledTimes(1);
        expect(secondAccessor.haapiManager).toBeDefined();
    });

    // post-close lifecycle ---------------------------------------------------

    it('haapiManager.start() throws synchronously after close with HAAPI_ACCESSOR_NOT_INITIALIZED', async () => {
        var accessor = await initializeForHaapi(createConfig());
        accessor.close();

        try {
            accessor.haapiManager.start();
            fail('expected throw');
        } catch (e) {
            expect(e).toMatchObject({
                code: 'HAAPI_ACCESSOR_NOT_INITIALIZED',
                category: 'bridge',
                recovery: {
                    kind: 'unrecoverable',
                    action: {
                        kind: 'modifyConfiguration',
                        reason: 'Call initializeForHaapi() or initializeForOAuth() first.',
                    },
                },
            });
        }
        // Native must NOT be reached — the JS guard fired first.
        expect(native.start).not.toHaveBeenCalled();
    });

    it('haapiManager.submitForm() / followLink() throw synchronously after close', async () => {
        var accessor = await initializeForHaapi(createConfig());
        accessor.close();

        expect(() => accessor.haapiManager.submitForm({ model: { href: '/x', method: 'POST' } }, {})).toThrow(
            expect.objectContaining({ code: 'HAAPI_ACCESSOR_NOT_INITIALIZED' }),
        );
        expect(() => accessor.haapiManager.followLink({ href: '/y', rel: 'cancel' })).toThrow(
            expect.objectContaining({ code: 'HAAPI_ACCESSOR_NOT_INITIALIZED' }),
        );
        expect(native.submitForm).not.toHaveBeenCalled();
        expect(native.followLink).not.toHaveBeenCalled();
    });

    it('oauthTokenManager methods throw synchronously after close on a HaapiAccessor', async () => {
        var accessor = await initializeForHaapi(createConfig());
        accessor.close();

        expect(() => accessor.oauthTokenManager.fetchAccessToken('c')).toThrow(
            expect.objectContaining({ code: 'HAAPI_ACCESSOR_NOT_INITIALIZED' }),
        );
        expect(() => accessor.oauthTokenManager.refreshAccessToken('rt')).toThrow(
            expect.objectContaining({ code: 'HAAPI_ACCESSOR_NOT_INITIALIZED' }),
        );
        expect(() => accessor.oauthTokenManager.revokeAccessToken('t')).toThrow(
            expect.objectContaining({ code: 'HAAPI_ACCESSOR_NOT_INITIALIZED' }),
        );
        expect(() => accessor.oauthTokenManager.revokeRefreshToken('t')).toThrow(
            expect.objectContaining({ code: 'HAAPI_ACCESSOR_NOT_INITIALIZED' }),
        );
        expect(native.oauthFetchAccessToken).not.toHaveBeenCalled();
        expect(native.oauthRefreshAccessToken).not.toHaveBeenCalled();
        expect(native.oauthRevokeAccessToken).not.toHaveBeenCalled();
        expect(native.oauthRevokeRefreshToken).not.toHaveBeenCalled();
    });

    it('double close() is a no-op — native close is called exactly once', async () => {
        var accessor = await initializeForHaapi(createConfig());

        accessor.close();
        accessor.close();
        accessor.close();

        expect(native.close).toHaveBeenCalledTimes(1);
    });
});

describe('initializeForOAuth', () => {
    var native;

    beforeEach(() => {
        native = createNativeMock();
        mockGetHaapiNativeModule.mockReturnValue(native);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('calls native initializeForOAuth with the configuration', async () => {
        var config = createConfig();

        await initializeForOAuth(config);

        expect(native.initializeForOAuth).toHaveBeenCalledTimes(1);
        expect(native.initializeForOAuth).toHaveBeenCalledWith(config);
    });

    it('resolves to an OAuth-only accessor (no haapiManager)', async () => {
        var accessor = await initializeForOAuth(createConfig());

        expect(accessor.oauthTokenManager).toBeDefined();
        expect(accessor.haapiManager).toBeUndefined();
        expect(typeof accessor.close).toBe('function');
    });

    it('passes the provided logger through to the OAuth manager', async () => {
        var logger = createLoggerMock();

        var accessor = await initializeForOAuth(createConfig(), logger);
        await accessor.oauthTokenManager.refreshAccessToken('rt-1');

        // Severity + arity only — refreshAccessToken emits exactly one info log.
        expect(logger.info).toHaveBeenCalledTimes(1);
    });

    it('defaults to a no-op logger when none is provided', async () => {
        var consoleInfo = jest.spyOn(console, 'info').mockImplementation(() => {});
        try {
            var accessor = await initializeForOAuth(createConfig());
            await accessor.oauthTokenManager.refreshAccessToken('rt-1');

            expect(consoleInfo).not.toHaveBeenCalled();
        } finally {
            consoleInfo.mockRestore();
        }
    });

    it('accessor.close() forwards to native close', async () => {
        var accessor = await initializeForOAuth(createConfig());

        accessor.close();

        expect(native.close).toHaveBeenCalledTimes(1);
    });

    it('rejects with ALREADY_INITIALIZED when native does (mode-switch case)', async () => {
        native.initializeForOAuth.mockRejectedValue(
            envelopeError({
                code: 'HAAPI_ACCESSOR_ALREADY_INITIALIZED',
                category: 'bridge',
                errorDescription: 'already in HAAPI mode',
            }),
        );

        await expect(initializeForOAuth(createConfig())).rejects.toMatchObject({
            code: 'HAAPI_ACCESSOR_ALREADY_INITIALIZED',
            category: 'bridge',
        });
    });

          it('routes OAuthAccessor revoke methods to native while open', async () => {
            var accessor = await initializeForOAuth(createConfig());

            await accessor.oauthTokenManager.revokeAccessToken('access-1');
            await accessor.oauthTokenManager.revokeRefreshToken('refresh-1');

            expect(native.oauthRevokeAccessToken).toHaveBeenCalledWith('access-1');
            expect(native.oauthRevokeRefreshToken).toHaveBeenCalledWith('refresh-1');
          });

    it('after close, a fresh initializeForOAuth succeeds', async () => {
        var firstAccessor = await initializeForOAuth(createConfig());
        firstAccessor.close();

        native.initializeForOAuth.mockClear();

        var secondAccessor = await initializeForOAuth(createConfig());

        expect(native.initializeForOAuth).toHaveBeenCalledTimes(1);
        expect(secondAccessor.oauthTokenManager).toBeDefined();
    });

    // post-close lifecycle ---------------------------------------------------

    it('oauthTokenManager methods throw synchronously after close on an OAuthAccessor', async () => {
        var accessor = await initializeForOAuth(createConfig());
        accessor.close();

        expect(() => accessor.oauthTokenManager.fetchAccessToken('c')).toThrow(
            expect.objectContaining({ code: 'HAAPI_ACCESSOR_NOT_INITIALIZED' }),
        );
        expect(() => accessor.oauthTokenManager.refreshAccessToken('rt')).toThrow(
            expect.objectContaining({ code: 'HAAPI_ACCESSOR_NOT_INITIALIZED' }),
        );
        expect(native.oauthFetchAccessToken).not.toHaveBeenCalled();
        expect(native.oauthRefreshAccessToken).not.toHaveBeenCalled();
    });

    it('OAuthAccessor double close() is a no-op', async () => {
        var accessor = await initializeForOAuth(createConfig());

        accessor.close();
        accessor.close();

        expect(native.close).toHaveBeenCalledTimes(1);
    });
});

// Cross-mode lifecycle ------------------------------------------------------
//
// Hosts can switch between full HAAPI flow and OAuth-only token management
// across the same JS context — the only constraint is that each accessor
// must be closed before the next factory call. This suite drives the full
// HAAPI → OAuth → HAAPI cycle to confirm that close+re-init works
// regardless of which mode you're switching from.

describe('cross-mode close → re-init', () => {
    var native;

    beforeEach(() => {
        native = createNativeMock();
        mockGetHaapiNativeModule.mockReturnValue(native);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('HAAPI → close → OAuth → close → HAAPI all succeed', async () => {
        var haapiFirst = await initializeForHaapi(createConfig());
        expect(haapiFirst.haapiManager).toBeDefined();
        expect(haapiFirst.oauthTokenManager).toBeDefined();
        haapiFirst.close();

        var oauthAccessor = await initializeForOAuth(createConfig());
        expect(oauthAccessor.oauthTokenManager).toBeDefined();
        // OAuthAccessor exposes only oauthTokenManager — no haapiManager.
        expect(oauthAccessor.haapiManager).toBeUndefined();
        oauthAccessor.close();

        var haapiSecond = await initializeForHaapi(createConfig());
        expect(haapiSecond.haapiManager).toBeDefined();
        expect(haapiSecond.oauthTokenManager).toBeDefined();
        haapiSecond.close();

        // Native init was hit exactly once per factory call (3 total: 2 HAAPI + 1 OAuth).
        expect(native.initializeForHaapi).toHaveBeenCalledTimes(2);
        expect(native.initializeForOAuth).toHaveBeenCalledTimes(1);
        // Native close was hit once per accessor.close() (3 total).
        expect(native.close).toHaveBeenCalledTimes(3);
    });
});
