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
internal import ExpoModulesCore
@testable import RNIdsvrHaapiSdk

// File delivered alongside the Android `IdsvrHaapiReactNativeSdkModuleTest.kt`
// and mirrors that test in coverage and case order. Since HSRN-23, this file
// runs in the full native iOS test workspace (`npm run test:ios:native`).
//
// SDK type construction strategy:
//   - `HaapiAccessor` / `OAuthAccessor`: implemented by hand-rolled fakes
//     conforming to the `@objc` protocols. The protocols expose
//     `haapiManager` / `oAuthTokenManager` as non-optional getters whose
//     concrete types are `final`, so negative-path tests still use fakes that
//     `fatalError` from those getters; the tests intentionally avoid paths
//     that would read them.
//   - Cases that need a fully-wired bridge use `RealHaapiAccessor` /
//     `RealOAuthAccessor`, which wrap real SDK managers built via
//     `HaapiModelFixtures` and let the production bridge constructors read the
//     accessors without trapping.
//   - The suite therefore covers both categories now: store/error-mapping
//     paths with fakes, and fully wired lifecycle paths with real managers.

// MARK: - Fakes

/// Bare-minimum HaapiAccessor whose manager getters fatalError. Used for
/// tests that assert the bridge throws before the manager is read.
private final class FakeHaapiAccessor: NSObject, HaapiAccessor, @unchecked Sendable {
    var haapiManager: HaapiManager {
        fatalError("FakeHaapiAccessor.haapiManager is not constructible in JVM-equivalent iOS unit tests.")
    }
    var oAuthTokenManager: OAuthTokenManager {
        fatalError("FakeHaapiAccessor.oAuthTokenManager is not constructible in JVM-equivalent iOS unit tests.")
    }

    private(set) var closeCalls = 0
    func close() {
        closeCalls += 1
    }
}

private final class FakeOAuthAccessor: NSObject, OAuthAccessor {
    var oAuthTokenManager: OAuthTokenManager {
        fatalError("FakeOAuthAccessor.oAuthTokenManager is not constructible in JVM-equivalent iOS unit tests.")
    }
}

/// Real accessor returning real `HaapiManager` and `OAuthTokenManager`
/// instances constructed via `HaapiModelFixtures`. Used by the bridge-wired
/// lifecycle tests that need a non-fatal manager getter. The managers'
/// network calls never fire because the lifecycle tests don't drive flow
/// operations — they only exercise init / close / re-init orchestration.
private final class RealHaapiAccessor: NSObject, HaapiAccessor, @unchecked Sendable {
    let _haapiManager: HaapiManager
    let _oAuthTokenManager: OAuthTokenManager
    private(set) var closeCalls = 0

    // `NSObject.init()` is non-throwing, so we can't override it with a
    // throwing init. `try!` is acceptable for test fixtures — a failure to
    // construct the SDK manager from test config is a fatal test setup
    // error, not a meaningful test outcome.
    override init() {
        let config = HaapiModelFixtures.haapiConfiguration()
        self._haapiManager = try! HaapiModelFixtures.haapiManager(configuration: config)
        self._oAuthTokenManager = HaapiModelFixtures.oAuthTokenManager(configuration: config)
        super.init()
    }

    var haapiManager: HaapiManager { _haapiManager }
    var oAuthTokenManager: OAuthTokenManager { _oAuthTokenManager }
    func close() { closeCalls += 1 }
}

private final class RealOAuthAccessor: NSObject, OAuthAccessor, @unchecked Sendable {
    let _oAuthTokenManager: OAuthTokenManager

    override init() {
        self._oAuthTokenManager = HaapiModelFixtures.oAuthTokenManager()
        super.init()
    }

    var oAuthTokenManager: OAuthTokenManager { _oAuthTokenManager }
}

/// An OAuth invoker whose DPoP lookup answers one real `Dpop` and signs with it; the token operations are
/// not exercised where it is used.
private final class SigningInvoker: OAuthTokenInvoker, @unchecked Sendable {
    private let dpop: Dpop
    private let lock = NSLock()
    private var _lookups: [String] = []
    var lookups: [String] { lock.withLock { _lookups } }

    init(dpop: Dpop) {
        self.dpop = dpop
    }

    func fetchAccessToken(authorizationCode: String, dpop: Dpop?, additionalParameters: [String: String]?) async
        -> TokenResponse { .error(StubError.notStubbed) }
    func refreshAccessToken(refreshToken: String, additionalParameters: [String: String]?) async -> TokenResponse {
        .error(StubError.notStubbed)
    }
    func revokeAccessToken(token: String) async -> TokenRevocationResponse { .error(StubError.notStubbed) }
    func revokeRefreshToken(token: String) async -> TokenRevocationResponse { .error(StubError.notStubbed) }

    func dpop(forAccessToken accessToken: String) throws -> Dpop? {
        lock.withLock { _lookups.append(accessToken) }
        return dpop
    }

    func createProof(dpop: Dpop, httpMethod: String, url: URL, nonce: String?, accessToken: String) throws -> String {
        try dpop.createProof(httpMethod: httpMethod, url: url, nonce: nonce, accessToken: accessToken)
    }
}

/// Recording stub for `HaapiAccessorBuilderProvider`. Defaults to throwing
/// the placeholder so happy-path setup is opt-in (mirrors the
/// `RecordingInvoker.stubbedResult` pattern from Step 3 / 4 tests).
private final class RecordingBuilderProvider: HaapiAccessorBuilderProvider, @unchecked Sendable {
    var buildForHaapiCalls = 0
    var buildForOAuthCalls = 0

    var stubbedHaapiAccessor: (any HaapiAccessor)? = nil
    var stubbedOAuthAccessor: (any OAuthAccessor)? = nil
    var stubbedError: Error? = StubError.notStubbed

    /// Fired at the start of `buildForHaapi`, so a test can simulate a rival
    /// initialization claiming the store slot while this build is in flight.
    var onBuildForHaapi: (() -> Void)? = nil

    func buildForHaapi(configuration: RNHaapiConfigurationRecord) async throws -> any HaapiAccessor {
        buildForHaapiCalls += 1
        onBuildForHaapi?()
        if let accessor = stubbedHaapiAccessor { return accessor }
        if let error = stubbedError { throw error }
        throw StubError.notStubbed
    }

    func buildForOAuth(configuration: RNHaapiConfigurationRecord) async throws -> any OAuthAccessor {
        buildForOAuthCalls += 1
        if let accessor = stubbedOAuthAccessor { return accessor }
        if let error = stubbedError { throw error }
        throw StubError.notStubbed
    }
}

private enum StubError: Error {
    case notStubbed
}

// MARK: - Helpers

/// Empty config record — suitable for tests that don't run the production
/// `DefaultHaapiAccessorBuilderProvider` path. The recording stub above
/// ignores the record entirely.
private func makeConfigRecord() -> RNHaapiConfigurationRecord {
    RNHaapiConfigurationRecord()
}

/// As ``makeConfigRecord()``, with the iOS token binding set — the module reads it itself.
private func makeConfigRecord(tokenBinding: RNTokenBindingConfigurationRecord) -> RNHaapiConfigurationRecord {
    var record = RNHaapiConfigurationRecord()
    record.iosConfig.tokenBindingConfiguration = tokenBinding
    return record
}

/// What `iOSTokenBinding({ keyPairType: CryptoKeyType.P256 })` sends.
private func boundTokenBinding() -> RNTokenBindingConfigurationRecord {
    RNTokenBindingConfigurationRecord(kind: .bound, keyPairType: .p256)
}

/// Asserts the thrown error carries a HAAPI bridge code matching `expected`.
private func assertBridgeError(_ error: Error, code expected: String, file: StaticString = #file, line: UInt = #line) {
    if let bridgeError = error as? HaapiAccessorBridgeException {
        XCTAssertEqual(bridgeError.code, expected, file: file, line: line)
    } else {
        XCTFail("Expected HaapiAccessorBridgeException with code \(expected), got \(type(of: error)): \(error)", file: file, line: line)
    }
}

// MARK: - Tests

final class IdsvrHaapiReactNativeSdkModuleTests: XCTestCase {
    private var module: IdsvrHaapiReactNativeSdkModule!
    private var store: HaapiAccessorStore!
    private var builderProvider: RecordingBuilderProvider!

    override func setUp() {
        super.setUp()
        module = IdsvrHaapiReactNativeSdkModule(appContext: AppContext())
        store = HaapiAccessorStore()
        builderProvider = RecordingBuilderProvider()
        module.accessorStore = store
        module.builderProvider = builderProvider
    }

    override func tearDown() {
        module = nil
        store = nil
        builderProvider = nil
        super.tearDown()
    }

    // MARK: § 11.5 — Lifecycle: cases that don't read accessor.haapiManager / oAuthTokenManager.

    // Case 3 — initializeForHaapi twice without close → ALREADY_INITIALIZED.
    // Bypasses the happy-path bridge construction by pre-populating the store.
    func test_initializeForHaapi_whenStoreAlreadyHasHaapi_throwsAlreadyInitialized() async throws {
        try store.setHaapi(FakeHaapiAccessor())
        builderProvider.stubbedHaapiAccessor = FakeHaapiAccessor()

        do {
            try await module.handleInitializeForHaapi(makeConfigRecord())
            XCTFail("Expected ALREADY_INITIALIZED, got success.")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.alreadyInitialized)
        }

        XCTAssertEqual(builderProvider.buildForHaapiCalls, 0,
                       "a rejected re-init must be refused before any native accessor is built")
    }

    // Case 4 — initializeForOAuth twice without close → ALREADY_INITIALIZED.
    func test_initializeForOAuth_whenStoreAlreadyHasOAuth_throwsAlreadyInitialized() async throws {
        try store.setOAuth(FakeOAuthAccessor())
        builderProvider.stubbedOAuthAccessor = FakeOAuthAccessor()

        do {
            try await module.handleInitializeForOAuth(makeConfigRecord())
            XCTFail("Expected ALREADY_INITIALIZED, got success.")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.alreadyInitialized)
        }

        XCTAssertEqual(builderProvider.buildForOAuthCalls, 0,
                       "a rejected re-init must be refused before any native accessor is built")
    }

    // Case 5 — initializeForOAuth after initializeForHaapi without close → ALREADY_INITIALIZED.
    func test_initializeForOAuth_whenStoreHasHaapi_throwsAlreadyInitialized() async throws {
        try store.setHaapi(FakeHaapiAccessor())
        builderProvider.stubbedOAuthAccessor = FakeOAuthAccessor()

        do {
            try await module.handleInitializeForOAuth(makeConfigRecord())
            XCTFail("Expected ALREADY_INITIALIZED, got success.")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.alreadyInitialized)
        }

        XCTAssertEqual(builderProvider.buildForOAuthCalls, 0,
                       "a rejected re-init must be refused before any native accessor is built")
    }

    // Case 6 — initializeForHaapi after initializeForOAuth without close → ALREADY_INITIALIZED.
    func test_initializeForHaapi_whenStoreHasOAuth_throwsAlreadyInitialized() async throws {
        try store.setOAuth(FakeOAuthAccessor())
        builderProvider.stubbedHaapiAccessor = FakeHaapiAccessor()

        do {
            try await module.handleInitializeForHaapi(makeConfigRecord())
            XCTFail("Expected ALREADY_INITIALIZED, got success.")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.alreadyInitialized)
        }

        XCTAssertEqual(builderProvider.buildForHaapiCalls, 0,
                       "a rejected re-init must be refused before any native accessor is built")
    }

    // MARK: - Reservation ordering (HSRN-42)

    /// A failed build must hand the slot back, so the next initialization gets
    /// a clean bridge rather than ALREADY_INITIALIZED against a reservation
    /// nobody owns any more.
    func test_initializeForHaapi_afterBuildFailure_canInitializeAgain() async throws {
        builderProvider.stubbedError = StubError.notStubbed
        do {
            try await module.handleInitializeForHaapi(makeConfigRecord())
            XCTFail("expected the stubbed build failure to propagate")
        } catch {
            // Expected: the *build* failed. The guard is what must stay clean.
        }

        let accessor = RealHaapiAccessor()
        builderProvider.stubbedHaapiAccessor = accessor
        builderProvider.stubbedError = nil

        try await module.handleInitializeForHaapi(makeConfigRecord())

        let held = try store.requireHaapi()
        XCTAssertTrue(held === accessor, "a failed build must not brick the bridge")
    }

    /// The store-rejection rollback still has a job after HSRN-42: a rival
    /// initialization can claim the slot while our build is in flight, and the
    /// accessor we built by then must be closed rather than leaked.
    func test_initializeForHaapi_whenSlotIsClaimedDuringBuild_closesTheLosingAccessor() async throws {
        let store = self.store!
        let losing = FakeHaapiAccessor()
        builderProvider.stubbedHaapiAccessor = losing
        builderProvider.stubbedError = nil
        builderProvider.onBuildForHaapi = {
            // A rival init commits while our build is running: it releases the
            // reservation via clear() and takes the slot for itself.
            store.clear()
            try? store.setHaapi(FakeHaapiAccessor())
        }

        do {
            try await module.handleInitializeForHaapi(makeConfigRecord())
            XCTFail("Expected ALREADY_INITIALIZED, got success.")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.alreadyInitialized)
        }

        XCTAssertEqual(losing.closeCalls, 1,
                       "the accessor built before losing the slot must be closed, not leaked")
    }

    // Case 7 — start before init → NOT_INITIALIZED.
    func test_start_beforeInit_throwsNotInitialized() async throws {
        do {
            _ = try await module.handleStart()
            XCTFail("Expected NOT_INITIALIZED, got success.")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.notInitialized)
        }
    }

    // submitForm before init → NOT_INITIALIZED.
    func test_submitForm_beforeInit_throwsNotInitialized() async throws {
        let formRecord = RNFormActionModelRecord()
        do {
            _ = try await module.handleSubmitForm(formRecord, parameters: [:])
            XCTFail("Expected NOT_INITIALIZED, got success.")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.notInitialized)
        }
    }

    // followLink before init → NOT_INITIALIZED.
    func test_followLink_beforeInit_throwsNotInitialized() async throws {
        let linkRecord = RNLinkRecord()
        do {
            _ = try await module.handleFollowLink(linkRecord)
            XCTFail("Expected NOT_INITIALIZED, got success.")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.notInitialized)
        }
    }

    // Case 8 — start after initializeForOAuth → WRONG_KIND.
    // (Decision #4 — codes are surfaced distinctly, not folded into NOT_INITIALIZED.)
    func test_start_afterOAuthOnlyInit_throwsWrongKind() async throws {
        try store.setOAuth(FakeOAuthAccessor())

        do {
            _ = try await module.handleStart()
            XCTFail("Expected WRONG_KIND, got success.")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.wrongKind)
        }
    }

    // submitForm after initializeForOAuth → WRONG_KIND.
    func test_submitForm_afterOAuthOnlyInit_throwsWrongKind() async throws {
        try store.setOAuth(FakeOAuthAccessor())
        let formRecord = RNFormActionModelRecord()

        do {
            _ = try await module.handleSubmitForm(formRecord, parameters: [:])
            XCTFail("Expected WRONG_KIND, got success.")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.wrongKind)
        }
    }

    // Case 9 — oauthFetchAccessToken before init → NOT_INITIALIZED.
    func test_oauthFetchAccessToken_beforeInit_throwsNotInitialized() async throws {
        do {
            _ = try await module.handleOAuthFetchAccessToken(authorizationCode: "abc", additionalParameters: nil)
            XCTFail("Expected NOT_INITIALIZED, got success.")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.notInitialized)
        }
    }

    // oauthRefreshAccessToken before init → NOT_INITIALIZED.
    func test_oauthRefreshAccessToken_beforeInit_throwsNotInitialized() async throws {
        do {
            _ = try await module.handleOAuthRefreshAccessToken(refreshToken: "rt", additionalParameters: nil)
            XCTFail("Expected NOT_INITIALIZED, got success.")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.notInitialized)
        }
    }

    // oauthRevokeAccessToken before init → NOT_INITIALIZED.
    func test_oauthRevokeAccessToken_beforeInit_throwsNotInitialized() async throws {
        do {
            try await module.handleOAuthRevokeAccessToken(token: "tok")
            XCTFail("Expected NOT_INITIALIZED, got success.")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.notInitialized)
        }
    }

    // oauthCreateDpopProof before init → NOT_INITIALIZED.
    func test_oauthCreateDpopProof_beforeInit_throwsNotInitialized() async throws {
        do {
            _ = try await module.handleOAuthCreateDpopProof(
                accessToken: "at",
                httpMethod: "GET",
                url: "https://api.example.com/orders",
                nonce: nil
            )
            XCTFail("Expected NOT_INITIALIZED, got success.")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.notInitialized)
        }
    }

    // The native lookup itself reads the keychain, which this test bundle has no entitlement for
    // (errSecMissingEntitlement); the E2E `dpop-proof-*` scenarios cover it in the entitled app.
    func test_oauthCreateDpopProof_signsThroughTheOAuthBridge() async throws {
        builderProvider.stubbedOAuthAccessor = RealOAuthAccessor()
        builderProvider.stubbedError = nil
        try await module.handleInitializeForOAuth(makeConfigRecord())
        let invoker = SigningInvoker(dpop: try HaapiModelFixtures.dpop())
        module.oauthTokenManagerBridge = RNOAuthTokenManagerBridge(invoker: invoker, isTokenBound: true)

        let proof = try await module.handleOAuthCreateDpopProof(
            accessToken: "at-1",
            httpMethod: "GET",
            url: "https://api.example.com/orders",
            nonce: nil
        )

        XCTAssertEqual(try XCTUnwrap(proof).split(separator: ".").count, 3, "a compact JWS")
        XCTAssertEqual(invoker.lookups, ["at-1"])
    }

    // The OAuth bridge answers no proof for an accessor without token binding (its own tests); these pin
    // that both init paths hand it the binding the app configured.
    func test_initializeForHaapi_withoutTokenBinding_wiresAnUnboundOAuthBridge() async throws {
        builderProvider.stubbedHaapiAccessor = RealHaapiAccessor()
        builderProvider.stubbedError = nil

        try await module.handleInitializeForHaapi(makeConfigRecord(tokenBinding: RNTokenBindingConfigurationRecord(kind: .unbound)))

        XCTAssertEqual(module.oauthTokenManagerBridge?.isTokenBound, false)
    }

    func test_initializeForHaapi_withTokenBinding_wiresABoundOAuthBridge() async throws {
        builderProvider.stubbedHaapiAccessor = RealHaapiAccessor()
        builderProvider.stubbedError = nil

        try await module.handleInitializeForHaapi(makeConfigRecord(tokenBinding: boundTokenBinding()))

        XCTAssertEqual(module.oauthTokenManagerBridge?.isTokenBound, true)
    }

    func test_initializeForOAuth_withoutTokenBinding_wiresAnUnboundOAuthBridge() async throws {
        builderProvider.stubbedOAuthAccessor = RealOAuthAccessor()
        builderProvider.stubbedError = nil

        try await module.handleInitializeForOAuth(makeConfigRecord(tokenBinding: RNTokenBindingConfigurationRecord(kind: .unbound)))

        XCTAssertEqual(module.oauthTokenManagerBridge?.isTokenBound, false)
    }

    func test_initializeForOAuth_withTokenBinding_wiresABoundOAuthBridge() async throws {
        builderProvider.stubbedOAuthAccessor = RealOAuthAccessor()
        builderProvider.stubbedError = nil

        try await module.handleInitializeForOAuth(makeConfigRecord(tokenBinding: boundTokenBinding()))

        XCTAssertEqual(module.oauthTokenManagerBridge?.isTokenBound, true)
    }

    // The OAuth-only path reads the binding too now, so a binding it can't convert must fail like the HAAPI
    // path: an invalid configuration, nothing built, and the slot free for the next attempt.
    func test_initializeForOAuth_withAnInvalidTokenBinding_failsAndFreesTheSlot() async throws {
        builderProvider.stubbedOAuthAccessor = RealOAuthAccessor()
        builderProvider.stubbedError = nil

        do {
            try await module.handleInitializeForOAuth(makeConfigRecord(tokenBinding: RNTokenBindingConfigurationRecord(kind: .bound)))
            XCTFail("expected HAAPI_INVALID_CONFIGURATION")
        } catch {
            assertBridgeError(error, code: "HAAPI_INVALID_CONFIGURATION")
        }
        XCTAssertEqual(builderProvider.buildForOAuthCalls, 0, "nothing is built for a configuration that is refused")
        XCTAssertNil(module.oauthTokenManagerBridge)

        try await module.handleInitializeForOAuth(makeConfigRecord(tokenBinding: boundTokenBinding()))
        XCTAssertEqual(module.oauthTokenManagerBridge?.isTokenBound, true)
    }

    // oauthRevokeRefreshToken before init → NOT_INITIALIZED.
    func test_oauthRevokeRefreshToken_beforeInit_throwsNotInitialized() async throws {
        do {
            try await module.handleOAuthRevokeRefreshToken(token: "tok")
            XCTFail("Expected NOT_INITIALIZED, got success.")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.notInitialized)
        }
    }

    // Case 10 — close before init → no-op (no throw).
    func test_close_beforeInit_isNoOp() {
        module.handleClose()

        XCTAssertNil(module.haapiManagerBridge)
        XCTAssertNil(module.oauthTokenManagerBridge)
        XCTAssertNoThrow(try store.setOAuth(FakeOAuthAccessor()),
                         "close-before-init must leave the injected store empty and reusable")
    }

    // close after initializeForOAuth (store-only path) → store cleared, no manager close.
    func test_close_afterOAuthOnlyInit_clearsStore() throws {
        let fake = FakeOAuthAccessor()
        try store.setOAuth(fake)

        module.handleClose()

        // Store should now accept a new accessor.
        XCTAssertNoThrow(try store.setOAuth(FakeOAuthAccessor()))
    }

    // close after initializeForHaapi → store cleared, fake.close() invoked once.
    func test_close_afterHaapiInit_clearsStoreAndCallsClose() throws {
        let fake = FakeHaapiAccessor()
        try store.setHaapi(fake)

        module.handleClose()

        XCTAssertEqual(fake.closeCalls, 1)
        XCTAssertNoThrow(try store.setHaapi(FakeHaapiAccessor()))
    }

    // MARK: § 11.5 — Cases needing a fully-wired bridge

    // Case 1 — initializeForHaapi happy. `HaapiModelFixtures` provides a real
    // `HaapiManager` + `OAuthTokenManager` via the SDK's public initializers,
    // wrapped in `RealHaapiAccessor`. The module's
    // `RNHaapiManagerBridge(invoker: DefaultHaapiFlowInvoker(...))` now has a
    // non-fatal getter to read from.
    func test_initializeForHaapi_happy() async throws {
        let accessor = RealHaapiAccessor()
        builderProvider.stubbedHaapiAccessor = accessor
        builderProvider.stubbedError = nil

        try await module.handleInitializeForHaapi(makeConfigRecord())

        XCTAssertEqual(builderProvider.buildForHaapiCalls, 1)
        XCTAssertNotNil(module.haapiManagerBridge, "happy init wires the HAAPI manager bridge")
        XCTAssertNotNil(module.oauthTokenManagerBridge, "happy init wires the OAuth token manager bridge too")
        // Store now holds the accessor — re-init must throw ALREADY_INITIALIZED.
        do {
            try await module.handleInitializeForHaapi(makeConfigRecord())
            XCTFail("expected re-init to throw HAAPI_ACCESSOR_ALREADY_INITIALIZED")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.alreadyInitialized)
        }
        XCTAssertEqual(builderProvider.buildForHaapiCalls, 1,
                       "the rejected re-init must not have built a second accessor")
    }

    // Case 2 — initializeForOAuth happy. The OAuth-only path wires the OAuth
    // bridge but leaves the HAAPI bridge nil. `requireHaapiManagerBridge`
    // calls must subsequently throw HAAPI_ACCESSOR_WRONG_KIND.
    func test_initializeForOAuth_happy() async throws {
        let accessor = RealOAuthAccessor()
        builderProvider.stubbedOAuthAccessor = accessor
        builderProvider.stubbedError = nil

        try await module.handleInitializeForOAuth(makeConfigRecord())

        XCTAssertEqual(builderProvider.buildForOAuthCalls, 1)
        XCTAssertNotNil(module.oauthTokenManagerBridge, "OAuth-only init wires the OAuth bridge")
        XCTAssertNil(module.haapiManagerBridge, "OAuth-only init must NOT wire the HAAPI bridge")
        // HAAPI flow ops on an OAuth-only accessor must throw WRONG_KIND.
        do {
            _ = try await module.handleStart()
            XCTFail("expected handleStart on OAuth-only init to throw HAAPI_ACCESSOR_WRONG_KIND")
        } catch {
            assertBridgeError(error, code: HaapiAccessorStore.ErrorCode.wrongKind)
        }
    }

    // Case 11 — initializeForHaapi → close → initializeForHaapi again. Verifies
    // the strict-reinit contract end-to-end: after close, the store is empty
    // and the bridges are dropped, so a second initializeForHaapi succeeds
    // with a fresh accessor.
    func test_lifecycle_haapiRoundTrip() async throws {
        let firstAccessor = RealHaapiAccessor()
        builderProvider.stubbedHaapiAccessor = firstAccessor
        builderProvider.stubbedError = nil

        try await module.handleInitializeForHaapi(makeConfigRecord())
        XCTAssertNotNil(module.haapiManagerBridge, "first init wires the bridge")
        XCTAssertNotNil(module.oauthTokenManagerBridge)

        module.handleClose()
        XCTAssertEqual(firstAccessor.closeCalls, 1, "close() forwards to accessor.close()")
        XCTAssertNil(module.haapiManagerBridge, "close drops the HAAPI bridge")
        XCTAssertNil(module.oauthTokenManagerBridge, "close drops the OAuth bridge")

        // Fresh accessor for re-init.
        let secondAccessor = RealHaapiAccessor()
        builderProvider.stubbedHaapiAccessor = secondAccessor
        try await module.handleInitializeForHaapi(makeConfigRecord())
        XCTAssertEqual(builderProvider.buildForHaapiCalls, 2, "second init invokes builderProvider again")
        XCTAssertNotNil(module.haapiManagerBridge, "second init re-wires the HAAPI bridge")
    }

    // Case 12 — initializeForOAuth → close → initializeForOAuth again. Mirrors
    // case 11 for the OAuth-only path.
    func test_lifecycle_oauthRoundTrip() async throws {
        let firstAccessor = RealOAuthAccessor()
        builderProvider.stubbedOAuthAccessor = firstAccessor
        builderProvider.stubbedError = nil

        try await module.handleInitializeForOAuth(makeConfigRecord())
        XCTAssertNotNil(module.oauthTokenManagerBridge, "first init wires the OAuth bridge")
        XCTAssertNil(module.haapiManagerBridge, "OAuth-only init must NOT wire the HAAPI bridge")

        module.handleClose()
        XCTAssertNil(module.oauthTokenManagerBridge, "close drops the OAuth bridge")

        // Fresh accessor for re-init.
        let secondAccessor = RealOAuthAccessor()
        builderProvider.stubbedOAuthAccessor = secondAccessor
        try await module.handleInitializeForOAuth(makeConfigRecord())
        XCTAssertEqual(builderProvider.buildForOAuthCalls, 2, "second init invokes builderProvider again")
        XCTAssertNotNil(module.oauthTokenManagerBridge, "second init re-wires the OAuth bridge")
    }
}

// MARK: - Token binding

/// Asserts the code, category and recovery both platforms report for an invalid configuration.
private func assertInvalidConfiguration(
    _ error: Error,
    file: StaticString = #filePath,
    line: UInt = #line
) {
    let normalized = HaapiErrorNormalizer.normalize(error)
    XCTAssertEqual(normalized.code, "HAAPI_INVALID_CONFIGURATION", file: file, line: line)
    let prefix = "HAAPI_ERROR_V1::"
    let text = normalized.description
    guard text.hasPrefix(prefix),
          let data = String(text.dropFirst(prefix.count)).data(using: .utf8),
          let envelope = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    else {
        return XCTFail("Missing or unreadable error envelope: \(text)", file: file, line: line)
    }
    XCTAssertEqual(envelope["category"] as? String, "configuration", file: file, line: line)
    let recovery = envelope["recovery"] as? [String: Any]
    XCTAssertEqual(recovery?["kind"] as? String, "unrecoverable", file: file, line: line)
    XCTAssertEqual(
        (recovery?["action"] as? [String: Any])?["kind"] as? String,
        "modifyConfiguration",
        file: file,
        line: line
    )
}

final class TokenBindingConversionTests: XCTestCase {

    // A configuration built without the factories may still carry the deprecated
    // `tokenBoundConfiguration` ({ keyPairType }). It must stay bound — reading it as "no binding"
    // would silently drop binding the developer asked for.
    func testDeprecatedSettingStaysBoundWithItsKeyType() throws {
        let deprecated = RNTokenBindingConfigurationRecord(kind: nil, keyPairType: .p256)

        let converted = try resolveTokenBinding(nil, deprecated: deprecated)

        XCTAssertTrue(converted is BoundedTokenConfiguration)
        XCTAssertEqual(converted.keyPairType, IdsvrHaapiSdk.CryptoKeyType.p256)
    }

    func testDeprecatedSettingWithoutAKeyTypeBindsWithTheDefaultKeyType() throws {
        let converted = try resolveTokenBinding(nil, deprecated: RNTokenBindingConfigurationRecord())

        XCTAssertTrue(converted is BoundedTokenConfiguration)
        XCTAssertEqual(converted.keyPairType, IdsvrHaapiSdk.CryptoKeyType.secureEnclave)
    }

    func testBothSettingsAtOnceAreAnInvalidConfiguration() throws {
        XCTAssertThrowsError(try resolveTokenBinding(
            RNTokenBindingConfigurationRecord(kind: .unbound),
            deprecated: RNTokenBindingConfigurationRecord(kind: nil, keyPairType: .p256)
        )) { error in
            assertInvalidConfiguration(error)
        }
    }

    func testWithoutTheDeprecatedSettingTheCurrentOneDecides() throws {
        XCTAssertTrue(try resolveTokenBinding(nil, deprecated: nil) is UnboundedTokenConfiguration)
        XCTAssertTrue(try resolveTokenBinding(
            RNTokenBindingConfigurationRecord(kind: .bound, keyPairType: .p256),
            deprecated: nil
        ) is BoundedTokenConfiguration)
    }

    func testBoundRecordConvertsToBindingWithTheChosenKeyType() throws {
        let cases: [(RNCryptoKeyType, IdsvrHaapiSdk.CryptoKeyType)] = [
            (.p256, .p256),
            (.secureEnclave, .secureEnclave),
            (.security, .security),
        ]
        for (recordKeyType, nativeKeyType) in cases {
            let record: RNTokenBindingConfigurationRecord? = RNTokenBindingConfigurationRecord(
                kind: .bound,
                keyPairType: recordKeyType
            )

            let converted = try record.toNativeTokenBinding()

            XCTAssertTrue(converted is BoundedTokenConfiguration, "\(recordKeyType)")
            XCTAssertEqual(converted.keyPairType, nativeKeyType, "\(recordKeyType)")
        }
    }

    func testBoundRecordWithoutAKeyTypeIsAnInvalidConfiguration() throws {
        let record: RNTokenBindingConfigurationRecord? = RNTokenBindingConfigurationRecord(kind: .bound)

        XCTAssertThrowsError(try record.toNativeTokenBinding()) { error in
            assertInvalidConfiguration(error)
        }
    }

    // Binding a developer asked for (a legacy `{ keyPairType }` object) must never silently become
    // "no binding" — a value without a mode is rejected.
    func testRecordWithoutAKindIsAnInvalidConfiguration() throws {
        let record: RNTokenBindingConfigurationRecord? = RNTokenBindingConfigurationRecord(
            kind: nil,
            keyPairType: .secureEnclave
        )

        XCTAssertThrowsError(try record.toNativeTokenBinding()) { error in
            assertInvalidConfiguration(error)
        }
    }

    // No setting at all is the only way "no binding" is read without a mode.
    func testAbsentRecordConvertsToNoTokenBinding() throws {
        let record: RNTokenBindingConfigurationRecord? = nil

        XCTAssertTrue(try record.toNativeTokenBinding() is UnboundedTokenConfiguration)
    }

    // A leftover key type must not turn "no binding" back into binding.
    func testUnboundRecordConvertsToNoTokenBindingEvenWithAKeyType() throws {
        let record: RNTokenBindingConfigurationRecord? = RNTokenBindingConfigurationRecord(
            kind: .unbound,
            keyPairType: .secureEnclave
        )

        XCTAssertTrue(try record.toNativeTokenBinding() is UnboundedTokenConfiguration)
    }

    // The native SDK rejects a DPoP at the token exchange under `UnboundedTokenConfiguration`,
    // and the HAAPI flow always holds one — so it must be withheld when binding is off.
    func testTokenExchangeGetsNoDpopWhenBindingIsOff() throws {
        let dpop = try HaapiModelFixtures.dpop()

        let provider = tokenExchangeDpopProvider(for: UnboundedTokenConfiguration(), dpop: { dpop })

        XCTAssertNil(provider())
    }

    func testTokenExchangeGetsTheHaapiDpopWhenBindingIsOn() throws {
        let dpop = try HaapiModelFixtures.dpop()

        let provider = tokenExchangeDpopProvider(
            for: BoundedTokenConfiguration(keyPairType: IdsvrHaapiSdk.CryptoKeyType.p256),
            dpop: { dpop }
        )

        XCTAssertTrue(provider() === dpop)
    }

    // Only the configuration known to bind lets the OAuth bridge make proofs, so one the native SDK adds
    // later fails closed.
    func testOnlyABoundConfigurationBindsTokens() {
        XCTAssertTrue(bindsTokens(BoundedTokenConfiguration(keyPairType: IdsvrHaapiSdk.CryptoKeyType.p256)))
        XCTAssertFalse(bindsTokens(UnboundedTokenConfiguration()))
        XCTAssertFalse(bindsTokens(AnotherTokenBinding()))
    }
}

/// A binding neither of the two the native SDK ships today.
private final class AnotherTokenBinding: NSObject, TokenBoundConfiguration, @unchecked Sendable {
    let keyPairType: IdsvrHaapiSdk.CryptoKeyType = .secureEnclave
}

// MARK: - Client authentication

/// iOS already reports every incomplete client-authentication configuration as an invalid
/// configuration; these pin that contract, which Android now matches.
final class ClientAuthenticationConversionTests: XCTestCase {
    private let registryWithoutBundles = NativeRegistry()

    private func record(
        _ kind: ClientAuthenticationKind,
        _ configure: (inout ClientAuthenticationMethodConfigurationRecord) -> Void = { _ in }
    ) -> ClientAuthenticationMethodConfigurationRecord {
        var record = ClientAuthenticationMethodConfigurationRecord()
        record.kind = kind
        configure(&record)
        return record
    }

    private func assertRejected(
        _ record: ClientAuthenticationMethodConfigurationRecord,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertThrowsError(try record.toAuthMethod(registryWithoutBundles), file: file, line: line) { error in
            assertInvalidConfiguration(error, file: file, line: line)
        }
    }

    func testSecretWithoutASecretIsAnInvalidConfiguration() {
        assertRejected(record(.secret))
    }

    func testMtlsWithAMissingFieldOrUnresolvableBundleIsAnInvalidConfiguration() {
        let complete: (inout ClientAuthenticationMethodConfigurationRecord) -> Void = {
            $0.pkcs12Filename = "client"
            $0.pkcs12Passphrase = "passphrase"
            $0.serverPEMFilename = "server"
            $0.bundleOption = .custom
        }
        assertRejected(record(.mtls) { complete(&$0); $0.pkcs12Filename = nil })
        assertRejected(record(.mtls) { complete(&$0); $0.pkcs12Passphrase = nil })
        assertRejected(record(.mtls) { complete(&$0); $0.serverPEMFilename = nil })
        // `.custom` has no bundle registered in this registry.
        assertRejected(record(.mtls) { complete(&$0) })
    }

    func testMtlsKeyPinningWithAMissingFieldOrUnresolvableBundleIsAnInvalidConfiguration() {
        let complete: (inout ClientAuthenticationMethodConfigurationRecord) -> Void = {
            $0.pkcs12Filename = "client"
            $0.pkcs12Passphrase = "passphrase"
            $0.serverKeyPinnings = []
            $0.bundleOption = .custom
        }
        assertRejected(record(.mtlsKeyPinning) { complete(&$0); $0.pkcs12Filename = nil })
        assertRejected(record(.mtlsKeyPinning) { complete(&$0); $0.pkcs12Passphrase = nil })
        assertRejected(record(.mtlsKeyPinning) { complete(&$0); $0.serverKeyPinnings = nil })
        assertRejected(record(.mtlsKeyPinning) { complete(&$0) })
    }

    func testJwtAsymmetricWithAMissingFieldOrUnresolvableBundleIsAnInvalidConfiguration() {
        let complete: (inout ClientAuthenticationMethodConfigurationRecord) -> Void = {
            $0.pemFilename = "client-key"
            $0.asymmetricAlgorithm = .es256
            $0.bundleOption = .custom
        }
        assertRejected(record(.jwtAsymmetric) { complete(&$0); $0.pemFilename = nil })
        assertRejected(record(.jwtAsymmetric) { complete(&$0); $0.asymmetricAlgorithm = nil })
        assertRejected(record(.jwtAsymmetric) { complete(&$0) })
    }

    func testJwtSymmetricWithAMissingFieldIsAnInvalidConfiguration() {
        let complete: (inout ClientAuthenticationMethodConfigurationRecord) -> Void = {
            $0.symmetricAlgorithm = .hs256
            $0.secretKey = "secret-key"
        }
        assertRejected(record(.jwtSymmetric) { complete(&$0); $0.symmetricAlgorithm = nil })
        assertRejected(record(.jwtSymmetric) { complete(&$0); $0.secretKey = nil })
    }

    // Regression pins: complete configurations still convert.
    func testCompleteConfigurationsStillConvert() throws {
        XCTAssertTrue(try record(.none).toAuthMethod(registryWithoutBundles) is ClientAuthenticationMethodNone)
        XCTAssertTrue(
            try record(.secret) { $0.secret = "s" }.toAuthMethod(registryWithoutBundles)
                is ClientAuthenticationMethodSecret
        )
        XCTAssertTrue(
            try record(.jwtSymmetric) { $0.symmetricAlgorithm = .hs256; $0.secretKey = "k" }
                .toAuthMethod(registryWithoutBundles) is ClientAuthenticationMethodJWTSymmetric
        )
    }
}
