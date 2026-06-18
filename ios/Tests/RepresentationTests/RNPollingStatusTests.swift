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

final class RNPollingStatusTests: XCTestCase {

    func testAllCasesCount() {
        XCTAssertEqual(RNPollingStatus.allCases.count, 3)
    }

    func testPendingRawValue() {
        XCTAssertEqual(RNPollingStatus.pending.rawValue, "pending")
    }

    func testDoneRawValue() {
        XCTAssertEqual(RNPollingStatus.done.rawValue, "done")
    }

    func testFailedRawValue() {
        XCTAssertEqual(RNPollingStatus.failed.rawValue, "failed")
    }
}
