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

/// Recording stub for `HaapiAccessorBuilderProvider`. Defaults to throwing
/// the placeholder so happy-path setup is opt-in (mirrors the
/// `RecordingInvoker.stubbedResult` pattern from Step 3 / 4 tests).
private final class RecordingBuilderProvider: HaapiAccessorBuilderProvider, @unchecked Sendable {
    var buildForHaapiCalls = 0
    var buildForOAuthCalls = 0

    var stubbedHaapiAccessor: (any HaapiAccessor)? = nil
    var stubbedOAuthAccessor: (any OAuthAccessor)? = nil
    var stubbedError: Error? = StubError.notStubbed

    func buildForHaapi(configuration: RNHaapiConfigurationRecord) async throws -> any HaapiAccessor {
        buildForHaapiCalls += 1
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
