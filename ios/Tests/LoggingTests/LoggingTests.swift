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

final class LoggingTests: XCTestCase {

    func testMapLogTypeDebug() {
        XCTAssertEqual(RNLogSink.mapLogType(.debug), "debug")
    }

    func testMapLogTypeInfo() {
        XCTAssertEqual(RNLogSink.mapLogType(.info), "info")
    }

    func testMapLogTypeWarning() {
        XCTAssertEqual(RNLogSink.mapLogType(.warning), "warning")
    }

    func testMapLogTypeError() {
        XCTAssertEqual(RNLogSink.mapLogType(.error), "error")
    }
}
