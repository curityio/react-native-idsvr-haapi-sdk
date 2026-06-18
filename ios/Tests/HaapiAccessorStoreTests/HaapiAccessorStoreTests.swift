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

// MARK: - Mock Accessors
//
// HaapiAccessor / OAuthAccessor are @objc protocols in the native SDK. Mocks
// must inherit NSObject and conform to the protocol. The store never reads
// `haapiManager` / `oAuthTokenManager` itself — flow / OAuth bridges read
// those properties at their own call sites — so trapping in those getters
// is the right failure mode for unit tests of the store.

// `@unchecked Sendable`: HaapiAccessor inherits Sendable from
// HaapiManagerAccessor; Swift 6 then forbids mutable stored properties on
// conforming types. The test counter is single-threaded — manual opt-out is
// the right call here, not adding a lock for test mechanics.

private final class MockHaapiAccessor: NSObject, HaapiAccessor, @unchecked Sendable {
    private(set) var closeCount = 0

    /// Records invocations from `HaapiAccessorStore.clear()`. Overrides the
    /// protocol-extension default that would otherwise forward to
    /// `haapiManager.close()` (and trap, since `haapiManager` traps).
    func close() {
        closeCount += 1
    }

    var haapiManager: HaapiManager {
        fatalError("MockHaapiAccessor.haapiManager is not available in store unit tests.")
    }

    var oAuthTokenManager: OAuthTokenManager {
        fatalError("MockHaapiAccessor.oAuthTokenManager is not available in store unit tests.")
    }
}

private final class MockOAuthAccessor: NSObject, OAuthAccessor, @unchecked Sendable {
    var oAuthTokenManager: OAuthTokenManager {
        fatalError("MockOAuthAccessor.oAuthTokenManager is not available in store unit tests.")
    }
}

/// Mock that re-enters the store from inside `close()` so we can pin the
/// contract: the store's `lock` must be released **before** `close()` runs,
/// otherwise `requireHaapi()` (which acquires the same lock) deadlocks on
/// iOS — `NSLock` is non-reentrant.
///
/// `store` is set after construction so the accessor can be installed via
/// `setHaapi(self)` without a circular initialiser dependency.
private final class ReentrantCloseAccessor: NSObject, HaapiAccessor, @unchecked Sendable {
    private(set) var closeCount = 0
    private(set) var observedRequireError: HaapiAccessorStore.StoreError?
    var store: HaapiAccessorStore?

    func close() {
        closeCount += 1
        guard let store else { return }
        // If `clear()` held `lock` across this call, `requireHaapi()` —
        // which calls `lock.lock()` again on the same thread — would hang
        // because `NSLock` is non-reentrant. With the lock released
        // before `close()` runs, `requireHaapi()` can acquire it cleanly.
        // The store's `current` has also been nulled by then, so the call
        // throws `.notInitialized`.
        do {
            _ = try store.requireHaapi()
        } catch let error as HaapiAccessorStore.StoreError {
            observedRequireError = error
        } catch {
            // ignore — only StoreError is interesting here
        }
    }

    var haapiManager: HaapiManager {
        fatalError("ReentrantCloseAccessor.haapiManager is not available in store unit tests.")
    }
    var oAuthTokenManager: OAuthTokenManager {
        fatalError("ReentrantCloseAccessor.oAuthTokenManager is not available in store unit tests.")
    }
}

// MARK: - Tests

final class HaapiAccessorStoreTests: XCTestCase {

    // MARK: - Happy path

    func testSetHaapiThenRequireHaapiReturnsSameInstance() throws {
        let store = HaapiAccessorStore()
        let accessor = MockHaapiAccessor()

        try store.setHaapi(accessor)

        let retrieved = try store.requireHaapi()
        XCTAssertTrue(retrieved === accessor)
    }

    func testSetOAuthThenRequireOAuthReturnsSameInstance() throws {
        let store = HaapiAccessorStore()
        let accessor = MockOAuthAccessor()

        try store.setOAuth(accessor)

        let retrieved = try store.requireOAuth()
        XCTAssertTrue(retrieved === accessor)
    }

    func testSetHaapiThenRequireOAuthSucceedsBecauseHaapiAccessorIsAnOAuthAccessor() throws {
        let store = HaapiAccessorStore()
        let accessor = MockHaapiAccessor()

        try store.setHaapi(accessor)

        let retrieved = try store.requireOAuth()
        XCTAssertTrue(retrieved === accessor)
    }

    func testSetOAuthThenRequireHaapiThrowsWrongKind() throws {
        let store = HaapiAccessorStore()
        try store.setOAuth(MockOAuthAccessor())

        XCTAssertThrowsError(try store.requireHaapi()) { error in
            XCTAssertEqual(error as? HaapiAccessorStore.StoreError, .wrongKind)
            XCTAssertEqual((error as? HaapiAccessorStore.StoreError)?.code,
                           HaapiAccessorStore.ErrorCode.wrongKind)
        }
    }

    // MARK: - Already-initialized errors

    func testSetHaapiTwiceWithoutClearThrowsAlreadyInitialized() throws {
        let store = HaapiAccessorStore()
        try store.setHaapi(MockHaapiAccessor())

        XCTAssertThrowsError(try store.setHaapi(MockHaapiAccessor())) { error in
            XCTAssertEqual(error as? HaapiAccessorStore.StoreError, .alreadyInitialized)
        }
    }

    func testSetOAuthAfterSetHaapiWithoutClearThrowsAlreadyInitialized() throws {
        let store = HaapiAccessorStore()
        try store.setHaapi(MockHaapiAccessor())

        XCTAssertThrowsError(try store.setOAuth(MockOAuthAccessor())) { error in
            XCTAssertEqual(error as? HaapiAccessorStore.StoreError, .alreadyInitialized)
        }
    }

    func testSetHaapiAfterSetOAuthWithoutClearThrowsAlreadyInitialized() throws {
        let store = HaapiAccessorStore()
        try store.setOAuth(MockOAuthAccessor())

        XCTAssertThrowsError(try store.setHaapi(MockHaapiAccessor())) { error in
            XCTAssertEqual(error as? HaapiAccessorStore.StoreError, .alreadyInitialized)
        }
    }

    // MARK: - Not-initialized errors

    func testRequireHaapiOnEmptyStoreThrowsNotInitialized() {
        let store = HaapiAccessorStore()

        XCTAssertThrowsError(try store.requireHaapi()) { error in
            XCTAssertEqual(error as? HaapiAccessorStore.StoreError, .notInitialized)
        }
    }

    func testRequireOAuthOnEmptyStoreThrowsNotInitialized() {
        let store = HaapiAccessorStore()

        XCTAssertThrowsError(try store.requireOAuth()) { error in
            XCTAssertEqual(error as? HaapiAccessorStore.StoreError, .notInitialized)
        }
    }

    // MARK: - Lifecycle

    func testClearOnEmptyStoreIsNoOp() {
        let store = HaapiAccessorStore()
        store.clear() // must not throw or trap
    }

    func testClearAfterSetHaapiInvokesCloseAndAllowsReinit() throws {
        let store = HaapiAccessorStore()
        let first = MockHaapiAccessor()
        let second = MockHaapiAccessor()

        try store.setHaapi(first)
        store.clear()

        XCTAssertEqual(first.closeCount, 1, "clear() must close the previously-stored HaapiAccessor")

        // Re-init must succeed now that the store is empty.
        try store.setHaapi(second)
        let retrieved = try store.requireHaapi()
        XCTAssertTrue(retrieved === second)
    }

    func testClearAfterSetOAuthDoesNotCloseAnyHaapiAccessor() throws {
        let store = HaapiAccessorStore()
        try store.setOAuth(MockOAuthAccessor())

        store.clear() // must not crash trying to call .close() on an OAuthAccessor
    }

    func testClearLetsTheStoreSwitchModes() throws {
        let store = HaapiAccessorStore()
        try store.setHaapi(MockHaapiAccessor())
        store.clear()

        // Mode switch is permitted only after clear().
        try store.setOAuth(MockOAuthAccessor())
    }

    // MARK: - Lock-release ordering

    /// `clear()` must release the store lock **before** invoking the
    /// stored accessor's `close()`. If the lock is still held, a re-entrant
    /// `requireHaapi()` from inside `close()` deadlocks because `NSLock`
    /// is non-reentrant.
    ///
    /// This test runs `clear()` on a background queue with an
    /// `XCTestExpectation` deadline — a regression manifests as the
    /// expectation timing out instead of hanging the whole test process.
    func testClearWithReentrantCloseCallbackDoesNotDeadlock() throws {
        let store = HaapiAccessorStore()
        let accessor = ReentrantCloseAccessor()
        accessor.store = store
        try store.setHaapi(accessor)

        let expectation = expectation(description: "clear completes without deadlocking")
        DispatchQueue.global().async {
            store.clear()
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)

        XCTAssertEqual(accessor.closeCount, 1,
                       "close() should have been invoked exactly once")
        XCTAssertEqual(accessor.observedRequireError, .notInitialized,
                       "close() callback must observe the store as already cleared")
    }

    // MARK: - Concurrency smoke test

    func testConcurrentSetAndClearDoesNotDeadlockOrCorruptState() {
        let store = HaapiAccessorStore()
        let iterations = 1000

        DispatchQueue.concurrentPerform(iterations: iterations) { i in
            if i.isMultiple(of: 2) {
                // setHaapi may legitimately throw alreadyInitialized in races — that's fine.
                _ = try? store.setHaapi(MockHaapiAccessor())
            } else {
                store.clear()
            }
        }

        // Reaching here without a crash or deadlock is the assertion. Final
        // state must be consistent — either empty or holding one accessor.
        store.clear()

        // Mirrors the Android `HaapiAccessorStoreTest` post-concurrency
        // invariant: after the storm, `requireHaapi()` must either return a
        // valid accessor (no torn state) or throw `notInitialized` (clean
        // empty store). It must never return a stale half-cleared instance
        // and must never throw `wrongKind`. We've just `clear()`ed, so the
        // expected outcome is `notInitialized`.
        XCTAssertThrowsError(try store.requireHaapi()) { error in
            XCTAssertEqual(
                error as? HaapiAccessorStore.StoreError,
                .notInitialized,
                "post-concurrency requireHaapi must throw notInitialized after the final clear()"
            )
        }
    }
}
