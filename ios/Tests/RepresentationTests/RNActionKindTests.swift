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

final class RNActionKindTests: XCTestCase {

    func testAllCasesCount() {
        XCTAssertEqual(RNActionKind.allCases.count, 17)
    }

    func testCancelRawValue() {
        XCTAssertEqual(RNActionKind.cancel.rawValue, "cancel")
    }

    func testDeviceOptionRawValue() {
        XCTAssertEqual(RNActionKind.deviceOption.rawValue, "device-option")
    }

    func testLoginRawValue() {
        XCTAssertEqual(RNActionKind.login.rawValue, "login")
    }

    func testContinueRawValue() {
        XCTAssertEqual(RNActionKind.continue.rawValue, "continue")
    }

    func testContinueAutoLoginRawValue() {
        XCTAssertEqual(RNActionKind.continueAutoLogin.rawValue, "continue-auto-login")
    }

    func testDeviceSelectorRawValue() {
        XCTAssertEqual(RNActionKind.deviceSelector.rawValue, "device-selector")
    }

    func testRedirectRawValue() {
        XCTAssertEqual(RNActionKind.redirect.rawValue, "redirect")
    }

    func testAuthenticatorSelectorRawValue() {
        XCTAssertEqual(RNActionKind.authenticatorSelector.rawValue, "authenticator-selector")
    }

    func testSelectAuthenticatorRawValue() {
        XCTAssertEqual(RNActionKind.selectAuthenticator.rawValue, "select-authenticator")
    }

    func testPollRawValue() {
        XCTAssertEqual(RNActionKind.poll.rawValue, "poll")
    }

    func testFormRawValue() {
        XCTAssertEqual(RNActionKind.form.rawValue, "form")
    }

    func testBankIdSameDeviceRawValue() {
        XCTAssertEqual(RNActionKind.bankIdSameDevice.rawValue, "bankid-same-device")
    }

    func testBankIdOtherDeviceRawValue() {
        XCTAssertEqual(RNActionKind.bankIdOtherDevice.rawValue, "bankid-other-device")
    }

    func testPasswordResetRawValue() {
        XCTAssertEqual(RNActionKind.passwordReset.rawValue, "password-reset")
    }

    func testAccountIdRecoveryRawValue() {
        XCTAssertEqual(RNActionKind.accountIdRecovery.rawValue, "account-id-recovery")
    }

    func testUserRegisterRawValue() {
        XCTAssertEqual(RNActionKind.userRegister.rawValue, "user-register")
    }

    func testOtherRawValue() {
        XCTAssertEqual(RNActionKind.other.rawValue, "other")
    }
}
