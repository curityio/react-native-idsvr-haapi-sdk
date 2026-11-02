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
import Foundation
import IdsvrHaapiSdk

/// Test seam over ``HaapiAccessorBuilder``'s build entry points.
///
/// The native ``HaapiAccessorBuilder`` is `final` and constructs real crypto
/// material when its `buildFor*` methods are invoked, which makes it
/// unsuitable for module-level integration tests. The Expo module depends
/// on this protocol instead, and production wiring uses
/// ``DefaultHaapiAccessorBuilderProvider``. Tests provide hand-rolled stubs
/// that return prepared fake accessors.
internal protocol HaapiAccessorBuilderProvider: Sendable {
    func buildForHaapi(configuration: RNHaapiConfigurationRecord) async throws -> any HaapiAccessor
    func buildForOAuth(configuration: RNHaapiConfigurationRecord) async throws -> any OAuthAccessor
}

/// Production ``HaapiAccessorBuilderProvider`` that translates the bridge
/// ``RNHaapiConfigurationRecord`` into a native ``HaapiConfiguration``,
/// applies the per-platform configuration steps (DCR + attestation retry
/// count — `clientAuthenticationMethod` is forwarded inline through the
/// ``HaapiConfiguration`` initializer per Appendix B), and delegates to
/// ``HaapiAccessorBuilder/buildForHaapi(shouldClearExistingDCRClient:)`` /
/// ``HaapiAccessorBuilder/buildForOAuth()``.
///
/// Both factory paths run the same configuration wiring (HSRN-8 § 11.5
/// decision A) so OAuth-only sessions inherit DCR / attestation settings
/// the host app already declared.
internal struct DefaultHaapiAccessorBuilderProvider: HaapiAccessorBuilderProvider {
    func buildForHaapi(configuration: RNHaapiConfigurationRecord) async throws -> any HaapiAccessor {
        try await makeBuilder(configuration: configuration).buildForHaapi()
    }

    func buildForOAuth(configuration: RNHaapiConfigurationRecord) async throws -> any OAuthAccessor {
        try await makeBuilder(configuration: configuration).buildForOAuth()
    }

    private func makeBuilder(configuration: RNHaapiConfigurationRecord) throws -> HaapiAccessorBuilder {
        let haapiConfiguration = try HaapiConfiguration(record: configuration)
        let builder = HaapiAccessorBuilder(haapiConfiguration: haapiConfiguration)
        if let dcrConfigurationRecord = configuration.iosConfig.dcrConfiguration {
            builder.setDCRConfiguration(configuration: try DCRConfiguration(record: dcrConfigurationRecord))
        }
        builder.setAttestationValidationRetryCount(
            maxRetries: configuration.iosConfig.attestationConfiguration.attestationMaxRetries
        )
        return builder
    }
}
