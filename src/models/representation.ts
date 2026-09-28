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

import type {
    AuthenticatorSelectorStep,
    InteractiveFormStep,
    UserConsentStep,
} from "./representation-interactive-steps";
import type {
    RedirectionStep,
    PollingStep,
    ContinueSameStep,
} from "./representation-flow";
import type { OAuthAuthorizationResponseStep } from "./representation-oauth";
import type {
    ExternalBrowserClientOperationStep,
    BankIdClientOperationStep,
    EncapClientOperationStep,
    WebAuthnRegistrationClientOperationStep,
    WebAuthnAuthenticationClientOperationStep,
    GenericClientOperationStep,
} from "./representation-clientoperation";
import type { GenericRepresentationStep } from "./representation-fallback";

/**
 * A successful HAAPI representation response.
 *
 * @remarks
 * Discriminated union on `stepType`. Use a `switch` statement on `stepType`
 * to narrow to the specific step type and access step-specific properties.
 *
 * @example
 * ```typescript
 * switch (representation.stepType) {
 *     case StepType.InteractiveForm:
 *         // representation is InteractiveFormStep
 *         break;
 *     case StepType.AuthenticatorSelector:
 *         // representation is AuthenticatorSelectorStep
 *         break;
 * }
 * ```
 */
export type HaapiRepresentation =
    | AuthenticatorSelectorStep
    | InteractiveFormStep
    | UserConsentStep
    | RedirectionStep
    | PollingStep
    | ContinueSameStep
    | OAuthAuthorizationResponseStep
    | ExternalBrowserClientOperationStep
    | BankIdClientOperationStep
    | EncapClientOperationStep
    | WebAuthnRegistrationClientOperationStep
    | WebAuthnAuthenticationClientOperationStep
    | GenericClientOperationStep
    | GenericRepresentationStep;
