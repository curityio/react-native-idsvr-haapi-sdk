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

import type { StepType } from "./step-type";
import type { Link } from "./link";
import type {
    ExternalBrowserClientOperationActionModel,
    BankIdClientOperationActionModel,
    EncapClientOperationActionModel,
    WebAuthnRegistrationClientOperationActionModel,
    WebAuthnAuthenticationClientOperationActionModel,
    GenericClientOperationActionModel,
} from "./action-clientoperation";
import type { RepresentationBase } from "./representation-base";

// ─── Client Operation Steps ──────────────────────────────────────────────────

/**
 * Step requiring an external browser launch.
 */
export interface ExternalBrowserClientOperationStep extends RepresentationBase {
    readonly stepType: StepType.ExternalBrowserClientOperation;
    readonly clientOperationActionModel: ExternalBrowserClientOperationActionModel;
}

/**
 * Step requiring BankID native app launch.
 */
export interface BankIdClientOperationStep extends RepresentationBase {
    readonly stepType: StepType.BankIdClientOperation;
    readonly clientOperationActionModel: BankIdClientOperationActionModel;
    /** Optional QR code activation link. */
    readonly activationLink?: Link;
}

/**
 * Step requiring Encap device auto-activation.
 */
export interface EncapClientOperationStep extends RepresentationBase {
    readonly stepType: StepType.EncapClientOperation;
    readonly clientOperationActionModel: EncapClientOperationActionModel;
}

/**
 * Step requiring WebAuthn/FIDO2 registration (Passkey creation).
 */
export interface WebAuthnRegistrationClientOperationStep extends RepresentationBase {
    readonly stepType: StepType.WebAuthnRegistrationClientOperation;
    readonly clientOperationActionModel: WebAuthnRegistrationClientOperationActionModel;
}

/**
 * Step requiring WebAuthn/FIDO2 authentication (Passkey assertion).
 */
export interface WebAuthnAuthenticationClientOperationStep extends RepresentationBase {
    readonly stepType: StepType.WebAuthnAuthenticationClientOperation;
    readonly clientOperationActionModel: WebAuthnAuthenticationClientOperationActionModel;
}

/**
 * Step for an unknown client operation type.
 */
export interface GenericClientOperationStep extends RepresentationBase {
    readonly stepType: StepType.GenericClientOperation;
    readonly clientOperationActionModel: GenericClientOperationActionModel;
}
