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
import type { FormFieldType } from "./form-field-type";

/**
 * An option within a {@link SelectFormField}.
 */
export interface SelectOption {
    /** Display label for the option. */
    readonly label: string;
    /** The value submitted when this option is selected. */
    readonly value: string;
    /** Whether this option is pre-selected. */
    readonly selected: boolean;
}

/**
 * A hidden form field with a required value. Not shown to the user.
 */
export interface HiddenFormField {
    readonly fieldType: FormFieldType.Hidden;
    readonly name: string;
    readonly value: string;
    readonly isRequired: boolean;
}

/**
 * A general text input field.
 */
export interface TextFormField {
    readonly fieldType: FormFieldType.Text;
    readonly name: string;
    readonly value?: string;
    readonly label?: Message;
    readonly placeholder?: Message;
    readonly isRequired: boolean;
    /** Input kind hint (e.g., "email", "tel"). */
    readonly kind?: string;
    readonly minLength?: number;
    readonly maxLength?: number;
}

/**
 * A username input field.
 */
export interface UsernameFormField {
    readonly fieldType: FormFieldType.Username;
    readonly name: string;
    readonly value?: string;
    readonly label?: Message;
    readonly placeholder?: Message;
    readonly isRequired: boolean;
    readonly minLength?: number;
    readonly maxLength?: number;
}

/**
 * A password input field.
 */
export interface PasswordFormField {
    readonly fieldType: FormFieldType.Password;
    readonly name: string;
    readonly value?: string;
    readonly label?: Message;
    readonly placeholder?: Message;
    readonly isRequired: boolean;
    readonly minLength?: number;
    readonly maxLength?: number;
}

/**
 * A dropdown / select field with predefined options.
 */
export interface SelectFormField {
    readonly fieldType: FormFieldType.Select;
    readonly name: string;
    readonly value?: string;
    readonly label?: Message;
    readonly placeholder?: Message;
    readonly isRequired: boolean;
    /** The available options for this select field. */
    readonly options: SelectOption[];
}

/**
 * A checkbox input field.
 */
export interface CheckboxFormField {
    readonly fieldType: FormFieldType.Checkbox;
    readonly name: string;
    readonly value?: string;
    readonly label?: Message;
    readonly placeholder?: Message;
    readonly isRequired: boolean;
    /** Whether the checkbox is currently checked. */
    readonly checked: boolean;
    /** Whether the field is read-only. */
    readonly readOnly: boolean;
}

/**
 * A hidden context field used for WebAuthn / external browser flow data.
 */
export interface ContextFormField {
    readonly fieldType: FormFieldType.Context;
    readonly name: string;
    readonly value?: string;
    readonly label?: Message;
    readonly placeholder?: Message;
    readonly isRequired: boolean;
}

/**
 * A form field within a {@link FormActionModel}.
 *
 * @remarks
 * Discriminated union on `fieldType`. Use a `switch` statement on `fieldType`
 * to narrow to the specific field type and access variant-specific properties.
 */
export type FormField =
    | HiddenFormField
    | TextFormField
    | UsernameFormField
    | PasswordFormField
    | SelectFormField
    | CheckboxFormField
    | ContextFormField;
