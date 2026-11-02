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

import se.curity.identityserver.haapi.android.sdk.models.AuthenticatorSelectorStep
import se.curity.identityserver.haapi.android.sdk.models.BankIdClientOperationStep
import se.curity.identityserver.haapi.android.sdk.models.ContinueSameStep
import se.curity.identityserver.haapi.android.sdk.models.EncapClientOperationStep
import se.curity.identityserver.haapi.android.sdk.models.ExternalBrowserClientOperationStep
import se.curity.identityserver.haapi.android.sdk.models.GenericClientOperationStep
import se.curity.identityserver.haapi.android.sdk.models.GenericRepresentationStep
import se.curity.identityserver.haapi.android.sdk.models.HaapiRepresentation
import se.curity.identityserver.haapi.android.sdk.models.InteractiveFormStep
import se.curity.identityserver.haapi.android.sdk.models.OAuthAuthorizationResponseStep
import se.curity.identityserver.haapi.android.sdk.models.PollingStep
import se.curity.identityserver.haapi.android.sdk.models.RedirectionStep
import se.curity.identityserver.haapi.android.sdk.models.UserConsentStep
import se.curity.identityserver.haapi.android.sdk.models.WebAuthnAuthenticationClientOperationStep
import se.curity.identityserver.haapi.android.sdk.models.WebAuthnRegistrationClientOperationStep

/** Maps a [HaapiRepresentation] step into an [RNHaapiRepresentationRecord]. */
internal fun HaapiResponseMapper.convertRepresentation(repr: HaapiRepresentation): RNHaapiRepresentationRecord {
    collectedLinks = repr.links
    val linkRecords = repr.links.map { convertLink(it) }
    val messageRecords = repr.messages.map { convertUserMessage(it) }
    val metadataRecord = repr.metadata?.let { convertMetadata(it) }
    val typeString = repr.type.type

    val record = RNHaapiRepresentationRecord()
    record.metadata = metadataRecord
    record.type =
        RNRepresentationType.entries.find { it.value == typeString }
            ?: RNRepresentationType.AUTHENTICATION_STEP
    record.links = linkRecords
    record.messages = messageRecords

    when (repr) {
        is AuthenticatorSelectorStep -> {
            record.stepType = RNStepType.AUTHENTICATOR_SELECTOR
            record.title = convertMessage(repr.title)
            record.actions = repr.actions.map { convertAction(it) }
            record.authenticators = repr.authenticators.map { convertAuthenticatorOption(it) }
        }

        is InteractiveFormStep -> {
            record.stepType = RNStepType.INTERACTIVE_FORM
            record.actions = repr.actions.map { convertAction(it) }
            record.properties = convertProperties(repr.properties)
        }

        is UserConsentStep -> {
            record.stepType = RNStepType.USER_CONSENT
            record.actions = repr.actions.map { convertAction(it) }
        }

        is RedirectionStep -> {
            record.stepType = RNStepType.REDIRECTION
            record.redirectAction = convertAction(repr.redirectAction)
            record.actions = repr.actions.map { convertAction(it) }
        }

        is PollingStep -> {
            record.stepType = RNStepType.POLLING
            record.mainAction = convertAction(repr.mainAction)
            record.cancelAction = repr.cancelAction?.let { convertAction(it) }
            record.pollingProperties = convertPollingProperties(repr.properties)
            record.actions = repr.actions.map { convertAction(it) }
        }

        is ContinueSameStep -> {
            record.stepType = RNStepType.CONTINUE_SAME
            record.actions = repr.actions.map { convertAction(it) }
        }

        is OAuthAuthorizationResponseStep -> {
            record.stepType = RNStepType.OAUTH_AUTHORIZATION_RESPONSE
            record.oauthProperties = convertOAuthProperties(repr.properties)
            record.actions = repr.actions.map { convertAction(it) }
        }

        is ExternalBrowserClientOperationStep -> {
            record.stepType = RNStepType.EXTERNAL_BROWSER_CLIENT_OPERATION
            record.clientOperationActionModel = convertExternalBrowserModel(repr.actionModel)
            record.actions = repr.actions.map { convertAction(it) }
        }

        is BankIdClientOperationStep -> {
            record.stepType = RNStepType.BANK_ID_CLIENT_OPERATION
            record.clientOperationActionModel = convertBankIdModel(repr.actionModel)
            record.activationLink =
                repr.activationLink?.let {
                    collectedLinks = collectedLinks + it
                    convertLink(it)
                }
            record.actions = repr.actions.map { convertAction(it) }
        }

        is EncapClientOperationStep -> {
            record.stepType = RNStepType.ENCAP_CLIENT_OPERATION
            record.clientOperationActionModel = convertEncapModel(repr.actionModel)
            record.actions = repr.actions.map { convertAction(it) }
        }

        is WebAuthnRegistrationClientOperationStep -> {
            record.stepType = RNStepType.WEB_AUTHN_REGISTRATION_CLIENT_OPERATION
            record.clientOperationActionModel =
                convertWebAuthnRegistrationModel(repr.actionModel)
            record.actions = repr.actions.map { convertAction(it) }
        }

        is WebAuthnAuthenticationClientOperationStep -> {
            record.stepType = RNStepType.WEB_AUTHN_AUTHENTICATION_CLIENT_OPERATION
            record.clientOperationActionModel =
                convertWebAuthnAuthenticationModel(repr.actionModel)
            record.actions = repr.actions.map { convertAction(it) }
        }

        is GenericClientOperationStep -> {
            record.stepType = RNStepType.GENERIC_CLIENT_OPERATION
            record.clientOperationActionModel =
                convertGenericClientOperationModel(repr.actionModel)
            record.actions = repr.actions.map { convertAction(it) }
        }

        is GenericRepresentationStep -> {
            record.stepType = RNStepType.GENERIC_REPRESENTATION
            record.properties = convertProperties(repr.properties)
            record.actions = repr.actions.map { convertAction(it) }
        }

        else -> {
            record.stepType = RNStepType.GENERIC_REPRESENTATION
            record.properties = convertProperties(repr.properties)
            record.actions = repr.actions.map { convertAction(it) }
        }
    }

    return record
}
