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

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.json.JSONObject

// MARK: - WebAuthn Records

/** A credential parameter for WebAuthn registration. */
class RNCredentialParameterRecord : Record {
    @Field var type: String = ""

    @Field var alg: Int = 0

    override fun toString(): String =
        buildRecordString("RNCredentialParameterRecord") {
            put("type", type)
            put("alg", alg)
        }
}

/** Authenticator selection criteria for WebAuthn registration. */
class RNAuthenticatorSelectionRecord : Record {
    @Field var authenticatorAttachment: String? = null

    @Field var residentKey: String? = null

    @Field var userVerification: String? = null

    override fun toString(): String =
        buildRecordString("RNAuthenticatorSelectionRecord") {
            put("authenticatorAttachment", authenticatorAttachment)
            put("residentKey", residentKey)
            put("userVerification", userVerification)
        }
}

/** A credential descriptor for WebAuthn. */
class RNWebAuthnCredentialRecord : Record {
    @Field var type: String = ""

    @Field var id: String = ""

    @Field var transports: List<String>? = null

    override fun toString(): String =
        buildRecordString("RNWebAuthnCredentialRecord") {
            put("type", type)
            put("id", id)
            put("transports", transports?.size)
        }
}

/** Public key options for WebAuthn registration. */
class RNWebAuthnRegistrationPublicKeyRecord : Record {
    @Field var relyingPartyId: String = ""

    @Field var relyingPartyName: String = ""

    @Field var userName: String = ""

    @Field var userDisplayName: String = ""

    @Field var userId: String = ""

    @Field var challenge: String = ""

    @Field var credentialParameters: List<RNCredentialParameterRecord> = emptyList()

    @Field var excludedCredentials: List<RNWebAuthnCredentialRecord> = emptyList()

    @Field var authenticatorSelection: RNAuthenticatorSelectionRecord? = null

    @Field var attestation: String? = null

    @Field var attachment: String? = null

    @Field var contextFieldName: String = ""

    override fun toString(): String =
        buildRecordString("RNWebAuthnRegistrationPublicKeyRecord") {
            put("relyingPartyId", relyingPartyId)
            put("relyingPartyName", relyingPartyName)
            put("userName", userName)
            put("userDisplayName", userDisplayName)
            put("userId", userId)
            put("challenge", challenge)
            put("credentialParameters", credentialParameters.size)
            put("excludedCredentials", excludedCredentials.size)
            put("authenticatorSelection", authenticatorSelection?.let { JSONObject(it.toString()) })
            put("attestation", attestation)
            put("attachment", attachment)
            put("contextFieldName", contextFieldName)
        }
}

/** Public key options for WebAuthn authentication. */
class RNWebAuthnAuthenticationPublicKeyRecord : Record {
    @Field var challenge: String = ""

    @Field var relyingPartyId: String = ""

    @Field var allowCredentials: List<RNWebAuthnCredentialRecord> = emptyList()

    @Field var userVerification: String? = null

    @Field var platformCredentials: List<RNWebAuthnCredentialRecord> = emptyList()

    @Field var crossPlatformCredentials: List<RNWebAuthnCredentialRecord> = emptyList()

    override fun toString(): String =
        buildRecordString("RNWebAuthnAuthenticationPublicKeyRecord") {
            put("challenge", challenge)
            put("relyingPartyId", relyingPartyId)
            put("allowCredentials", allowCredentials.size)
            put("userVerification", userVerification)
            put("platformCredentials", platformCredentials.size)
            put("crossPlatformCredentials", crossPlatformCredentials.size)
        }
}

// MARK: - Client Operation Action Model Record

/**
 * A client operation action model.
 *
 * Maps to the TypeScript `ClientOperationActionModel` discriminated union.
 * The [clientOperationType] field is the discriminator.
 */
class RNClientOperationActionModelRecord : Record {
    /** Discriminator for the client operation type. */
    @Field var clientOperationType: RNClientOperationType = RNClientOperationType.GENERIC

    /** The original operation name string (for generic operations). */
    @Field var name: String = ""

    /** Raw arguments JSON string. */
    @Field var argumentsJson: String = "{}"

    /** Continue actions. */
    @Field var continueActions: List<RNActionRecord> = emptyList()

    /** Error actions. */
    @Field var errorActions: List<RNActionRecord> = emptyList()

    // ExternalBrowser

    /** The URL to open in the external browser. */
    @Field var href: String? = null

    // BankId

    /** Auto-start token for BankID app launch. */
    @Field var autoStartToken: String? = null

    /** Redirect URI for BankID. */
    @Field var redirect: String? = null

    // Encap

    /** Activation code for Encap device. */
    @Field var activationCode: String? = null

    // WebAuthn Registration

    /** Public key credential creation options (request). */
    @Field var requestPublicKey: RNWebAuthnRegistrationPublicKeyRecord? = null

    /** Platform-specific public key options. */
    @Field var platformPublicKey: RNWebAuthnRegistrationPublicKeyRecord? = null

    /** Cross-platform public key options. */
    @Field var crossPlatformPublicKey: RNWebAuthnRegistrationPublicKeyRecord? = null

    // WebAuthn Authentication

    /** Public key credential request options. */
    @Field var publicKey: RNWebAuthnAuthenticationPublicKeyRecord? = null

    // WebAuthn shared

    /** Fallback actions if WebAuthn is not supported. */
    @Field var fallbackActions: List<RNActionRecord>? = null

    override fun toString(): String =
        buildRecordString("RNClientOperationActionModelRecord") {
            put("clientOperationType", clientOperationType)
            put("name", name)
            put("argumentsJson", argumentsJson)
            put("continueActions", continueActions.size)
            put("errorActions", errorActions.size)
            put("href", href)
            put("autoStartToken", autoStartToken)
            put("redirect", redirect)
            put("activationCode", activationCode)
            put("requestPublicKey", requestPublicKey?.let { JSONObject(it.toString()) })
            put("platformPublicKey", platformPublicKey?.let { JSONObject(it.toString()) })
            put("crossPlatformPublicKey", crossPlatformPublicKey?.let { JSONObject(it.toString()) })
            put("publicKey", publicKey?.let { JSONObject(it.toString()) })
            put("fallbackActions", fallbackActions?.size)
        }
}
