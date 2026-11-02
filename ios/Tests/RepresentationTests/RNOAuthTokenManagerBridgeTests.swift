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
import CryptoKit
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

    // DPoP: the bridge actor's `await` releases its executor, so concurrent calls reach this double at once —
    // the fields they mutate are locked.
    private let lock = NSLock()
    private var _dpopCalls: [String] = []
    private var _createProofCalls: [(httpMethod: String, url: URL, nonce: String?, accessToken: String)] = []
    var stubbedDpop: Dpop?
    var stubbedLookupError: Error?
    var stubbedSigningError: Error?

    var dpopCalls: [String] { lock.withLock { _dpopCalls } }
    var createProofCalls: [(httpMethod: String, url: URL, nonce: String?, accessToken: String)] {
        lock.withLock { _createProofCalls }
    }

    func dpop(forAccessToken accessToken: String) throws -> Dpop? {
        lock.withLock { _dpopCalls.append(accessToken) }
        if let error = stubbedLookupError { throw error }
        return stubbedDpop
    }

    /// Signs with the real `Dpop` unless a failure is stubbed — the native SDK offers no way to make a
    /// release-build `Dpop` fail.
    func createProof(dpop: Dpop, httpMethod: String, url: URL, nonce: String?, accessToken: String) throws -> String {
        lock.withLock { _createProofCalls.append((httpMethod, url, nonce, accessToken)) }
        if let error = stubbedSigningError { throw error }
        return try dpop.createProof(httpMethod: httpMethod, url: url, nonce: nonce, accessToken: accessToken)
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

// MARK: - createDpopProof

final class RNOAuthTokenManagerBridgeDpopProofTests: XCTestCase {
    private let accessToken = "eyJhbGciOiJFUzI1NiJ9.a-bound-access-token.sig"
    private let url = "https://api.example.com/orders?page=2#top"

    func testCreateDpopProof_signsWithTheKeyTheAccessTokenIsBoundTo() async throws {
        let dpop = try HaapiModelFixtures.dpop()
        let invoker = RecordingInvoker()
        invoker.stubbedDpop = dpop
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker, isTokenBound: true)

        let proof = try await bridge.createDpopProof(accessToken: accessToken, httpMethod: "GET", url: url, nonce: nil)

        let jws = try XCTUnwrap(proof)
        let header = try part(jws, 0)
        XCTAssertEqual(header["typ"] as? String, "dpop+jwt")
        XCTAssertEqual(header["alg"] as? String, "ES256")
        let jwk = try XCTUnwrap(header["jwk"] as? [String: Any])
        XCTAssertEqual(try thumbprint(of: jwk), dpop.jwkThumbprint, "the proof carries the key the token is bound to")
        XCTAssertTrue(try signatureVerifies(jws, with: jwk), "and is signed by it")
        XCTAssertEqual(invoker.dpopCalls, [accessToken])
    }

    func testCreateDpopProof_bindsTheRequestAndTheAccessToken() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedDpop = try HaapiModelFixtures.dpop()
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker, isTokenBound: true)

        let proof = try await bridge.createDpopProof(accessToken: accessToken, httpMethod: "GET", url: url, nonce: nil)

        let claims = try part(try XCTUnwrap(proof), 1)
        XCTAssertEqual(claims["htm"] as? String, "GET")
        XCTAssertEqual(claims["htu"] as? String, "https://api.example.com/orders", "query and fragment are not bound")
        XCTAssertEqual(claims["ath"] as? String, base64Url(Data(SHA256.hash(data: Data(accessToken.utf8)))))
        XCTAssertNil(claims["nonce"], "no nonce was passed")
        XCTAssertNotNil(claims["jti"])
    }

    // A resource server's own nonce: the proof carries exactly the one the app was given.
    func testCreateDpopProof_carriesTheResourceServerNonceItIsGiven() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedDpop = try HaapiModelFixtures.dpop()
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker, isTokenBound: true)

        let proof = try await bridge.createDpopProof(
            accessToken: accessToken,
            httpMethod: "GET",
            url: url,
            nonce: "eyJ7S_zG.rs-nonce-1"
        )

        XCTAssertEqual(try part(try XCTUnwrap(proof), 1)["nonce"] as? String, "eyJ7S_zG.rs-nonce-1")
    }

    func testCreateDpopProof_isFreshOnEveryCallAlsoWhenConcurrent() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedDpop = try HaapiModelFixtures.dpop()
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker, isTokenBound: true)
        let token = accessToken
        let target = url

        let first = try await bridge.createDpopProof(accessToken: token, httpMethod: "GET", url: target, nonce: nil)
        let second = try await bridge.createDpopProof(accessToken: token, httpMethod: "GET", url: target, nonce: nil)
        async let third = bridge.createDpopProof(accessToken: token, httpMethod: "GET", url: target, nonce: nil)
        async let fourth = bridge.createDpopProof(accessToken: token, httpMethod: "GET", url: target, nonce: nil)
        let proofs = [first, second, try await third, try await fourth]

        let identifiers = try proofs.map { try part(try XCTUnwrap($0), 1)["jti"] as? String }
        XCTAssertEqual(Set(identifiers.compactMap { $0 }).count, 4, "every proof has its own jti")
    }

    func testCreateDpopProof_isNilWhenNoKeyIsBoundToTheToken() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedDpop = nil
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker, isTokenBound: true)

        let proof = try await bridge.createDpopProof(accessToken: accessToken, httpMethod: "GET", url: url, nonce: nil)

        XCTAssertNil(proof)
        XCTAssertEqual(invoker.dpopCalls, [accessToken])
        XCTAssertTrue(invoker.createProofCalls.isEmpty, "nothing is signed without a key")
    }

    // The native SDK still answers a token minted while bound after the app re-initializes without binding;
    // Android answers nothing then, so the bridge decides from the accessor's own binding.
    func testCreateDpopProof_isNilForAnAccessorWithoutTokenBinding() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedDpop = try HaapiModelFixtures.dpop()
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker, isTokenBound: false)

        let proof = try await bridge.createDpopProof(accessToken: accessToken, httpMethod: "GET", url: url, nonce: nil)

        XCTAssertNil(proof)
        XCTAssertTrue(invoker.dpopCalls.isEmpty, "the key store is not read")
        XCTAssertTrue(invoker.createProofCalls.isEmpty)
    }

    // The gate fails closed: a construction site that doesn't state the accessor's binding signs nothing.
    func testCreateDpopProof_isNilWhenTheBridgeIsNotToldTheAccessorBindsTokens() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedDpop = try HaapiModelFixtures.dpop()
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker)

        let proof = try await bridge.createDpopProof(accessToken: accessToken, httpMethod: "GET", url: url, nonce: nil)

        XCTAssertNil(proof)
        XCTAssertTrue(invoker.dpopCalls.isEmpty, "the key store is not read")
    }

    // MARK: Failures

    // TypeScript refuses such a URL first; the bridge re-checks, so nothing can reach signing with a URL it
    // can't use. Same inputs and descriptions as the Android bridge test.
    func testCreateDpopProof_refusesAURLItCannotUseBeforeAnyLookup() async throws {
        let notAbsolute = "url must be an absolute http or https URL."
        let credentials = "url must not carry user credentials."
        let unusableURLs = [
            ("http://[::1", notAbsolute),
            ("https:/orders", notAbsolute),
            ("ftp://api.example.com/orders", notAbsolute),
            ("https://:8443/x", notAbsolute),
            ("https://u:p@h/x", credentials),
            ("https://u@h/x", credentials)
        ]
        for (unusable, description) in unusableURLs {
            let invoker = RecordingInvoker()
            invoker.stubbedDpop = try HaapiModelFixtures.dpop()
            let bridge = RNOAuthTokenManagerBridge(invoker: invoker, isTokenBound: true)

            do {
                _ = try await bridge.createDpopProof(accessToken: accessToken, httpMethod: "GET", url: unusable, nonce: nil)
                XCTFail("expected \(unusable) to be refused")
            } catch {
                let envelope = try envelope(of: error)
                XCTAssertEqual(envelope["code"] as? String, "HAAPI_INVALID_ARGUMENT", unusable)
                XCTAssertEqual(envelope["errorDescription"] as? String, description, unusable)
            }
            XCTAssertTrue(invoker.dpopCalls.isEmpty, "\(unusable): the key store is not read")
        }
    }

    func testCreateDpopProof_lockedKeychainIsStorageUnavailable() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedLookupError = HaapiError.dpopProofFailure(
            message: "Unable to load the DPoP for the access token",
            cause: StorageError.readError(
                cause: StorageError.unavailable(operation: .read, category: .cryptographicKey, code: -25308)
            )
        )

        let envelope = try await failureEnvelope(from: invoker)

        XCTAssertEqual(envelope["code"] as? String, "HAAPI_STORAGE_UNAVAILABLE")
        XCTAssertEqual(envelope["category"] as? String, "haapi")
        let recovery = try XCTUnwrap(envelope["recovery"] as? [String: Any])
        XCTAssertEqual(recovery["kind"] as? String, "retryable")
        XCTAssertEqual(recovery["condition"] as? String, "whenAppInForeground")
    }

    func testCreateDpopProof_unreadableKeyIsDpopProofFailure() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedLookupError = HaapiError.dpopProofFailure(
            message: "Unable to load the DPoP for the access token",
            cause: StorageError.readError(cause: NSError(domain: NSOSStatusErrorDomain, code: -26276))
        )

        let envelope = try await failureEnvelope(from: invoker)

        XCTAssertEqual(envelope["code"] as? String, "HAAPI_DPOP_PROOF_FAILURE")
        XCTAssertEqual(envelope["category"] as? String, "dpop")
        try assertModifyConfiguration(envelope)
    }

    func testCreateDpopProof_signingFailureIsDpopProofCreationFailure() async throws {
        let invoker = RecordingInvoker()
        invoker.stubbedDpop = try HaapiModelFixtures.dpop()
        // Stands in for the SDK's internal `CryptoError`, which `Dpop.createProof` throws as it is.
        invoker.stubbedSigningError = NSError(domain: "CryptoKit.CryptoKitError", code: 3)

        let envelope = try await failureEnvelope(from: invoker)

        XCTAssertEqual(envelope["code"] as? String, "HAAPI_DPOP_PROOF_CREATION_FAILURE")
        XCTAssertEqual(envelope["category"] as? String, "dpop")
        try assertModifyConfiguration(envelope)
    }

    // MARK: Helpers

    /// Calls the bridge with a token, URL and nonce, normalizes what it throws as the module does, and checks
    /// that none of the three reaches the envelope.
    private func failureEnvelope(
        from invoker: RecordingInvoker,
        file: StaticString = #filePath,
        line: UInt = #line
    ) async throws -> [String: Any] {
        let bridge = RNOAuthTokenManagerBridge(invoker: invoker, isTokenBound: true)
        let nonce = "a-resource-server-nonce"
        let thrown: Error
        do {
            _ = try await bridge.createDpopProof(accessToken: accessToken, httpMethod: "GET", url: url, nonce: nonce)
            XCTFail("expected the call to fail", file: file, line: line)
            return [:]
        } catch {
            thrown = error
        }
        let text = HaapiErrorNormalizer.normalize(thrown).description
        for secret in [accessToken, url, "api.example.com", nonce] {
            XCTAssertFalse(text.contains(secret), "the envelope must not carry \(secret)", file: file, line: line)
        }
        return try envelope(of: thrown, file: file, line: line)
    }

    /// The envelope JS receives for `error`, as the module normalizes it.
    private func envelope(of error: Error, file: StaticString = #filePath, line: UInt = #line) throws -> [String: Any] {
        let text = HaapiErrorNormalizer.normalize(error).description
        let prefix = "HAAPI_ERROR_V1::"
        XCTAssertTrue(text.hasPrefix(prefix), file: file, line: line)
        let data = try XCTUnwrap(String(text.dropFirst(prefix.count)).data(using: .utf8))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    private func assertModifyConfiguration(_ envelope: [String: Any], file: StaticString = #filePath, line: UInt = #line)
        throws {
        let recovery = try XCTUnwrap(envelope["recovery"] as? [String: Any], file: file, line: line)
        XCTAssertEqual(recovery["kind"] as? String, "unrecoverable", file: file, line: line)
        let action = try XCTUnwrap(recovery["action"] as? [String: Any], file: file, line: line)
        XCTAssertEqual(action["kind"] as? String, "modifyConfiguration", file: file, line: line)
    }

    private func part(_ jws: String, _ index: Int) throws -> [String: Any] {
        let segment = jws.split(separator: ".", omittingEmptySubsequences: false)[index]
        let data = try XCTUnwrap(base64UrlDecode(String(segment)))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    /// RFC 7638 thumbprint of an EC JWK: SHA-256 over its required members in lexicographic order.
    private func thumbprint(of jwk: [String: Any]) throws -> String {
        let crv = try XCTUnwrap(jwk["crv"] as? String)
        let x = try XCTUnwrap(jwk["x"] as? String)
        let y = try XCTUnwrap(jwk["y"] as? String)
        let canonical = "{\"crv\":\"\(crv)\",\"kty\":\"EC\",\"x\":\"\(x)\",\"y\":\"\(y)\"}"
        return base64Url(Data(SHA256.hash(data: Data(canonical.utf8))))
    }

    private func signatureVerifies(_ jws: String, with jwk: [String: Any]) throws -> Bool {
        let parts = jws.split(separator: ".", omittingEmptySubsequences: false).map(String.init)
        let x = try XCTUnwrap(base64UrlDecode(try XCTUnwrap(jwk["x"] as? String)))
        let y = try XCTUnwrap(base64UrlDecode(try XCTUnwrap(jwk["y"] as? String)))
        let publicKey = try P256.Signing.PublicKey(rawRepresentation: x + y)
        let signature = try P256.Signing.ECDSASignature(rawRepresentation: try XCTUnwrap(base64UrlDecode(parts[2])))
        return publicKey.isValidSignature(signature, for: Data("\(parts[0]).\(parts[1])".utf8))
    }

    private func base64Url(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func base64UrlDecode(_ value: String) -> Data? {
        var base64 = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 { base64 += "=" }
        return Data(base64Encoded: base64)
    }
}
