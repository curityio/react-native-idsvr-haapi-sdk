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

// MARK: - WebAuthn Records

/// A credential parameter for WebAuthn registration.
struct RNCredentialParameterRecord: Record {
    @Field var type: String = ""
    @Field var alg: Int = 0

    init() {}
    init(type: String, alg: Int) {
        self.type = type
        self.alg = alg
    }
}

extension RNCredentialParameterRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNCredentialParameterRecord",
            "type": type,
            "alg": alg
        ].debugDescription
    }
}

/// Authenticator selection criteria for WebAuthn registration.
struct RNAuthenticatorSelectionRecord: Record {
    @Field var authenticatorAttachment: String?
    @Field var residentKey: String?
    @Field var userVerification: String?

    init() {}
}

extension RNAuthenticatorSelectionRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNAuthenticatorSelectionRecord",
            "authenticatorAttachment": authenticatorAttachment as Any,
            "residentKey": residentKey as Any,
            "userVerification": userVerification as Any
        ].debugDescription
    }
}

/// A credential descriptor for WebAuthn.
struct RNWebAuthnCredentialRecord: Record {
    @Field var type: String = ""
    @Field var id: String = ""
    @Field var transports: [String]?

    init() {}
    init(type: String, id: String, transports: [String]?) {
        self.type = type
        self.id = id
        self.transports = transports
    }
}

extension RNWebAuthnCredentialRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNWebAuthnCredentialRecord",
            "type": type,
            "id": id,
            "transports": transports as Any
        ].debugDescription
    }
}

/// Public key options for WebAuthn registration.
struct RNWebAuthnRegistrationPublicKeyRecord: Record {
    @Field var relyingPartyId: String = ""
    @Field var relyingPartyName: String = ""
    @Field var userName: String = ""
    @Field var userDisplayName: String = ""
    @Field var userId: String = ""
    @Field var challenge: String = ""
    @Field var credentialParameters: [RNCredentialParameterRecord] = []
    @Field var excludedCredentials: [RNWebAuthnCredentialRecord] = []
    @Field var authenticatorSelection: RNAuthenticatorSelectionRecord?
    @Field var attestation: String?
    @Field var attachment: String?
    @Field var contextFieldName: String = ""

    init() {}
}

extension RNWebAuthnRegistrationPublicKeyRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNWebAuthnRegistrationPublicKeyRecord",
            "relyingPartyId": relyingPartyId,
            "relyingPartyName": relyingPartyName,
            "userName": userName,
            "userDisplayName": userDisplayName,
            "userId": userId,
            "challenge": challenge,
            "credentialParameters": credentialParameters.count,
            "excludedCredentials": excludedCredentials.count,
            "authenticatorSelection": authenticatorSelection as Any,
            "attestation": attestation as Any,
            "attachment": attachment as Any,
            "contextFieldName": contextFieldName
        ].debugDescription
    }
}

/// Public key options for WebAuthn authentication.
struct RNWebAuthnAuthenticationPublicKeyRecord: Record {
    @Field var challenge: String = ""
    @Field var relyingPartyId: String = ""
    @Field var allowCredentials: [RNWebAuthnCredentialRecord] = []
    @Field var userVerification: String?
    @Field var platformCredentials: [RNWebAuthnCredentialRecord] = []
    @Field var crossPlatformCredentials: [RNWebAuthnCredentialRecord] = []

    init() {}
}

extension RNWebAuthnAuthenticationPublicKeyRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNWebAuthnAuthenticationPublicKeyRecord",
            "challenge": challenge,
            "relyingPartyId": relyingPartyId,
            "allowCredentials": allowCredentials.count,
            "userVerification": userVerification as Any,
            "platformCredentials": platformCredentials.count,
            "crossPlatformCredentials": crossPlatformCredentials.count
        ].debugDescription
    }
}

// MARK: - Client Operation Action Model Record

/// A client operation action model.
///
/// Maps to the TypeScript `ClientOperationActionModel` discriminated union.
/// The `clientOperationType` field is the discriminator.
struct RNClientOperationActionModelRecord: Record {
    /// Discriminator for the client operation type.
    @Field var clientOperationType: RNClientOperationType = .generic
    /// The original operation name string (for generic operations).
    @Field var name: String = ""
    /// Raw arguments JSON string.
    @Field var argumentsJson: String = "{}"
    /// Continue actions.
    @Field var continueActions: [RNActionRecord] = []
    /// Error actions.
    @Field var errorActions: [RNActionRecord] = []

    // ExternalBrowser
    /// The URL to open in the external browser.
    @Field var href: String?

    // BankId
    /// Auto-start token for BankID app launch.
    @Field var autoStartToken: String?
    /// Redirect URI for BankID.
    @Field var redirect: String?

    // Encap
    /// Activation code for Encap device.
    @Field var activationCode: String?

    // WebAuthn Registration
    /// Public key credential creation options (request).
    @Field var requestPublicKey: RNWebAuthnRegistrationPublicKeyRecord?
    /// Platform-specific public key options.
    @Field var platformPublicKey: RNWebAuthnRegistrationPublicKeyRecord?
    /// Cross-platform public key options.
    @Field var crossPlatformPublicKey: RNWebAuthnRegistrationPublicKeyRecord?

    // WebAuthn Authentication
    /// Public key credential request options.
    @Field var publicKey: RNWebAuthnAuthenticationPublicKeyRecord?

    // WebAuthn shared
    /// Fallback actions if WebAuthn is not supported.
    @Field var fallbackActions: [RNActionRecord]?

    init() {}
}

extension RNClientOperationActionModelRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNClientOperationActionModelRecord",
            "clientOperationType": clientOperationType,
            "name": name,
            "argumentsJson": argumentsJson,
            "continueActions": continueActions.count,
            "errorActions": errorActions.count,
            "href": href as Any,
            "autoStartToken": autoStartToken as Any,
            "redirect": redirect as Any,
            "activationCode": activationCode as Any,
            "requestPublicKey": requestPublicKey as Any,
            "platformPublicKey": platformPublicKey as Any,
            "crossPlatformPublicKey": crossPlatformPublicKey as Any,
            "publicKey": publicKey as Any,
            "fallbackActions": fallbackActions as Any
        ].debugDescription
    }
}
