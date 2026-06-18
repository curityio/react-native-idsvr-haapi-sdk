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
import XCTest
import IdsvrHaapiSdk
@testable import RNIdsvrHaapiSdk

// File delivered alongside the Android `RNOAuthTokenManagerBridgeTest.kt`
// and mirrors that test in coverage and case order. Since HSRN-23, this file
// runs in the full native iOS test workspace (`npm run test:ios:native`).
//
// SDK type construction strategy:
//   - `SuccessfulTokenResponse` / `ErrorTokenResponse`: built via
//     `JSONDecoder` against the canonical fixtures from plan § 11.11. Their
//     `init(from:)` is public (the only-internal initializer is the direct
//     positional one).
//   - `Dpop`: the SDK does not expose a public initializer reachable from
//     test code. The non-nil DPoP forwarding case therefore goes through the
//     SDK's deprecated-but-public `InternalTestUtility` seam via
//     `HaapiModelFixtures.dpop()`.
//   - `OAuthTokenInvoker` / `OAuthTokenManager`: hand-rolled stubs (our
//     own protocol, no mocking lib needed).

// MARK: - Stubs

private final class RecordingInvoker: OAuthTokenInvoker, @unchecked Sendable {
    var fetchAccessTokenCalls: [(String, Dpop?, [String: String]?)] = []
    var refreshAccessTokenCalls: [(String, [String: String]?)] = []
    var revokeAccessTokenCalls: [String] = []
    var revokeRefreshTokenCalls: [String] = []

    var stubbedTokenResponse: TokenResponse = .error(StubError.placeholder)
    var stubbedRevocationResponse: TokenRevocationResponse = .success

    func fetchAccessToken(
        authorizationCode: String,
        dpop: Dpop?,
        additionalParameters: [String: String]?
    ) async -> TokenResponse {
        fetchAccessTokenCalls.append((authorizationCode, dpop, additionalParameters))
        return stubbedTokenResponse
    }

    func refreshAccessToken(
        refreshToken: String,
        additionalParameters: [String: String]?
    ) async -> TokenResponse {
        refreshAccessTokenCalls.append((refreshToken, additionalParameters))
        return stubbedTokenResponse
    }

    func revokeAccessToken(token: String) async -> TokenRevocationResponse {
        revokeAccessTokenCalls.append(token)
        return stubbedRevocationResponse
    }

    func revokeRefreshToken(token: String) async -> TokenRevocationResponse {
        revokeRefreshTokenCalls.append(token)
        return stubbedRevocationResponse
    }
}

private enum StubError: Error, LocalizedError {
    case placeholder
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .placeholder: return "placeholder"
        case let .transport(message): return message
        }
    }
}

// MARK: - § 11.11 fixture decoding (HSRN-20 / D17)
//
// Fixtures are loaded from `__fixtures__/token-responses.json` (OAuth RFC 6749
// § 5.1 / § 5.2 wire format, snake_case keys) shared with Jest and Android
// JUnit. xcodegen wires `../__fixtures__/*.json` into the test bundle as
// resources (see `ios/project.yml` RNIdsvrHaapiSdkTests target). The SDK's
// `Codable` `SuccessfulTokenResponse` / `ErrorTokenResponse` decode the
// snake_case sub-object directly — the wire→SDK-struct asymmetry is contained
// at this read boundary, mirroring the production decode pipeline.

private final class FixturesBundleAnchor {}

private enum Fixtures {
    // `[String: Any]` is not `Sendable` (the `Any` could hold a non-Sendable
    // value). The dict is loaded once from a JSON file at first access and
    // never mutated, so concurrent reads are safe. `nonisolated(unsafe)` is
    // the conventional Swift 6 escape hatch for this read-once-then-immutable
    // pattern.
    nonisolated(unsafe) private static let rawFixtures: [String: Any] = {
        guard let url = Bundle(for: FixturesBundleAnchor.self)
            .url(forResource: "token-responses", withExtension: "json")
        else {
            fatalError(
                "token-responses.json missing from RNIdsvrHaapiSdkTests bundle — " +
                "check `ios/project.yml` RNIdsvrHaapiSdkTests Resources entry."
            )
        }
        guard let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            fatalError("token-responses.json is unreadable or malformed at \(url.path)")
        }
        return json
    }()

    /// Re-serializes the named sub-object back to a JSON string the SDK Codable
    /// decoder can consume. The disk fixture already uses OAuth-wire snake_case
    /// keys, so no key remapping is needed.
    private static func wireJSON(for key: String) -> String {
        guard let dict = rawFixtures[key] as? [String: Any] else {
            fatalError("Fixture key '\(key)' missing in token-responses.json")
        }
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let json = String(data: data, encoding: .utf8)
        else {
            fatalError("Fixture key '\(key)' failed to re-serialize as JSON string")
        }
        return json
    }

    /// Fixture A — basic bearer (no OIDC).
    static let successBearerJSON: String = wireJSON(for: "successBearer")
    /// Fixture B — OIDC success with id_token + non-empty scope.
    static let successOidcJSON: String = wireJSON(for: "successOidc")
    /// Fixture C — DPoP-bound token (no refresh token issued).
    static let successDpopJSON: String = wireJSON(for: "successDpop")
    /// Fixture D — invalid_scope error token.
    static let errorInvalidScopeJSON: String = wireJSON(for: "errorInvalidScope")
    /// Fixture E — invalid_grant error token (canonical refresh-token failure).
    static let errorInvalidGrantJSON: String = wireJSON(for: "errorInvalidGrant")

    static func successful(_ json: String) throws -> SuccessfulTokenResponse {
        try JSONDecoder().decode(SuccessfulTokenResponse.self, from: Data(json.utf8))
    }

    static func errored(_ json: String) throws -> ErrorTokenResponse {
        try JSONDecoder().decode(ErrorTokenResponse.self, from: Data(json.utf8))
    }
}

// MARK: - Tests

final class RNOAuthTokenManagerBridgeTests: XCTestCase {

    // MARK: - fetchAccessToken happy paths

    func testFetchAccessToken_successBearer_returnsSuccessRecord() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedTokenResponse = .successfulToken(try Fixtures.successful(Fixtures.successBearerJSON))
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        let record = try await bridge.fetchAccessToken(authorizationCode: "abc", additionalParameters: nil)

        XCTAssertEqual(invoker.fetchAccessTokenCalls.count, 1)
        XCTAssertEqual(invoker.fetchAccessTokenCalls.first?.0, "abc")
        XCTAssertNil(invoker.fetchAccessTokenCalls.first?.2)
        XCTAssertEqual(record.responseType, .success)
        XCTAssertEqual(record.accessToken, "c2f1bd4c-a1bf-49b8-aa64-1535fa5161a6")
        XCTAssertEqual(record.tokenType, "bearer")
        XCTAssertEqual(record.scope, "")
        XCTAssertEqual(record.expiresIn, 299.0)
        XCTAssertEqual(record.refreshToken, "e57b7017-3fdd-40a9-97c4-97d26c500c8f")
        XCTAssertNil(record.idToken)
    }

    func testFetchAccessToken_successOidc_returnsSuccessRecordWithIdToken() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedTokenResponse = .successfulToken(try Fixtures.successful(Fixtures.successOidcJSON))
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        let record = try await bridge.fetchAccessToken(authorizationCode: "abc", additionalParameters: nil)

        XCTAssertEqual(record.responseType, .success)
        XCTAssertEqual(record.accessToken, "24605f8a-b558-4527-adcc-99f7d401d4c5")
        XCTAssertEqual(record.idToken, "eyJraWQiOiItMzgwNzQ4MTIi")
        XCTAssertEqual(record.scope, "address openid")
    }

    func testFetchAccessToken_successDpop_returnsRecordWithoutRefreshToken() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedTokenResponse = .successfulToken(try Fixtures.successful(Fixtures.successDpopJSON))
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        let record = try await bridge.fetchAccessToken(authorizationCode: "abc", additionalParameters: nil)

        XCTAssertEqual(record.responseType, .success)
        XCTAssertEqual(record.tokenType, "DPoP")
        XCTAssertEqual(record.expiresIn, 600.0)
        XCTAssertNil(record.refreshToken)
        XCTAssertNil(record.idToken)
    }

    func testFetchAccessToken_errorInvalidScope_returnsErrorRecord() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedTokenResponse = .errorToken(try Fixtures.errored(Fixtures.errorInvalidScopeJSON))
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        let record = try await bridge.fetchAccessToken(authorizationCode: "abc", additionalParameters: nil)

        XCTAssertEqual(record.responseType, .error)
        XCTAssertEqual(record.error, "invalid_scope")
        XCTAssertEqual(record.errorDescription, "No valid scope was requested.")
        XCTAssertNil(record.errorUri)
    }

    func testFetchAccessToken_errorInvalidGrant_returnsErrorRecord() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedTokenResponse = .errorToken(try Fixtures.errored(Fixtures.errorInvalidGrantJSON))
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        let record = try await bridge.fetchAccessToken(authorizationCode: "abc", additionalParameters: nil)

        XCTAssertEqual(record.responseType, .error)
        XCTAssertEqual(record.error, "invalid_grant")
    }

    // MARK: - fetchAccessToken transport error

    func testFetchAccessToken_transportError_rethrows() async {
        let invoker = RecordingInvoker()
        invoker.stubbedTokenResponse = .error(StubError.transport("network down"))
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        do {
            _ = try await bridge.fetchAccessToken(authorizationCode: "abc", additionalParameters: nil)
            XCTFail("expected transport error to rethrow")
        } catch let error as StubError {
            if case let .transport(message) = error {
                XCTAssertEqual(message, "network down")
            } else {
                XCTFail("unexpected StubError variant: \(error)")
            }
        } catch {
            XCTFail("unexpected error type: \(error)")
        }
    }

    // MARK: - additionalParameters forwarding

    func testFetchAccessToken_missingAdditionalParameters_forwardsNil() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedTokenResponse = .successfulToken(try Fixtures.successful(Fixtures.successBearerJSON))
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        _ = try await bridge.fetchAccessToken(authorizationCode: "abc", additionalParameters: nil)

        XCTAssertNil(invoker.fetchAccessTokenCalls.first?.2)
    }

    func testFetchAccessToken_emptyAdditionalParameters_forwardsEmptyMap() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedTokenResponse = .successfulToken(try Fixtures.successful(Fixtures.successBearerJSON))
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        _ = try await bridge.fetchAccessToken(authorizationCode: "abc", additionalParameters: [:])

        XCTAssertEqual(invoker.fetchAccessTokenCalls.first?.2, [:])
    }

    func testFetchAccessToken_populatedAdditionalParameters_forwardsMap() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedTokenResponse = .successfulToken(try Fixtures.successful(Fixtures.successBearerJSON))
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        _ = try await bridge.fetchAccessToken(authorizationCode: "abc", additionalParameters: ["foo": "bar"])

        XCTAssertEqual(invoker.fetchAccessTokenCalls.first?.2, ["foo": "bar"])
    }

    // MARK: - DPoP asymmetry (iOS only)

    func testFetchAccessToken_dpopProviderReturnsNil_invokerReceivesNil() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedTokenResponse = .successfulToken(try Fixtures.successful(Fixtures.successBearerJSON))
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker, dpopProvider: { nil })

        _ = try await bridge.fetchAccessToken(authorizationCode: "abc", additionalParameters: nil)

        XCTAssertNil(invoker.fetchAccessTokenCalls.first?.1, "dpop must be nil when provider returns nil")
    }

    func testFetchAccessToken_dpopProviderReturnsValue_invokerReceivesValue() async throws {
        // Verifies the bounded-config DPoP-forward behavior: when the bridge's
        // dpopProvider returns a non-nil Dpop, the invoker receives that exact
        // Dpop. Dpop is constructed via `HaapiModelFixtures.dpop()`, which uses
        // the SDK's `InternalTestUtility.createDPoP(keyType: .p256)` —
        // simulator-safe, keychain-only.
        let invoker = RecordingInvoker()
        invoker.stubbedTokenResponse = .successfulToken(try Fixtures.successful(Fixtures.successBearerJSON))
        let dpop = try HaapiModelFixtures.dpop()
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker, dpopProvider: { dpop })

        _ = try await bridge.fetchAccessToken(authorizationCode: "abc", additionalParameters: nil)

        let forwardedDpop = try XCTUnwrap(invoker.fetchAccessTokenCalls.first?.1,
                                          "invoker.fetchAccessToken must receive a non-nil Dpop when the provider returns one")
        XCTAssertEqual(forwardedDpop.jwkThumbprint, dpop.jwkThumbprint,
                       "the provider's Dpop must be forwarded unchanged — jwkThumbprint identifies the keypair")
    }

    // MARK: - refreshAccessToken (mirrors fetchAccessToken)

    func testRefreshAccessToken_successBearer_returnsSuccessRecord() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedTokenResponse = .successfulToken(try Fixtures.successful(Fixtures.successBearerJSON))
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        let record = try await bridge.refreshAccessToken(refreshToken: "rt", additionalParameters: nil)

        XCTAssertEqual(invoker.refreshAccessTokenCalls.count, 1)
        XCTAssertEqual(invoker.refreshAccessTokenCalls.first?.0, "rt")
        XCTAssertEqual(record.responseType, .success)
        XCTAssertEqual(record.accessToken, "c2f1bd4c-a1bf-49b8-aa64-1535fa5161a6")
    }

    func testRefreshAccessToken_errorInvalidGrant_returnsErrorRecord() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedTokenResponse = .errorToken(try Fixtures.errored(Fixtures.errorInvalidGrantJSON))
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        let record = try await bridge.refreshAccessToken(refreshToken: "rt", additionalParameters: nil)

        XCTAssertEqual(record.responseType, .error)
        XCTAssertEqual(record.error, "invalid_grant")
    }

    func testRefreshAccessToken_transportError_rethrows() async {
        let invoker = RecordingInvoker()
        invoker.stubbedTokenResponse = .error(StubError.transport("refresh failed"))
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        do {
            _ = try await bridge.refreshAccessToken(refreshToken: "rt", additionalParameters: nil)
            XCTFail("expected rethrow")
        } catch let error as StubError {
            if case let .transport(message) = error {
                XCTAssertEqual(message, "refresh failed")
            } else {
                XCTFail("unexpected StubError variant: \(error)")
            }
        } catch {
            XCTFail("unexpected error type: \(error)")
        }

        XCTAssertEqual(invoker.refreshAccessTokenCalls.count, 1)
        XCTAssertEqual(invoker.refreshAccessTokenCalls.first?.0, "rt")
        XCTAssertNil(invoker.refreshAccessTokenCalls.first?.1)
    }

    // MARK: - revokeAccessToken / revokeRefreshToken

    func testRevokeAccessToken_success_resolves() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedRevocationResponse = .success
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        try await bridge.revokeAccessToken(token: "tok")

        XCTAssertEqual(invoker.revokeAccessTokenCalls, ["tok"])
    }

    func testRevokeAccessToken_error_rethrows() async {
        let invoker = RecordingInvoker()
        invoker.stubbedRevocationResponse = .error(StubError.transport("revoke failed"))
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        do {
            try await bridge.revokeAccessToken(token: "tok")
            XCTFail("expected rethrow")
        } catch let error as StubError {
            if case let .transport(message) = error {
                XCTAssertEqual(message, "revoke failed")
            } else {
                XCTFail("unexpected StubError variant: \(error)")
            }
        } catch {
            XCTFail("unexpected error type: \(error)")
        }

        XCTAssertEqual(invoker.revokeAccessTokenCalls, ["tok"])
    }

    func testRevokeRefreshToken_success_resolves() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedRevocationResponse = .success
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        try await bridge.revokeRefreshToken(token: "tok")

        XCTAssertEqual(invoker.revokeRefreshTokenCalls, ["tok"])
    }

    func testRevokeRefreshToken_error_rethrows() async {
        let invoker = RecordingInvoker()
        invoker.stubbedRevocationResponse = .error(StubError.transport("revoke refresh failed"))
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        do {
            try await bridge.revokeRefreshToken(token: "tok")
            XCTFail("expected rethrow")
        } catch let error as StubError {
            if case let .transport(message) = error {
                XCTAssertEqual(message, "revoke refresh failed")
            } else {
                XCTFail("unexpected StubError variant: \(error)")
            }
        } catch {
            XCTFail("unexpected error type: \(error)")
        }

        XCTAssertEqual(invoker.revokeRefreshTokenCalls, ["tok"])
    }
}
