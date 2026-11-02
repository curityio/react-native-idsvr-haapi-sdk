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

/// The access group and level the bridge gives the native keychain builder for each keychain
/// configuration the TypeScript layer can send, and the storage the builder returns.
///
/// The native keychain storage type is internal to the SDK, so the built storage's group and level are
/// read by reflection (see `storedProperty(_:of:)`). Records are built in Swift, as in
/// `ClientAuthenticationDecodingTests`; enum values go through `Enumerable.create(fromRawValue:)`,
/// the conversion every value from JavaScript goes through.
final class KeychainConfigurationTests: XCTestCase {
    private func configuration(keychain: RNKeychainConfigurationRecord?) -> iOSConfigurationRecord {
        iOSConfigurationRecord(
            name: "ios-test-configuration",
            clientId: "ios-test-client",
            appRedirect: "testapp://callback",
            urlSessionOption: .default,
            attestationConfiguration: RNAttestationConfigurationRecord(),
            clientAuthenticationMethodConfiguration: ClientAuthenticationMethodConfigurationRecord(),
            keychainConfiguration: keychain
        )
    }

    /// A stored property of the storage `nativeStorage()` builds, read by reflection because the native
    /// keychain storage type is internal. A property the native SDK renames fails here rather than
    /// reading as `nil`.
    private func storedProperty(_ name: String, of storage: any Storage) -> Any? {
        let children = Mirror(reflecting: storage).children
        let child = children.first { $0.label == name }
        XCTAssertNotNil(child, "no stored property '\(name)' in \(children.map { $0.label ?? "?" })")
        return child?.value
    }

    // MARK: Built storage

    func testTheBuiltStorageCarriesTheConfiguredGroupAndLevel() {
        let storage = configuration(keychain: RNKeychainConfigurationRecord(
            accessGroup: "ABCDE12345.com.example.shared",
            accessibility: .whenUnlockedThisDeviceOnly
        )).nativeStorage()

        XCTAssertEqual(storedProperty("accessGroup", of: storage) as? String, "ABCDE12345.com.example.shared")
        XCTAssertEqual(
            storedProperty("accessibility", of: storage) as? IdsvrHaapiSdk.KeychainAccessibility,
            .whenUnlockedThisDeviceOnly
        )
    }

    func testWithoutAKeychainConfigurationTheBuiltStorageIsTheNativeDefault() {
        let storage = configuration(keychain: nil).nativeStorage()

        XCTAssertNil(storedProperty("accessGroup", of: storage) as? String)
        XCTAssertEqual(
            storedProperty("accessibility", of: storage) as? IdsvrHaapiSdk.KeychainAccessibility,
            .afterFirstUnlockThisDeviceOnly
        )
    }

    // MARK: Access group

    func testAConfiguredAccessGroupReachesTheNativeBuilderUnchanged() {
        for group in ["ABCDE12345.com.example.shared", "group.com.example.shared"] {
            let settings = configuration(keychain: RNKeychainConfigurationRecord(accessGroup: group))
                .keychainStorageSettings
            XCTAssertEqual(settings.accessGroup, group, group)
        }
    }

    func testAGroupAndALevelReachTheNativeBuilderTogether() {
        let settings = configuration(keychain: RNKeychainConfigurationRecord(
            accessGroup: "ABCDE12345.com.example.shared",
            accessibility: .whenUnlockedThisDeviceOnly
        )).keychainStorageSettings

        XCTAssertEqual(settings.accessGroup, "ABCDE12345.com.example.shared")
        XCTAssertEqual(settings.accessibility, IdsvrHaapiSdk.KeychainAccessibility.whenUnlockedThisDeviceOnly)
    }

    // MARK: No keychain configuration

    func testWithoutAKeychainConfigurationTheBuilderGetsNoSettingSoTheNativeDefaultApplies() {
        let settings = configuration(keychain: nil).keychainStorageSettings

        XCTAssertNil(settings.accessGroup)
        XCTAssertNil(settings.accessibility)
    }

    func testAnEmptyKeychainConfigurationGivesTheBuilderNoSettingEither() {
        let settings = configuration(keychain: RNKeychainConfigurationRecord()).keychainStorageSettings

        XCTAssertNil(settings.accessGroup)
        XCTAssertNil(settings.accessibility)
    }

    func testTheRecordDefaultsToNoKeychainConfiguration() {
        XCTAssertNil(iOSConfigurationRecord().keychainConfiguration)
    }

    func testTheDebugDescriptionShowsTheKeychainConfiguration() {
        let configured = configuration(keychain: RNKeychainConfigurationRecord(accessGroup: "ABCDE12345.com.example.shared"))
        XCTAssertTrue(configured.debugDescription.contains("ABCDE12345.com.example.shared"), configured.debugDescription)

        let absent = configuration(keychain: nil)
        XCTAssertTrue(absent.debugDescription.contains("\"keychainConfiguration\": \"nil\""), absent.debugDescription)
    }

    // MARK: Accessibility level

    func testEveryLevelTheTSLayerSendsReachesTheNativeBuilderAsTheMatchingLevel() throws {
        let expected: [(tsValue: String, native: IdsvrHaapiSdk.KeychainAccessibility)] = [
            ("afterFirstUnlockThisDeviceOnly", .afterFirstUnlockThisDeviceOnly),
            ("whenUnlockedThisDeviceOnly", .whenUnlockedThisDeviceOnly),
        ]
        for (tsValue, native) in expected {
            let level = try RNKeychainAccessibility.create(fromRawValue: tsValue)
            let settings = configuration(keychain: RNKeychainConfigurationRecord(accessGroup: nil, accessibility: level))
                .keychainStorageSettings

            XCTAssertEqual(settings.accessibility, native, tsValue)
            XCTAssertNil(settings.accessGroup, "a level alone keeps the app's default access group (\(tsValue))")
        }
    }

    func testAGroupWithoutALevelLeavesTheLevelToTheNativeDefault() {
        let settings = configuration(keychain: RNKeychainConfigurationRecord(accessGroup: "ABCDE12345.com.example.shared"))
            .keychainStorageSettings

        XCTAssertNil(settings.accessibility)
    }

    /// The TS layer rejects these before the bridge; this pins what the bridge itself does.
    func testALevelOutsideTheTSValuesIsRejectedByTheBridgeConversion() {
        for value in ["whenUnlocked", "WhenUnlockedThisDeviceOnly"] {
            XCTAssertThrowsError(try RNKeychainAccessibility.create(fromRawValue: value), value) { error in
                XCTAssertEqual((error as? CodedError)?.code, "ERR_ENUM_NO_SUCH_VALUE", value)
            }
        }
    }
}
