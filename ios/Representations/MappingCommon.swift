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

/// Links, messages, metadata, properties, problems, and enum mapping for ``HaapiResponseMapper``.
extension HaapiResponseMapper {

    // MARK: - Links

    /// Maps a native Link into an RNLinkRecord.
    func convertLink(_ link: Link) -> RNLinkRecord {
        RNLinkRecord(
            href: link.href,
            rel: link.rel,
            title: link.title.map { convertMessage($0) },
            type: link.type
        )
    }

    // MARK: - Messages

    /// Maps a native Message into an RNMessageRecord.
    func convertMessage(_ message: Message) -> RNMessageRecord {
        RNMessageRecord(key: message.key, literal: message.literal)
    }

    /// Maps a native UserMessage into an RNUserMessageRecord.
    func convertUserMessage(_ message: UserMessage) -> RNUserMessageRecord {
        RNUserMessageRecord(
            text: convertMessage(message.text),
            classList: message.classList
        )
    }

    // MARK: - Metadata

    /// Maps a native Metadata into an RNMetadataRecord.
    func convertMetadata(_ metadata: Metadata) -> RNMetadataRecord {
        RNMetadataRecord(templateArea: metadata.templateArea, viewName: metadata.viewName)
    }

    // MARK: - Properties

    /// Maps native Properties into an RNPropertiesRecord, or returns nil if absent.
    func convertProperties(_ props: (any Properties)?) -> RNPropertiesRecord? {
        guard let props else { return nil }

        let record = RNPropertiesRecord()
        record.rawJsonString = props.rawJsonString

        switch props {
        case let p as OAuthAuthorizationResponseProperties:
            record.kind = "oauthAuthorizationResponse"
            record.code = p.code
            record.idToken = p.idToken
            record.scope = p.scope
            record.state = p.state
        case let p as PollingProperties:
            record.kind = "polling"
            record.recipientOfCommunication = p.recipientOfCommunication
            record.status = convertPollingStatus(p.status)
            record.interval = p.interval
            record.maxWaitTime = p.maxWaitTime
            record.maxWaitRemainingTime = p.maxWaitRemainingTime
        default:
            record.kind = "generic"
        }

        return record
    }

    /// Maps OAuth authorization response properties into an RNPropertiesRecord.
    func convertOAuthProperties(
        _ props: OAuthAuthorizationResponseProperties
    ) -> RNPropertiesRecord {
        let record = RNPropertiesRecord()
        record.kind = "oauthAuthorizationResponse"
        record.rawJsonString = props.rawJsonString
        record.code = props.code
        record.idToken = props.idToken
        record.scope = props.scope
        record.state = props.state
        return record
    }

    /// Maps polling properties into an RNPropertiesRecord.
    func convertPollingProperties(_ props: PollingProperties) -> RNPropertiesRecord {
        let record = RNPropertiesRecord()
        record.kind = "polling"
        record.rawJsonString = props.rawJsonString
        record.recipientOfCommunication = props.recipientOfCommunication
        record.status = convertPollingStatus(props.status)
        record.interval = props.interval
        record.maxWaitTime = props.maxWaitTime
        record.maxWaitRemainingTime = props.maxWaitRemainingTime
        return record
    }

    // MARK: - Problems

    /// Maps a native ProblemRepresentation into an RNProblemRepresentationRecord.
    func convertProblem(_ problem: any ProblemRepresentation) -> RNProblemRepresentationRecord {
        collectedLinks = problem.links

        let record = RNProblemRepresentationRecord()
        record.type = convertProblemType(problem.type)
        record.metadata = problem.metadata.map { convertMetadata($0) }
        record.title = problem.title.map { convertMessage($0) }
        record.messages = problem.messages.map { convertUserMessage($0) }
        record.links = problem.links.map { convertLink($0) }

        switch problem {
        case let p as InvalidInputProblem:
            record.problemKind = "invalidInput"
            record.invalidFields = p.invalidFields.map {
                RNInvalidFieldRecord(name: $0.name, reason: $0.reason, detail: convertMessage($0.detail))
            }
            record.errorDescription = p.errorDescription
        case let p as AuthorizationProblem:
            record.problemKind = "authorization"
            record.error = p.error
            record.errorDescription = p.errorDescription
            record.iss = p.iss
        default:
            record.problemKind = "problem"
        }

        return record
    }

    // MARK: - Enum Conversions

    /// Maps a native ActionKind to its bridge enum.
    func convertActionKind(_ kind: ActionKind) -> RNActionKind {
        switch kind {
        case .cancel: return .cancel
        case .deviceOption: return .deviceOption
        case .login: return .login
        case .continue: return .continue
        case .continueAutoLogin: return .continueAutoLogin
        case .deviceSelector: return .deviceSelector
        case .redirect: return .redirect
        case .authenticatorSelector: return .authenticatorSelector
        case .selectAuthenticator: return .selectAuthenticator
        case .poll: return .poll
        case .form: return .form
        case .bankIdSameDevice: return .bankIdSameDevice
        case .bankIdOtherDevice: return .bankIdOtherDevice
        case .passwordReset: return .passwordReset
        case .accountIdRecovery: return .accountIdRecovery
        case .userRegister: return .userRegister
        case .other: return .other
        @unknown default: return .other
        }
    }

    /// Maps a native ProblemType to its bridge enum.
    func convertProblemType(_ type: ProblemType) -> RNProblemType {
        switch type {
        case .authenticationFailedProblem: return .authenticationFailed
        case .invalidInputProblem: return .invalidInput
        case .incorrectCredentialsProblem: return .incorrectCredentials
        case .errorAuthorizationResponseProblem: return .errorAuthorizationResponse
        case .unexpectedProblem: return .unexpected
        case .tooManyAttemptsProblem: return .tooManyAttempts
        case .genericUserProblem: return .genericUserError
        case .sessionAndAccessTokenMismatchProblem: return .sessionAndAccessTokenMismatch
        case .other: return .other
        @unknown default: return .other
        }
    }

    /// Maps a native ClientOperationName to its bridge enum.
    func convertClientOperationName(_ name: ClientOperationName) -> RNClientOperationType {
        switch name {
        case .externalBrowser: return .externalBrowserFlow
        case .bankId: return .bankid
        case .encapAutoActivation: return .encapAutoActivation
        case .webAuthnRegistration: return .webauthnRegistration
        case .webAuthnAuthentication: return .webauthnAuthentication
        case .unknown: return .generic
        @unknown default: return .generic
        }
    }

    /// Maps a native PollingStatus to its bridge enum.
    func convertPollingStatus(_ status: PollingStatus) -> RNPollingStatus {
        switch status {
        case .pending: return .pending
        case .done: return .done
        case .failed: return .failed
        @unknown default: return .pending
        }
    }

    /// Maps a text field kind to its string representation.
    func convertTextFieldKind(_ kind: TextFormField.Kind) -> String {
        switch kind {
        case .number: return "number"
        case .email: return "email"
        case .url: return "url"
        case .tel: return "tel"
        case .color: return "color"
        case .unknown(let value): return value
        @unknown default: return "unknown"
        }
    }
}
