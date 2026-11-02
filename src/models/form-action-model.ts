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

import type { Message } from "./message";
import type { FormField } from "./form-field";

/**
 * The model of a form action, describing the HTTP request and its fields.
 *
 * @remarks
 * Contains the fields that should be rendered as a form, plus the HTTP
 * method and target URI for submission.
 */
export interface FormActionModel {
    /** Optional title for the form action. */
    readonly actionTitle?: Message;
    /** The form fields to render. */
    readonly fields: FormField[];
    /** The media type of the form submission (e.g., "application/x-www-form-urlencoded"). */
    readonly type: string;
    /** The HTTP method for submission (e.g., "POST", "GET"). */
    readonly method: string;
    /** The target URI for form submission. */
    readonly href: string;
}
