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

// Fixture values are pulled from HSRN-8 plan § 11.11 so this test, the
// future bridge tests (Step 4), and the TS-side tests (Step 6) all assert
// against the same canonical TokenResponse shapes.
//
// File delivered alongside the Android `RNTokenResponseRecordTest.kt` and
// mirrors that test 1:1 (same case order, same fixture values, same
// field-by-field assertions). Since HSRN-23, this file runs in the full
// native iOS test workspace (`npm run test:ios:native`).

final class RNTokenResponseRecordTests: XCTestCase {

    // MARK: - Defaults

    func testDefaultResponseTypeIsSuccess() {
        let record = RNTokenResponseRecord()
        XCTAssertEqual(record.responseType, .success)
    }

    func testDefaultSuccessFieldsAreNil() {
        let record = RNTokenResponseRecord()
        XCTAssertNil(record.accessToken)
        XCTAssertNil(record.tokenType)
        XCTAssertNil(record.scope)
        // `expiresIn` is now an optional `Double?` so the error branch
        // can omit it (RFC 6749 has no spec field for it on errors).
        // The default is `nil`, not `0.0`.
        XCTAssertNil(record.expiresIn)
        XCTAssertNil(record.refreshToken)
        XCTAssertNil(record.idToken)
    }

    func testDefaultErrorFieldsAreNil() {
        let record = RNTokenResponseRecord()
        XCTAssertNil(record.error)
        XCTAssertNil(record.errorDescription)
        XCTAssertNil(record.errorUri)
    }

    // MARK: - Field population

    func testSuccessShapePopulatesAllFields() {
        // Fixture B (OIDC success).
        var record = RNTokenResponseRecord()
        record.responseType = .success
        record.accessToken = "24605f8a-b558-4527-adcc-99f7d401d4c5"
        record.tokenType = "bearer"
        record.scope = "address openid"
        record.expiresIn = 299.0
        record.refreshToken = "f33c1f4c-ee98-4ad7-8583-c53772225f78"
        record.idToken = "eyJraWQiOiItMzgwNzQ4MTIi"

        XCTAssertEqual(record.responseType, .success)
        XCTAssertEqual(record.accessToken, "24605f8a-b558-4527-adcc-99f7d401d4c5")
        XCTAssertEqual(record.tokenType, "bearer")
        XCTAssertEqual(record.scope, "address openid")
        XCTAssertEqual(record.expiresIn, 299.0)
        XCTAssertEqual(record.refreshToken, "f33c1f4c-ee98-4ad7-8583-c53772225f78")
        XCTAssertEqual(record.idToken, "eyJraWQiOiItMzgwNzQ4MTIi")
    }

    func testErrorShapePopulatesAllErrorFields() {
        // Fixture E (invalid_grant) plus a synthetic errorUri to exercise the field.
        var record = RNTokenResponseRecord()
        record.responseType = .error
        record.error = "invalid_grant"
        record.errorDescription = "Invalid or unknown refresh token provided."
        record.errorUri = "https://docs.example.com/errors/invalid_grant"

        XCTAssertEqual(record.responseType, .error)
        XCTAssertEqual(record.error, "invalid_grant")
        XCTAssertEqual(record.errorDescription, "Invalid or unknown refresh token provided.")
        XCTAssertEqual(record.errorUri, "https://docs.example.com/errors/invalid_grant")
    }

    // MARK: - debugDescription

    func testDebugDescriptionContainsClassNameAndDiscriminator() {
        let output = RNTokenResponseRecord().debugDescription
        XCTAssertTrue(output.contains("RNTokenResponseRecord"),
                      "debugDescription should contain the class name")
        XCTAssertTrue(output.contains("responseType"),
                      "debugDescription should contain the responseType key")
        XCTAssertTrue(output.contains("success"),
                      "debugDescription should contain the default discriminator value")
    }

    func testDebugDescriptionContainsPopulatedSuccessFields() {
        var record = RNTokenResponseRecord()
        record.accessToken = "c2f1bd4c-a1bf-49b8-aa64-1535fa5161a6"
        record.tokenType = "bearer"
        record.expiresIn = 600.0

        let output = record.debugDescription
        XCTAssertTrue(output.contains("c2f1bd4c-a1bf-49b8-aa64-1535fa5161a6"))
        XCTAssertTrue(output.contains("bearer"))
        XCTAssertTrue(output.contains("600"))
    }

    func testDebugDescriptionContainsPopulatedErrorFields() {
        var record = RNTokenResponseRecord()
        record.responseType = .error
        record.error = "invalid_grant"
        record.errorDescription = "Invalid or unknown refresh token provided."

        let output = record.debugDescription
        XCTAssertTrue(output.contains("error"))
        XCTAssertTrue(output.contains("invalid_grant"))
        XCTAssertTrue(output.contains("Invalid or unknown refresh token provided."))
    }
}
