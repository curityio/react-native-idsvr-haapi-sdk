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
internal import ExpoModulesCore
@testable import RNIdsvrHaapiSdk

/// Factory helpers that produce real `IdsvrHaapiSdk` model instances
/// suitable for bridge cache-population tests.
///
/// The bridge's `RNHaapiManagerBridge` matches `submitForm` / `followLink`
/// records against cached real models by `href` + `method` (form action)
/// or `href` + `rel` (link). The cache is populated by `processResult`
/// from `HaapiResponseMapping.collectedFormActionModels` / `.collectedLinks`
/// after every flow operation, so tests can pre-populate the cache by:
///
///   1. Setting `recordingMapping.collectedFormActionModels = [...]` (or `.collectedLinks`)
///      with real models from this fixtures helper.
///   2. Invoking `await bridge.start()` once — the bridge reads the
///      mapping's collections and stores them in its private cache.
///
/// `FormActionModel`, `Link`, and `Dpop` are all `public`, `Codable`,
/// and `Sendable` in `IdsvrHaapiSdk` v5.7.1. Construction goes through
/// `JSONDecoder` using the HAAPI wire format — minimum required keys
/// only; optional fields are omitted.
enum HaapiModelFixtures {

    /// Builds a `FormActionModel` whose `href` + `method` will be matched
    /// by `RNHaapiManagerBridge.submitForm`.
    ///
    /// Optional fields (`actionTitle`, `continueActions`, `errorActions`)
    /// are omitted from JSON; the decoder defaults them to nil / empty.
    static func formActionModel(
        href: String,
        method: String = "POST",
        type: String = "form"
    ) throws -> FormActionModel {
        let json = """
        {
            "type": "\(type)",
            "method": "\(method)",
            "href": "\(href)",
            "fields": []
        }
        """.data(using: .utf8)!
        return try JSONDecoder().decode(FormActionModel.self, from: json)
    }

    /// Builds a `Link` whose `href` + `rel` will be matched by
    /// `RNHaapiManagerBridge.followLink`.
    static func link(
        href: String,
        rel: String
    ) throws -> Link {
        let json = """
        {
            "href": "\(href)",
            "rel": "\(rel)"
        }
        """.data(using: .utf8)!
        return try JSONDecoder().decode(Link.self, from: json)
    }

    /// Minimal `HaapiConfiguration` suitable for constructing a real
    /// `HaapiManager` / `OAuthTokenManager` in unit tests. Uses test-only
    /// URLs that never get hit because we always drive flow operations
    /// through the bridge's invoker test seam.
    ///
    /// `name` defaults to a UUID-suffixed string because the SDK keeps a
    /// process-wide `OAuthTokenManager` registry keyed by name and throws
    /// `haapiTokenManagerAlreadyExists` on duplicate registrations.
    /// Test cases that construct multiple accessor fixtures would otherwise
    /// collide on a constant name.
    static func haapiConfiguration(
        name: String = "test-haapi-configuration-\(UUID().uuidString)",
        baseURL: URL = URL(string: "https://example.test")!
    ) -> HaapiConfiguration {
        return HaapiConfiguration(
            name: name,
            clientId: "test-client",
            baseURL: baseURL,
            tokenEndpointURL: baseURL.appendingPathComponent("token"),
            authorizationEndpointURL: baseURL.appendingPathComponent("auth"),
            appRedirect: "test-app://callback",
            httpHeadersProvider: nil,
            authorizationParametersProvider: nil
        )
    }

    /// Constructs a real `HaapiManager` for tests that need a non-fatal
    /// accessor getter. The manager never actually talks to the network
    /// — flow operations route through the bridge's invoker test seam.
    static func haapiManager(
        configuration: HaapiConfiguration? = nil
    ) throws -> HaapiManager {
        let config = configuration ?? haapiConfiguration()
        return try HaapiManager(haapiConfiguration: config)
    }

    /// Constructs a real `OAuthTokenManager` for tests that need a
    /// non-fatal `accessor.oAuthTokenManager` getter.
    static func oAuthTokenManager(
        configuration: HaapiConfiguration? = nil
    ) -> OAuthTokenManager {
        let config = configuration ?? haapiConfiguration()
        return OAuthTokenManager(oauthTokenConfiguration: config)
    }

    /// Constructs a real `Dpop` instance via `InternalTestUtility` (the SDK's
    /// deprecated-but-public test seam). Used by the DPoP-forwarded test
    /// `testFetchAccessToken_dpopProviderReturnsValue_invokerReceivesValue`.
    /// `.p256` is simulator-safe (no Secure Enclave hardware needed); the
    /// generated keypair is throw-away keychain material the test never
    /// reuses.
    ///
    /// NOTE: `InternalTestUtility` is marked deprecated by the SDK but remains
    /// the only public path to a real `Dpop`. The deprecation warning is
    /// silenced locally with `@available(*, deprecated)` on the call sites.
    /// Replace this helper when the SDK exposes a non-deprecated test seam.
    static func dpop(
        oAuthTokenManager manager: OAuthTokenManager? = nil
    ) throws -> Dpop {
        let resolved = manager ?? Self.oAuthTokenManager()
        return try Self.makeDpopUsingDeprecatedUtility(manager: resolved)
    }

    @available(*, deprecated)
    private static func makeDpopUsingDeprecatedUtility(manager: OAuthTokenManager) throws -> Dpop {
        let previous = InternalTestUtility.isEnabled
        InternalTestUtility.isEnabled = true
        defer { InternalTestUtility.isEnabled = previous }
        let utility = InternalTestUtility(oauthTokenManager: manager)
        return try utility.createDPoP(keyType: .p256)
    }
}
