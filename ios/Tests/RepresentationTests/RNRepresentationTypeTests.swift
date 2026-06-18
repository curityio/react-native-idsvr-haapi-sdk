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

final class RNRepresentationTypeTests: XCTestCase {

    func testAllCasesCount() {
        XCTAssertEqual(RNRepresentationType.allCases.count, 8)
    }

    func testAuthenticationStepRawValue() {
        XCTAssertEqual(RNRepresentationType.authenticationStep.rawValue, "authentication-step")
    }

    func testRedirectionStepRawValue() {
        XCTAssertEqual(RNRepresentationType.redirectionStep.rawValue, "redirection-step")
    }

    func testRegistrationStepRawValue() {
        XCTAssertEqual(RNRepresentationType.registrationStep.rawValue, "registration-step")
    }

    func testPollingStepRawValue() {
        XCTAssertEqual(RNRepresentationType.pollingStep.rawValue, "polling-step")
    }

    func testContinueSameStepRawValue() {
        XCTAssertEqual(RNRepresentationType.continueSameStep.rawValue, "continue-same-step")
    }

    func testOauthAuthorizationResponseRawValue() {
        XCTAssertEqual(RNRepresentationType.oauthAuthorizationResponse.rawValue, "oauth-authorization-response")
    }

    func testConsentorStepRawValue() {
        XCTAssertEqual(RNRepresentationType.consentorStep.rawValue, "consentor-step")
    }

    func testUserConsentStepRawValue() {
        XCTAssertEqual(RNRepresentationType.userConsentStep.rawValue, "user-consent-step")
    }
}
