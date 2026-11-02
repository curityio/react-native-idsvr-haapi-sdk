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

/// Representation step mapping for ``HaapiResponseMapper``.
extension HaapiResponseMapper {

    /// Maps a native HaapiRepresentation step into an RNHaapiRepresentationRecord.
    func convertRepresentation(_ repr: any HaapiRepresentation) -> RNHaapiRepresentationRecord {
        collectedLinks = repr.links
        let linkRecords = repr.links.map { convertLink($0) }
        let messageRecords = repr.messages.map { convertUserMessage($0) }
        let metadataRecord = repr.metadata.map { convertMetadata($0) }
        let representationType = RNRepresentationType(rawValue: repr.type.rawValue) ?? .authenticationStep

        let record = RNHaapiRepresentationRecord()
        record.metadata = metadataRecord
        record.type = representationType
        record.links = linkRecords
        record.messages = messageRecords

        switch repr {
        case let step as AuthenticatorSelectorStep:
            record.stepType = .authenticatorSelector
            record.title = convertMessage(step.title)
            record.actions = step.actions.map { convertAction($0) }
            record.authenticators = step.authenticators.map { convertAuthenticatorOption($0) }
        case let step as InteractiveFormStep:
            record.stepType = .interactiveForm
            record.actions = step.actions.map { convertAction($0) }
            record.properties = convertProperties(step.properties)
        case let step as UserConsentStep:
            record.stepType = .userConsent
            record.actions = step.actions.map { convertAction($0) }
        case let step as RedirectionStep:
            record.stepType = .redirection
            record.redirectAction = convertAction(step.redirectAction)
            record.actions = step.actions.map { convertAction($0) }
        case let step as PollingStep:
            record.stepType = .polling
            record.mainAction = convertAction(step.mainAction)
            record.cancelAction = step.cancelAction.map { convertAction($0) }
            record.pollingProperties = convertPollingProperties(step.pollingProperties)
            record.actions = step.actions.map { convertAction($0) }
        case let step as ContinueSameStep:
            record.stepType = .continueSame
            record.actions = step.actions.map { convertAction($0) }
        case let step as OAuthAuthorizationResponseStep:
            record.stepType = .oAuthAuthorizationResponse
            record.oauthProperties = convertOAuthProperties(step.oauthAuthorizationResponseProperties)
            record.actions = step.actions.map { convertAction($0) }
        case let step as ExternalBrowserClientOperationStep:
            record.stepType = .externalBrowserClientOperation
            record.clientOperationActionModel = convertExternalBrowserModel(step.actionModel)
            record.actions = step.actions.map { convertAction($0) }
        case let step as BankIdClientOperationStep:
            record.stepType = .bankIdClientOperation
            record.clientOperationActionModel = convertBankIdModel(step.actionModel)
            record.activationLink = step.activationLink.map {
                collectedLinks.append($0)
                return convertLink($0)
            }
            record.actions = step.actions.map { convertAction($0) }
        case let step as EncapClientOperationStep:
            record.stepType = .encapClientOperation
            record.clientOperationActionModel = convertEncapModel(step.actionModel)
            record.actions = step.actions.map { convertAction($0) }
        case let step as WebAuthnRegistrationClientOperationStep:
            record.stepType = .webAuthnRegistrationClientOperation
            record.clientOperationActionModel = convertWebAuthnRegistrationModel(step.actionModel)
            record.actions = step.actions.map { convertAction($0) }
        case let step as WebAuthnAuthenticationClientOperationStep:
            record.stepType = .webAuthnAuthenticationClientOperation
            record.clientOperationActionModel = convertWebAuthnAuthenticationModel(step.actionModel)
            record.actions = step.actions.map { convertAction($0) }
        case let step as GenericClientOperationStep:
            record.stepType = .genericClientOperation
            record.clientOperationActionModel = convertGenericClientOperationModel(step.actionModel)
            record.actions = step.actions.map { convertAction($0) }
        default:
            record.stepType = .genericRepresentation
            record.properties = convertProperties(repr.properties)
        }

        return record
    }
}
