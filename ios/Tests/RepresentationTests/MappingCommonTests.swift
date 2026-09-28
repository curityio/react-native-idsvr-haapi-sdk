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

// MARK: - Polling-properties converter tests (HSRN-20 / Phase 4)
//
// Layer-(a) round-trip and layer-(c) absence assertions for the polling
// converter on iOS. Companion to `RecordDefaultsTests.testPropertiesRecordDefaults`
// (layer-(b)) and the Android `MappingCommonTest.kt` cross-platform mirror.
//
// The `interval` field was added in HAAPI SDK 5.4.0 (see ai/plans/HSRN-20).
// Each test must FAIL if the corresponding `record.interval = …` assignment
// in `MappingCommon.swift` is re-commented (rule 4 of
// `ai/knowledge/testing-philosophy.md`: failing on the right axis with a clear
// message).

// MARK: - Fixture loader (shared __fixtures__/polling-properties.json)

private final class PollingFixturesBundleAnchor {}

private enum PollingFixtures {
    // The `[String: Any]` cache is loaded once and never mutated; the
    // `nonisolated(unsafe)` escape hatch is the conventional Swift 6
    // concurrency-safe pattern for read-once-then-immutable test data.
    nonisolated(unsafe) private static let raw: [String: Any] = {
        guard let url = Bundle(for: PollingFixturesBundleAnchor.self)
            .url(forResource: "polling-properties", withExtension: "json")
        else {
            fatalError(
                "polling-properties.json missing from RNIdsvrHaapiSdkTests bundle — " +
                "check `ios/project.yml` Resources entry on the test target."
            )
        }
        guard let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            fatalError("polling-properties.json unreadable or malformed at \(url.path)")
        }
        return json
    }()

    static func dict(_ key: String) -> [String: String?] {
        guard let sub = raw[key] as? [String: Any] else {
            fatalError("polling fixture '\(key)' missing in polling-properties.json")
        }
        // Build a uniform String? dictionary; the HAAPI wire fields we care
        // about are all string-valued (or absent).
        var result: [String: String?] = [:]
        for (k, v) in sub { result[k] = v as? String }
        return result
    }

    /// Build a real `PollingProperties` from the fixture's named variant.
    static func properties(_ key: String) -> PollingProperties {
        let f = dict(key)
        return HaapiModel.PropertiesFactory.polling(
            rawJsonString: "{}",
            recipientOfCommunication: f["recipientOfCommunication"] ?? nil,
            status: .pending,
            maxWaitTime: f["maxWaitTime"] ?? nil,
            maxWaitRemainingTime: f["maxWaitRemainingTime"] ?? nil,
            interval: f["interval"] ?? nil
        )
    }
}

// MARK: - Authorization-problem fixture loader (shared __fixtures__/authorization-problem.json)

private final class AuthorizationProblemFixturesBundleAnchor {}

private enum AuthorizationProblemFixtures {
    nonisolated(unsafe) private static let raw: [String: Any] = {
        guard let url = Bundle(for: AuthorizationProblemFixturesBundleAnchor.self)
            .url(forResource: "authorization-problem", withExtension: "json")
        else {
            fatalError(
                "authorization-problem.json missing from RNIdsvrHaapiSdkTests bundle — " +
                "check `ios/project.yml` Resources entry on the test target."
            )
        }
        guard let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            fatalError("authorization-problem.json unreadable or malformed at \(url.path)")
        }
        return json
    }()

    /// Build a real `AuthorizationProblem` from the fixture's named variant.
    /// `iss` is absent in the `withoutIss` variant, exercising the layer-(c)
    /// absence path through the converter.
    static func problem(_ key: String) -> AuthorizationProblem {
        guard let f = raw[key] as? [String: Any] else {
            fatalError("authorization-problem fixture '\(key)' missing in authorization-problem.json")
        }
        return HaapiModel.ProblemFactory.authorization(
            error: f["error"] as? String ?? "",
            errorDescription: f["errorDescription"] as? String,
            iss: f["iss"] as? String,
            type: .other(value: "https://curity.se/problems/error-authorization-response"),
            metadata: nil,
            title: nil,
            messages: [],
            links: [],
            rawJsonString: "{}"
        )
    }
}

// MARK: - Tests

final class MappingCommonTests: XCTestCase {

    // MARK: - convertPollingProperties (dedicated path)

    /// `pendingFull` fixture — every polling field populated, including the
    /// 5.4.0 `interval`. Asserts each semantic field round-trips into the
    /// Record. (Layer (a) converter round-trip.)
    func testConvertPollingProperties_pendingFull_populatesAllFields() {
        let mapper = HaapiResponseMapper()
        let props = PollingFixtures.properties("pendingFull")

        let record = mapper.convertPollingProperties(props)

        XCTAssertEqual(record.kind, "polling")
        XCTAssertEqual(record.recipientOfCommunication, "+46-70-1234567")
        XCTAssertEqual(record.status, .pending)
        XCTAssertEqual(record.interval, "5000")
        XCTAssertEqual(record.maxWaitTime, "PT5M")
        XCTAssertEqual(record.maxWaitRemainingTime, "PT4M30S")
    }

    /// `pendingMinimal` fixture — `interval` present, sibling polling fields
    /// absent. Asserts `interval` propagates without leaking sibling values.
    func testConvertPollingProperties_pendingMinimal_propagatesIntervalOnly() {
        let mapper = HaapiResponseMapper()
        let props = PollingFixtures.properties("pendingMinimal")

        let record = mapper.convertPollingProperties(props)

        XCTAssertEqual(record.kind, "polling")
        XCTAssertEqual(record.recipientOfCommunication, "+46-70-1234567")
        XCTAssertEqual(record.status, .pending)
        XCTAssertEqual(record.interval, "5000")
        XCTAssertNil(record.maxWaitTime)
        XCTAssertNil(record.maxWaitRemainingTime)
    }

    /// `pendingWithoutInterval` fixture — every other polling field set, but
    /// `interval` absent. Asserts the Record's `interval` stays nil and
    /// sibling fields are not corrupted. (Layer (c) absence path.)
    func testConvertPollingProperties_pendingWithoutInterval_intervalIsNil() {
        let mapper = HaapiResponseMapper()
        let props = PollingFixtures.properties("pendingWithoutInterval")

        let record = mapper.convertPollingProperties(props)

        XCTAssertEqual(record.kind, "polling")
        XCTAssertEqual(record.recipientOfCommunication, "+46-70-1234567")
        XCTAssertEqual(record.status, .pending)
        XCTAssertNil(record.interval, "Absent interval in fixture must yield nil Record field, not empty string or stale value")
        XCTAssertEqual(record.maxWaitTime, "PT5M")
        XCTAssertEqual(record.maxWaitRemainingTime, "PT4M30S")
    }

    // MARK: - convertProperties (generic-dispatch path)

    /// `convertProperties` is the in-line switch path used by
    /// `convertRepresentation` when it walks a `HaapiRepresentation`'s
    /// `properties`. The polling case must wire `interval` exactly like the
    /// dedicated `convertPollingProperties` path. Two converters, one
    /// contract: tested here so a divergence between the two arms is caught.
    func testConvertProperties_polling_pendingFull_populatesInterval() {
        let mapper = HaapiResponseMapper()
        let props: any Properties = PollingFixtures.properties("pendingFull")

        let record = mapper.convertProperties(props)

        XCTAssertNotNil(record)
        XCTAssertEqual(record?.kind, "polling")
        XCTAssertEqual(record?.recipientOfCommunication, "+46-70-1234567")
        XCTAssertEqual(record?.status, .pending)
        XCTAssertEqual(record?.interval, "5000")
        XCTAssertEqual(record?.maxWaitTime, "PT5M")
        XCTAssertEqual(record?.maxWaitRemainingTime, "PT4M30S")
    }

    /// Absence path through the generic-dispatch `convertProperties` arm —
    /// mirrors the dedicated absence test for the in-line `case PollingProperties:`
    /// branch.
    func testConvertProperties_polling_pendingWithoutInterval_intervalIsNil() {
        let mapper = HaapiResponseMapper()
        let props: any Properties = PollingFixtures.properties("pendingWithoutInterval")

        let record = mapper.convertProperties(props)

        XCTAssertNotNil(record)
        XCTAssertEqual(record?.kind, "polling")
        XCTAssertNil(record?.interval)
    }

    // MARK: - convertProblem (AuthorizationProblem.iss — HSRN-0 / HAAPI SDK 5.5.0)
    //
    // `iss` (RFC 9207 issuer identifier) became available on
    // `AuthorizationProblem` in HAAPI SDK 5.5.0. Each test must FAIL if the
    // `record.iss = p.iss` assignment in `MappingCommon.swift` is re-commented
    // (rule 4 of `ai/knowledge/testing-philosophy.md`).

    /// `withIss` fixture — `iss` populated. Asserts it round-trips into the
    /// Record alongside the OAuth `error`. (Layer (a) converter round-trip.)
    func testConvertProblem_authorizationWithIss_populatesIss() {
        let mapper = HaapiResponseMapper()
        let problem = AuthorizationProblemFixtures.problem("withIss")

        let record = mapper.convertProblem(problem)

        XCTAssertEqual(record.problemKind, "authorization")
        XCTAssertEqual(record.error, "access_denied")
        XCTAssertEqual(record.iss, "https://issuer.example.com/oauth/v2/oauth-anonymous")
    }

    /// `withoutIss` fixture — `iss` absent. Asserts the Record's `iss` stays
    /// nil (not empty string) while sibling fields are unaffected.
    /// (Layer (c) absence path.)
    func testConvertProblem_authorizationWithoutIss_issIsNil() {
        let mapper = HaapiResponseMapper()
        let problem = AuthorizationProblemFixtures.problem("withoutIss")

        let record = mapper.convertProblem(problem)

        XCTAssertEqual(record.problemKind, "authorization")
        XCTAssertEqual(record.error, "access_denied")
        XCTAssertNil(record.iss, "Absent iss in fixture must yield nil Record field, not empty string or stale value")
    }
}