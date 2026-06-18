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

import se.curity.identityserver.haapi.android.sdk.models.actions.ClientOperationActionModel
import se.curity.identityserver.haapi.android.sdk.models.actions.ClientOperationActionModel.WebAuthnAuthentication
import se.curity.identityserver.haapi.android.sdk.models.actions.ClientOperationActionModel.WebAuthnRegistration

/** Maps a [ClientOperationActionModel] into an [RNClientOperationActionModelRecord]. */
internal fun HaapiResponseMapper.convertClientOperationActionModel(
    model: ClientOperationActionModel,
): RNClientOperationActionModelRecord =
    when (model) {
        is ClientOperationActionModel.ExternalBrowser -> convertExternalBrowserModel(model)
        is ClientOperationActionModel.BankId -> convertBankIdModel(model)
        is ClientOperationActionModel.EncapAutoActivation -> convertEncapModel(model)
        is ClientOperationActionModel.WebAuthnRegistration -> convertWebAuthnRegistrationModel(model)
        is ClientOperationActionModel.WebAuthnAuthentication -> convertWebAuthnAuthenticationModel(model)
        is ClientOperationActionModel.Generic -> convertGenericClientOperationModel(model)
        else -> convertGenericClientOperationModel(model)
    }

/** Maps an external browser client operation model to record. */
internal fun HaapiResponseMapper.convertExternalBrowserModel(
    model: ClientOperationActionModel.ExternalBrowser,
): RNClientOperationActionModelRecord {
    val record = RNClientOperationActionModelRecord()
    record.clientOperationType = RNClientOperationType.EXTERNAL_BROWSER_FLOW
    record.name = "external-browser-flow"
    record.href = model.href
    record.argumentsJson = model.arguments
    record.continueActions = model.continueActions.map { convertAction(it) }
    record.errorActions = model.errorActions.map { convertAction(it) }
    return record
}

/** Maps a BankID client operation model to record. */
internal fun HaapiResponseMapper.convertBankIdModel(
    model: ClientOperationActionModel.BankId,
): RNClientOperationActionModelRecord {
    val record = RNClientOperationActionModelRecord()
    record.clientOperationType = RNClientOperationType.BANKID
    record.name = "bankid"
    record.autoStartToken = model.autoStartToken
    record.redirect = model.redirect
    record.href = model.href
    record.argumentsJson = model.arguments
    record.continueActions = model.continueActions.map { convertAction(it) }
    record.errorActions = model.errorActions.map { convertAction(it) }
    return record
}

/** Maps an Encap auto-activation client operation model to record. */
internal fun HaapiResponseMapper.convertEncapModel(
    model: ClientOperationActionModel.EncapAutoActivation,
): RNClientOperationActionModelRecord {
    val record = RNClientOperationActionModelRecord()
    record.clientOperationType = RNClientOperationType.ENCAP_AUTO_ACTIVATION
    record.name = "encap-auto-activation"
    record.activationCode = model.activationCode
    record.href = model.href
    record.argumentsJson = model.arguments
    record.continueActions = model.continueActions.map { convertAction(it) }
    record.errorActions = model.errorActions.map { convertAction(it) }
    return record
}

/** Maps a WebAuthn registration client operation model to record. */
internal fun HaapiResponseMapper.convertWebAuthnRegistrationModel(
    model: ClientOperationActionModel.WebAuthnRegistration,
): RNClientOperationActionModelRecord {
    val record = RNClientOperationActionModelRecord()
    record.clientOperationType = RNClientOperationType.WEBAUTHN_REGISTRATION
    record.name = "webauthn-registration"
    record.requestPublicKey = model.requestPublicKey?.let { convertWebAuthnRegistrationPublicKey(it) }
    record.platformPublicKey = model.platformPublicKey?.let { convertWebAuthnRegistrationPublicKey(it) }
    record.crossPlatformPublicKey = model.crossPlatformPublicKey?.let { convertWebAuthnRegistrationPublicKey(it) }
    record.argumentsJson = model.arguments
    record.continueActions = model.continueActions.map { convertAction(it) }
    record.errorActions = model.errorActions.map { convertAction(it) }
    record.fallbackActions = model.fallbackActions.map { convertAction(it) }
    return record
}

/** Maps a WebAuthn authentication client operation model to record. */
internal fun HaapiResponseMapper.convertWebAuthnAuthenticationModel(
    model: ClientOperationActionModel.WebAuthnAuthentication,
): RNClientOperationActionModelRecord {
    val record = RNClientOperationActionModelRecord()
    record.clientOperationType = RNClientOperationType.WEBAUTHN_AUTHENTICATION
    record.name = "webauthn-authentication"
    record.publicKey = convertWebAuthnAuthenticationPublicKey(model.publicKey)
    record.argumentsJson = model.arguments
    record.continueActions = model.continueActions.map { convertAction(it) }
    record.errorActions = model.errorActions.map { convertAction(it) }
    record.fallbackActions = model.fallbackActions.map { convertAction(it) }
    return record
}

/** Maps an unknown client operation model to a generic record. */
internal fun HaapiResponseMapper.convertGenericClientOperationModel(
    model: ClientOperationActionModel,
): RNClientOperationActionModelRecord {
    val record = RNClientOperationActionModelRecord()
    record.clientOperationType = RNClientOperationType.GENERIC
    record.name = convertClientOperationName(model.name)
    record.argumentsJson = model.arguments
    record.continueActions = model.continueActions.map { convertAction(it) }
    record.errorActions = model.errorActions.map { convertAction(it) }
    return record
}

// ─── WebAuthn Helpers ───────────────────────────────────────────────────────

private fun ByteArray.toBase64Url(): String =
    android.util.Base64.encodeToString(this, android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP)

private fun convertCredential(
    cred: se.curity.identityserver.haapi.android.sdk.models.actions.Credential,
): RNWebAuthnCredentialRecord =
    RNWebAuthnCredentialRecord().apply {
        type = cred.type
        id = cred.idByteArray.toBase64Url()
    }

private fun convertWebAuthnRegistrationPublicKey(
    pk: WebAuthnRegistration.PublicKey,
): RNWebAuthnRegistrationPublicKeyRecord {
    val record = RNWebAuthnRegistrationPublicKeyRecord()
    record.relyingPartyId = pk.relyingPartyId
    record.relyingPartyName = pk.relyingPartyName
    record.userName = pk.userName
    record.userDisplayName = pk.userDisplayName
    record.userId = pk.userId.toBase64Url()
    record.challenge = pk.challenge.toBase64Url()
    record.credentialParameters =
        pk.credentialParameters.map { cp ->
            RNCredentialParameterRecord().apply {
                type = cp.type
                alg = cp.alg
            }
        }
    record.excludedCredentials = pk.excludedCredentials.map { convertCredential(it) }
    record.authenticatorSelection =
        pk.authenticatorSelection?.let { sel ->
            RNAuthenticatorSelectionRecord().apply {
                authenticatorAttachment = sel.authenticatorAttachment
                residentKey = sel.residentKey
                userVerification = sel.userVerification
            }
        }
    record.attestation = pk.attestation
    record.attachment = pk.attachment?.name
    record.contextFieldName = pk.contextFieldName
    return record
}

private fun convertWebAuthnAuthenticationPublicKey(
    pk: WebAuthnAuthentication.PublicKey,
): RNWebAuthnAuthenticationPublicKeyRecord {
    val record = RNWebAuthnAuthenticationPublicKeyRecord()
    record.challenge = pk.challenge.toBase64Url()
    record.relyingPartyId = pk.relyingPartyId
    record.allowCredentials = pk.allowCredentials.map { convertCredential(it) }
    record.userVerification = pk.userVerification
    record.platformCredentials = pk.platformCredentials.map { convertCredential(it) }
    record.crossPlatformCredentials = pk.crossPlatformCredentials.map { convertCredential(it) }
    return record
}
