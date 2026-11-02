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

/// OAuth authorization parameters appended to the authorization request.
///
/// Maps to the TypeScript `OAuthAuthorizationParameters` interface.
/// All fields are optional and default to `nil`.
struct RNOAuthAuthorizationParametersRecord: Record {
    /// OAuth scopes to request.
    @Field public var scope: [String]?
    /// Optional nonce value for OpenID Connect flows.
    @Field public var nonce: String?
    /// Optional ACR values.
    @Field public var acrValues: [String]?
    /// Additional custom authorization request parameters.
    @Field public var extraRequestParameters: [String: String]?

    public init() {}
    public init(scope: [String]? = nil, nonce: String? = nil, acrValues: [String]? = nil, extraRequestParameters: [String: String]? = nil) {
        self.scope = scope
        self.nonce = nonce
        self.acrValues = acrValues
        self.extraRequestParameters = extraRequestParameters
    }
}

extension RNOAuthAuthorizationParametersRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "scope": scope ?? "nil",
            "nonce": nonce ?? "nil",
            "acrValues": acrValues ?? "nil",
            "extraRequestParameters": extraRequestParameters ?? "nil"
        ].debugDescription
    }
}
