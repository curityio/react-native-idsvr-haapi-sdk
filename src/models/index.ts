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

// Enums
export { RepresentationType } from "./representation-type";
export { ActionKind } from "./action-kind";
export { ActionType } from "./action-type";
export { PollingStatus } from "./polling-status";
export { ProblemType } from "./problem-type";
export { FormFieldType } from "./form-field-type";
export { ClientOperationName } from "./client-operation-name";
export { StepType } from "./step-type";

// Primitive interfaces
export type { Message, UserMessage } from "./message";
export type { Metadata } from "./metadata";
export type { Link } from "./link";

// Properties
export type {
    GenericProperties,
    OAuthAuthorizationResponseProperties,
    PollingProperties,
    Properties,
} from "./properties";

// Form fields
export type {
    SelectOption,
    HiddenFormField,
    TextFormField,
    UsernameFormField,
    PasswordFormField,
    SelectFormField,
    CheckboxFormField,
    ContextFormField,
    FormField,
} from "./form-field";

// Action models
export type { FormActionModel } from "./form-action-model";

// WebAuthn models
export type {
    CredentialParameter,
    AuthenticatorSelection,
    WebAuthnCredential,
    WebAuthnRegistrationPublicKey,
    WebAuthnAuthenticationPublicKey,
} from "./action-webauthn";

// Form action
export type { FormAction } from "./action-form";

// Client operation action + models
export type {
    ExternalBrowserClientOperationActionModel,
    BankIdClientOperationActionModel,
    EncapClientOperationActionModel,
    WebAuthnRegistrationClientOperationActionModel,
    WebAuthnAuthenticationClientOperationActionModel,
    GenericClientOperationActionModel,
    ClientOperationActionModel,
    ClientOperationAction,
} from "./action-clientoperation";

// Selector action
export type { SelectorAction } from "./action-selector";

// Action union
export type { Action } from "./action";

// Representation base
export type { RepresentationBase } from "./representation-base";

// Interactive steps
export type {
    AuthenticatorOption,
    AuthenticatorSelectorStep,
    InteractiveFormStep,
    UserConsentStep,
} from "./representation-interactive-steps";

// Flow control steps
export type {
    RedirectionStep,
    PollingStep,
    ContinueSameStep,
} from "./representation-flow";

// OAuth step
export type { OAuthAuthorizationResponseStep } from "./representation-oauth";

// Client operation steps
export type {
    ExternalBrowserClientOperationStep,
    BankIdClientOperationStep,
    EncapClientOperationStep,
    WebAuthnRegistrationClientOperationStep,
    WebAuthnAuthenticationClientOperationStep,
    GenericClientOperationStep,
} from "./representation-clientoperation";

// Fallback step
export type { GenericRepresentationStep } from "./representation-fallback";

// Representation union
export type { HaapiRepresentation } from "./representation";

// Problems
export type {
    InvalidField,
    Problem,
    InvalidInputProblem,
    AuthorizationProblem,
    ProblemRepresentation,
} from "./problem";

// Token responses
export type {
    SuccessfulTokenResponse,
    ErrorTokenResponse,
    TokenResponse,
} from "./token-response";

// Top-level response
export type {
    HaapiRepresentationResponse,
    HaapiProblemResponse,
    HaapiResponse,
} from "./haapi-response";
