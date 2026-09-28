# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-09-28

### Changed

- Moved the supported baseline to Expo SDK 57 and React Native 0.86.3; the
  iOS 16.4 and Android `minSdkVersion` 26 floors are unchanged. [HSRN-45]
- Bumped the bundled HAAPI native SDKs to **5.6.0** on both platforms (iOS
  5.5.0 → 5.6.0, Android 5.5.1 → 5.6.0). The React Native API is unchanged;
  the bump carries the native fixes through the platform bridge. [HSRN-44]

### Fixed

- Re-initialising while an accessor is held now rejects with the documented
  `HAAPI_ACCESSOR_ALREADY_INITIALIZED` on both platforms, and no longer builds a
  native accessor before refusing. Apps branching on the codes this previously
  surfaced — `HAAPI_TOKEN_MANAGER_ALREADY_EXISTS` on iOS, `HAAPI_UNEXPECTED` on
  Android — must switch to it. [HSRN-42]

## [1.0.1] - 2026-06-26

### Security

- Bumped the bundled HAAPI Android SDK to **5.5.1**, patching [HSA-460]: the
  debug `network_security_config.xml` (cleartext for dev/LAN hosts) that shipped
  in the release AAR has been removed, so consumer apps no longer inherit
  `android:networkSecurityConfig` (with `cleartextTrafficPermitted="true"`) in
  their merged manifest. iOS is unaffected (remains on HAAPI SDK 5.5.0).

## [1.0.0] - 2026-06-15

### Added

- First public release of `@curity/identityserver-haapi-react-native-sdk`
  — React Native bridge for the Curity Identity Server HAAPI native
  iOS and Android SDKs. See [`README.md`](./README.md) for installation
  and the quick-start example.
