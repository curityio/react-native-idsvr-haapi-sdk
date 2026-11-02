import type {HaapiError} from '@curity/identityserver-haapi-react-native-sdk';

import {formatError, getRetryableHaapiError, retryButtonTitle} from '../error-format';

function makeHaapiError(overrides: Partial<HaapiError>): HaapiError {
    return Object.assign(new Error(overrides.message ?? 'fallback message'), {
        code: 'HAAPI_UNEXPECTED',
        category: 'unexpected',
        ...overrides,
    }) as HaapiError;
}

describe('formatError', function () {
    it('formats a bare Error using message', function () {
        expect(formatError(new Error('plain error'))).toBe('plain error');
    });

    it('formats a plain thrown value', function () {
        expect(formatError('oops')).toBe('oops');
    });

    it('formats a bridge-category HaapiError with code and recovery', function () {
        var error = makeHaapiError({
            code: 'HAAPI_ACCESSOR_NOT_INITIALIZED',
            category: 'bridge',
            errorDescription: 'Accessor closed',
            recovery: { kind: 'retryable', condition: 'now' },
        });

        expect(formatError(error)).toContain('HAAPI_ACCESSOR_NOT_INITIALIZED [bridge]: Accessor closed');
        expect(formatError(error)).toContain('[recovery: retryable.now]');
    });

    it('formats a HaapiError with serverError details', function () {
        var error = makeHaapiError({
            code: 'HAAPI_SERVER_ERROR',
            category: 'networking',
            errorDescription: 'Upstream failed',
            serverError: {
                error: 'temporarily_unavailable',
                errorDescription: 'Try again later',
                statusCode: 503,
            },
        });

        expect(formatError(error)).toContain('HAAPI_SERVER_ERROR [networking]: Upstream failed');
        expect(formatError(error)).toContain('[serverError: temporarily_unavailable]');
    });

    it('formats a newHaapiFlow recovery', function () {
        var error = makeHaapiError({
            code: 'HAAPI_TOKEN_MANAGER_EXPIRED',
            category: 'haapi',
            message: 'Token manager expired',
            recovery: { kind: 'newHaapiFlow' },
        });

        expect(formatError(error)).toContain('HAAPI_TOKEN_MANAGER_EXPIRED [haapi]: Token manager expired');
        expect(formatError(error)).toContain('[recovery: newHaapiFlow]');
    });
});

describe('retry helpers', function () {
    it('returns retryable errors and a retry-now button label', function () {
        var error = makeHaapiError({
            code: 'HAAPI_COMMUNICATION',
            category: 'networking',
            recovery: { kind: 'retryable', condition: 'now' },
        });

        expect(getRetryableHaapiError(error)).toBe(error);
        expect(retryButtonTitle(error)).toBe('Retry now');
    });

    it('returns null for non-retryable errors', function () {
        var error = makeHaapiError({
            code: 'HAAPI_INVALID_CONFIGURATION',
            category: 'configuration',
            recovery: { kind: 'unrecoverable', action: { kind: 'modifyConfiguration', reason: 'bad config' } },
        });

        expect(getRetryableHaapiError(error)).toBeNull();
    });
});

