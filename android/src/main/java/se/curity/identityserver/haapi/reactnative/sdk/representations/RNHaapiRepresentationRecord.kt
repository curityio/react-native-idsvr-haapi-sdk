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

/**
 * A successful HAAPI representation response.
 *
 * Maps to the TypeScript `HaapiRepresentation` discriminated union.
 * The [stepType] field is the discriminator.
 */
class RNHaapiRepresentationRecord : Record {
    /** Discriminator for the step type. */
    @Field var stepType: RNStepType = RNStepType.GENERIC_REPRESENTATION

    // Common fields

    /** Optional metadata. */
    @Field var metadata: RNMetadataRecord? = null

    /** The representation type (e.g., "authentication-step"). */
    @Field var type: RNRepresentationType = RNRepresentationType.AUTHENTICATION_STEP

    /** Available actions. */
    @Field var actions: List<RNActionRecord> = emptyList()

    /** Available links. */
    @Field var links: List<RNLinkRecord> = emptyList()

    /** User-facing messages. */
    @Field var messages: List<RNUserMessageRecord> = emptyList()

    // AuthenticatorSelectorStep

    /** Title displayed above the authenticator list. */
    @Field var title: RNMessageRecord? = null

    /** Available authenticator options. */
    @Field var authenticators: List<RNAuthenticatorOptionRecord>? = null

    // InteractiveFormStep / GenericRepresentationStep

    /** Step-specific properties. */
    @Field var properties: RNPropertiesRecord? = null

    // RedirectionStep

    /** The form action to follow for redirection. */
    @Field var redirectAction: RNActionRecord? = null

    // PollingStep

    /** The main polling action. */
    @Field var mainAction: RNActionRecord? = null

    /** Optional cancel action for polling. */
    @Field var cancelAction: RNActionRecord? = null

    /** Polling-specific properties. */
    @Field var pollingProperties: RNPropertiesRecord? = null

    // OAuthAuthorizationResponseStep

    /** OAuth authorization response properties. */
    @Field var oauthProperties: RNPropertiesRecord? = null

    // Client operation steps

    /** Client operation action model (for client operation steps). */
    @Field var clientOperationActionModel: RNClientOperationActionModelRecord? = null

    /** Optional QR code activation link (for BankId steps). */
    @Field var activationLink: RNLinkRecord? = null

    override fun toString(): String =
        buildRecordString("RNHaapiRepresentationRecord") {
            put("stepType", stepType)
            put("metadata", metadata?.let { JSONObject(it.toString()) })
            put("type", type)
            put("actions", actions.size)
            put("links", links.size)
            put("messages", messages.size)
            put("title", title?.let { JSONObject(it.toString()) })
            put("authenticators", authenticators?.size)
            put("properties", properties?.let { JSONObject(it.toString()) })
            put("redirectAction", redirectAction?.let { JSONObject(it.toString()) })
            put("mainAction", mainAction?.let { JSONObject(it.toString()) })
            put("cancelAction", cancelAction?.let { JSONObject(it.toString()) })
            put("pollingProperties", pollingProperties?.let { JSONObject(it.toString()) })
            put("oauthProperties", oauthProperties?.let { JSONObject(it.toString()) })
            put("clientOperationActionModel", clientOperationActionModel?.let { JSONObject(it.toString()) })
            put("activationLink", activationLink?.let { JSONObject(it.toString()) })
        }
}
