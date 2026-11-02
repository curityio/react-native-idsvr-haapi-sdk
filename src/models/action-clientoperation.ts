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

import type { ActionType } from "./action-type";
import type { ActionKind } from "./action-kind";
import type { Message } from "./message";
import type { ClientOperationName } from "./client-operation-name";
import type { WebAuthnRegistrationPublicKey, WebAuthnAuthenticationPublicKey } from "./action-webauthn";
import type { Action } from "./action";

// ─── Client Operation Action Models ─────────────────────────────────────────

/**
 * Client operation requiring an external browser launch.
 */
export interface ExternalBrowserClientOperationActionModel {
    readonly clientOperationType: ClientOperationName.ExternalBrowser;
    /** The URL to open in the external browser. */
    readonly href: string;
    /** Raw arguments JSON. */
    readonly argumentsJson: string;
    readonly continueActions: Action[];
    readonly errorActions: Action[];
}

/**
 * Client operation for BankID authentication.
 */
export interface BankIdClientOperationActionModel {
    readonly clientOperationType: ClientOperationName.BankId;
    /** Auto-start token for BankID app launch. */
    readonly autoStartToken: string;
    /** Redirect URI. */
    readonly redirect: string;
    /** BankID service URL. */
    readonly href: string;
    /** Raw arguments JSON. */
    readonly argumentsJson: string;
    readonly continueActions: Action[];
    readonly errorActions: Action[];
}

/**
 * Client operation for Encap device auto-activation.
 */
export interface EncapClientOperationActionModel {
    readonly clientOperationType: ClientOperationName.EncapAutoActivation;
    /** Activation code for the device. */
    readonly activationCode: string;
    /** Encap service URL. */
    readonly href: string;
    /** Raw arguments JSON. */
    readonly argumentsJson: string;
    readonly continueActions: Action[];
    readonly errorActions: Action[];
}

/**
 * Client operation for WebAuthn/FIDO2 registration (Passkey creation).
 */
export interface WebAuthnRegistrationClientOperationActionModel {
    readonly clientOperationType: ClientOperationName.WebAuthnRegistration;
    /** Public key credential creation options. May be null if platform-specific keys are used. */
    readonly requestPublicKey?: WebAuthnRegistrationPublicKey;
    /** Platform-specific public key options. */
    readonly platformPublicKey?: WebAuthnRegistrationPublicKey;
    /** Cross-platform public key options. */
    readonly crossPlatformPublicKey?: WebAuthnRegistrationPublicKey;
    /** Raw arguments JSON. */
    readonly argumentsJson: string;
    readonly continueActions: Action[];
    readonly errorActions: Action[];
    /** Fallback actions if WebAuthn is not supported. */
    readonly fallbackActions: Action[];
}

/**
 * Client operation for WebAuthn/FIDO2 authentication (Passkey assertion).
 */
export interface WebAuthnAuthenticationClientOperationActionModel {
    readonly clientOperationType: ClientOperationName.WebAuthnAuthentication;
    /** Public key credential request options. */
    readonly publicKey: WebAuthnAuthenticationPublicKey;
    /** Raw arguments JSON. */
    readonly argumentsJson: string;
    readonly continueActions: Action[];
    readonly errorActions: Action[];
    /** Fallback actions if WebAuthn is not supported. */
    readonly fallbackActions: Action[];
}

/**
 * Client operation of an unknown type. Contains raw arguments for custom handling.
 */
export interface GenericClientOperationActionModel {
    readonly clientOperationType: ClientOperationName.Generic;
    /** The original operation name string. */
    readonly name: string;
    /** Raw arguments JSON. */
    readonly argumentsJson: string;
    readonly continueActions: Action[];
    readonly errorActions: Action[];
}

/**
 * A client operation action model.
 *
 * @remarks
 * Discriminated union on `clientOperationType`. Use a `switch` statement to
 * narrow to the specific operation type.
 */
export type ClientOperationActionModel =
    | ExternalBrowserClientOperationActionModel
    | BankIdClientOperationActionModel
    | EncapClientOperationActionModel
    | WebAuthnRegistrationClientOperationActionModel
    | WebAuthnAuthenticationClientOperationActionModel
    | GenericClientOperationActionModel;

// ─── Client Operation Action ────────────────────────────────────────────────

/**
 * A client operation action requiring external handling (browser, BankID, WebAuthn, etc.).
 */
export interface ClientOperationAction {
    readonly actionType: ActionType.ClientOperation;
    readonly kind: ActionKind;
    readonly title?: Message;
    /** The client operation model with operation-specific details. */
    readonly model: ClientOperationActionModel;
}
