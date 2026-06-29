// swift-tools-version: 6.0
//
// Manifest for the iOS bridge of IdsvrHaapiReactNativeSdk.
//
// ROLE OF THIS FILE
//
// This Package.swift is NOT a test runner. iOS unit tests for this SDK run
// via the xcodegen + CocoaPods workspace at
// `ios/IdsvrHaapiReactNativeSdk.xcworkspace` — see `ios/CLAUDE.md` "Build &
// Run".
//
// What it IS:
//
//   (a) Xcode source indexing for the full bridge tree. Opening any *.swift
//       file under `ios/` in Xcode reads symbol tables from this manifest.
//   (b) Forward-positioning for Expo SDK 56's expected SPM-native module
//       support. When ExpoModulesCore eventually ships as SPM (HSRN-24+),
//       the transitional `ios/Podfile` is deleted and this manifest absorbs
//       the remaining deps.
//   (c) One canonical place for the IdsvrHaapiSdk SPM pin alongside the
//       podspec and `project.yml`. The version literal below is kept in sync
//       with the others by `scripts/sync-haapi-version.js` (CI-guarded via its
//       `--check` mode) — do not hand-edit it.
//
// What it is NOT:
//
//   - A buildable target. `swift build` fails at `import ExpoModulesCore`
//     because Expo SDK 55 does not publish `ExpoModulesCore` as a Swift
//     Package.
//   - A test runner. The `.testTarget(...)` declarations that previously
//     lived here were removed in HSRN-23 — three of the four needed
//     `ExpoModulesCore` (which `swift test` cannot provide), and the
//     xcodegen workspace is now the single source of truth for tests.
//
// HAAPI SDK version below is the iOS pin and MUST stay in sync with:
//   - `package.json -> haapi.ios.version`
//   - `ios/IdsvrHaapiReactNativeSdk.podspec` (`spm_dependency` call)
//   - `ios/project.yml` (`packages: IdsvrHaapiSdk exactVersion`)
//
import PackageDescription

let package = Package(
    name: "RNIdsvrHaapiSdk",
    platforms: [.iOS("16.4")],
    products: [
        .library(name: "RNIdsvrHaapiSdk", targets: ["RNIdsvrHaapiSdk"]),
    ],
    dependencies: [
        .package(
            url: "https://github.com/curityio/ios-idsvr-haapi-sdk-dist.git",
            exact: "5.5.0"
        ),
    ],
    targets: [
        .target(
            name: "RNIdsvrHaapiSdk",
            dependencies: [
                .product(name: "IdsvrHaapiSdk", package: "ios-idsvr-haapi-sdk-dist"),
            ],
            path: ".",
            exclude: [
                "CLAUDE.md",
                "IdsvrHaapiReactNativeSdk.podspec",
                "Podfile",
                "Podfile.shared.rb",
                "Tests",
            ]
        ),
    ]
)
