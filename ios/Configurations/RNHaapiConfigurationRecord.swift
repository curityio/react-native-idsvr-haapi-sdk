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

/// Top-level configuration record received from JavaScript.
///
/// Maps to the TypeScript `RNHaapiConfiguration` interface.
/// Fields are deserialized automatically by the Expo Modules bridge.
struct RNHaapiConfigurationRecord: Record {
    /// Base URL of the Curity Identity Server (e.g. `"https://idsvr.example.com"`).
    @Field var baseUrl: String
    /// Token endpoint URL.
    @Field var tokenEndpointUrl: String
    /// Optional revocation endpoint URL.
    @Field var revocationEndpointUrl: String?
    /// Authorization endpoint URL.
    @Field var authorizationEndpointUrl: String
    /// Whether to automatically follow redirects during the HAAPI flow.
    @Field var isAutoRedirect: Bool
    /// Minimum token time-to-live in seconds before proactive refresh.
    @Field var minTokenTtl: Double
    /// iOS-specific configuration.
    @Field var iosConfig: iOSConfigurationRecord
    /// Optional per-platform override of authorization request parameters.
    @Field var authorizationParameters: RNOAuthAuthorizationParametersRecord?
    /// Optional per-platform override of HTTP headers applied to SDK network calls.
    @Field var httpHeaders: [String: String]?
}

extension RNHaapiConfigurationRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        return [
            "baseUrl": baseUrl,
            "tokenEndpointUrl": tokenEndpointUrl,
            "revocationEndpointUrl": revocationEndpointUrl ?? "nil",
            "authorizationEndpointUrl": authorizationEndpointUrl,
            "isAutoRedirect": isAutoRedirect,
            "minTokenTtl": minTokenTtl,
            "iosConfig": iosConfig,
            "authorizationParameters": authorizationParameters ?? "nil",
            "httpHeaders": httpHeaders ?? "nil"
        ].debugDescription
    }
}


/// iOS-specific configuration for the HAAPI client.
///
/// Expo Modules can decode this from the TS object because it conforms to `Record`.
struct iOSConfigurationRecord: Record {
    // MARK: Mandatory
    /// Configuration name
    @Field var name: String
    /// Client identifier registered in the Curity Identity Server.
    @Field var clientId: String
    /// Redirect URI (deep link) registered for the iOS application.
    @Field var appRedirect: String

    /// URLSession behavior used for network calls on iOS.
    @Field var urlSessionOption: URLSessionOption = .default

    /// Attestation configuration.
    @Field var attestationConfiguration: RNAttestationConfigurationRecord
    /// Token binding configuration.
    @Field var tokenBoundConfiguration: RNTokenBoundConfigurationRecord?
    /// Client authentication method used when calling the token endpoint.
    ///
    /// Deserialized from the TypeScript `ClientAuthenticationMethodConfiguration` discriminated union.
    /// The `kind` field determines the authentication variant.
    @Field var clientAuthenticationMethodConfiguration: ClientAuthenticationMethodConfigurationRecord = ClientAuthenticationMethodConfigurationRecord()

    // MARK: Optional (DCR and RiskAssessment)
    /// Optional Dynamic Client Registration (DCR) configuration.
    @Field var dcrConfiguration: RNDcrConfigurationRecord?
    /// Optional risk assessment configuration.
    @Field var useRiskAssessmentConfiguration: Bool

    /// Whether a token endpoint response listener is registered on the native side.
    @Field var hasTokenEndpointResponseListener: Bool
    // MARK: Overriden options
    /// Optional per-platform override of authorization request parameters.
    @Field var authorizationParameters: RNOAuthAuthorizationParametersRecord?
    /// Optional per-platform override of HTTP headers.
    @Field var httpHeaders: [String: String]?

    init() {}
    init(
        name: String,
        clientId: String,
        appRedirect: String,
        urlSessionOption: URLSessionOption,
        attestationConfiguration: RNAttestationConfigurationRecord,
        tokenBoundConfiguration: RNTokenBoundConfigurationRecord,
        clientAuthenticationMethodConfiguration: ClientAuthenticationMethodConfigurationRecord,
        dcrConfiguration: RNDcrConfigurationRecord? = nil,
        useRiskAssessmentConfiguration: Bool = false,
        hasTokenEndpointResponseListener: Bool = false,
        authorizationParameters: RNOAuthAuthorizationParametersRecord? = nil,
        httpHeaders: [String : String]? = nil
    ) {
        self.name = name
        self.clientId = clientId
        self.appRedirect = appRedirect
        self.urlSessionOption = urlSessionOption
        self.attestationConfiguration = attestationConfiguration
        self.tokenBoundConfiguration = tokenBoundConfiguration
        self.clientAuthenticationMethodConfiguration = clientAuthenticationMethodConfiguration
        self.dcrConfiguration = dcrConfiguration
        self.useRiskAssessmentConfiguration = useRiskAssessmentConfiguration
        self.hasTokenEndpointResponseListener = hasTokenEndpointResponseListener
        self.authorizationParameters = authorizationParameters
        self.httpHeaders = httpHeaders
    }
}

extension iOSConfigurationRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        return [
            "name": name,
            "clientId": clientId,
            "appRedirect": appRedirect,
            "urlSessionOption": urlSessionOption,
            "attestationConfiguration": attestationConfiguration,
            "tokenBoundConfiguration": tokenBoundConfiguration ?? "nil",
            "clientAuthenticationMethodConfiguration": clientAuthenticationMethodConfiguration,
            "dcrConfiguration": dcrConfiguration ?? "nil",
            "useRiskAssessmentConfiguration": useRiskAssessmentConfiguration,
            "hasTokenEndpointResponseListener": hasTokenEndpointResponseListener,
            "authorizationParameters": authorizationParameters ?? "nil",
            "httpHeaders": httpHeaders ?? "nil"
        ].debugDescription
    }
}
