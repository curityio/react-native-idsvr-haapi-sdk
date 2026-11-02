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

final class RNActionTypeTests: XCTestCase {

    func testAllCasesCount() {
        XCTAssertEqual(RNActionType.allCases.count, 3)
    }

    func testFormRawValue() {
        XCTAssertEqual(RNActionType.form.rawValue, "form")
    }

    func testClientOperationRawValue() {
        XCTAssertEqual(RNActionType.clientOperation.rawValue, "clientOperation")
    }

    func testSelectorRawValue() {
        XCTAssertEqual(RNActionType.selector.rawValue, "selector")
    }
}
