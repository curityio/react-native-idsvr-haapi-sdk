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

// Mock the native module before importing HaapiManager
const mockInitialize = jest.fn();
const mockStart = jest.fn();
const mockSubmitForm = jest.fn();
const mockFollowLink = jest.fn();
const mockClose = jest.fn();

jest.mock('expo-modules-core', () => ({
    requireNativeModule: () => ({
        initialize: mockInitialize,
        start: mockStart,
        submitForm: mockSubmitForm,
        followLink: mockFollowLink,
        close: mockClose,
        addListener: () => ({ remove: () => {} }),
        configureLogger: () => Promise.resolve(),
    }),
    NativeModule: class {},
}));

import { HaapiManagerImpl } from '../../haapi-manager';
import { ActionType } from '../../models/action-type';
import { ActionKind } from '../../models/action-kind';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createFormAction(href) {
    return {
        actionType: ActionType.Form,
        kind: ActionKind.Login,
        title: { literal: 'Submit' },
        model: {
            fields: [],
            type: 'application/x-www-form-urlencoded',
            method: 'POST',
            href: href || '/auth/submit',
        },
    };
}

function createLink(rel) {
    return {
        href: '/auth/' + rel,
        rel: rel,
        title: { literal: rel },
    };
}

function createRepresentationResponse(stepType, actions, links) {
    return {
        responseCategory: 'representation',
        representation: {
            stepType: stepType,
            type: 'authentication-step',
            actions: actions || [],
            links: links || [],
            messages: [],
        },
    };
}

function createNativeMock() {
    return {
        start: jest.fn(),
        submitForm: jest.fn(),
        followLink: jest.fn(),
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

describe('HaapiManager', () => {
    var native;
    var logger;
    var manager;

    beforeEach(() => {
        native = createNativeMock();
        logger = createLoggerMock();
        manager = new HaapiManagerImpl(native, logger);
    });

    describe('start', () => {
        it('returns the response from the native module', async () => {
            var response = createRepresentationResponse('interactiveForm', [], []);
            native.start.mockResolvedValue(response);

            var result = await manager.start();

            expect(result).toBe(response);
            expect(native.start).toHaveBeenCalledTimes(1);
        });

        it('passes through a problem response untouched', async () => {
            var problemResponse = {
                responseCategory: 'problem',
                problem: {
                    problemKind: 'problem',
                    type: 'https://curity.se/problems/unexpected',
                    messages: [],
                    links: [],
                },
            };
            native.start.mockResolvedValue(problemResponse);

            var result = await manager.start();

            expect(result).toBe(problemResponse);
            expect(result.responseCategory).toBe('problem');
        });

        // Flow errors throw `HaapiError` — coverage lives in `rethrows a
        // normalized HaapiError when the native message carries an envelope`
        // below and in `errors.test.ts` for the parse path.

        it('emits one info-level log per call', async () => {
            native.start.mockResolvedValue(createRepresentationResponse('interactiveForm'));

            await manager.start();

            // Severity + arity only; message content is incidental and
            // would make the test brittle to wording changes.
            expect(logger.info).toHaveBeenCalledTimes(1);
        });

        it('rejects when the native call rejects', async () => {
            var failure = new Error('boom');
            native.start.mockRejectedValue(failure);

            await expect(manager.start()).rejects.toBe(failure);
        });

        it('rethrows a normalized HaapiError when the native message carries an envelope', async () => {
            native.start.mockRejectedValue(
                envelopeError({
                    code: 'HAAPI_COMMUNICATION',
                    category: 'networking',
                    errorDescription: 'network timeout',
                }),
            );

            await expect(manager.start()).rejects.toMatchObject({
                code: 'HAAPI_COMMUNICATION',
                category: 'networking',
                message: 'network timeout',
            });
        });
    });

    describe('submitForm', () => {
        it('passes the form action model to native (not the wrapping FormAction)', async () => {
            var action = createFormAction('/auth/login');
            var response = createRepresentationResponse('interactiveForm', [], []);
            native.submitForm.mockResolvedValue(response);

            var result = await manager.submitForm(action, { userName: 'john' });

            expect(native.submitForm).toHaveBeenCalledWith(action.model, { userName: 'john' });
            expect(result).toBe(response);
        });

        it('passes empty parameters when none provided', async () => {
            var action = createFormAction('/auth/submit');
            native.submitForm.mockResolvedValue(createRepresentationResponse('interactiveForm'));

            await manager.submitForm(action, {});

            expect(native.submitForm).toHaveBeenCalledWith(action.model, {});
        });

        it('forwards the exact params map to native', async () => {
            var action = createFormAction('/auth/submit');
            var params = {
                userName: 'john',
                password: 's3cret',
                _csrf: 'token-xyz',
            };
            native.submitForm.mockResolvedValue(createRepresentationResponse('interactiveForm'));

            await manager.submitForm(action, params);

            expect(native.submitForm).toHaveBeenCalledWith(action.model, params);
        });

        it('forwards heterogeneous parameter value types unchanged', async () => {
            // submitForm's parameters are typed `Record<string, unknown>` to
            // match the iOS [String: any Sendable] / Android Map<String, Any>
            // bridges. Push one value of every JSON-serialisable shape through
            // and assert each survives the pass-through with its concrete type
            // intact — strings, numbers (int + float), booleans, null, arrays,
            // nested objects.
            const action = createFormAction('/auth/submit');
            const params = {
                stringValue: 'alice',
                intValue: 42,
                doubleValue: 3.14,
                boolValueTrue: true,
                boolValueFalse: false,
                nullValue: null,
                arrayValue: ['a', 'b', 'c'],
                nestedObjectValue: { nestedKey: 'nestedVal', nestedCount: 7 },
            };
            native.submitForm.mockResolvedValue(createRepresentationResponse('interactiveForm'));

            await manager.submitForm(action, params);

            // Single source-of-truth assertion: the exact same object reference
            // (or at minimum deep-equal contents) must reach the native bridge.
            // Jest's toHaveBeenCalledWith uses deep equality and preserves type.
            expect(native.submitForm).toHaveBeenCalledWith(action.model, params);

            // Defence-in-depth: spot-check concrete types on the forwarded
            // value so a future refactor that JSON-stringifies or shallow-copies
            // can't pass by accident.
            const forwarded = native.submitForm.mock.calls[0][1];
            expect(typeof forwarded.stringValue).toBe('string');
            expect(typeof forwarded.intValue).toBe('number');
            expect(typeof forwarded.doubleValue).toBe('number');
            expect(typeof forwarded.boolValueTrue).toBe('boolean');
            expect(typeof forwarded.boolValueFalse).toBe('boolean');
            expect(forwarded.nullValue).toBeNull();
            expect(Array.isArray(forwarded.arrayValue)).toBe(true);
            expect(forwarded.nestedObjectValue).toEqual({ nestedKey: 'nestedVal', nestedCount: 7 });
        });

        it('passes each action model independently across calls', async () => {
            var loginAction = createFormAction('/auth/login');
            var otpAction = createFormAction('/auth/otp');
            native.submitForm.mockResolvedValue(createRepresentationResponse('interactiveForm'));

            await manager.submitForm(loginAction, { user: 'alice' });
            expect(native.submitForm).toHaveBeenCalledWith(loginAction.model, { user: 'alice' });

            await manager.submitForm(otpAction, { code: '123456' });
            expect(native.submitForm).toHaveBeenCalledWith(otpAction.model, { code: '123456' });
        });

        it('emits one info-level log per call', async () => {
            var action = createFormAction('/auth/login');
            native.submitForm.mockResolvedValue(createRepresentationResponse('interactiveForm'));

            await manager.submitForm(action, {});

            expect(logger.info).toHaveBeenCalledTimes(1);
        });

        it('rejects when the native call rejects', async () => {
            var action = createFormAction('/auth/submit');
            var failure = new Error('boom');
            native.submitForm.mockRejectedValue(failure);

            await expect(manager.submitForm(action, {})).rejects.toBe(failure);
        });

        it('normalizes envelope errors on submitForm', async () => {
            var action = createFormAction('/auth/submit');
            native.submitForm.mockRejectedValue(
                envelopeError({
                    code: 'HAAPI_FLOW_CACHE_MISS',
                    category: 'bridge',
                    errorDescription: 'stale form action',
                }),
            );

            await expect(manager.submitForm(action, {})).rejects.toMatchObject({
                code: 'HAAPI_FLOW_CACHE_MISS',
                category: 'bridge',
            });
        });
    });

    describe('followLink', () => {
        it('passes the link object to native', async () => {
            var link = createLink('cancel');
            var response = createRepresentationResponse('interactiveForm', [], []);
            native.followLink.mockResolvedValue(response);

            var result = await manager.followLink(link);

            expect(native.followLink).toHaveBeenCalledWith(link);
            expect(result).toBe(response);
        });

        it('passes each link independently across calls', async () => {
            var restartLink = createLink('restart');
            var helpLink = createLink('help');
            native.followLink.mockResolvedValue(createRepresentationResponse('interactiveForm'));

            await manager.followLink(restartLink);
            expect(native.followLink).toHaveBeenCalledWith(restartLink);

            await manager.followLink(helpLink);
            expect(native.followLink).toHaveBeenCalledWith(helpLink);
        });

        it('emits one info-level log per call', async () => {
            var link = createLink('cancel');
            native.followLink.mockResolvedValue(createRepresentationResponse('interactiveForm'));

            await manager.followLink(link);

            expect(logger.info).toHaveBeenCalledTimes(1);
        });

        it('rejects when the native call rejects', async () => {
            var link = createLink('cancel');
            var failure = new Error('boom');
            native.followLink.mockRejectedValue(failure);

            await expect(manager.followLink(link)).rejects.toBe(failure);
        });

        it('normalizes envelope errors on followLink', async () => {
            var link = createLink('cancel');
            native.followLink.mockRejectedValue(
                envelopeError({
                    code: 'HAAPI_UNEXPECTED',
                    category: 'unexpected',
                    failureReason: 'bridge conversion failed',
                }),
            );

            await expect(manager.followLink(link)).rejects.toMatchObject({
                code: 'HAAPI_UNEXPECTED',
                category: 'unexpected',
                message: 'bridge conversion failed',
            });
        });
    });
});
