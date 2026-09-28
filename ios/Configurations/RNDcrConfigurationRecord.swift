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

/// Dynamic Client Registration configuration.
struct RNDcrConfigurationRecord: Record {
    /// A template client ID used as a base when registering a new dynamic client.
    @Field var templateClientId: String
    /// DCR endpoint URL.
    @Field var clientRegistrationEndpointUrl: String

    init() {}
    init(
        templateClientId: String,
        clientRegistrationEndpointUrl: String
    ) {
        self.templateClientId = templateClientId
        self.clientRegistrationEndpointUrl = clientRegistrationEndpointUrl
    }
}
