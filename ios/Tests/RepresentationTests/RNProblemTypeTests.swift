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

final class RNProblemTypeTests: XCTestCase {

    func testAllCasesCount() {
        XCTAssertEqual(RNProblemType.allCases.count, 9)
    }

    func testAuthenticationFailedRawValue() {
        XCTAssertEqual(
            RNProblemType.authenticationFailed.rawValue,
            "https://curity.se/problems/authentication-failed"
        )
    }

    func testInvalidInputRawValue() {
        XCTAssertEqual(
            RNProblemType.invalidInput.rawValue,
            "https://curity.se/problems/invalid-input"
        )
    }

    func testIncorrectCredentialsRawValue() {
        XCTAssertEqual(
            RNProblemType.incorrectCredentials.rawValue,
            "https://curity.se/problems/incorrect-credentials"
        )
    }

    func testErrorAuthorizationResponseRawValue() {
        XCTAssertEqual(
            RNProblemType.errorAuthorizationResponse.rawValue,
            "https://curity.se/problems/error-authorization-response"
        )
    }

    func testUnexpectedRawValue() {
        XCTAssertEqual(
            RNProblemType.unexpected.rawValue,
            "https://curity.se/problems/unexpected"
        )
    }

    func testTooManyAttemptsRawValue() {
        XCTAssertEqual(
            RNProblemType.tooManyAttempts.rawValue,
            "https://curity.se/problems/too-many-attempts"
        )
    }

    func testGenericUserErrorRawValue() {
        XCTAssertEqual(
            RNProblemType.genericUserError.rawValue,
            "https://curity.se/problems/generic-user-error"
        )
    }

    func testSessionAndAccessTokenMismatchRawValue() {
        XCTAssertEqual(
            RNProblemType.sessionAndAccessTokenMismatch.rawValue,
            "https://curity.se/problems/mismatch-between-session-and-access-token"
        )
    }

    func testOtherRawValue() {
        XCTAssertEqual(RNProblemType.other.rawValue, "other")
    }
}
