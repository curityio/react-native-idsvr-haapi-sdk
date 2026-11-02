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

/// A successful HAAPI representation response.
///
/// Maps to the TypeScript `HaapiRepresentation` discriminated union.
/// The `stepType` field is the discriminator.
struct RNHaapiRepresentationRecord: Record {
    /// Discriminator for the step type.
    @Field var stepType: RNStepType = .genericRepresentation

    // Common fields
    /// Optional metadata.
    @Field var metadata: RNMetadataRecord?
    /// The representation type (e.g., "authentication-step").
    @Field var type: RNRepresentationType = .authenticationStep
    /// Available actions.
    @Field var actions: [RNActionRecord] = []
    /// Available links.
    @Field var links: [RNLinkRecord] = []
    /// User-facing messages.
    @Field var messages: [RNUserMessageRecord] = []

    // AuthenticatorSelectorStep
    /// Title displayed above the authenticator list.
    @Field var title: RNMessageRecord?
    /// Available authenticator options.
    @Field var authenticators: [RNAuthenticatorOptionRecord]?

    // InteractiveFormStep / GenericRepresentationStep
    /// Step-specific properties.
    @Field var properties: RNPropertiesRecord?

    // RedirectionStep
    /// The form action to follow for redirection.
    @Field var redirectAction: RNActionRecord?

    // PollingStep
    /// The main polling action.
    @Field var mainAction: RNActionRecord?
    /// Optional cancel action for polling.
    @Field var cancelAction: RNActionRecord?
    /// Polling-specific properties.
    @Field var pollingProperties: RNPropertiesRecord?

    // OAuthAuthorizationResponseStep
    /// OAuth authorization response properties.
    @Field var oauthProperties: RNPropertiesRecord?

    // Client operation steps
    /// Client operation action model (for client operation steps).
    @Field var clientOperationActionModel: RNClientOperationActionModelRecord?
    /// Optional QR code activation link (for BankId steps).
    @Field var activationLink: RNLinkRecord?

    init() {}
}

extension RNHaapiRepresentationRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNHaapiRepresentationRecord",
            "stepType": stepType,
            "metadata": metadata as Any,
            "type": type,
            "actions": actions.count,
            "links": links.count,
            "messages": messages.count,
            "title": title as Any,
            "authenticators": authenticators as Any,
            "properties": properties as Any,
            "redirectAction": redirectAction as Any,
            "mainAction": mainAction as Any,
            "cancelAction": cancelAction as Any,
            "pollingProperties": pollingProperties as Any,
            "oauthProperties": oauthProperties as Any,
            "clientOperationActionModel": clientOperationActionModel as Any,
            "activationLink": activationLink as Any
        ].debugDescription
    }
}
