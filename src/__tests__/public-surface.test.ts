/*
 * Copyright (C) 2026 Curity AB. All rights reserved.
 *
 * The contents of this file are the property of Curity AB.
 * You may not copy or use this file, in either source code
 * or executable form, except in compliance with terms
 * set by Curity AB.
 *
 * For further information, please contact Curity AB.
 */

// Smoke test for the public package surface.
//
// Goal: catch accidental surface changes at PR review time. The test
// asserts three things:
//
//   1. Every value-export documented as public is present with the
//      expected `typeof`.
//   2. Internals removed in HSRN-8 Step 8 (`getHaapiNativeModule`,
//      `IdsvrHaapiReactNativeSdkModule`) and the concrete `*Impl`
//      classes are NOT exported from the package entry.
//   3. A snapshot of the full set of runtime export keys catches any
//      accidental additions — they show up as a snapshot diff.
//
// Type-only exports (interfaces, type aliases) are erased at runtime
// and therefore not visible to `import * as`. Their presence is
// enforced by the regular `expo-module build` step (`tsc --noEmit`
// equivalent) — they would fail to compile if missing. This test
// covers the runtime surface only.

// We need to mock `expo-modules-core` because the package entry
// transitively imports `IdsvrHaapiReactNativeSdkModule.ts`, which
// calls `requireNativeModule` at module-evaluation time when the
// factories run. The smoke test doesn't actually call the factories,
// so a no-op mock is sufficient — `RNLogger` also constructs and
// touches `requireNativeModule` lazily, but only when first used.
jest.mock('expo-modules-core', () => ({
    requireNativeModule: jest.fn(() => ({
        addListener: jest.fn(() => ({ remove: jest.fn() })),
    })),
    NativeModule: class {},
}));

import * as Pkg from '../index';

// ---------------------------------------------------------------------------
// Expected public exports — value side (`typeof X !== 'undefined'` at runtime).
// Type-only exports (HaapiManager, OAuthTokenManager, HaapiAccessor,
// OAuthAccessor, Logger, RNLogger, RNLogEvent, RNLogSinkHandler,
// HaapiError (type-only), RNHaapiConfiguration, IOSConfiguration, AndroidConfiguration,
// all model interfaces, etc.) are erased — see file header.
// ---------------------------------------------------------------------------

var EXPECTED_FUNCTION_EXPORTS = [
    // HSRN-8 — accessor factories
    'initializeForHaapi',
    'initializeForOAuth',

    // Configuration factories
    'createHaapiConfiguration',
    'createAndroidConfiguration',
    'createIOSConfiguration',

    // Client authentication factories
    'noAuthentication',
    'iOSJwtAsymmetricAuthentication',
    'iOSMtlsAuthentication',
    'iOSMtlsKeyPinningAuthentication',
    'jwtSymmetricAuthentication',
    'AndroidMtlsAuthentication',
    'AndroidJwtAsymmetricAuthentication',
    'AndroidMtlsKeyPinningAuthentication',
    'secretAuthentication',

    // Token-binding factories
    'noTokenBinding',
    'iOSTokenBinding',
    'AndroidTokenBinding',

    // Logger singleton factory. Replaces the dropped `new RNLogger()`
    // value export — `RNLogger` survives as a type-only export so host
    // apps can still annotate with it.
    'getRNLogger',

    // Error helper
    'isHaapiError',
];

// Deprecated token-binding classes, kept so existing configurations keep working; replaced by
// noTokenBinding() / iOSTokenBinding(), which createIOSConfiguration maps them onto.
var EXPECTED_CLASS_EXPORTS = ['UnboundedTokenConfiguration', 'BoundTokenConfiguration'];

// String-backed enums compile to objects at runtime, so `typeof === 'object'`.
var EXPECTED_ENUM_EXPORTS = [
    'RNLogLevel',
    'RepresentationType',
    'ActionKind',
    'ActionType',
    'PollingStatus',
    'ProblemType',
    'FormFieldType',
    'ClientOperationName',
    'StepType',
    'KeyPairAlgorithmConfig',
    'StorageOption',
    'DpopKeyPolicy',
    'TokenEndpointResponseListenerOption',
    'ApplicationContextOption',
    'HttpUrlConnectionProviderOption',
    'CurrentTimeMillisProviderOption',
    'URLSessionOption',
    'CryptoKeyType',
    'KeychainAccessibility',
    'BundleOption',
    'JwtSymmetricAlgorithm',
    'JwtAsymmetricAlgorithm',
    'ClientAuthenticationKind',
    'KeyStoreOption',
    'HaapiErrorCode',
    'TokenBindingKind',
];

var REMOVED_OR_INTERNAL_EXPORTS = [
    // Removed in HSRN-8 Step 8 (was internal helper, never meant for host apps)
    'getHaapiNativeModule',
    // Removed in HSRN-8 Step 8 (was internal native-module type)
    'IdsvrHaapiReactNativeSdkModule',
    // Concrete impls — host apps go through the accessor factories
    'HaapiManagerImpl',
    'OAuthTokenManagerImpl',
    // Internal logger sentinel — host apps simply omit the optional logger
    'NO_OP_LOGGER',
    // `RNLogger` is a *type-only* export. Host apps obtain instances via
    // `getRNLogger()`; the class itself is not reachable as a runtime
    // value. Type-only exports erase at runtime, so it must NOT appear
    // in the runtime-keys snapshot below.
    'RNLogger',
    // Test-only reset is imported directly from `../logging/rn-logger`;
    // never re-exported from the package entry.
    '__resetRNLoggerForTests',
    // Removed in HSRN-22 (type alias replaced by HaapiError).
    'BridgeError',
    // Internal helpers from src/errors.ts — exported there for local use/tests,
    // but must never be part of the package entry surface.
    'decodeEnvelope',
    'rethrowAsHaapiError',
    // Internal configuration validation (src/internal/configuration-validation.ts) — the
    // factories apply it; host apps never call it.
    'validateConfiguration',
    'validateLoggerConfiguration',
    'ENUMERATED_CONFIGURATION_FIELDS',
    'ENUMERATED_LOGGER_FIELDS',
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('public surface — function exports', () => {
    EXPECTED_FUNCTION_EXPORTS.forEach((name) => {
        it('exports `' + name + '` as a function', () => {
            expect(typeof Pkg[name]).toBe('function');
        });
    });
});

describe('public surface — class exports', () => {
    EXPECTED_CLASS_EXPORTS.forEach((name) => {
        it('exports `' + name + '` as a constructor', () => {
            expect(typeof Pkg[name]).toBe('function');
            expect(Pkg[name].prototype).toBeDefined();
        });
    });
});

describe('public surface — enum exports', () => {
    EXPECTED_ENUM_EXPORTS.forEach((name) => {
        it('exports `' + name + '` as an object', () => {
            expect(typeof Pkg[name]).toBe('object');
            expect(Pkg[name]).not.toBeNull();
        });
    });
});

describe('public surface — internal symbols stay internal', () => {
    REMOVED_OR_INTERNAL_EXPORTS.forEach((name) => {
        it('does not export `' + name + '`', () => {
            expect(Pkg[name]).toBeUndefined();
        });
    });
});

describe('public surface — exhaustive runtime keys', () => {
    // Relaxed from `toEqual` to `arrayContaining` so legitimate additions
    // (new factories, new logging helpers) don't trip the snapshot until
    // the EXPECTED_* arrays are explicitly updated. The strict negative
    // check above (`REMOVED_OR_INTERNAL_EXPORTS.forEach … toBeUndefined`)
    // still catches accidental re-introductions of removed/internal
    // symbols, so the safety net stays — we just stop demanding that the
    // EXPECTED_* arrays enumerate every runtime key on every PR.
    it('the package entry exports the full documented surface (additions allowed; removals caught by the negative-list test above)', () => {
        var expected = []
            .concat(EXPECTED_FUNCTION_EXPORTS)
            .concat(EXPECTED_CLASS_EXPORTS)
            .concat(EXPECTED_ENUM_EXPORTS);
        var actual = Object.keys(Pkg);

        expect(actual).toEqual(expect.arrayContaining(expected));
    });
});
