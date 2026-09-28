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

import { StepType } from '../../models/step-type';
import { RepresentationType } from '../../models/representation-type';
import { ActionType } from '../../models/action-type';
import { ActionKind } from '../../models/action-kind';
import { FormFieldType } from '../../models/form-field-type';
import { ProblemType } from '../../models/problem-type';
import { PollingStatus } from '../../models/polling-status';
import { ClientOperationName } from '../../models/client-operation-name';

// ---------------------------------------------------------------------------
// HaapiResponse — discriminated on responseCategory
// ---------------------------------------------------------------------------

describe('HaapiResponse discriminated union', function () {
    it('narrows to representation response', function () {
        var response = {
            responseCategory: 'representation',
            representation: {
                stepType: StepType.InteractiveForm,
                type: RepresentationType.AuthenticationStep,
                actions: [],
                links: [],
                messages: [],
            },
        };
        if (response.responseCategory === 'representation') {
            expect(response.representation).toBeDefined();
            expect(response.representation.stepType).toBe(StepType.InteractiveForm);
        }
    });

    it('narrows to problem response', function () {
        var response = {
            responseCategory: 'problem',
            problem: {
                problemKind: 'problem',
                type: ProblemType.UnexpectedProblem,
                messages: [],
                links: [],
            },
        };
        if (response.responseCategory === 'problem') {
            expect(response.problem).toBeDefined();
            expect(response.problem.type).toBe(ProblemType.UnexpectedProblem);
        }
    });

    // Flow errors throw `HaapiError` via the bridge normalizers — coverage
    // lives in `errors.test.ts` and the bridge tests.
});

// ---------------------------------------------------------------------------
// HaapiRepresentation — discriminated on stepType
// ---------------------------------------------------------------------------

describe('HaapiRepresentation discriminated union', function () {
    it('narrows to AuthenticatorSelectorStep', function () {
        var step = {
            stepType: StepType.AuthenticatorSelector,
            type: RepresentationType.AuthenticationStep,
            actions: [],
            links: [],
            messages: [],
            title: { literal: 'Select' },
            authenticators: [],
        };
        if (step.stepType === StepType.AuthenticatorSelector) {
            expect(step.title.literal).toBe('Select');
            expect(step.authenticators).toEqual([]);
        }
    });

    it('narrows to InteractiveFormStep', function () {
        var step = {
            stepType: StepType.InteractiveForm,
            type: RepresentationType.AuthenticationStep,
            actions: [],
            links: [],
            messages: [],
            properties: { kind: 'generic', rawJsonString: '{}' },
        };
        if (step.stepType === StepType.InteractiveForm) {
            expect(step.properties).toBeDefined();
            expect(step.properties.kind).toBe('generic');
        }
    });

    it('narrows to PollingStep', function () {
        var step = {
            stepType: StepType.Polling,
            type: RepresentationType.PollingStep,
            actions: [],
            links: [],
            messages: [],
            mainAction: {
                actionType: ActionType.Form,
                kind: ActionKind.Poll,
                model: { fields: [], type: 'application/x-www-form-urlencoded', method: 'POST', href: '/poll' },

            },
            cancelAction: {
                actionType: ActionType.Form,
                kind: ActionKind.Cancel,
                model: { fields: [], type: 'application/x-www-form-urlencoded', method: 'POST', href: '/cancel' },

            },
            pollingProperties: {
                kind: 'polling',
                status: PollingStatus.Pending,
                // HSRN-20 / HAAPI SDK 5.4.0 — `interval` is an optional
                // decimal-string milliseconds value on the polling-properties
                // discriminated-union variant. Type guard must preserve it so
                // host apps can drive their UI polling cadence off the
                // server-provided value.
                interval: '5000',
            },
        };
        if (step.stepType === StepType.Polling) {
            expect(step.mainAction.kind).toBe(ActionKind.Poll);
            expect(step.cancelAction.kind).toBe(ActionKind.Cancel);
            expect(step.pollingProperties.status).toBe(PollingStatus.Pending);
            expect(step.pollingProperties.interval).toBe('5000');
        }
    });

    it('narrows PollingStep without interval (absence path)', function () {
        // Layer-(c) regression guard: when the SDK doesn't return `interval`
        // (5.3.0 servers, or 5.4.0 servers that opt out), the field is
        // `undefined` rather than coerced to empty string, and sibling fields
        // round-trip unaffected.
        var step = {
            stepType: StepType.Polling,
            type: RepresentationType.PollingStep,
            actions: [],
            links: [],
            messages: [],
            mainAction: {
                actionType: ActionType.Form,
                kind: ActionKind.Poll,
                model: { fields: [], type: 'application/x-www-form-urlencoded', method: 'POST', href: '/poll' },
            },
            cancelAction: {
                actionType: ActionType.Form,
                kind: ActionKind.Cancel,
                model: { fields: [], type: 'application/x-www-form-urlencoded', method: 'POST', href: '/cancel' },
            },
            pollingProperties: {
                kind: 'polling',
                status: PollingStatus.Pending,
                maxWaitTime: 'PT5M',
                maxWaitRemainingTime: 'PT4M30S',
            },
        };
        if (step.stepType === StepType.Polling) {
            expect(step.pollingProperties.status).toBe(PollingStatus.Pending);
            expect(step.pollingProperties.maxWaitTime).toBe('PT5M');
            expect(step.pollingProperties.interval).toBeUndefined();
        }
    });

    it('narrows to RedirectionStep', function () {
        var step = {
            stepType: StepType.Redirection,
            type: RepresentationType.RedirectionStep,
            actions: [],
            links: [],
            messages: [],
            redirectAction: {
                actionType: ActionType.Form,
                kind: ActionKind.Redirect,
                model: { fields: [], type: 'application/x-www-form-urlencoded', method: 'GET', href: '/redirect' },

            },
        };
        if (step.stepType === StepType.Redirection) {
            expect(step.redirectAction).toBeDefined();
            expect(step.redirectAction.kind).toBe(ActionKind.Redirect);
        }
    });

    it('narrows to OAuthAuthorizationResponseStep', function () {
        var step = {
            stepType: StepType.OAuthAuthorizationResponse,
            type: RepresentationType.OAuthAuthorizationResponse,
            actions: [],
            links: [],
            messages: [],
            oauthProperties: {
                kind: 'oauthAuthorizationResponse',
                code: 'abc123',
                state: 'xyz',
            },
        };
        if (step.stepType === StepType.OAuthAuthorizationResponse) {
            expect(step.oauthProperties).toBeDefined();
            expect(step.oauthProperties.code).toBe('abc123');
            expect(step.oauthProperties.state).toBe('xyz');
        }
    });
});

// ---------------------------------------------------------------------------
// Action — discriminated on actionType
// ---------------------------------------------------------------------------

describe('Action discriminated union', function () {
    it('narrows to FormAction', function () {
        var action = {
            actionType: ActionType.Form,
            kind: ActionKind.Login,
            title: { literal: 'Login' },
            model: {
                fields: [],
                type: 'application/x-www-form-urlencoded',
                method: 'POST',
                href: '/auth/login',
            },
        };
        if (action.actionType === ActionType.Form) {
            expect(action.model).toBeDefined();
            expect(action.model.href).toBe('/auth/login');
        }
    });

    it('narrows to ClientOperationAction', function () {
        var action = {
            actionType: ActionType.ClientOperation,
            kind: ActionKind.BankIdSameDevice,
            model: {
                clientOperationType: ClientOperationName.BankId,
                autoStartToken: 'token123',
                redirect: 'bankid:///',
                href: '/bankid',
                argumentsJson: '{}',
                continueActions: [],
                errorActions: [],
            },
        };
        if (action.actionType === ActionType.ClientOperation) {
            expect(action.model).toBeDefined();
            expect(action.model.clientOperationType).toBe(ClientOperationName.BankId);
        }
    });

    it('narrows to SelectorAction', function () {
        var action = {
            actionType: ActionType.Selector,
            kind: ActionKind.AuthenticatorSelector,
            options: [
                {
                    actionType: ActionType.Form,
                    kind: ActionKind.SelectAuthenticator,
                    model: { fields: [], type: 'application/x-www-form-urlencoded', method: 'POST', href: '/select' },
    
                },
            ],
        };
        if (action.actionType === ActionType.Selector) {
            expect(action.options).toBeDefined();
            expect(action.options).toHaveLength(1);
        }
    });
});

// ---------------------------------------------------------------------------
// FormField — discriminated on fieldType
// ---------------------------------------------------------------------------

describe('FormField discriminated union', function () {
    it('narrows to HiddenFormField', function () {
        var field = {
            fieldType: FormFieldType.Hidden,
            name: '_csrf',
            value: 'token-abc',
            isRequired: true,
        };
        if (field.fieldType === FormFieldType.Hidden) {
            expect(field.value).toBe('token-abc');
            expect(typeof field.value).toBe('string');
        }
    });

    it('narrows to TextFormField', function () {
        var field = {
            fieldType: FormFieldType.Text,
            name: 'email',
            isRequired: true,
            kind: 'email',
            minLength: 1,
            maxLength: 255,
        };
        if (field.fieldType === FormFieldType.Text) {
            expect(field.kind).toBe('email');
            expect(field.minLength).toBe(1);
            expect(field.maxLength).toBe(255);
        }
    });

    it('narrows to PasswordFormField', function () {
        var field = {
            fieldType: FormFieldType.Password,
            name: 'password',
            isRequired: true,
            minLength: 8,
            maxLength: 128,
        };
        if (field.fieldType === FormFieldType.Password) {
            expect(field.minLength).toBe(8);
            expect(field.maxLength).toBe(128);
        }
    });

    it('narrows to SelectFormField', function () {
        var field = {
            fieldType: FormFieldType.Select,
            name: 'country',
            isRequired: true,
            options: [
                { label: 'Sweden', value: 'SE', selected: true },
                { label: 'Norway', value: 'NO', selected: false },
            ],
        };
        if (field.fieldType === FormFieldType.Select) {
            expect(field.options).toHaveLength(2);
            expect(field.options[0].label).toBe('Sweden');
            expect(field.options[0].value).toBe('SE');
            expect(field.options[0].selected).toBe(true);
        }
    });

    it('narrows to CheckboxFormField', function () {
        var field = {
            fieldType: FormFieldType.Checkbox,
            name: 'rememberMe',
            isRequired: false,
            checked: false,
            readOnly: false,
        };
        if (field.fieldType === FormFieldType.Checkbox) {
            expect(field.checked).toBe(false);
            expect(field.readOnly).toBe(false);
        }
    });
});

// ---------------------------------------------------------------------------
// ProblemRepresentation — discriminated on problemKind
// ---------------------------------------------------------------------------

describe('ProblemRepresentation discriminated union', function () {
    it('narrows to Problem (base)', function () {
        var problem = {
            problemKind: 'problem',
            type: ProblemType.UnexpectedProblem,
            messages: [],
            links: [],
        };
        if (problem.problemKind === 'problem') {
            expect(problem.type).toBe(ProblemType.UnexpectedProblem);
            expect(problem.messages).toEqual([]);
            expect(problem.links).toEqual([]);
        }
    });

    it('narrows to InvalidInputProblem', function () {
        var problem = {
            problemKind: 'invalidInput',
            type: ProblemType.InvalidInputProblem,
            messages: [],
            links: [],
            invalidFields: [
                { name: 'userName', detail: { literal: 'Username is required' } },
            ],
        };
        if (problem.problemKind === 'invalidInput') {
            expect(problem.invalidFields).toHaveLength(1);
            expect(problem.invalidFields[0].name).toBe('userName');
            expect(problem.invalidFields[0].detail.literal).toBe('Username is required');
        }
    });

    it('narrows to AuthorizationProblem', function () {
        var problem = {
            problemKind: 'authorization',
            type: ProblemType.ErrorAuthorizationResponseProblem,
            messages: [],
            links: [],
            error: 'invalid_request',
            // HSRN-0 / HAAPI SDK 5.5.0 — `iss` is the optional RFC 9207 issuer
            // identifier on the AuthorizationProblem variant. The type guard
            // must preserve it so host apps can verify the responding issuer.
            iss: 'https://issuer.example.com/oauth/v2/oauth-anonymous',
        };
        if (problem.problemKind === 'authorization') {
            expect(problem.error).toBe('invalid_request');
            expect(problem.iss).toBe('https://issuer.example.com/oauth/v2/oauth-anonymous');
        }
    });

    it('narrows AuthorizationProblem without iss (absence path)', function () {
        // Layer-(c) regression guard: pre-5.5.0 servers (or servers that omit
        // it) don't return `iss`, so the field is `undefined` rather than
        // coerced to empty string, and sibling fields round-trip unaffected.
        var problem = {
            problemKind: 'authorization',
            type: ProblemType.ErrorAuthorizationResponseProblem,
            messages: [],
            links: [],
            error: 'invalid_request',
        };
        if (problem.problemKind === 'authorization') {
            expect(problem.error).toBe('invalid_request');
            expect(problem.iss).toBeUndefined();
        }
    });
});

// ---------------------------------------------------------------------------
// TokenResponse — discriminated on responseType
// ---------------------------------------------------------------------------

describe('TokenResponse discriminated union', function () {
    it('narrows to SuccessfulTokenResponse', function () {
        var response = {
            responseType: 'success',
            accessToken: 'eyJhbGciOi...',
            expiresIn: 3600,
            tokenType: 'bearer',
            scope: 'openid profile',
        };
        if (response.responseType === 'success') {
            expect(response.accessToken).toBe('eyJhbGciOi...');
            expect(response.expiresIn).toBe(3600);
        }
    });

    it('narrows to ErrorTokenResponse', function () {
        var response = {
            responseType: 'error',
            error: 'invalid_grant',
            errorDescription: 'The authorization code has expired',
        };
        if (response.responseType === 'error') {
            expect(response.error).toBe('invalid_grant');
        }
    });
});
