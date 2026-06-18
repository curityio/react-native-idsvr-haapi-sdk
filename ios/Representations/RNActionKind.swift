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
internal import ExpoModulesCore

/// The kind of action (e.g., login, cancel, redirect).
///
/// Maps to the TypeScript `ActionKind` enum.
enum RNActionKind: String, Enumerable {
    case cancel = "cancel"
    case deviceOption = "device-option"
    case login = "login"
    case `continue` = "continue"
    case continueAutoLogin = "continue-auto-login"
    case deviceSelector = "device-selector"
    case redirect = "redirect"
    case authenticatorSelector = "authenticator-selector"
    case selectAuthenticator = "select-authenticator"
    case poll = "poll"
    case form = "form"
    case bankIdSameDevice = "bankid-same-device"
    case bankIdOtherDevice = "bankid-other-device"
    case passwordReset = "password-reset"
    case accountIdRecovery = "account-id-recovery"
    case userRegister = "user-register"
    case other = "other"
}
