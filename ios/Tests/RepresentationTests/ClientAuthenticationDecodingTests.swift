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
internal import ExpoModulesCore
@testable import RNIdsvrHaapiSdk

/// Converts the JWT algorithm strings the TypeScript layer sends exactly as the bridge does, then
/// checks the native SDK receives that algorithm. Every Expo conversion of an enum field — from a
/// JS object or from a dictionary — ends in `Enumerable.create(fromRawValue:)`, the call that
/// rejected `"HS256"` at init when the bridge enums used lowercase raw values. Building records in
/// Swift with `.hs256` (as `ClientAuthenticationConversionTests` does) skips that call, which is how
/// the defect went unnoticed.
///
/// `Record(from:appContext:)` would add Expo's field plumbing, but in this test workspace its
/// reflection finds no fields (ExpoModulesCore's types resolve differently across the framework and
/// the test bundle), so a decoded record keeps its defaults whatever the input.
final class ClientAuthenticationDecodingTests: XCTestCase {
    private func symmetricRecord(
        _ algorithm: RNJWTSymmetricAlgorithm
    ) -> ClientAuthenticationMethodConfigurationRecord {
        var record = ClientAuthenticationMethodConfigurationRecord()
        record.kind = .jwtSymmetric
        record.symmetricAlgorithm = algorithm
        record.secretKey = "a-shared-secret"
        return record
    }

    func testEverySymmetricAlgorithmTheTSLayerSendsSignsWithThatAlgorithm() {
        let expected: [(tsValue: String, native: IdsvrHaapiSdk.JWTSymmetricAlgorithm)] = [
            ("HS256", .hs256),
            ("HS384", .hs384),
            ("HS512", .hs512),
        ]
        for (tsValue, native) in expected {
            do {
                let algorithm = try RNJWTSymmetricAlgorithm.create(fromRawValue: tsValue)
                let method = try symmetricRecord(algorithm).toAuthMethod(NativeRegistry())
                guard let symmetric = method as? ClientAuthenticationMethodJWTSymmetric else {
                    XCTFail("\(tsValue): expected a symmetric JWT method, got \(type(of: method))")
                    continue
                }
                XCTAssertEqual(symmetric.signatureAlgorithm, native, tsValue)
            } catch {
                XCTFail("\(tsValue) was rejected: \(error)")
            }
        }
    }

    /// A full `toAuthMethod` would load a private key from the bundle; test keys are deliberately
    /// not shipped in this test tree (it is part of the public mirror), so the converted value and
    /// its mapping to the native algorithm are asserted instead.
    func testEveryAsymmetricAlgorithmTheTSLayerSendsReachesTheNativeSDKUnchanged() {
        let expected: [(tsValue: String, native: IdsvrHaapiSdk.JWTAsymmetricAlgorithm)] = [
            ("RS256", .rs256),
            ("RS384", .rs384),
            ("RS512", .rs512),
            ("PS256", .ps256),
            ("PS384", .ps384),
            ("PS512", .ps512),
            ("ES256", .es256),
            ("ES384", .es384),
            ("ES512", .es512),
        ]
        for (tsValue, native) in expected {
            do {
                let algorithm = try RNJWTAsymmetricAlgorithm.create(fromRawValue: tsValue)
                XCTAssertEqual(algorithm.toJWTAsymmetricAlgorithm(), native, tsValue)
            } catch {
                XCTFail("\(tsValue) was rejected: \(error)")
            }
        }
    }

    /// The bridge accepts exactly the TypeScript values, as Android always has. The TS layer rejects
    /// these before the bridge; this pins what the bridge itself does.
    func testALowercaseAlgorithmIsRejectedByTheBridgeConversion() {
        XCTAssertThrowsError(try RNJWTSymmetricAlgorithm.create(fromRawValue: "hs256"), "hs256") { error in
            XCTAssertEqual((error as? CodedError)?.code, "ERR_ENUM_NO_SUCH_VALUE", "hs256")
        }
        XCTAssertThrowsError(try RNJWTAsymmetricAlgorithm.create(fromRawValue: "es256"), "es256") { error in
            XCTAssertEqual((error as? CodedError)?.code, "ERR_ENUM_NO_SUCH_VALUE", "es256")
        }
    }
}
