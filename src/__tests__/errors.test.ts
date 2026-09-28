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

import { HaapiErrorCode, isHaapiError } from '../errors';
import { decodeEnvelope, rethrowAsHaapiError } from '../internal/envelope';

function envelope(payload) {
    return 'HAAPI_ERROR_V1::' + JSON.stringify(payload);
}

describe('decodeEnvelope', () => {
    it('decodes envelope payload for every known code', () => {
        Object.values(HaapiErrorCode).forEach((code) => {
            var decoded = decodeEnvelope(
                envelope({
                    code,
                    category: 'unexpected',
                    errorDescription: 'desc',
                }),
            );
            expect(decoded).not.toBeNull();
            expect(decoded.code).toBe(code);
            expect(decoded.category).toBe('unexpected');
        });
    });

    it('returns null for malformed json', () => {
        expect(decodeEnvelope('HAAPI_ERROR_V1::not-json')).toBeNull();
    });

    it('returns null when balanced braces contain invalid JSON body', () => {
        // `extractFirstJsonObject` only balances braces; it doesn't validate
        // JSON. `{not-json}` is balanced but JSON.parse rejects it, exercising
        // the decoder's try/catch fallback.
        expect(decodeEnvelope('HAAPI_ERROR_V1::{not-json}')).toBeNull();
    });

      it('returns null when envelope JSON is not an object', () => {
        expect(decodeEnvelope(envelope('text'))).toBeNull();
        expect(decodeEnvelope(envelope(null))).toBeNull();
      });

      it('returns null when envelope object is missing required code/category fields', () => {
        expect(decodeEnvelope(envelope({ category: 'unexpected' }))).toBeNull();
        expect(decodeEnvelope(envelope({ code: HaapiErrorCode.Unexpected }))).toBeNull();
      });

    it('returns null for missing prefix', () => {
        expect(decodeEnvelope('{"code":"HAAPI_UNEXPECTED"}')).toBeNull();
    });

    it('returns null for non-string input', () => {
        expect(decodeEnvelope(undefined)).toBeNull();
        expect(decodeEnvelope(null)).toBeNull();
        expect(decodeEnvelope(12)).toBeNull();
        expect(decodeEnvelope({})).toBeNull();
    });

    it('extracts envelope nested inside Expo exception chain (iOS/Android observed shape)', () => {
        // Expo wraps our HaapiAccessorBridgeException with FunctionCallException
        // (iOS) / DecoratedException (Android), which concatenates the inner
        // description with the "\n→ Caused by: " separator. Real observed messages
        // look like this.
        var nested =
            "Calling the 'initializeForHaapi' function has failed\n" +
            '→ Caused by: ' +
            envelope({
                code: HaapiErrorCode.InvalidConfiguration,
                category: 'configuration',
                errorDescription: 'Cannot continue due to: "missing attestation"',
                failureReason: 'The configuration is invalid.',
                recovery: {
                    kind: 'unrecoverable',
                    action: {
                        kind: 'modifyConfiguration',
                        reason: 'Modify the configuration as mentioned in the `reason`.',
                    },
                },
                nativeCause: 'HaapiError',
            });

        var decoded = decodeEnvelope(nested);
        expect(decoded).not.toBeNull();
        expect(decoded.code).toBe(HaapiErrorCode.InvalidConfiguration);
        expect(decoded.category).toBe('configuration');
        expect(decoded.errorDescription).toBe('Cannot continue due to: "missing attestation"');
        expect(decoded.recovery).toEqual({
            kind: 'unrecoverable',
            action: {
                kind: 'modifyConfiguration',
                reason: 'Modify the configuration as mentioned in the `reason`.',
            },
        });
        expect(decoded.nativeCause).toBe('HaapiError');
    });

    it('extracts envelope followed by additional chain content', () => {
        // Defensive: if a future Expo / native change appends more "→ Caused by:"
        // segments after our envelope, we must still parse the envelope rather
        // than choke on the trailing text.
        var nested =
            envelope({
                code: HaapiErrorCode.Communication,
                category: 'networking',
                recovery: { kind: 'retryable', condition: 'now' },
            }) + '\n→ Caused by: java.net.ConnectException: Connection refused';

        var decoded = decodeEnvelope(nested);
        expect(decoded).not.toBeNull();
        expect(decoded.code).toBe(HaapiErrorCode.Communication);
        expect(decoded.recovery).toEqual({ kind: 'retryable', condition: 'now' });
    });

    it('handles JSON string values containing curly braces', () => {
        // The brace-balanced parser must be string-aware so a `}` inside
        // a JSON string value doesn't terminate the object early.
        var nested =
            envelope({
                code: HaapiErrorCode.ServerError,
                category: 'networking',
                errorDescription: 'Server returned {error:"nope"} payload',
                serverError: {
                    error: 'invalid_grant',
                    errorDescription: 'descriptor with } close brace',
                    statusCode: 400,
                },
            });

        var decoded = decodeEnvelope(nested);
        expect(decoded).not.toBeNull();
        expect(decoded.code).toBe(HaapiErrorCode.ServerError);
        expect(decoded.errorDescription).toBe('Server returned {error:"nope"} payload');
        expect(decoded.serverError.statusCode).toBe(400);
        expect(decoded.serverError.errorDescription).toBe('descriptor with } close brace');
    });

    it('returns null when envelope prefix is present but no balanced JSON object follows', () => {
        // Adversarial input: prefix is there but the payload is junk.
        expect(decodeEnvelope('prelude HAAPI_ERROR_V1:: { unbalanced')).toBeNull();
        expect(decodeEnvelope('HAAPI_ERROR_V1:: not-an-object')).toBeNull();
    });

    // -----------------------------------------------------------------------
    // Strict-validation tests
    //
    // `decodeEnvelope` must reject payloads whose shape would smuggle invalid
    // values into a typed `HaapiError`. Returning `null` lets the bridge
    // wrapper fall back to re-throwing the raw Error untouched — surfacing
    // native-side bugs immediately instead of papering over them with a
    // partially-typed error.

    it('returns null when category is not a known HaapiErrorCategory', () => {
        // typo: "networkng" — host apps doing `if (isHaapiError(e))` would
        // otherwise skip the typed branch and re-throw an Error whose
        // category silently fell through validation.
        expect(decodeEnvelope(envelope({ code: 'HAAPI_X', category: 'networkng' }))).toBeNull();
    });

    it('returns null when recovery.kind is unknown', () => {
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.Communication,
                    category: 'networking',
                    recovery: { kind: 'fantasyAction' },
                }),
            ),
        ).toBeNull();
    });

    it('returns null when retryable recovery has unknown condition', () => {
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.Communication,
                    category: 'networking',
                    recovery: { kind: 'retryable', condition: 'tomorrow' },
                }),
            ),
        ).toBeNull();
    });

    it('returns null when unrecoverable recovery has unknown action.kind', () => {
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.InvalidConfiguration,
                    category: 'configuration',
                    recovery: { kind: 'unrecoverable', action: { kind: 'fantasy' } },
                }),
            ),
        ).toBeNull();
    });

    it('returns null when modifyConfiguration is missing the reason string', () => {
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.InvalidConfiguration,
                    category: 'configuration',
                    recovery: { kind: 'unrecoverable', action: { kind: 'modifyConfiguration' } },
                }),
            ),
        ).toBeNull();
    });

    it('returns null when cause is not a string', () => {
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.Unexpected,
                    category: 'unexpected',
                    cause: 42,
                }),
            ),
        ).toBeNull();
    });

    it('returns null when serverError.statusCode is not a number', () => {
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.ServerError,
                    category: 'networking',
                    serverError: {
                        error: 'invalid_grant',
                        errorDescription: 'bad',
                        statusCode: '400',
                    },
                }),
            ),
        ).toBeNull();
    });

    it('returns null when serverError lacks required error/errorDescription strings', () => {
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.ServerError,
                    category: 'networking',
                    serverError: { errorDescription: 'missing error' },
                }),
            ),
        ).toBeNull();
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.ServerError,
                    category: 'networking',
                    serverError: { error: 'invalid_grant' },
                }),
            ),
        ).toBeNull();
    });

    it('accepts newHaapiFlow recovery with no extra fields', () => {
        const decoded = decodeEnvelope(
            envelope({
                code: HaapiErrorCode.TokenManagerExpired,
                category: 'haapi',
                recovery: { kind: 'newHaapiFlow' },
            }),
        );
        expect(decoded).not.toBeNull();
        expect(decoded.recovery).toEqual({ kind: 'newHaapiFlow' });
    });

    it('returns null when recovery is a non-object value (e.g. number)', () => {
        // Defensive: native side could conceivably emit a malformed envelope
        // with a number where a recovery object is expected. The decoder
        // must reject before downstream code interprets it.
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.Communication,
                    category: 'networking',
                    recovery: 42,
                }),
            ),
        ).toBeNull();
    });

    it('returns null when recovery.kind is non-string', () => {
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.Communication,
                    category: 'networking',
                    recovery: { kind: 7 },
                }),
            ),
        ).toBeNull();
    });

    it('returns null when unrecoverable recovery has a non-object action', () => {
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.InvalidConfiguration,
                    category: 'configuration',
                    recovery: { kind: 'unrecoverable', action: 'introspectCause' },
                }),
            ),
        ).toBeNull();
    });

    it('returns null when unrecoverable action.kind is non-string', () => {
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.InvalidConfiguration,
                    category: 'configuration',
                    recovery: { kind: 'unrecoverable', action: { kind: 7 } },
                }),
            ),
        ).toBeNull();
    });

    it('returns null when serverError is a non-object value', () => {
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.ServerError,
                    category: 'networking',
                    serverError: 'invalid_grant',
                }),
            ),
        ).toBeNull();
    });

    it('returns null when serverError.errorUri is non-string', () => {
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.ServerError,
                    category: 'networking',
                    serverError: {
                        error: 'invalid_grant',
                        errorDescription: 'bad',
                        errorUri: 42,
                    },
                }),
            ),
        ).toBeNull();
    });

    it('returns null when errorDescription / failureReason / nativeCause are non-string', () => {
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.Unexpected,
                    category: 'unexpected',
                    errorDescription: 42,
                }),
            ),
        ).toBeNull();
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.Unexpected,
                    category: 'unexpected',
                    failureReason: 42,
                }),
            ),
        ).toBeNull();
        expect(
            decodeEnvelope(
                envelope({
                    code: HaapiErrorCode.Unexpected,
                    category: 'unexpected',
                    nativeCause: 42,
                }),
            ),
        ).toBeNull();
    });
});

describe('rethrowAsHaapiError', () => {
    it('rethrows non-Error input untouched', () => {
        var payload = { raw: true };
        try {
            rethrowAsHaapiError(payload);
            fail('expected throw');
        } catch (e) {
            expect(e).toBe(payload);
        }
    });

    it('rethrows Error without envelope untouched', () => {
        var failure = new Error('plain');
        try {
            rethrowAsHaapiError(failure);
            fail('expected throw');
        } catch (e) {
            expect(e).toBe(failure);
            expect(e.message).toBe('plain');
        }
    });

    it('mutates and rethrows Error with envelope as HaapiError shape', () => {
        var original = new Error(
            envelope({
                code: HaapiErrorCode.ServerError,
                category: 'networking',
                errorDescription: 'Readable message',
                failureReason: 'Developer reason',
                recovery: { kind: 'unrecoverable', action: { kind: 'introspectCause' } },
                serverError: {
                    error: 'invalid_grant',
                    errorDescription: 'token invalid',
                    statusCode: 400,
                },
                nativeCause: 'HaapiError',
            }),
        );
        var stackBefore = original.stack;

        try {
            rethrowAsHaapiError(original);
            fail('expected throw');
        } catch (e) {
            expect(e).toBe(original);
            expect(e.code).toBe(HaapiErrorCode.ServerError);
            expect(e.category).toBe('networking');
            expect(e.message).toBe('Readable message');
            expect(e.failureReason).toBe('Developer reason');
            expect(e.serverError.statusCode).toBe(400);
            expect(e.nativeCause).toBe('HaapiError');
            expect(e.stack).toBe(stackBefore);
        }
    });

          it('falls back to original error.message when decoded payload has no description/reason', () => {
            var payload = {
              code: HaapiErrorCode.Unexpected,
              category: 'unexpected',
            };
            var original = new Error(envelope(payload));

            try {
              rethrowAsHaapiError(original);
              fail('expected throw');
            } catch (e) {
              expect(e.message).toBe(original.message);
              expect(e.code).toBe(HaapiErrorCode.Unexpected);
              expect(e.category).toBe('unexpected');
            }
          });

    it('parses envelope nested inside Expo chain and rewrites message to errorDescription', () => {
        // Real-world iOS/Android: Expo prepends "Calling 'X' has failed\n→ Caused by: "
        // around our HaapiAccessorBridgeException's description. The rethrow path
        // must still parse the envelope and replace `message` with the readable
        // description so host apps don't see the raw envelope in `e.message`.
        var nested =
            "Call to function 'IdsvrHaapiReactNativeSdk.initializeForHaapi' has been rejected.\n" +
            '→ Caused by: ' +
            envelope({
                code: HaapiErrorCode.Communication,
                category: 'networking',
                errorDescription:
                    'Failed to connect to the server host. This may be due to network issues or incorrect server address.',
                recovery: { kind: 'retryable', condition: 'now' },
                nativeCause: 'HostConnectionException',
                cause: 'Failed to connect to localhost/127.0.0.1:8443',
            });
        var original = new Error(nested);

        try {
            rethrowAsHaapiError(original);
            fail('expected throw');
        } catch (e) {
            expect(e).toBe(original); // mutated in place so stack survives
            expect(e.code).toBe(HaapiErrorCode.Communication);
            expect(e.category).toBe('networking');
            expect(e.message).toBe(
                'Failed to connect to the server host. This may be due to network issues or incorrect server address.',
            );
            expect(e.recovery).toEqual({ kind: 'retryable', condition: 'now' });
            expect(e.nativeCause).toBe('HostConnectionException');
            expect(e.cause).toBe('Failed to connect to localhost/127.0.0.1:8443');
        }
    });
});

describe('isHaapiError', () => {
    it('returns true for each category with code/category shape', () => {
        var categories = [
            'networking',
            'attestation',
            'dpop',
            'haapi',
            'configuration',
            'bridge',
            'unexpected',
        ];

        categories.forEach((category) => {
            expect(
                isHaapiError({
                    name: 'Error',
                    message: 'x',
                    code: HaapiErrorCode.Unexpected,
                    category,
                }),
            ).toBe(true);
        });
    });

    it('returns false for non-haapi values', () => {
        expect(isHaapiError(new Error('x'))).toBe(false);
        expect(isHaapiError(null)).toBe(false);
        expect(isHaapiError(undefined)).toBe(false);
        expect(isHaapiError({})).toBe(false);
        expect(isHaapiError(1)).toBe(false);
        expect(
            isHaapiError({
                code: HaapiErrorCode.Unexpected,
                category: 'not-a-category',
            }),
        ).toBe(false);
    });
});

describe('HaapiErrorCode', () => {
    it('contains only unique values', () => {
        var values = Object.values(HaapiErrorCode);
        expect(new Set(values).size).toBe(values.length);
    });

    it('matches documented constants', () => {
        var expected = {
            AccessorAlreadyInitialized: 'HAAPI_ACCESSOR_ALREADY_INITIALIZED',
            AccessorNotInitialized: 'HAAPI_ACCESSOR_NOT_INITIALIZED',
            AccessorWrongKind: 'HAAPI_ACCESSOR_WRONG_KIND',
            FlowCacheMiss: 'HAAPI_FLOW_CACHE_MISS',
            Communication: 'HAAPI_COMMUNICATION',
            ServerError: 'HAAPI_SERVER_ERROR',
            InvalidUrlResponse: 'HAAPI_INVALID_URL_RESPONSE',
            InvalidStatusCode: 'HAAPI_INVALID_STATUS_CODE',
            UnsupportedContentType: 'HAAPI_UNSUPPORTED_CONTENT_TYPE',
            NoResponseData: 'HAAPI_NO_RESPONSE_DATA',
            AttestationNotSupported: 'HAAPI_ATTESTATION_NOT_SUPPORTED',
            AttestationFailure: 'HAAPI_ATTESTATION_FAILURE',
            AttestationKeyGenFailure: 'HAAPI_ATTESTATION_KEY_GEN_FAILURE',
            AttestationRefusedByServer: 'HAAPI_ATTESTATION_REFUSED_BY_SERVER',
            AssertionFailure: 'HAAPI_ASSERTION_FAILURE',
            DpopKeyCreationFailure: 'HAAPI_DPOP_KEY_CREATION_FAILURE',
            DpopProofCreationFailure: 'HAAPI_DPOP_PROOF_CREATION_FAILURE',
            DpopProofFailure: 'HAAPI_DPOP_PROOF_FAILURE',
            DpopNonceRequired: 'HAAPI_DPOP_NONCE_REQUIRED',
            TokenManagerClosed: 'HAAPI_TOKEN_MANAGER_CLOSED',
            TokenManagerExpired: 'HAAPI_TOKEN_MANAGER_EXPIRED',
            TokenManagerAlreadyExists: 'HAAPI_TOKEN_MANAGER_ALREADY_EXISTS',
            IllegalState: 'HAAPI_ILLEGAL_STATE',
            InvalidModel: 'HAAPI_INVALID_MODEL',
            InvalidConfiguration: 'HAAPI_INVALID_CONFIGURATION',
            Unexpected: 'HAAPI_UNEXPECTED',
        };

        expect(HaapiErrorCode).toEqual(expected);
    });
});

