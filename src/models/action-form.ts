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
import type { FormActionModel } from "./form-action-model";

/**
 * A form action that the user can submit with field parameters.
 *
 * @remarks
 * Pass this object to {@link HaapiManager.submitForm} or
 * {@link IdsvrHaapiReactNativeSdkModule.submitForm} to submit the form.
 */
export interface FormAction {
    readonly actionType: ActionType.Form;
    /** The kind of action (e.g., login, cancel, redirect). */
    readonly kind: ActionKind;
    /** Optional display title. */
    readonly title?: Message;
    /** The form model containing fields, HTTP method, and target URI. */
    readonly model: FormActionModel;
}
