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

import se.curity.identityserver.haapi.android.sdk.models.AuthorizationProblem
import se.curity.identityserver.haapi.android.sdk.models.InvalidInputProblem
import se.curity.identityserver.haapi.android.sdk.models.Link
import se.curity.identityserver.haapi.android.sdk.models.Message
import se.curity.identityserver.haapi.android.sdk.models.Metadata
import se.curity.identityserver.haapi.android.sdk.models.PollingStatus
import se.curity.identityserver.haapi.android.sdk.models.ProblemRepresentation
import se.curity.identityserver.haapi.android.sdk.models.ProblemType
import se.curity.identityserver.haapi.android.sdk.models.Properties
import se.curity.identityserver.haapi.android.sdk.models.UserMessage
import se.curity.identityserver.haapi.android.sdk.models.actions.ActionKind
import se.curity.identityserver.haapi.android.sdk.models.actions.ClientOperationName
import se.curity.identityserver.haapi.android.sdk.models.actions.FormField

// ─── Links ──────────────────────────────────────────────────────────────────

/** Maps a native [Link] into an [RNLinkRecord]. */
internal fun HaapiResponseMapper.convertLink(link: Link): RNLinkRecord {
    val record = RNLinkRecord()
    record.href = link.href
    record.rel = link.rel
    record.title = link.title?.let { convertMessage(it) }
    record.type = link.type
    return record
}

// ─── Messages ───────────────────────────────────────────────────────────────

/** Maps a native [Message] into an [RNMessageRecord]. */
internal fun HaapiResponseMapper.convertMessage(message: Message): RNMessageRecord {
    val record = RNMessageRecord()
    record.key = message.key
    record.literal = message.literal
    return record
}

/** Maps a native [UserMessage] into an [RNUserMessageRecord]. */
internal fun HaapiResponseMapper.convertUserMessage(message: UserMessage): RNUserMessageRecord {
    val record = RNUserMessageRecord()
    record.text = convertMessage(message.text)
    record.classList = message.classList
    return record
}

// ─── Metadata ───────────────────────────────────────────────────────────────

/** Maps a native [Metadata] into an [RNMetadataRecord]. */
internal fun HaapiResponseMapper.convertMetadata(metadata: Metadata): RNMetadataRecord {
    val record = RNMetadataRecord()
    record.templateArea = metadata.templateArea
    record.viewName = metadata.viewName
    return record
}

// ─── Properties ─────────────────────────────────────────────────────────────

/** Maps native [Properties] into an [RNPropertiesRecord], or returns null if absent. */
internal fun HaapiResponseMapper.convertProperties(props: Properties?): RNPropertiesRecord? {
    if (props == null) return null

    val record = RNPropertiesRecord()
    record.rawJsonString = props.rawJsonString

    when (props) {
        is Properties.OAuthAuthorizationResponse -> {
            record.kind = "oauthAuthorizationResponse"
            record.code = props.code
            record.idToken = props.idToken
            record.scope = props.scope
            record.state = props.state
        }

        is Properties.Polling -> {
            record.kind = "polling"
            record.recipientOfCommunication = props.recipientOfCommunication
            record.status = convertPollingStatus(props.status)
            record.interval = props.interval
            record.maxWaitTime = props.maxWaitTime
            record.maxWaitRemainingTime = props.maxWaitRemainingTime
        }

        is Properties.GenericProperties -> {
            record.kind = "generic"
        }

        else -> {
            record.kind = "generic"
        }
    }

    return record
}

/** Maps OAuth authorization response properties into an [RNPropertiesRecord]. */
internal fun HaapiResponseMapper.convertOAuthProperties(
    props: Properties.OAuthAuthorizationResponse,
): RNPropertiesRecord {
    val record = RNPropertiesRecord()
    record.kind = "oauthAuthorizationResponse"
    record.rawJsonString = props.rawJsonString
    record.code = props.code
    record.idToken = props.idToken
    record.scope = props.scope
    record.state = props.state
    return record
}

/** Maps polling properties into an [RNPropertiesRecord]. */
internal fun HaapiResponseMapper.convertPollingProperties(props: Properties.Polling): RNPropertiesRecord {
    val record = RNPropertiesRecord()
    record.kind = "polling"
    record.rawJsonString = props.rawJsonString
    record.recipientOfCommunication = props.recipientOfCommunication
    record.status = convertPollingStatus(props.status)
    record.interval = props.interval
    record.maxWaitTime = props.maxWaitTime
    record.maxWaitRemainingTime = props.maxWaitRemainingTime
    return record
}

// ─── Problems ───────────────────────────────────────────────────────────────

/** Maps a native [ProblemRepresentation] into an [RNProblemRepresentationRecord]. */
internal fun HaapiResponseMapper.convertProblem(problem: ProblemRepresentation): RNProblemRepresentationRecord {
    collectedLinks = problem.links

    val record = RNProblemRepresentationRecord()
    record.type = convertProblemType(problem.type)
    record.metadata = problem.metadata?.let { convertMetadata(it) }
    record.title = problem.title?.let { convertMessage(it) }
    record.messages = problem.messages.map { convertUserMessage(it) }
    record.links = problem.links.map { convertLink(it) }

    when (problem) {
        is InvalidInputProblem -> {
            record.problemKind = "invalidInput"
            record.invalidFields =
                problem.invalidFields.map { invalidField ->
                    RNInvalidFieldRecord().apply {
                        name = invalidField.name
                        reason = invalidField.reason
                        detail = convertMessage(invalidField.detail)
                    }
                }
            record.errorDescription = problem.errorDescription
        }

        is AuthorizationProblem -> {
            record.problemKind = "authorization"
            record.error = problem.error
            record.errorDescription = problem.errorDescription
            record.iss = problem.iss
        }

        else -> {
            record.problemKind = "problem"
        }
    }

    return record
}

// ─── Enum Mapping ───────────────────────────────────────────────────────────

/** Maps a native [ActionKind] to its bridge enum. */
internal fun HaapiResponseMapper.convertActionKind(kind: ActionKind): RNActionKind =
    RNActionKind.entries.find { it.value == kind.discriminator }
        ?: RNActionKind.OTHER

/** Maps a native [ProblemType] to its bridge enum. */
internal fun HaapiResponseMapper.convertProblemType(type: ProblemType): RNProblemType =
    RNProblemType.entries.find { it.value == type.discriminator }
        ?: RNProblemType.OTHER

/** Maps a native [ClientOperationName] to its discriminator string. */
internal fun HaapiResponseMapper.convertClientOperationName(name: ClientOperationName): String = name.discriminator

/** Maps a native [PollingStatus] to its bridge enum. */
internal fun HaapiResponseMapper.convertPollingStatus(status: PollingStatus): RNPollingStatus =
    when (status) {
        PollingStatus.PENDING -> RNPollingStatus.PENDING
        PollingStatus.DONE -> RNPollingStatus.DONE
        PollingStatus.FAILED -> RNPollingStatus.FAILED
    }

/** Maps a text field kind to its string representation. */
internal fun HaapiResponseMapper.convertTextFieldKind(kind: FormField.Text.Kind): String =
    when (kind) {
        is FormField.Text.Kind.Number -> "number"
        is FormField.Text.Kind.Email -> "email"
        is FormField.Text.Kind.Url -> "url"
        is FormField.Text.Kind.Tel -> "tel"
        is FormField.Text.Kind.Color -> "color"
        is FormField.Text.Kind.Unknown -> kind.value
        else -> "unknown"
    }
