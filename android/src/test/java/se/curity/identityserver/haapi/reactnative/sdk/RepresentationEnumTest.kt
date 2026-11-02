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
package se.curity.identityserver.haapi.reactnative.sdk

import org.junit.Assert.assertEquals
import org.junit.Test
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNActionKind
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNActionType
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNClientOperationType
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNFormFieldType
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNPollingStatus
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNProblemType
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNRepresentationType
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNResponseCategory
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNStepType

class RepresentationEnumTest {
    // region RNResponseCategory
    // `RNResponseCategory` covers only the two value-bearing response
    // categories. Flow failures are surfaced as thrown `HaapiError` values
    // and do not appear here.

    @Test
    fun responseCategoryHas2Entries() {
        assertEquals(2, RNResponseCategory.entries.size)
    }

    @Test
    fun responseCategoryRepresentation() {
        assertEquals("representation", RNResponseCategory.REPRESENTATION.value)
    }

    @Test
    fun responseCategoryProblem() {
        assertEquals("problem", RNResponseCategory.PROBLEM.value)
    }

    @Test
    fun responseCategoryReverseMappingRepresentation() {
        val byValue = RNResponseCategory.entries.associateBy { it.value }
        assertEquals(RNResponseCategory.REPRESENTATION, byValue["representation"])
    }

    @Test
    fun responseCategoryReverseMappingProblem() {
        val byValue = RNResponseCategory.entries.associateBy { it.value }
        assertEquals(RNResponseCategory.PROBLEM, byValue["problem"])
    }

    @Test
    fun responseCategoryRejectsUnknownValue() {
        val byValue = RNResponseCategory.entries.associateBy { it.value }
        org.junit.Assert.assertNull(byValue["error"])
        org.junit.Assert.assertNull(byValue["unknown"])
    }

    // endregion

    // region RNStepType

    @Test
    fun stepTypeHas14Entries() {
        assertEquals(14, RNStepType.entries.size)
    }

    @Test
    fun stepTypeAuthenticatorSelector() {
        assertEquals("authenticatorSelector", RNStepType.AUTHENTICATOR_SELECTOR.value)
    }

    @Test
    fun stepTypeInteractiveForm() {
        assertEquals("interactiveForm", RNStepType.INTERACTIVE_FORM.value)
    }

    @Test
    fun stepTypeUserConsent() {
        assertEquals("userConsent", RNStepType.USER_CONSENT.value)
    }

    @Test
    fun stepTypeRedirection() {
        assertEquals("redirection", RNStepType.REDIRECTION.value)
    }

    @Test
    fun stepTypePolling() {
        assertEquals("polling", RNStepType.POLLING.value)
    }

    @Test
    fun stepTypeContinueSame() {
        assertEquals("continueSame", RNStepType.CONTINUE_SAME.value)
    }

    @Test
    fun stepTypeOAuthAuthorizationResponse() {
        assertEquals("oAuthAuthorizationResponse", RNStepType.OAUTH_AUTHORIZATION_RESPONSE.value)
    }

    @Test
    fun stepTypeExternalBrowserClientOperation() {
        assertEquals("externalBrowserClientOperation", RNStepType.EXTERNAL_BROWSER_CLIENT_OPERATION.value)
    }

    @Test
    fun stepTypeBankIdClientOperation() {
        assertEquals("bankIdClientOperation", RNStepType.BANK_ID_CLIENT_OPERATION.value)
    }

    @Test
    fun stepTypeEncapClientOperation() {
        assertEquals("encapClientOperation", RNStepType.ENCAP_CLIENT_OPERATION.value)
    }

    @Test
    fun stepTypeWebAuthnRegistrationClientOperation() {
        assertEquals(
            "webAuthnRegistrationClientOperation",
            RNStepType.WEB_AUTHN_REGISTRATION_CLIENT_OPERATION.value,
        )
    }

    @Test
    fun stepTypeWebAuthnAuthenticationClientOperation() {
        assertEquals(
            "webAuthnAuthenticationClientOperation",
            RNStepType.WEB_AUTHN_AUTHENTICATION_CLIENT_OPERATION.value,
        )
    }

    @Test
    fun stepTypeGenericClientOperation() {
        assertEquals("genericClientOperation", RNStepType.GENERIC_CLIENT_OPERATION.value)
    }

    @Test
    fun stepTypeGenericRepresentation() {
        assertEquals("genericRepresentation", RNStepType.GENERIC_REPRESENTATION.value)
    }

    // endregion

    // region RNRepresentationType

    @Test
    fun representationTypeHas8Entries() {
        assertEquals(8, RNRepresentationType.entries.size)
    }

    @Test
    fun representationTypeAuthenticationStep() {
        assertEquals("authentication-step", RNRepresentationType.AUTHENTICATION_STEP.value)
    }

    @Test
    fun representationTypeRedirectionStep() {
        assertEquals("redirection-step", RNRepresentationType.REDIRECTION_STEP.value)
    }

    @Test
    fun representationTypeRegistrationStep() {
        assertEquals("registration-step", RNRepresentationType.REGISTRATION_STEP.value)
    }

    @Test
    fun representationTypePollingStep() {
        assertEquals("polling-step", RNRepresentationType.POLLING_STEP.value)
    }

    @Test
    fun representationTypeContinueSameStep() {
        assertEquals("continue-same-step", RNRepresentationType.CONTINUE_SAME_STEP.value)
    }

    @Test
    fun representationTypeOAuthAuthorizationResponse() {
        assertEquals("oauth-authorization-response", RNRepresentationType.OAUTH_AUTHORIZATION_RESPONSE.value)
    }

    @Test
    fun representationTypeConsentorStep() {
        assertEquals("consentor-step", RNRepresentationType.CONSENTOR_STEP.value)
    }

    @Test
    fun representationTypeUserConsentStep() {
        assertEquals("user-consent-step", RNRepresentationType.USER_CONSENT_STEP.value)
    }

    // endregion

    // region RNActionType

    @Test
    fun actionTypeHas3Entries() {
        assertEquals(3, RNActionType.entries.size)
    }

    @Test
    fun actionTypeForm() {
        assertEquals("form", RNActionType.FORM.value)
    }

    @Test
    fun actionTypeClientOperation() {
        assertEquals("clientOperation", RNActionType.CLIENT_OPERATION.value)
    }

    @Test
    fun actionTypeSelector() {
        assertEquals("selector", RNActionType.SELECTOR.value)
    }

    // endregion

    // region RNActionKind

    @Test
    fun actionKindHas17Entries() {
        assertEquals(17, RNActionKind.entries.size)
    }

    @Test
    fun actionKindCancel() {
        assertEquals("cancel", RNActionKind.CANCEL.value)
    }

    @Test
    fun actionKindDeviceOption() {
        assertEquals("device-option", RNActionKind.DEVICE_OPTION.value)
    }

    @Test
    fun actionKindLogin() {
        assertEquals("login", RNActionKind.LOGIN.value)
    }

    @Test
    fun actionKindContinue() {
        assertEquals("continue", RNActionKind.CONTINUE.value)
    }

    @Test
    fun actionKindContinueAutoLogin() {
        assertEquals("continue-auto-login", RNActionKind.CONTINUE_AUTO_LOGIN.value)
    }

    @Test
    fun actionKindDeviceSelector() {
        assertEquals("device-selector", RNActionKind.DEVICE_SELECTOR.value)
    }

    @Test
    fun actionKindRedirect() {
        assertEquals("redirect", RNActionKind.REDIRECT.value)
    }

    @Test
    fun actionKindAuthenticatorSelector() {
        assertEquals("authenticator-selector", RNActionKind.AUTHENTICATOR_SELECTOR.value)
    }

    @Test
    fun actionKindSelectAuthenticator() {
        assertEquals("select-authenticator", RNActionKind.SELECT_AUTHENTICATOR.value)
    }

    @Test
    fun actionKindPoll() {
        assertEquals("poll", RNActionKind.POLL.value)
    }

    @Test
    fun actionKindForm() {
        assertEquals("form", RNActionKind.FORM.value)
    }

    @Test
    fun actionKindBankIdSameDevice() {
        assertEquals("bankid-same-device", RNActionKind.BANK_ID_SAME_DEVICE.value)
    }

    @Test
    fun actionKindBankIdOtherDevice() {
        assertEquals("bankid-other-device", RNActionKind.BANK_ID_OTHER_DEVICE.value)
    }

    @Test
    fun actionKindPasswordReset() {
        assertEquals("password-reset", RNActionKind.PASSWORD_RESET.value)
    }

    @Test
    fun actionKindAccountIdRecovery() {
        assertEquals("account-id-recovery", RNActionKind.ACCOUNT_ID_RECOVERY.value)
    }

    @Test
    fun actionKindUserRegister() {
        assertEquals("user-register", RNActionKind.USER_REGISTER.value)
    }

    @Test
    fun actionKindOther() {
        assertEquals("other", RNActionKind.OTHER.value)
    }

    // endregion

    // region RNFormFieldType

    @Test
    fun formFieldTypeHas7Entries() {
        assertEquals(7, RNFormFieldType.entries.size)
    }

    @Test
    fun formFieldTypeHidden() {
        assertEquals("hidden", RNFormFieldType.HIDDEN.value)
    }

    @Test
    fun formFieldTypeText() {
        assertEquals("text", RNFormFieldType.TEXT.value)
    }

    @Test
    fun formFieldTypeUsername() {
        assertEquals("username", RNFormFieldType.USERNAME.value)
    }

    @Test
    fun formFieldTypePassword() {
        assertEquals("password", RNFormFieldType.PASSWORD.value)
    }

    @Test
    fun formFieldTypeSelect() {
        assertEquals("select", RNFormFieldType.SELECT.value)
    }

    @Test
    fun formFieldTypeCheckbox() {
        assertEquals("checkbox", RNFormFieldType.CHECKBOX.value)
    }

    @Test
    fun formFieldTypeContext() {
        assertEquals("context", RNFormFieldType.CONTEXT.value)
    }

    // endregion

    // region RNClientOperationType

    @Test
    fun clientOperationTypeHas6Entries() {
        assertEquals(6, RNClientOperationType.entries.size)
    }

    @Test
    fun clientOperationTypeExternalBrowserFlow() {
        assertEquals("external-browser-flow", RNClientOperationType.EXTERNAL_BROWSER_FLOW.value)
    }

    @Test
    fun clientOperationTypeBankid() {
        assertEquals("bankid", RNClientOperationType.BANKID.value)
    }

    @Test
    fun clientOperationTypeEncapAutoActivation() {
        assertEquals("encap-auto-activation", RNClientOperationType.ENCAP_AUTO_ACTIVATION.value)
    }

    @Test
    fun clientOperationTypeWebauthnRegistration() {
        assertEquals("webauthn-registration", RNClientOperationType.WEBAUTHN_REGISTRATION.value)
    }

    @Test
    fun clientOperationTypeWebauthnAuthentication() {
        assertEquals("webauthn-authentication", RNClientOperationType.WEBAUTHN_AUTHENTICATION.value)
    }

    @Test
    fun clientOperationTypeGeneric() {
        assertEquals("generic", RNClientOperationType.GENERIC.value)
    }

    // endregion

    // region RNPollingStatus

    @Test
    fun pollingStatusHas3Entries() {
        assertEquals(3, RNPollingStatus.entries.size)
    }

    @Test
    fun pollingStatusPending() {
        assertEquals("pending", RNPollingStatus.PENDING.value)
    }

    @Test
    fun pollingStatusDone() {
        assertEquals("done", RNPollingStatus.DONE.value)
    }

    @Test
    fun pollingStatusFailed() {
        assertEquals("failed", RNPollingStatus.FAILED.value)
    }

    // endregion

    // region RNProblemType

    @Test
    fun problemTypeHas9Entries() {
        assertEquals(9, RNProblemType.entries.size)
    }

    @Test
    fun problemTypeAuthenticationFailed() {
        assertEquals(
            "https://curity.se/problems/authentication-failed",
            RNProblemType.AUTHENTICATION_FAILED.value,
        )
    }

    @Test
    fun problemTypeInvalidInput() {
        assertEquals(
            "https://curity.se/problems/invalid-input",
            RNProblemType.INVALID_INPUT.value,
        )
    }

    @Test
    fun problemTypeIncorrectCredentials() {
        assertEquals(
            "https://curity.se/problems/incorrect-credentials",
            RNProblemType.INCORRECT_CREDENTIALS.value,
        )
    }

    @Test
    fun problemTypeErrorAuthorizationResponse() {
        assertEquals(
            "https://curity.se/problems/error-authorization-response",
            RNProblemType.ERROR_AUTHORIZATION_RESPONSE.value,
        )
    }

    @Test
    fun problemTypeUnexpected() {
        assertEquals(
            "https://curity.se/problems/unexpected",
            RNProblemType.UNEXPECTED.value,
        )
    }

    @Test
    fun problemTypeTooManyAttempts() {
        assertEquals(
            "https://curity.se/problems/too-many-attempts",
            RNProblemType.TOO_MANY_ATTEMPTS.value,
        )
    }

    @Test
    fun problemTypeGenericUserError() {
        assertEquals(
            "https://curity.se/problems/generic-user-error",
            RNProblemType.GENERIC_USER_ERROR.value,
        )
    }

    @Test
    fun problemTypeSessionAndAccessTokenMismatch() {
        assertEquals(
            "https://curity.se/problems/mismatch-between-session-and-access-token",
            RNProblemType.SESSION_AND_ACCESS_TOKEN_MISMATCH.value,
        )
    }

    @Test
    fun problemTypeOther() {
        assertEquals("other", RNProblemType.OTHER.value)
    }

    // endregion
}
