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

final class RNFormFieldTypeTests: XCTestCase {

    func testAllCasesCount() {
        XCTAssertEqual(RNFormFieldType.allCases.count, 7)
    }

    func testHiddenRawValue() {
        XCTAssertEqual(RNFormFieldType.hidden.rawValue, "hidden")
    }

    func testTextRawValue() {
        XCTAssertEqual(RNFormFieldType.text.rawValue, "text")
    }

    func testUsernameRawValue() {
        XCTAssertEqual(RNFormFieldType.username.rawValue, "username")
    }

    func testPasswordRawValue() {
        XCTAssertEqual(RNFormFieldType.password.rawValue, "password")
    }

    func testSelectRawValue() {
        XCTAssertEqual(RNFormFieldType.select.rawValue, "select")
    }

    func testCheckboxRawValue() {
        XCTAssertEqual(RNFormFieldType.checkbox.rawValue, "checkbox")
    }

    func testContextRawValue() {
        XCTAssertEqual(RNFormFieldType.context.rawValue, "context")
    }
}
