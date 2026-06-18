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
import IdsvrHaapiSdk

/// Client operation model mapping for ``HaapiResponseMapper``.
extension HaapiResponseMapper {

    /// Maps a native client operation action model into an RNClientOperationActionModelRecord.
    func convertClientOperationActionModel(
        _ model: any ClientOperationActionModelRepresentation
    ) -> RNClientOperationActionModelRecord {
        switch model {
        case let m as ExternalBrowserClientOperationActionModel:
            return convertExternalBrowserModel(m)
        case let m as BankIdClientOperationActionModel:
            return convertBankIdModel(m)
        case let m as EncapAutoActivationClientOperationActionModel:
            return convertEncapModel(m)
        case let m as WebAuthnRegistrationClientOperationActionModel:
            return convertWebAuthnRegistrationModel(m)
        case let m as WebAuthnAuthenticationClientOperationActionModel:
            return convertWebAuthnAuthenticationModel(m)
        default:
            return convertGenericClientOperationModel(model)
        }
    }

    /// Maps an external browser client operation model to record.
    func convertExternalBrowserModel(
        _ model: ExternalBrowserClientOperationActionModel
    ) -> RNClientOperationActionModelRecord {
        let record = RNClientOperationActionModelRecord()
        record.clientOperationType = .externalBrowserFlow
        record.name = "external-browser-flow"
        record.href = model.href
        record.argumentsJson = serializeArguments(model.arguments)
        record.continueActions = model.continueActions.map { convertAction($0) }
        record.errorActions = model.errorActions.map { convertAction($0) }
        return record
    }

    /// Maps a BankID client operation model to record.
    func convertBankIdModel(
        _ model: BankIdClientOperationActionModel
    ) -> RNClientOperationActionModelRecord {
        let record = RNClientOperationActionModelRecord()
        record.clientOperationType = .bankid
        record.name = "bankid"
        record.autoStartToken = model.autoStartToken
        record.redirect = model.redirect
        record.href = model.href
        record.argumentsJson = serializeArguments(model.arguments)
        record.continueActions = model.continueActions.map { convertAction($0) }
        record.errorActions = model.errorActions.map { convertAction($0) }
        return record
    }

    /// Maps an Encap auto-activation client operation model to record.
    func convertEncapModel(
        _ model: EncapAutoActivationClientOperationActionModel
    ) -> RNClientOperationActionModelRecord {
        let record = RNClientOperationActionModelRecord()
        record.clientOperationType = .encapAutoActivation
        record.name = "encap-auto-activation"
        record.activationCode = model.activationCode
        record.href = model.href
        record.argumentsJson = serializeArguments(model.arguments)
        record.continueActions = model.continueActions.map { convertAction($0) }
        record.errorActions = model.errorActions.map { convertAction($0) }
        return record
    }

    /// Maps a WebAuthn registration client operation model to record.
    func convertWebAuthnRegistrationModel(
        _ model: WebAuthnRegistrationClientOperationActionModel
    ) -> RNClientOperationActionModelRecord {
        let record = RNClientOperationActionModelRecord()
        record.clientOperationType = .webauthnRegistration
        record.name = "webauthn-registration"
        record.argumentsJson = serializeArguments(model.arguments)
        record.continueActions = model.continueActions.map { convertAction($0) }
        record.errorActions = model.errorActions.map { convertAction($0) }
        record.fallbackActions = model.fallbackActions.map { convertAction($0) }
        return record
    }

    /// Maps a WebAuthn authentication client operation model to record.
    func convertWebAuthnAuthenticationModel(
        _ model: WebAuthnAuthenticationClientOperationActionModel
    ) -> RNClientOperationActionModelRecord {
        let record = RNClientOperationActionModelRecord()
        record.clientOperationType = .webauthnAuthentication
        record.name = "webauthn-authentication"
        record.argumentsJson = serializeArguments(model.arguments)
        record.continueActions = model.continueActions.map { convertAction($0) }
        record.errorActions = model.errorActions.map { convertAction($0) }
        record.fallbackActions = model.fallbackActions.map { convertAction($0) }
        return record
    }

    /// Maps an unknown client operation model to a generic record.
    func convertGenericClientOperationModel(
        _ model: any ClientOperationActionModelRepresentation
    ) -> RNClientOperationActionModelRecord {
        let record = RNClientOperationActionModelRecord()
        record.clientOperationType = .generic
        record.name = convertClientOperationName(model.name).rawValue
        record.argumentsJson = serializeArguments(model.arguments)
        record.continueActions = model.continueActions.map { convertAction($0) }
        record.errorActions = model.errorActions.map { convertAction($0) }
        return record
    }

    /// Serializes a dictionary of arguments to a JSON string.
    func serializeArguments(_ arguments: [String: any Sendable]) -> String {
        guard let data = try? JSONSerialization.data(
            withJSONObject: arguments,
            options: [.sortedKeys]
        ) else {
            return "{}"
        }
        return String(data: data, encoding: .utf8) ?? "{}"
    }
}
