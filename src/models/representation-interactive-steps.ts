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
import type { FormAction } from "./action-form";
import type { Message } from "./message";
import type { Properties } from "./properties";
import type { RepresentationBase } from "./representation-base";

// ─── Authenticator Option ────────────────────────────────────────────────────

/**
 * An authenticator option within an {@link AuthenticatorSelectorStep}.
 */
export interface AuthenticatorOption {
    /** Display title for the authenticator. */
    readonly title: Message;
    /** Authenticator type identifier (e.g., "html-form", "bankid"). */
    readonly type?: string;
    /** The action to select this authenticator. */
    readonly action: FormAction;
}

// ─── Interactive Steps ───────────────────────────────────────────────────────

/**
 * Step where the user selects from available authenticators.
 */
export interface AuthenticatorSelectorStep extends RepresentationBase {
    readonly stepType: StepType.AuthenticatorSelector;
    /** Title displayed above the authenticator list. */
    readonly title: Message;
    /** Available authenticator options. */
    readonly authenticators: AuthenticatorOption[];
}

/**
 * Step containing form actions for user interaction (e.g., username/password).
 */
export interface InteractiveFormStep extends RepresentationBase {
    readonly stepType: StepType.InteractiveForm;
    readonly properties?: Properties;
}

/**
 * Step where the user reviews and consents to sharing identity attributes.
 */
export interface UserConsentStep extends RepresentationBase {
    readonly stepType: StepType.UserConsent;
}
