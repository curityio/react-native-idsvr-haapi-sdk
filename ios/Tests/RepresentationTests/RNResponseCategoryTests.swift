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

final class RNResponseCategoryTests: XCTestCase {

    // `RNResponseCategory` covers only the two value-bearing response
    // categories. Flow failures are surfaced as thrown `HaapiError`
    // values and do not appear here.

    func testAllCasesCount() {
        XCTAssertEqual(RNResponseCategory.allCases.count, 2)
    }

    func testRepresentationRawValue() {
        XCTAssertEqual(RNResponseCategory.representation.rawValue, "representation")
    }

    func testProblemRawValue() {
        XCTAssertEqual(RNResponseCategory.problem.rawValue, "problem")
    }

    func testReverseMappingRepresentation() {
        XCTAssertEqual(RNResponseCategory(rawValue: "representation"), .representation)
    }

    func testReverseMappingProblem() {
        XCTAssertEqual(RNResponseCategory(rawValue: "problem"), .problem)
    }

    func testRejectsUnknownRawValue() {
        XCTAssertNil(RNResponseCategory(rawValue: "error"))
        XCTAssertNil(RNResponseCategory(rawValue: "unknown"))
    }
}

