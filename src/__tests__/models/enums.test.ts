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
import { RepresentationType } from '../../models/representation-type';
import { ActionKind } from '../../models/action-kind';
import { ActionType } from '../../models/action-type';
import { PollingStatus } from '../../models/polling-status';
import { ProblemType } from '../../models/problem-type';
import { FormFieldType } from '../../models/form-field-type';
import { ClientOperationName } from '../../models/client-operation-name';
import { StepType } from '../../models/step-type';

// ---------------------------------------------------------------------------
// RepresentationType
// ---------------------------------------------------------------------------

describe('RepresentationType', () => {
    it('has correct HAAPI protocol string values', () => {
        expect(RepresentationType.AuthenticationStep).toBe('authentication-step');
        expect(RepresentationType.RedirectionStep).toBe('redirection-step');
        expect(RepresentationType.RegistrationStep).toBe('registration-step');
        expect(RepresentationType.PollingStep).toBe('polling-step');
        expect(RepresentationType.ContinueSameStep).toBe('continue-same-step');
        expect(RepresentationType.OAuthAuthorizationResponse).toBe('oauth-authorization-response');
        expect(RepresentationType.ConsentorStep).toBe('consentor-step');
        expect(RepresentationType.UserConsentStep).toBe('user-consent-step');
    });

    it('has exactly 8 values', () => {
        expect(Object.keys(RepresentationType)).toHaveLength(8);
    });
});

// ---------------------------------------------------------------------------
// ActionKind
// ---------------------------------------------------------------------------

describe('ActionKind', () => {
    it('has correct HAAPI protocol string values', () => {
        expect(ActionKind.Cancel).toBe('cancel');
        expect(ActionKind.DeviceOption).toBe('device-option');
        expect(ActionKind.Login).toBe('login');
        expect(ActionKind.Continue).toBe('continue');
        expect(ActionKind.ContinueAutoLogin).toBe('continue-auto-login');
        expect(ActionKind.DeviceSelector).toBe('device-selector');
        expect(ActionKind.Redirect).toBe('redirect');
        expect(ActionKind.AuthenticatorSelector).toBe('authenticator-selector');
        expect(ActionKind.SelectAuthenticator).toBe('select-authenticator');
        expect(ActionKind.Poll).toBe('poll');
        expect(ActionKind.Form).toBe('form');
        expect(ActionKind.BankIdSameDevice).toBe('bankid-same-device');
        expect(ActionKind.BankIdOtherDevice).toBe('bankid-other-device');
        expect(ActionKind.PasswordReset).toBe('password-reset');
        expect(ActionKind.AccountIdRecovery).toBe('account-id-recovery');
        expect(ActionKind.UserRegister).toBe('user-register');
        expect(ActionKind.Other).toBe('other');
    });

    it('has exactly 17 values', () => {
        expect(Object.keys(ActionKind)).toHaveLength(17);
    });
});

// ---------------------------------------------------------------------------
// ActionType
// ---------------------------------------------------------------------------

describe('ActionType', () => {
    it('has correct string values', () => {
        expect(ActionType.Form).toBe('form');
        expect(ActionType.ClientOperation).toBe('clientOperation');
        expect(ActionType.Selector).toBe('selector');
    });

    it('has exactly 3 values', () => {
        expect(Object.keys(ActionType)).toHaveLength(3);
    });
});

// ---------------------------------------------------------------------------
// PollingStatus
// ---------------------------------------------------------------------------

describe('PollingStatus', () => {
    it('has correct string values', () => {
        expect(PollingStatus.Pending).toBe('pending');
        expect(PollingStatus.Done).toBe('done');
        expect(PollingStatus.Failed).toBe('failed');
    });

    it('has exactly 3 values', () => {
        expect(Object.keys(PollingStatus)).toHaveLength(3);
    });
});

// ---------------------------------------------------------------------------
// ProblemType
// ---------------------------------------------------------------------------

describe('ProblemType', () => {
    it('has correct Curity problem type URIs', () => {
        expect(ProblemType.AuthenticationFailedProblem).toBe(
            'https://curity.se/problems/authentication-failed'
        );
        expect(ProblemType.InvalidInputProblem).toBe(
            'https://curity.se/problems/invalid-input'
        );
        expect(ProblemType.IncorrectCredentialsProblem).toBe(
            'https://curity.se/problems/incorrect-credentials'
        );
        expect(ProblemType.ErrorAuthorizationResponseProblem).toBe(
            'https://curity.se/problems/error-authorization-response'
        );
        expect(ProblemType.UnexpectedProblem).toBe(
            'https://curity.se/problems/unexpected'
        );
        expect(ProblemType.TooManyAttemptsProblem).toBe(
            'https://curity.se/problems/too-many-attempts'
        );
        expect(ProblemType.GenericUserProblem).toBe(
            'https://curity.se/problems/generic-user-error'
        );
        expect(ProblemType.SessionAndAccessTokenMismatchProblem).toBe(
            'https://curity.se/problems/mismatch-between-session-and-access-token'
        );
        expect(ProblemType.Other).toBe('other');
    });

    it('has exactly 9 values', () => {
        expect(Object.keys(ProblemType)).toHaveLength(9);
    });
});

// ---------------------------------------------------------------------------
// FormFieldType
// ---------------------------------------------------------------------------

describe('FormFieldType', () => {
    it('has correct string values', () => {
        expect(FormFieldType.Hidden).toBe('hidden');
        expect(FormFieldType.Text).toBe('text');
        expect(FormFieldType.Username).toBe('username');
        expect(FormFieldType.Password).toBe('password');
        expect(FormFieldType.Select).toBe('select');
        expect(FormFieldType.Checkbox).toBe('checkbox');
        expect(FormFieldType.Context).toBe('context');
    });

    it('has exactly 7 values', () => {
        expect(Object.keys(FormFieldType)).toHaveLength(7);
    });
});

// ---------------------------------------------------------------------------
// ClientOperationName
// ---------------------------------------------------------------------------

describe('ClientOperationName', () => {
    it('has correct string values', () => {
        expect(ClientOperationName.ExternalBrowser).toBe('external-browser-flow');
        expect(ClientOperationName.BankId).toBe('bankid');
        expect(ClientOperationName.EncapAutoActivation).toBe('encap-auto-activation');
        expect(ClientOperationName.WebAuthnRegistration).toBe('webauthn-registration');
        expect(ClientOperationName.WebAuthnAuthentication).toBe('webauthn-authentication');
        expect(ClientOperationName.Generic).toBe('generic');
    });

    it('has exactly 6 values', () => {
        expect(Object.keys(ClientOperationName)).toHaveLength(6);
    });
});

// ---------------------------------------------------------------------------
// StepType
// ---------------------------------------------------------------------------

describe('StepType', () => {
    it('has correct string values', () => {
        expect(StepType.AuthenticatorSelector).toBe('authenticatorSelector');
        expect(StepType.InteractiveForm).toBe('interactiveForm');
        expect(StepType.UserConsent).toBe('userConsent');
        expect(StepType.Redirection).toBe('redirection');
        expect(StepType.Polling).toBe('polling');
        expect(StepType.ContinueSame).toBe('continueSame');
        expect(StepType.OAuthAuthorizationResponse).toBe('oAuthAuthorizationResponse');
        expect(StepType.ExternalBrowserClientOperation).toBe('externalBrowserClientOperation');
        expect(StepType.BankIdClientOperation).toBe('bankIdClientOperation');
        expect(StepType.EncapClientOperation).toBe('encapClientOperation');
        expect(StepType.WebAuthnRegistrationClientOperation).toBe('webAuthnRegistrationClientOperation');
        expect(StepType.WebAuthnAuthenticationClientOperation).toBe('webAuthnAuthenticationClientOperation');
        expect(StepType.GenericClientOperation).toBe('genericClientOperation');
        expect(StepType.GenericRepresentation).toBe('genericRepresentation');
    });

    it('has exactly 14 values', () => {
        expect(Object.keys(StepType)).toHaveLength(14);
    });
});
