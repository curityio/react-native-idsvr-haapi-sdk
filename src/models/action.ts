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

import type { FormAction } from "./action-form";
import type { ClientOperationAction } from "./action-clientoperation";
import type { SelectorAction } from "./action-selector";

/**
 * An action within a HAAPI step.
 *
 * @remarks
 * Discriminated union on `actionType`. Use a `switch` statement on `actionType`
 * to narrow to the specific action type.
 *
 * - {@link FormAction}: A submittable form (use with {@link HaapiManager.submitForm}).
 * - {@link ClientOperationAction}: Requires external handling (browser, BankID, WebAuthn).
 * - {@link SelectorAction}: Presents a list of selectable options.
 */
export type Action = FormAction | ClientOperationAction | SelectorAction;
