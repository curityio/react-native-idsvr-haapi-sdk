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
package se.curity.identityserver.haapi.reactnative.sdk.representations

import expo.modules.kotlin.types.Enumerable

/**
 * The kind of action within a HAAPI step.
 *
 * Maps to the TypeScript `ActionKind` enum.
 */
enum class RNActionKind(
    val value: String,
) : Enumerable {
    CANCEL("cancel"),
    DEVICE_OPTION("device-option"),
    LOGIN("login"),
    CONTINUE("continue"),
    CONTINUE_AUTO_LOGIN("continue-auto-login"),
    DEVICE_SELECTOR("device-selector"),
    REDIRECT("redirect"),
    AUTHENTICATOR_SELECTOR("authenticator-selector"),
    SELECT_AUTHENTICATOR("select-authenticator"),
    POLL("poll"),
    FORM("form"),
    BANK_ID_SAME_DEVICE("bankid-same-device"),
    BANK_ID_OTHER_DEVICE("bankid-other-device"),
    PASSWORD_RESET("password-reset"),
    ACCOUNT_ID_RECOVERY("account-id-recovery"),
    USER_REGISTER("user-register"),
    OTHER("other"),
}
