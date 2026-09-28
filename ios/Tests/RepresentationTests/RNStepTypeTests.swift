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

final class RNStepTypeTests: XCTestCase {

    func testAllCasesCount() {
        XCTAssertEqual(RNStepType.allCases.count, 14)
    }

    func testAuthenticatorSelectorRawValue() {
        XCTAssertEqual(RNStepType.authenticatorSelector.rawValue, "authenticatorSelector")
    }

    func testInteractiveFormRawValue() {
        XCTAssertEqual(RNStepType.interactiveForm.rawValue, "interactiveForm")
    }

    func testUserConsentRawValue() {
        XCTAssertEqual(RNStepType.userConsent.rawValue, "userConsent")
    }

    func testRedirectionRawValue() {
        XCTAssertEqual(RNStepType.redirection.rawValue, "redirection")
    }

    func testPollingRawValue() {
        XCTAssertEqual(RNStepType.polling.rawValue, "polling")
    }

    func testContinueSameRawValue() {
        XCTAssertEqual(RNStepType.continueSame.rawValue, "continueSame")
    }

    func testOAuthAuthorizationResponseRawValue() {
        XCTAssertEqual(RNStepType.oAuthAuthorizationResponse.rawValue, "oAuthAuthorizationResponse")
    }

    func testExternalBrowserClientOperationRawValue() {
        XCTAssertEqual(RNStepType.externalBrowserClientOperation.rawValue, "externalBrowserClientOperation")
    }

    func testBankIdClientOperationRawValue() {
        XCTAssertEqual(RNStepType.bankIdClientOperation.rawValue, "bankIdClientOperation")
    }

    func testEncapClientOperationRawValue() {
        XCTAssertEqual(RNStepType.encapClientOperation.rawValue, "encapClientOperation")
    }

    func testWebAuthnRegistrationClientOperationRawValue() {
        XCTAssertEqual(
            RNStepType.webAuthnRegistrationClientOperation.rawValue,
            "webAuthnRegistrationClientOperation"
        )
    }

    func testWebAuthnAuthenticationClientOperationRawValue() {
        XCTAssertEqual(
            RNStepType.webAuthnAuthenticationClientOperation.rawValue,
            "webAuthnAuthenticationClientOperation"
        )
    }

    func testGenericClientOperationRawValue() {
        XCTAssertEqual(RNStepType.genericClientOperation.rawValue, "genericClientOperation")
    }

    func testGenericRepresentationRawValue() {
        XCTAssertEqual(RNStepType.genericRepresentation.rawValue, "genericRepresentation")
    }
}
