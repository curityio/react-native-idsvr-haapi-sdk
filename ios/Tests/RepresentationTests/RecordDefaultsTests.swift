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
@testable import RNIdsvrHaapiSdk

final class RecordDefaultsTests: XCTestCase {

    func testHaapiResponseRecordDefaults() {
        let record = RNHaapiResponseRecord()
        XCTAssertEqual(record.responseCategory, .representation)
        XCTAssertNil(record.representation)
        XCTAssertNil(record.problem)
    }

    func testHaapiResponseRecordConvenienceInits() {
        let repr = RNHaapiResponseRecord(representation: RNHaapiRepresentationRecord())
        XCTAssertEqual(repr.responseCategory, .representation)
        XCTAssertNotNil(repr.representation)

        let prob = RNHaapiResponseRecord(problem: RNProblemRepresentationRecord())
        XCTAssertEqual(prob.responseCategory, .problem)
        XCTAssertNotNil(prob.problem)
    }

    func testHaapiRepresentationRecordDefaults() {
        let record = RNHaapiRepresentationRecord()
        XCTAssertEqual(record.stepType, .genericRepresentation)
        XCTAssertEqual(record.type, .authenticationStep)
        XCTAssertTrue(record.actions.isEmpty)
        XCTAssertTrue(record.links.isEmpty)
        XCTAssertTrue(record.messages.isEmpty)
        XCTAssertNil(record.metadata)
        XCTAssertNil(record.title)
        XCTAssertNil(record.authenticators)
        XCTAssertNil(record.properties)
        XCTAssertNil(record.redirectAction)
        XCTAssertNil(record.mainAction)
        XCTAssertNil(record.cancelAction)
        XCTAssertNil(record.pollingProperties)
        XCTAssertNil(record.oauthProperties)
        XCTAssertNil(record.clientOperationActionModel)
        XCTAssertNil(record.activationLink)
    }

    func testActionRecordDefaults() {
        let record = RNActionRecord()
        XCTAssertEqual(record.actionType, .form)
        XCTAssertEqual(record.kind, .other)
        XCTAssertNil(record.title)
        XCTAssertNil(record.model)
        XCTAssertNil(record.clientOperationModel)
        XCTAssertNil(record.options)
    }

    func testFormFieldRecordDefaults() {
        let record = RNFormFieldRecord()
        XCTAssertEqual(record.fieldType, .text)
        XCTAssertEqual(record.name, "")
        XCTAssertEqual(record.isRequired, true)
        XCTAssertNil(record.value)
        XCTAssertNil(record.label)
        XCTAssertNil(record.placeholder)
        XCTAssertNil(record.kind)
        XCTAssertNil(record.minLength)
        XCTAssertNil(record.maxLength)
        XCTAssertNil(record.options)
        XCTAssertNil(record.checked)
        XCTAssertNil(record.readOnly)
    }

    func testProblemRepresentationRecordDefaults() {
        let record = RNProblemRepresentationRecord()
        XCTAssertEqual(record.problemKind, "problem")
        XCTAssertEqual(record.type, .unexpected)
        XCTAssertNil(record.metadata)
        XCTAssertNil(record.title)
        XCTAssertTrue(record.messages.isEmpty)
        XCTAssertTrue(record.links.isEmpty)
        XCTAssertNil(record.invalidFields)
        XCTAssertNil(record.errorDescription)
        XCTAssertNil(record.error)
        XCTAssertNil(record.iss)
    }

    func testTokenResponseRecordDefaults() {
        let record = RNTokenResponseRecord()
        XCTAssertEqual(record.responseType, .success)
        XCTAssertNil(record.accessToken)
        XCTAssertNil(record.tokenType)
        XCTAssertNil(record.scope)
        XCTAssertNil(record.expiresIn)
        XCTAssertNil(record.refreshToken)
        XCTAssertNil(record.idToken)
        XCTAssertNil(record.error)
        XCTAssertNil(record.errorDescription)
        XCTAssertNil(record.errorUri)
    }

    /// Default state of every `@Field` on `RNPropertiesRecord`. The discriminator
    /// `kind` defaults to `"generic"` (matching the `RNPropertiesRecord.swift`
    /// declaration); every other field defaults to `nil`. The `interval` field
    /// (HSRN-20, HAAPI SDK 5.4.0) sits inside the polling sub-group; this test
    /// is the lock-in for "default-constructed Record carries no polling state
    /// unless the converter populates it".
    func testPropertiesRecordDefaults() {
        let record = RNPropertiesRecord()
        XCTAssertEqual(record.kind, "generic")
        XCTAssertNil(record.rawJsonString)
        // OAuth authorization-response sub-group
        XCTAssertNil(record.code)
        XCTAssertNil(record.idToken)
        XCTAssertNil(record.scope)
        XCTAssertNil(record.state)
        // Polling sub-group
        XCTAssertNil(record.recipientOfCommunication)
        XCTAssertNil(record.status)
        XCTAssertNil(record.interval)
        XCTAssertNil(record.maxWaitTime)
        XCTAssertNil(record.maxWaitRemainingTime)
    }
}
