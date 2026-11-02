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

/// Step-specific properties attached to a HAAPI representation.
///
/// Maps to the TypeScript `Properties` discriminated union.
/// The `kind` field is the discriminator: "generic", "oauthAuthorizationResponse", or "polling".
struct RNPropertiesRecord: Record {
    /// Discriminator: "generic", "oauthAuthorizationResponse", or "polling".
    @Field var kind: String = "generic"

    // Generic properties
    /// The raw JSON string of the properties object.
    @Field var rawJsonString: String?

    // OAuth authorization response properties
    /// The authorization code.
    @Field var code: String?
    /// The OpenID Connect ID token.
    @Field var idToken: String?
    /// The granted scope.
    @Field var scope: String?
    /// The OAuth state parameter.
    @Field var state: String?

    // Polling properties
    /// Description of who/what is being communicated with.
    @Field var recipientOfCommunication: String?
    /// Current polling status ("pending", "done", "failed").
    @Field var status: RNPollingStatus?
    /// The amount of time in milliseconds that the client should wait between polling requests.
    @Field var interval: String?
    /// Maximum wait time.
    @Field var maxWaitTime: String?
    /// Remaining wait time.
    @Field var maxWaitRemainingTime: String?

    init() {}
}

extension RNPropertiesRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNPropertiesRecord",
            "kind": kind,
            "rawJsonString": rawJsonString as Any,
            "code": code as Any,
            "idToken": idToken as Any,
            "scope": scope as Any,
            "state": state as Any,
            "recipientOfCommunication": recipientOfCommunication as Any,
            "status": status as Any,
            "interval": interval as Any,
            "maxWaitTime": maxWaitTime as Any,
            "maxWaitRemainingTime": maxWaitRemainingTime as Any
        ].debugDescription
    }
}
