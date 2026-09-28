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

final class RNClientOperationTypeTests: XCTestCase {

    func testAllCasesCount() {
        XCTAssertEqual(RNClientOperationType.allCases.count, 6)
    }

    func testExternalBrowserFlowRawValue() {
        XCTAssertEqual(RNClientOperationType.externalBrowserFlow.rawValue, "external-browser-flow")
    }

    func testBankidRawValue() {
        XCTAssertEqual(RNClientOperationType.bankid.rawValue, "bankid")
    }

    func testEncapAutoActivationRawValue() {
        XCTAssertEqual(RNClientOperationType.encapAutoActivation.rawValue, "encap-auto-activation")
    }

    func testWebauthnRegistrationRawValue() {
        XCTAssertEqual(RNClientOperationType.webauthnRegistration.rawValue, "webauthn-registration")
    }

    func testWebauthnAuthenticationRawValue() {
        XCTAssertEqual(RNClientOperationType.webauthnAuthentication.rawValue, "webauthn-authentication")
    }

    func testGenericRawValue() {
        XCTAssertEqual(RNClientOperationType.generic.rawValue, "generic")
    }
}
