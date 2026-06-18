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

/**
 * Specializes the meaning of an {@link Action} within a HAAPI step.
 *
 * @remarks
 * Maps to the `kind` field in the HAAPI protocol JSON. Unknown kinds from
 * future server versions are represented as {@link ActionKind.Other}.
 */
export enum ActionKind {
    Cancel = "cancel",
    DeviceOption = "device-option",
    Login = "login",
    Continue = "continue",
    ContinueAutoLogin = "continue-auto-login",
    DeviceSelector = "device-selector",
    Redirect = "redirect",
    AuthenticatorSelector = "authenticator-selector",
    SelectAuthenticator = "select-authenticator",
    Poll = "poll",
    Form = "form",
    BankIdSameDevice = "bankid-same-device",
    BankIdOtherDevice = "bankid-other-device",
    PasswordReset = "password-reset",
    AccountIdRecovery = "account-id-recovery",
    UserRegister = "user-register",
    Other = "other",
}
