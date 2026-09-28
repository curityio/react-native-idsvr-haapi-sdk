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

// File delivered alongside the Android `RNHaapiManagerBridgeTest.kt` and
// mirrors that test in coverage and case order. Since HSRN-23, this file runs
// in the full native iOS test workspace (`npm run test:ios:native`).
//
// The Android test uses MockK to stand in for SDK types whose constructors
// are `internal` (FormActionModel, Link, HaapiResponse). On iOS the SDK
// types are `final` Swift classes — also not subclassable — so this file
// uses hand-rolled stubs and the public `HaapiResult.error(_:)` enum case
// where it can. The cache-population tests need real `FormActionModel` /
// `Link` instances, which now come from `HaapiModelFixtures` via Codable JSON
// decoding against the SDK's public models. No extra mocking framework is
// needed on iOS.

// MARK: - Stubs (our own interfaces — hand-rolled, no mocking lib required)

private final class RecordingMapping: HaapiResponseMapping, @unchecked Sendable {
    var collectedFormActionModels: [FormActionModel] = []
    var collectedLinks: [Link] = []

    var convertedResults: [HaapiResult] = []
    var stubbedRecord = RNHaapiResponseRecord()
    /// When set, `convert` throws this error instead of returning `stubbedRecord`.
    /// Mirrors the production contract where `HaapiResult.error(_)` is
    /// rethrown by the real mapper.
    var stubbedThrow: Error?

    func convert(_ result: HaapiResult) throws -> RNHaapiResponseRecord {
        convertedResults.append(result)
        if let stubbedThrow {
            throw stubbedThrow
        }
        return stubbedRecord
    }
}

private final class RecordingInvoker: HaapiFlowInvoker, @unchecked Sendable {
    // These methods run OFF the bridge actor: `RNHaapiManagerBridge.start()`
    // (and submitForm/followLink) suspend at `await invoker.<method>()`, which
    // releases the actor's executor, so these non-isolated async bodies run on
    // the concurrent cooperative pool. Under the concurrent-start test that
    // means many bodies execute on different threads at once — so every
    // mutation must be serialised by hand. That hand-serialisation is exactly
    // the promise `@unchecked Sendable` makes; the lock below honours it.
    // (Actor isolation of the bridge does NOT cover state owned by this
    // injected invoker.)
    private let lock = NSLock()
    private var _startCalls = 0
    private var _submitFormCalls: [(FormActionModel, [String: any Sendable])] = []
    private var _followLinkCalls: [Link] = []
    private var _stubbedResult: HaapiResult = .error(StubError.placeholder)

    var startCalls: Int { lock.withLock { _startCalls } }
    var submitFormCalls: [(FormActionModel, [String: any Sendable])] { lock.withLock { _submitFormCalls } }
    var followLinkCalls: [Link] { lock.withLock { _followLinkCalls } }

    /// Defaults to `.error(...)` so happy-path stubs never need to construct
    /// a real `HaapiRepresentation` or `ProblemRepresentation`. Tests that
    /// care about a specific `HaapiResult` (or a real flow representation)
    /// override this — see HSRN-23 follow-up.
    var stubbedResult: HaapiResult {
        get { lock.withLock { _stubbedResult } }
        set { lock.withLock { _stubbedResult = newValue } }
    }

    func start() async -> HaapiResult {
        lock.withLock {
            _startCalls += 1
            return _stubbedResult
        }
    }

    func submitForm(_ form: FormActionModel, parameters: [String: any Sendable]) async -> HaapiResult {
        lock.withLock {
            _submitFormCalls.append((form, parameters))
            return _stubbedResult
        }
    }

    func followLink(_ link: Link) async -> HaapiResult {
        lock.withLock {
            _followLinkCalls.append(link)
            return _stubbedResult
        }
    }
}

private enum StubError: Error, Equatable {
    case placeholder
}

// MARK: - Tests

final class RNHaapiManagerBridgeTests: XCTestCase {

    // MARK: - start

    func testStartCallsInvokerAndConvertsResult() async throws {
        // Default `invoker.stubbedResult = .error(StubError.placeholder)` is fine
        // here: the mapping's `stubbedThrow` is nil so convert() returns the
        // stubbed record regardless of the result variant. The contract we
        // assert: bridge.start() forwards to invoker exactly once, hands the
        // returned result to the mapper exactly once, and returns a record
        // sourced from the mapper (not synthesized). RNHaapiResponseRecord is
        // a value type so identity (`===`) doesn't apply; we discriminate by
        // setting a sentinel on the mapper's stubbedRecord before the call
        // and reading it back from the returned record.
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        mapping.stubbedRecord.responseCategory = .problem
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        let result = try await bridge.start()

        XCTAssertEqual(invoker.startCalls, 1, "bridge.start() must call invoker.start() exactly once")
        XCTAssertEqual(mapping.convertedResults.count, 1, "invoker's result must reach the mapper exactly once")
        XCTAssertEqual(result.responseCategory, .problem, "bridge.start() must return the mapper's converted record (sentinel field preserved — default is .representation, sentinel is .problem)")
    }

    func testStartPopulatesCacheFromMapperCollectedFields() async throws {
        // The bridge's `processResult` snapshot reads
        // `mapper.collectedFormActionModels` / `.collectedLinks` after every
        // convert. Tests pre-populate these collections with real
        // FormActionModel / Link instances (via Codable JSON fixtures); after
        // bridge.start() runs, the bridge's private cache must reflect them
        // by value.
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let loginAction = try HaapiModelFixtures.formActionModel(href: "/login", method: "POST")
        let cancelAction = try HaapiModelFixtures.formActionModel(href: "/cancel", method: "POST")
        let helpLink = try HaapiModelFixtures.link(href: "/help", rel: "help")
        mapping.collectedFormActionModels = [loginAction, cancelAction]
        mapping.collectedLinks = [helpLink]
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        _ = try await bridge.start()

        let cachedActions = await bridge.lastFormActionModels
        let cachedLinks = await bridge.lastLinks
        XCTAssertEqual(cachedActions.count, 2, "bridge must snapshot both form actions from the mapper")
        XCTAssertEqual(cachedActions.map(\.href), ["/login", "/cancel"])
        XCTAssertEqual(cachedActions.map(\.method), ["POST", "POST"])
        XCTAssertEqual(cachedLinks.count, 1)
        XCTAssertEqual(cachedLinks.first?.href, "/help")
        XCTAssertEqual(cachedLinks.first?.rel, "help")
    }

    func testStartRethrowsNativeError() async {
        // iOS `HaapiManager.start()` is non-throwing and surfaces errors as
        // `HaapiResult.error(Error)`. The mapper unpacks the wrapped error
        // and rethrows so the bridge surfaces a typed `HaapiError` to JS via
        // `HaapiErrorNormalizer.normalize(...)`.
        //
        // `RecordingMapping.stubbedThrow` mirrors the production mapper's
        // rethrow path; the bridge must propagate that throw unchanged.
        let invoker = RecordingInvoker()
        invoker.stubbedResult = .error(StubError.placeholder)
        let mapping = RecordingMapping()
        mapping.stubbedThrow = StubError.placeholder
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        do {
            _ = try await bridge.start()
            XCTFail("expected bridge.start() to rethrow the wrapped error")
        } catch let error as StubError {
            XCTAssertEqual(error, .placeholder)
        } catch {
            XCTFail("unexpected error type: \(error)")
        }
        XCTAssertEqual(mapping.convertedResults.count, 1,
                       "mapper still observes the .error result before rethrowing")
    }

    // MARK: - submitForm

    func testSubmitFormWithCachedActionForwardsToInvoker() async throws {
        // Happy path: cache hit on href + method, real cached model
        // forwarded to invoker, parameters passed through unchanged. The
        // bridge MUST forward the *cached* FormActionModel (not a synthesized
        // one), so the native SDK gets the exact instance it created.
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let cachedAction = try HaapiModelFixtures.formActionModel(href: "/submit", method: "POST")
        mapping.collectedFormActionModels = [cachedAction]
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)
        _ = try await bridge.start() // populates cache from mapper

        let record = RNFormActionModelRecord()
        record.href = "/submit"
        record.method = "POST"
        _ = try await bridge.submitForm(record, parameters: ["username": "alice", "scope": "openid"])

        XCTAssertEqual(invoker.submitFormCalls.count, 1, "invoker.submitForm must be called once on cache hit")
        let (forwardedAction, forwardedParams) = try XCTUnwrap(invoker.submitFormCalls.first)
        XCTAssertEqual(forwardedAction, cachedAction, "the cached FormActionModel instance must be forwarded to the invoker")
        XCTAssertEqual(forwardedParams as? [String: String], ["username": "alice", "scope": "openid"])
    }

    func testSubmitFormForwardsHeterogeneousParameterValueTypes() async throws {
        // The bridge's `parameters` type is `[String: any Sendable]` to match the
        // native SDK and the JSON-serialisable values the JS host is allowed to
        // pass (see `HaapiManager.submitForm` in src/haapi-manager.ts). This test
        // pushes one value of every supported JSON type through the bridge and
        // asserts each is forwarded with its concrete type and value intact —
        // no flattening to strings, no dropped nested structure.
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let cachedAction = try HaapiModelFixtures.formActionModel(href: "/submit", method: "POST")
        mapping.collectedFormActionModels = [cachedAction]
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)
        _ = try await bridge.start()

        let record = RNFormActionModelRecord()
        record.href = "/submit"
        record.method = "POST"

        let parameters: [String: any Sendable] = [
            "stringValue": "alice",
            "intValue": 42,
            "doubleValue": 3.14,
            "boolValue": true,
            "arrayValue": ["a", "b", "c"],
            "nestedObjectValue": ["nestedKey": "nestedVal", "nestedCount": 7] as [String: any Sendable],
        ]
        _ = try await bridge.submitForm(record, parameters: parameters)

        let (_, forwardedParams) = try XCTUnwrap(invoker.submitFormCalls.first)
        XCTAssertEqual(forwardedParams.count, parameters.count,
                       "every key must be forwarded — no entries silently dropped")
        XCTAssertEqual(forwardedParams["stringValue"] as? String, "alice")
        XCTAssertEqual(forwardedParams["intValue"] as? Int, 42)
        XCTAssertEqual(forwardedParams["doubleValue"] as? Double, 3.14)
        XCTAssertEqual(forwardedParams["boolValue"] as? Bool, true)
        XCTAssertEqual(forwardedParams["arrayValue"] as? [String], ["a", "b", "c"])
        let nested = try XCTUnwrap(forwardedParams["nestedObjectValue"] as? [String: any Sendable])
        XCTAssertEqual(nested["nestedKey"] as? String, "nestedVal")
        XCTAssertEqual(nested["nestedCount"] as? Int, 7)
    }

    func testSubmitFormWithUnknownActionThrowsWithoutCallingInvoker() async {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        let record = RNFormActionModelRecord()
        record.href = "/unknown"
        record.method = "GET"

        do {
            _ = try await bridge.submitForm(record, parameters: [:])
            XCTFail("expected StoreError.flowCacheMiss")
        } catch let error as HaapiAccessorStore.StoreError {
            switch error {
            case let .flowCacheMiss(reason):
                XCTAssertTrue(reason.contains("/unknown"))
                XCTAssertTrue(reason.contains("GET"))
            default:
                XCTFail("unexpected StoreError variant: \(error)")
            }
        } catch {
            XCTFail("unexpected error type: \(error)")
        }

        XCTAssertEqual(invoker.submitFormCalls.count, 0,
                       "invoker must not be called on cache miss")
    }

    func testSubmitFormNativeErrorFlowsThroughMapper() async throws {
        // Cache hit, invoker returns .error(_), mapper rethrows the wrapped
        // error → bridge propagates the throw. Asserts the error reaches the
        // caller unchanged AND that the invoker is called before the mapper
        // rethrows (cache lookup + invoker dispatch happen before convert).
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let cachedAction = try HaapiModelFixtures.formActionModel(href: "/submit", method: "POST")
        mapping.collectedFormActionModels = [cachedAction]
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)
        _ = try await bridge.start() // populates cache; convert returns stubbedRecord (no throw yet)

        mapping.stubbedThrow = StubError.placeholder
        let record = RNFormActionModelRecord()
        record.href = "/submit"
        record.method = "POST"

        do {
            _ = try await bridge.submitForm(record, parameters: [:])
            XCTFail("expected submitForm to rethrow the mapper's error")
        } catch let error as StubError {
            XCTAssertEqual(error, .placeholder, "native error must propagate unchanged via the mapper's rethrow")
        } catch {
            XCTFail("unexpected error type: \(error)")
        }

        XCTAssertEqual(invoker.submitFormCalls.count, 1, "invoker is called BEFORE the mapper, so a mapper rethrow doesn't suppress the invoker call")
    }

    // MARK: - followLink

    func testFollowLinkWithCachedLinkForwardsToInvoker() async throws {
        // Happy path for followLink: cache hit on href + rel, real cached
        // Link forwarded to invoker. Mirrors submitForm's cached-forwarding
        // contract.
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let cachedLink = try HaapiModelFixtures.link(href: "/next", rel: "next")
        mapping.collectedLinks = [cachedLink]
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)
        _ = try await bridge.start() // populates cache

        let record = RNLinkRecord()
        record.href = "/next"
        record.rel = "next"
        _ = try await bridge.followLink(record)

        XCTAssertEqual(invoker.followLinkCalls.count, 1, "invoker.followLink must be called once on cache hit")
        let forwardedLink = try XCTUnwrap(invoker.followLinkCalls.first)
        XCTAssertEqual(forwardedLink, cachedLink, "the cached Link instance must be forwarded to the invoker")
    }

    func testFollowLinkWithUnknownLinkThrowsWithoutCallingInvoker() async {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        let record = RNLinkRecord()
        record.href = "/missing"
        record.rel = "next"

        do {
            _ = try await bridge.followLink(record)
            XCTFail("expected StoreError.flowCacheMiss")
        } catch let error as HaapiAccessorStore.StoreError {
            switch error {
            case let .flowCacheMiss(reason):
                XCTAssertTrue(reason.contains("/missing"))
                XCTAssertTrue(reason.contains("next"))
            default:
                XCTFail("unexpected StoreError variant: \(error)")
            }
        } catch {
            XCTFail("unexpected error type: \(error)")
        }

        XCTAssertEqual(invoker.followLinkCalls.count, 0,
                       "invoker must not be called on cache miss")
    }

    func testFollowLinkNativeErrorFlowsThroughMapper() async throws {
        // Symmetric to testSubmitFormNativeErrorFlowsThroughMapper:
        // cache hit, invoker called, mapper rethrows → bridge propagates.
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let cachedLink = try HaapiModelFixtures.link(href: "/next", rel: "next")
        mapping.collectedLinks = [cachedLink]
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)
        _ = try await bridge.start() // populates cache

        mapping.stubbedThrow = StubError.placeholder
        let record = RNLinkRecord()
        record.href = "/next"
        record.rel = "next"

        do {
            _ = try await bridge.followLink(record)
            XCTFail("expected followLink to rethrow the mapper's error")
        } catch let error as StubError {
            XCTAssertEqual(error, .placeholder, "native error must propagate unchanged via the mapper's rethrow")
        } catch {
            XCTFail("unexpected error type: \(error)")
        }

        XCTAssertEqual(invoker.followLinkCalls.count, 1, "invoker is called BEFORE the mapper rethrow")
    }

    // MARK: - clearCaches

    func testClearCachesEmptiesBothLists() async throws {
        // After populating both caches via a start() pass, clearCaches()
        // must drop both. Companion to testClearCachesOnFreshBridgeIsNoOp,
        // which exercises the empty-to-empty path.
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        mapping.collectedFormActionModels = [try HaapiModelFixtures.formActionModel(href: "/a", method: "POST")]
        mapping.collectedLinks = [try HaapiModelFixtures.link(href: "/b", rel: "next")]
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)
        _ = try await bridge.start()

        let preActions = await bridge.lastFormActionModels
        let preLinks = await bridge.lastLinks
        XCTAssertEqual(preActions.count, 1, "precondition: form-action cache is populated before clear")
        XCTAssertEqual(preLinks.count, 1, "precondition: link cache is populated before clear")

        await bridge.clearCaches()

        let postActions = await bridge.lastFormActionModels
        let postLinks = await bridge.lastLinks
        XCTAssertTrue(postActions.isEmpty, "clearCaches must drop cached form actions")
        XCTAssertTrue(postLinks.isEmpty, "clearCaches must drop cached links")
    }

    func testClearCachesOnFreshBridgeIsNoOp() async {
        let bridge = RNHaapiManagerBridge(invoker: RecordingInvoker(), mapper: RecordingMapping())
        await bridge.clearCaches() // must not throw or trap
        let cachedForms = await bridge.lastFormActionModels
        let cachedLinks = await bridge.lastLinks
        XCTAssertTrue(cachedForms.isEmpty)
        XCTAssertTrue(cachedLinks.isEmpty)
    }

    // MARK: - HSRN-33 flow-lifetime cache semantics
    //
    // These tests pin down the accumulating cache + reset rules introduced
    // by HSRN-33. The rules:
    //   - start() → anything: reset, then add.
    //   - followLink() → new-step representation: reset, then add.
    //   - followLink() → continuation step (continueSame / polling): merge.
    //   - submitForm() / *-> problem: append (never reset).
    //   - Lookup is newest-first (`last(where:)`).
    //   - Dedup-on-append keeps cache size bounded under polling.
    //
    // `RecordingMapping.stubbedRecord.responseCategory` is the bridge's
    // `isRepresentation` signal and `.representation?.stepType` is the
    // continuation signal (the bridge reads both off the converted record),
    // so these tests drive them by setting those fields before each call.

    /// Helper: a representation record carrying a specific step type, so a
    /// stubbed `convert` can signal new-step vs continuation to the bridge.
    private func representationRecord(stepType: RNStepType) -> RNHaapiRepresentationRecord {
        let rep = RNHaapiRepresentationRecord()
        rep.stepType = stepType
        return rep
    }

    /// HSRN-33 happy path: representation → submitForm → problem → resubmit
    /// the same form must succeed. Under the pre-HSRN-33 single-response cache
    /// the problem would have evicted the form action.
    func testProblemResponseDoesNotEvictPriorFormAction() async throws {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        // Step 1: start() — representation with the login form
        let loginAction = try HaapiModelFixtures.formActionModel(href: "/login", method: "POST")
        mapping.stubbedRecord.responseCategory = .representation
        mapping.collectedFormActionModels = [loginAction]
        mapping.collectedLinks = []
        _ = try await bridge.start()

        // Step 2: submitForm with bad input — server returns a problem with
        // its own links (no actions, per the SDK contract).
        let problemLink = try HaapiModelFixtures.link(href: "/help", rel: "help")
        mapping.stubbedRecord.responseCategory = .problem
        mapping.collectedFormActionModels = []
        mapping.collectedLinks = [problemLink]
        let submitRecord = RNFormActionModelRecord()
        submitRecord.href = "/login"
        submitRecord.method = "POST"
        _ = try await bridge.submitForm(submitRecord, parameters: [:])

        // Step 3: retry the original form. Pre-HSRN-33 this threw FlowCacheMiss.
        let retryRecord = RNFormActionModelRecord()
        retryRecord.href = "/login"
        retryRecord.method = "POST"
        _ = try await bridge.submitForm(retryRecord, parameters: ["fixed": "true"])

        XCTAssertEqual(invoker.submitFormCalls.count, 2, "both submit attempts must reach the invoker")
        let cachedActions = await bridge.lastFormActionModels
        let cachedLinks = await bridge.lastLinks
        XCTAssertEqual(cachedActions.map(\.href), ["/login"], "prior form action remains cached across the problem")
        XCTAssertTrue(cachedLinks.contains(where: { $0.href == "/help" && $0.rel == "help" }),
                      "problem.links are additive — not replacing")
    }

    /// HSRN-33 screenshot reproduction: prior-step link (e.g. `register-create`)
    /// must remain followable after a problem response that doesn't echo it.
    func testProblemResponseDoesNotEvictPriorRepresentationLink() async throws {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        let registerLink = try HaapiModelFixtures.link(
            href: "/dev/authn/register/create/htmlSql",
            rel: "register-create"
        )
        let loginAction = try HaapiModelFixtures.formActionModel(href: "/login", method: "POST")
        mapping.stubbedRecord.responseCategory = .representation
        mapping.collectedFormActionModels = [loginAction]
        mapping.collectedLinks = [registerLink]
        _ = try await bridge.start()

        // submitForm returns a problem whose own links DO NOT include `register-create`.
        mapping.stubbedRecord.responseCategory = .problem
        mapping.collectedFormActionModels = []
        mapping.collectedLinks = [try HaapiModelFixtures.link(href: "/help", rel: "help")]
        let submitRecord = RNFormActionModelRecord()
        submitRecord.href = "/login"
        submitRecord.method = "POST"
        _ = try await bridge.submitForm(submitRecord, parameters: [:])

        // User taps the register-create button rendered from the prior step.
        let followRecord = RNLinkRecord()
        followRecord.href = "/dev/authn/register/create/htmlSql"
        followRecord.rel = "register-create"
        _ = try await bridge.followLink(followRecord)

        XCTAssertEqual(invoker.followLinkCalls.count, 1, "follow on the prior-representation link must reach the invoker")
        XCTAssertEqual(invoker.followLinkCalls.first?.href, "/dev/authn/register/create/htmlSql")
    }

    /// Multi-step accumulation: submitForm to representation B adds B's models
    /// without dropping representation A's.
    func testSubmitFormToRepresentationAccumulatesModels() async throws {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        // Step 1: start() — representation A with form /login.
        let loginAction = try HaapiModelFixtures.formActionModel(href: "/login", method: "POST")
        mapping.stubbedRecord.responseCategory = .representation
        mapping.collectedFormActionModels = [loginAction]
        mapping.collectedLinks = []
        _ = try await bridge.start()

        // Step 2: submit /login — successful, server returns representation B
        // (the MFA step) with a different form /mfa.
        let mfaAction = try HaapiModelFixtures.formActionModel(href: "/mfa", method: "POST")
        mapping.collectedFormActionModels = [mfaAction]
        mapping.collectedLinks = []
        let submitRecord = RNFormActionModelRecord()
        submitRecord.href = "/login"
        submitRecord.method = "POST"
        _ = try await bridge.submitForm(submitRecord, parameters: [:])

        let cachedActions = await bridge.lastFormActionModels
        XCTAssertEqual(cachedActions.map(\.href), ["/login", "/mfa"],
                       "submitForm to a representation must accumulate — prior step's action stays cached")
    }

    /// followLink → new-step representation: bridge resets the cache before
    /// appending, because the user has navigated to an alternative path.
    func testFollowLinkToRepresentationResetsCache() async throws {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        // Step 1: start() — representation A with form /login and link /register.
        let loginAction = try HaapiModelFixtures.formActionModel(href: "/login", method: "POST")
        let registerLink = try HaapiModelFixtures.link(href: "/register", rel: "register-create")
        mapping.stubbedRecord.responseCategory = .representation
        mapping.stubbedRecord.representation = representationRecord(stepType: .interactiveForm)
        mapping.collectedFormActionModels = [loginAction]
        mapping.collectedLinks = [registerLink]
        _ = try await bridge.start()

        // Step 2: followLink /register — server returns a NEW-step (interactive
        // form) representation B with only the /register form. Because B is a
        // distinct step (not a continuation), prior step's models are evicted.
        let registerForm = try HaapiModelFixtures.formActionModel(href: "/register", method: "POST")
        let cancelLink = try HaapiModelFixtures.link(href: "/cancel", rel: "cancel")
        mapping.stubbedRecord.representation = representationRecord(stepType: .interactiveForm)
        mapping.collectedFormActionModels = [registerForm]
        mapping.collectedLinks = [cancelLink]
        let followRecord = RNLinkRecord()
        followRecord.href = "/register"
        followRecord.rel = "register-create"
        _ = try await bridge.followLink(followRecord)

        let cachedActions = await bridge.lastFormActionModels
        let cachedLinks = await bridge.lastLinks
        XCTAssertEqual(cachedActions.map(\.href), ["/register"],
                       "followLink → new-step representation evicts prior step's actions")
        XCTAssertEqual(cachedLinks.map(\.href), ["/cancel"],
                       "followLink → new-step representation evicts prior step's links")
    }

    /// followLink → ContinueSameStep: bridge MUST merge, not reset. A
    /// continue-same-step is the *same* logical step continuing (e.g. after a
    /// client operation), so prior chrome — a `cancel` link, a prior form —
    /// must stay addressable for a responsive multi-model UI.
    func testFollowLinkToContinueSameStepMergesCache() async throws {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        // Step 1: start() — interactive form A with a login form + cancel link.
        let loginAction = try HaapiModelFixtures.formActionModel(href: "/login", method: "POST")
        let cancelLink = try HaapiModelFixtures.link(href: "/cancel", rel: "cancel")
        mapping.stubbedRecord.responseCategory = .representation
        mapping.stubbedRecord.representation = representationRecord(stepType: .interactiveForm)
        mapping.collectedFormActionModels = [loginAction]
        mapping.collectedLinks = [cancelLink]
        _ = try await bridge.start()

        // Step 2: followLink (the cancel link) → ContinueSameStep carrying a
        // poll action. Because it's a continuation, the prior login action +
        // cancel link must survive (merge), not be evicted.
        let pollAction = try HaapiModelFixtures.formActionModel(href: "/poll", method: "POST")
        mapping.stubbedRecord.representation = representationRecord(stepType: .continueSame)
        mapping.collectedFormActionModels = [pollAction]
        mapping.collectedLinks = []
        let followRecord = RNLinkRecord()
        followRecord.href = "/cancel"
        followRecord.rel = "cancel"
        _ = try await bridge.followLink(followRecord)

        let cachedActions = await bridge.lastFormActionModels
        let cachedLinks = await bridge.lastLinks
        XCTAssertEqual(cachedActions.map(\.href), ["/login", "/poll"],
                       "followLink → continueSame merges: prior action kept, continuation's added")
        XCTAssertEqual(cachedLinks.map(\.href), ["/cancel"],
                       "prior step's cancel link survives a continue-same continuation")
    }

    /// followLink → PollingStep: same merge semantics as continueSame. A
    /// polling step reached via a link is the same out-of-band operation
    /// continuing, so prior state is preserved.
    func testFollowLinkToPollingStepMergesCache() async throws {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        let loginAction = try HaapiModelFixtures.formActionModel(href: "/login", method: "POST")
        let pollLink = try HaapiModelFixtures.link(href: "/poll", rel: "poll")
        mapping.stubbedRecord.responseCategory = .representation
        mapping.stubbedRecord.representation = representationRecord(stepType: .interactiveForm)
        mapping.collectedFormActionModels = [loginAction]
        mapping.collectedLinks = [pollLink]
        _ = try await bridge.start()

        // followLink(poll) → PollingStep with its own poll action. Merge.
        let pollAction = try HaapiModelFixtures.formActionModel(href: "/poll", method: "POST")
        mapping.stubbedRecord.representation = representationRecord(stepType: .polling)
        mapping.collectedFormActionModels = [pollAction]
        mapping.collectedLinks = []
        let followRecord = RNLinkRecord()
        followRecord.href = "/poll"
        followRecord.rel = "poll"
        _ = try await bridge.followLink(followRecord)

        let cachedActions = await bridge.lastFormActionModels
        XCTAssertEqual(cachedActions.map(\.href), ["/login", "/poll"],
                       "followLink → polling merges: prior action kept alongside the poll action")
    }

    /// submitForm → ContinueSameStep merges (submitForm never resets). The
    /// continue action typically arrives after a client operation completes;
    /// the prior step's form + links must stay re-dispatchable.
    func testSubmitFormToContinueSameStepMergesCache() async throws {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        // Step 1: start() → interactive form A (login) + a cancel link.
        let loginAction = try HaapiModelFixtures.formActionModel(href: "/login", method: "POST")
        let cancelLink = try HaapiModelFixtures.link(href: "/cancel", rel: "cancel")
        mapping.stubbedRecord.responseCategory = .representation
        mapping.stubbedRecord.representation = representationRecord(stepType: .interactiveForm)
        mapping.collectedFormActionModels = [loginAction]
        mapping.collectedLinks = [cancelLink]
        _ = try await bridge.start()

        // Step 2: submitForm(/login) → ContinueSameStep carrying a /continue action.
        let continueAction = try HaapiModelFixtures.formActionModel(href: "/continue", method: "POST")
        mapping.stubbedRecord.representation = representationRecord(stepType: .continueSame)
        mapping.collectedFormActionModels = [continueAction]
        mapping.collectedLinks = []
        let submitRecord = RNFormActionModelRecord()
        submitRecord.href = "/login"
        submitRecord.method = "POST"
        _ = try await bridge.submitForm(submitRecord, parameters: [:])

        let cachedActions = await bridge.lastFormActionModels
        let cachedLinks = await bridge.lastLinks
        XCTAssertEqual(cachedActions.map(\.href), ["/login", "/continue"],
                       "submitForm → continueSame merges: prior login action kept, continue added")
        XCTAssertEqual(cachedLinks.map(\.href), ["/cancel"],
                       "prior step's cancel link survives a submitForm-driven continue-same step")
    }

    /// Realistic polling loop: start → form → submitForm → PollingStep
    /// (pending), then re-submit the poll action repeatedly. Each poll must
    /// resolve (reach the invoker), the cache stays bounded (dedup), and the
    /// prior login action is preserved across the whole loop.
    func testPollingStepLoopResolvesAndStaysBounded() async throws {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        // Step 1: start() → interactive form A (login).
        let loginAction = try HaapiModelFixtures.formActionModel(href: "/login", method: "POST")
        mapping.stubbedRecord.responseCategory = .representation
        mapping.stubbedRecord.representation = representationRecord(stepType: .interactiveForm)
        mapping.collectedFormActionModels = [loginAction]
        mapping.collectedLinks = []
        _ = try await bridge.start()

        // Step 2: submitForm(/login) → PollingStep (pending) with poll + cancel.
        mapping.stubbedRecord.representation = representationRecord(stepType: .polling)
        mapping.collectedFormActionModels = [try HaapiModelFixtures.formActionModel(href: "/poll", method: "POST")]
        mapping.collectedLinks = [try HaapiModelFixtures.link(href: "/cancel", rel: "cancel")]
        let loginRecord = RNFormActionModelRecord()
        loginRecord.href = "/login"
        loginRecord.method = "POST"
        _ = try await bridge.submitForm(loginRecord, parameters: [:])

        // Step 3..N: re-submit the poll action; each response is a fresh PollingStep.
        let pollRecord = RNFormActionModelRecord()
        pollRecord.href = "/poll"
        pollRecord.method = "POST"
        for _ in 0..<10 {
            mapping.collectedFormActionModels = [try HaapiModelFixtures.formActionModel(href: "/poll", method: "POST")]
            mapping.collectedLinks = [try HaapiModelFixtures.link(href: "/cancel", rel: "cancel")]
            _ = try await bridge.submitForm(pollRecord, parameters: [:])
        }

        let cachedActions = await bridge.lastFormActionModels
        let cachedLinks = await bridge.lastLinks
        XCTAssertEqual(invoker.submitFormCalls.count, 11,
                       "every poll iteration must resolve the poll action and reach the invoker (1 login + 10 polls)")
        XCTAssertEqual(cachedActions.map(\.href), ["/login", "/poll"],
                       "poll loop stays bounded — one /login + one /poll, no per-iteration growth")
        XCTAssertEqual(cachedLinks.map(\.href), ["/cancel"],
                       "poll loop keeps a single /cancel link, not one per iteration")
    }

    /// followLink → continuation step in a LOOP. The `followLink` branch is the
    /// only call kind whose reset decision reads `isContinuation` (start always
    /// resets; submitForm never does), and both existing bounded-loop tests
    /// drive `submitForm`. This locks the followLink→continuation branch under
    /// repetition: it must keep merging (never reset), stay bounded, and leave
    /// the prior step's action dispatchable. Alternates polling / continueSame
    /// to exercise both continuation types on this branch.
    func testFollowLinkToContinuationStepLoopResolvesAndStaysBounded() async throws {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        // Step 1: start() → interactive form A: login action + cancel link.
        mapping.stubbedRecord.responseCategory = .representation
        mapping.stubbedRecord.representation = representationRecord(stepType: .interactiveForm)
        mapping.collectedFormActionModels = [try HaapiModelFixtures.formActionModel(href: "/login", method: "POST")]
        mapping.collectedLinks = [try HaapiModelFixtures.link(href: "/cancel", rel: "cancel")]
        _ = try await bridge.start()

        // Step 2: 10× followLink(/cancel), each landing on a continuation step
        // (alternating polling / continueSame). The cancel link is re-emitted
        // each iteration so it stays resolvable for the next follow.
        let followRecord = RNLinkRecord()
        followRecord.href = "/cancel"
        followRecord.rel = "cancel"
        for i in 0..<10 {
            mapping.stubbedRecord.representation =
                representationRecord(stepType: i % 2 == 0 ? .polling : .continueSame)
            mapping.collectedFormActionModels = [try HaapiModelFixtures.formActionModel(href: "/poll", method: "POST")]
            mapping.collectedLinks = [try HaapiModelFixtures.link(href: "/cancel", rel: "cancel")]
            _ = try await bridge.followLink(followRecord)
        }

        // Step 3: the prior-step /login action must still be dispatchable — if
        // any followLink had reset, /login would be gone and this throws.
        let loginRecord = RNFormActionModelRecord()
        loginRecord.href = "/login"
        loginRecord.method = "POST"
        _ = try await bridge.submitForm(loginRecord, parameters: [:])

        let cachedActions = await bridge.lastFormActionModels
        let cachedLinks = await bridge.lastLinks
        XCTAssertEqual(invoker.followLinkCalls.count, 10,
                       "every followLink to a continuation step must reach the invoker across the loop")
        XCTAssertEqual(cachedActions.map(\.href), ["/login", "/poll"],
                       "followLink → continuation loop never resets (/login survives) and stays bounded (single /poll)")
        XCTAssertEqual(cachedLinks.count, 1,
                       "dedup keeps exactly one /cancel link across all 10 continuation follows")
        XCTAssertEqual(invoker.submitFormCalls.count, 1,
                       "the prior /login action survived 10 continuation follows and still resolves (no cache miss)")
    }

    /// followLink → problem: bridge does NOT reset — symmetric to submitForm→problem.
    func testFollowLinkToProblemPreservesPriorCache() async throws {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        let loginAction = try HaapiModelFixtures.formActionModel(href: "/login", method: "POST")
        let helpLink = try HaapiModelFixtures.link(href: "/help", rel: "help")
        mapping.stubbedRecord.responseCategory = .representation
        mapping.collectedFormActionModels = [loginAction]
        mapping.collectedLinks = [helpLink]
        _ = try await bridge.start()

        // followLink → problem. Prior action + link must remain in the cache.
        let problemLink = try HaapiModelFixtures.link(href: "/back", rel: "back")
        mapping.stubbedRecord.responseCategory = .problem
        mapping.collectedFormActionModels = []
        mapping.collectedLinks = [problemLink]
        let followRecord = RNLinkRecord()
        followRecord.href = "/help"
        followRecord.rel = "help"
        _ = try await bridge.followLink(followRecord)

        let cachedActions = await bridge.lastFormActionModels
        let cachedLinks = await bridge.lastLinks
        XCTAssertEqual(cachedActions.map(\.href), ["/login"],
                       "followLink → problem keeps prior form actions")
        XCTAssertEqual(Set(cachedLinks.map(\.href)), Set(["/help", "/back"]),
                       "followLink → problem unions problem.links onto prior link cache")
    }

    /// start() mid-flow → problem: cache is still reset. `start()` always
    /// resets — it's the "begin fresh" entry-point. A problem returned by
    /// start() doesn't undo the host's signalled intent to abandon prior
    /// state. Differs from `submitForm → problem` and `followLink → problem`,
    /// which both preserve.
    func testStartToProblemResetsCache() async throws {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        // Prime the cache via an initial representation.
        let initialAction = try HaapiModelFixtures.formActionModel(href: "/initial", method: "POST")
        let initialLink = try HaapiModelFixtures.link(href: "/help", rel: "help")
        mapping.stubbedRecord.responseCategory = .representation
        mapping.collectedFormActionModels = [initialAction]
        mapping.collectedLinks = [initialLink]
        _ = try await bridge.start()

        // Re-start mid-flow → server returns a problem (rare but possible).
        // The prior step's models must be evicted before problem.links land.
        let problemLink = try HaapiModelFixtures.link(href: "/recover", rel: "recover")
        mapping.stubbedRecord.responseCategory = .problem
        mapping.collectedFormActionModels = []
        mapping.collectedLinks = [problemLink]
        _ = try await bridge.start()

        let cachedActions = await bridge.lastFormActionModels
        let cachedLinks = await bridge.lastLinks
        XCTAssertTrue(cachedActions.isEmpty,
                      "start() always resets — prior form actions evicted even when start returns a problem")
        XCTAssertEqual(cachedLinks.map(\.href), ["/recover"],
                       "after reset, only the problem's links remain — prior step's /help is gone")
    }

    /// start() mid-flow → representation: cache is reset.
    func testStartToRepresentationResetsCache() async throws {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        let initialAction = try HaapiModelFixtures.formActionModel(href: "/initial", method: "POST")
        mapping.stubbedRecord.responseCategory = .representation
        mapping.collectedFormActionModels = [initialAction]
        mapping.collectedLinks = []
        _ = try await bridge.start()

        // Re-start: representation A' with a different form.
        let freshAction = try HaapiModelFixtures.formActionModel(href: "/fresh", method: "POST")
        mapping.collectedFormActionModels = [freshAction]
        mapping.collectedLinks = []
        _ = try await bridge.start()

        let cachedActions = await bridge.lastFormActionModels
        XCTAssertEqual(cachedActions.map(\.href), ["/fresh"],
                       "start() to a fresh representation must replace the cache, not accumulate")
    }

    /// Lookup is newest-first: a later cache entry with the same key shadows
    /// the earlier one. Critical for HAAPI rels reused across steps (`back`,
    /// `cancel`, etc.).
    func testLookupReturnsNewestEntryOnCollision() async throws {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        // Step 1: representation A with form (/submit, POST).
        let stepAForm = try HaapiModelFixtures.formActionModel(href: "/submit", method: "POST")
        mapping.stubbedRecord.responseCategory = .representation
        mapping.collectedFormActionModels = [stepAForm]
        mapping.collectedLinks = []
        _ = try await bridge.start()

        // Step 2: submit to (/submit, POST) — server returns representation B
        // which ALSO carries a (/submit, POST) action (different native instance).
        let stepBForm = try HaapiModelFixtures.formActionModel(href: "/submit", method: "POST")
        mapping.collectedFormActionModels = [stepBForm]
        mapping.collectedLinks = []
        let submitRecord = RNFormActionModelRecord()
        submitRecord.href = "/submit"
        submitRecord.method = "POST"
        _ = try await bridge.submitForm(submitRecord, parameters: [:])

        // The next submitForm at (/submit, POST) must resolve to step B's
        // model (newest), not step A's.
        let retryRecord = RNFormActionModelRecord()
        retryRecord.href = "/submit"
        retryRecord.method = "POST"
        _ = try await bridge.submitForm(retryRecord, parameters: [:])

        XCTAssertEqual(invoker.submitFormCalls.count, 2, "both submitForm calls reach the invoker (start() doesn't count)")
        // The second submitForm call must have used step B's instance, not step A's.
        // Dedup-on-append removes the older entry, so cache holds only step B's.
        let cachedActions = await bridge.lastFormActionModels
        XCTAssertEqual(cachedActions.count, 1, "dedup-on-append collapses the duplicate (href, method) entries")
        let lastForwarded = try XCTUnwrap(invoker.submitFormCalls.last?.0)
        XCTAssertEqual(lastForwarded, stepBForm, "newest-first lookup resolves to step B's FormActionModel")
    }

    /// Polling: repeatedly submitting the same form must not grow the cache
    /// unboundedly. Dedup-on-append keeps it at exactly one entry per unique
    /// `(href, method)`.
    func testPollingDoesNotGrowCacheUnboundedly() async throws {
        let invoker = RecordingInvoker()
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)

        // Step 1: start() with a single polling form + link.
        let pollAction = try HaapiModelFixtures.formActionModel(href: "/poll", method: "POST")
        let cancelLink = try HaapiModelFixtures.link(href: "/cancel", rel: "cancel")
        mapping.stubbedRecord.responseCategory = .representation
        mapping.collectedFormActionModels = [pollAction]
        mapping.collectedLinks = [cancelLink]
        _ = try await bridge.start()

        // Each poll iteration returns a fresh native FormActionModel +
        // Link instance carrying the same (href, method) / (href, rel).
        let submitRecord = RNFormActionModelRecord()
        submitRecord.href = "/poll"
        submitRecord.method = "POST"
        for _ in 0..<10 {
            let nextPoll = try HaapiModelFixtures.formActionModel(href: "/poll", method: "POST")
            let nextCancel = try HaapiModelFixtures.link(href: "/cancel", rel: "cancel")
            mapping.collectedFormActionModels = [nextPoll]
            mapping.collectedLinks = [nextCancel]
            _ = try await bridge.submitForm(submitRecord, parameters: [:])
        }

        let cachedActions = await bridge.lastFormActionModels
        let cachedLinks = await bridge.lastLinks
        XCTAssertEqual(cachedActions.count, 1,
                       "dedup-on-append keeps exactly one cached entry per unique (href, method)")
        XCTAssertEqual(cachedLinks.count, 1,
                       "dedup-on-append keeps exactly one cached entry per unique (href, rel)")
        XCTAssertEqual(invoker.submitFormCalls.count, 10,
                       "every poll iteration reaches the invoker")
    }

    // MARK: - Actor isolation

    /// `RNHaapiManagerBridge` is an `actor`: concurrent flow ops on the same
    /// bridge are serialised by its executor, so the bridge never drops or
    /// coalesces a call and never tears its own cache.
    ///
    /// This test fires `expectedCalls` concurrent `start()` calls and asserts
    /// each one reached the invoker exactly once and each result reached the
    /// mapper exactly once — `expectedCalls` invocations, no work lost under
    /// load.
    ///
    /// Where the counts are serialised differs by call, and that distinction
    /// matters: `invoker.start()` runs OFF the bridge actor (`start()` suspends
    /// at `await invoker.start()`, releasing the actor's executor, and the
    /// non-isolated invoker body then runs on the concurrent cooperative pool),
    /// so `RecordingInvoker` serialises its own `startCalls` increment under a
    /// lock — actor isolation of the bridge does not cover invoker-owned state.
    /// The mapper's `convert` runs synchronously inside the actor (via
    /// `processResult`), so its `convertedResults` count is serialised by the
    /// actor itself.
    ///
    /// This runs in the full native iOS workspace added in HSRN-23 and
    /// exercises the no-dropped-work contract against the real bridge type.
    func testActorSerializesConcurrentStartCallsWithoutLostIncrements() async {
        let invoker = RecordingInvoker()
        // `RecordingInvoker.stubbedResult` defaults to `.error(...)`. Under
        // the rethrow contract that would make every call throw, so the
        // mapper is left without `stubbedThrow`: it absorbs the `.error`
        // results and returns the canned record. We observe the increments
        // to prove actor serialisation under load.
        let mapping = RecordingMapping()
        let bridge = RNHaapiManagerBridge(invoker: invoker, mapper: mapping)
        let expectedCalls = 100

        await withTaskGroup(of: Void.self) { group in
            for _ in 0..<expectedCalls {
                group.addTask { _ = try? await bridge.start() }
            }
        }

        XCTAssertEqual(invoker.startCalls, expectedCalls,
                       "every concurrent start() must reach the invoker exactly once — the bridge must not drop or coalesce calls under load")
        XCTAssertEqual(mapping.convertedResults.count, expectedCalls,
                       "every start() result must reach the mapper — actor serialisation prevents dropped convert() calls")
    }
}
