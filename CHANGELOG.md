# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-11-02

### Added

- `HaapiErrorCode.StorageUnavailable` (`HAAPI_STORAGE_UNAVAILABLE`, retryable):
  the platform key store is temporarily unavailable. On Android, SDK init
  reports it instead of starting without the stored token-binding key, so a
  retry keeps the existing sign-in. [HSRN-49]
- On Android, `AndroidTokenBinding()` takes a key policy (`keyType`) and can
  adopt an earlier version's key (`migrateFromLegacyAlias`); a hardware-only key
  the device can't create reports `HAAPI_DPOP_KEY_CREATION_FAILURE` (`dpop`), as
  on iOS. [HSRN-36]
- On iOS, `keychainConfiguration` in `createIOSConfiguration` keeps the SDK's
  keychain items in a shared access group, so a native app extension can use the
  session, and can make them readable only while the device is unlocked
  (`KeychainAccessibility`). Without it, behaviour is unchanged. [HSRN-37]
- `OAuthTokenManager.createDpopProof` creates a DPoP proof for calling your own
  resource server with a DPoP-bound access token. [HSRN-47]
- `HaapiErrorCode.InvalidArgument` (`HAAPI_INVALID_ARGUMENT`, category `bridge`):
  a call's input can't be used. [HSRN-47]

### Changed

- **Breaking:** token binding is now opt-in on both platforms, as a consequence
  of the HSRN-54 fix below (binding can now really be turned off, so the default
  is no binding). Tokens are no longer sender-constrained unless you pass
  `iOSTokenBinding()` / `AndroidTokenBinding()` as `tokenBindingConfiguration` —
  required if your client issues token-bound authorization codes. On Android,
  existing sign-ins end with the new default and users must sign in again unless
  the binding adopts their key (`migrateFromLegacyAlias`); iOS sign-ins
  continue. See the
  [upgrade guide](https://curity.io/docs/identity-server/developer-guide/haapi-sdks/upgrade-guides/react-native-vn/).
  [HSRN-54]
- On iOS, a locked or unusable keychain is now reported as
  `HAAPI_STORAGE_UNAVAILABLE` (category `haapi`) instead of a `HAAPI_DPOP_*`
  code (category `dpop`). Recovery is unchanged. [HSRN-49]
- Bumped the bundled HAAPI native SDKs to iOS **5.7.1** and Android **5.7.0**.
  The React Native API is unchanged. [HSRN-50]
- `followLink` now refuses a link whose target is not the configured identity
  server, on both platforms, without sending the request; it fails with
  `HAAPI_UNEXPECTED` (category `unexpected`). [HSRN-50]
- Building for iOS now requires Xcode 27 or later. The bundled iOS SDK's own
  minimum is now iOS 15.0; this package's minimum stays iOS 16.4. [HSRN-50]
- An unsupported configuration value (an algorithm, a `kind` or an option outside
  its enum) now fails initialization, and `getRNLogger`, with
  `HAAPI_INVALID_CONFIGURATION` (category `configuration`) on both platforms,
  instead of an untyped error. [HSRN-56]

### Deprecated

- `tokenBoundConfiguration`, in favour of `tokenBindingConfiguration` built with
  `noTokenBinding()`, `iOSTokenBinding()` or `AndroidTokenBinding()`. The old
  setting keeps working: `BoundTokenConfiguration` stays bound with the same
  settings, the Android object stays bound and keeps its key, and
  `UnboundedTokenConfiguration` now really turns binding off. Also deprecated:
  `UnboundedTokenConfiguration`, `BoundTokenConfiguration`,
  `IOSTokenBoundConfiguration` and `AndroidTokenBoundConfiguration`. [HSRN-54]

### Fixed

- On iOS, revoking a token now uses the configured client authentication, so
  clients that authenticate with a secret or mutual TLS no longer fail
  revocation with HTTP 401. [HSRN-50]
- On Android, the configuration logged at init (debug level) no longer includes
  the client secret, the PKCS#12 passphrase or the JWT signing key. [HSRN-50]
- On Android, a token-bound sign-in now keeps refreshing after later sign-ins,
  app restarts and HAAPI access-token expiry, instead of failing with
  `invalid_grant`. [HSRN-50]
- `StorageOption.Default` on Android now keeps stored values encrypted at rest
  under a non-exportable Android Keystore key; values stored by earlier versions
  move across automatically on first launch, so existing sessions are kept.
  [HSRN-49]
- Token binding can now be turned off on both platforms with `noTokenBinding()`;
  on iOS, the documented "unbound" configuration previously bound tokens
  anyway. [HSRN-54]
- Android reports `HAAPI_INVALID_CONFIGURATION` for an incomplete
  client-authentication or token-binding configuration, as iOS does (it was
  `HAAPI_UNEXPECTED`). [HSRN-54]
- On iOS, JWT client authentication (`jwtSymmetricAuthentication()`,
  `iOSJwtAsymmetricAuthentication()`) no longer fails at initialization.
  [HSRN-56]

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
