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

// An unsupported value in an enumerated configuration field must be rejected before the bridge,
// with the same typed `HAAPI_INVALID_CONFIGURATION` error on both platforms. Left to the bridge,
// the value fails native argument conversion instead: an untyped error whose code differs per
// platform (`ERR_ARGUMENT_CAST` on iOS, `ERR_UNEXPECTED` on Android).
//
// The allowed values below are written out by hand, so a wrong enum in the validation table
// fails here rather than being mirrored by it.

import { validateConfiguration, validateLoggerConfiguration } from '../internal/configuration-validation';
import { isHaapiError } from '../errors';
import { createHaapiConfiguration } from '../haapi-configuration';
import { createIOSConfiguration, iOSTokenBinding, CryptoKeyType, URLSessionOption, BundleOption } from '../ios-configuration';
import {
    createAndroidConfiguration,
    AndroidTokenBinding,
    StorageOption,
    ApplicationContextOption,
    TokenEndpointResponseListenerOption,
} from '../android-configuration';
import {
    jwtSymmetricAuthentication,
    iOSJwtAsymmetricAuthentication,
    AndroidJwtAsymmetricAuthentication,
    JwtSymmetricAlgorithm,
    JwtAsymmetricAlgorithm,
    KeyStoreOption,
} from '../clientAuthenticationMethods';
import { RNLogLevel } from '../logging/rn-log-level';

// ---------------------------------------------------------------------------
// Fixtures — configurations as an app builds them with the public factories
// ---------------------------------------------------------------------------

function crossPlatformConfiguration() {
    return createHaapiConfiguration({
        baseUrl: 'https://idsvr.example.com',
        authorizationEndpointUrl: 'https://idsvr.example.com/oauth/v2/oauth-authorize',
        tokenEndpointUrl: 'https://idsvr.example.com/oauth/v2/oauth-token',
        iosConfig: createIOSConfiguration({
            clientId: 'haapi-ios-client',
            appRedirect: 'app://haapi',
            urlSessionOption: URLSessionOption.Ephemeral,
            tokenBindingConfiguration: iOSTokenBinding({ keyPairType: CryptoKeyType.P256 }),
            clientAuthenticationMethodConfig: iOSJwtAsymmetricAuthentication({
                asymmetricAlgorithm: JwtAsymmetricAlgorithm.ES256,
                pemFilename: 'client-private-key',
                bundleOption: BundleOption.Main,
            }),
        }),
        androidConfig: createAndroidConfiguration({
            clientId: 'haapi-android-client',
            appRedirect: 'app://haapi',
            tokenBindingConfiguration: AndroidTokenBinding({ storageOption: StorageOption.Default }),
            clientAuthenticationMethodConfig: AndroidJwtAsymmetricAuthentication({
                asymmetricAlgorithm: JwtAsymmetricAlgorithm.ES256,
                alias: 'client-key',
                clientKeyStoreOption: KeyStoreOption.Client,
            }),
            tokenEndpointResponseListenerOption: TokenEndpointResponseListenerOption.None,
            applicationContextOption: ApplicationContextOption.Default,
            dcrConfiguration: {
                templateClientId: 'haapi-template-client',
                clientRegistrationEndpointUrl: 'https://idsvr.example.com/oauth/v2/oauth-dcr',
                contextOption: ApplicationContextOption.Default,
            },
        }),
    });
}

function symmetricConfiguration() {
    return createHaapiConfiguration({
        baseUrl: 'https://idsvr.example.com',
        authorizationEndpointUrl: 'https://idsvr.example.com/oauth/v2/oauth-authorize',
        tokenEndpointUrl: 'https://idsvr.example.com/oauth/v2/oauth-token',
        iosConfig: createIOSConfiguration({
            clientId: 'haapi-ios-client-symmetric',
            appRedirect: 'app://haapi',
            clientAuthenticationMethodConfig: jwtSymmetricAuthentication({
                symmetricAlgorithm: JwtSymmetricAlgorithm.HS256,
                secretKey: 'a-shared-secret',
            }),
        }),
    });
}

// A deep copy with `value` written at the dotted `path`, creating intermediate objects.
function withValue(configuration, path, value) {
    const copy = JSON.parse(JSON.stringify(configuration));
    const keys = path.split('.');
    let target = copy;
    keys.slice(0, -1).forEach(key => {
        if (target[key] === undefined || target[key] === null) {
            target[key] = {};
        }
        target = target[key];
    });
    target[keys[keys.length - 1]] = value;
    return copy;
}

function rejection(validate) {
    try {
        validate();
    } catch (error) {
        return error;
    }
    throw new Error('expected the configuration to be rejected');
}

// The shape the native normalizers give HAAPI_INVALID_CONFIGURATION, from TS ("TSBridge").
function expectInvalidConfiguration(error) {
    expect(isHaapiError(error)).toBe(true);
    expect(error.code).toBe('HAAPI_INVALID_CONFIGURATION');
    expect(error.category).toBe('configuration');
    expect(error.nativeCause).toBe('TSBridge');
    expect(error.recovery).toEqual({
        kind: 'unrecoverable',
        action: { kind: 'modifyConfiguration', reason: error.errorDescription },
    });
    expect(error.message).toBe(error.errorDescription);
}

// ---------------------------------------------------------------------------
// Every enumerated field of the configuration, with its allowed values (hand-written)
// ---------------------------------------------------------------------------

const CLIENT_AUTHENTICATION_KINDS = ['none', 'secret', 'mtls', 'mtlsKeyPinning', 'jwtAsymmetric', 'jwtSymmetric'];
const SYMMETRIC_ALGORITHMS = ['HS256', 'HS384', 'HS512'];
const ASYMMETRIC_ALGORITHMS = ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512'];
const KEY_STORE_OPTIONS = ['client', 'server', 'alternateClient', 'alternateServer'];
const TOKEN_BINDING_KINDS = ['unbound', 'bound'];
const DEFAULT_OR_CUSTOM = ['default', 'custom'];

function clientAuthenticationFields(platform) {
    const prefix = platform + '.clientAuthenticationMethodConfiguration.';
    return [
        [prefix + 'kind', CLIENT_AUTHENTICATION_KINDS],
        [prefix + 'symmetricAlgorithm', SYMMETRIC_ALGORITHMS],
        [prefix + 'asymmetricAlgorithm', ASYMMETRIC_ALGORITHMS],
        [prefix + 'bundleOption', ['main', 'custom']],
        [prefix + 'clientKeyStoreOption', KEY_STORE_OPTIONS],
        [prefix + 'serverKeyStoreOption', KEY_STORE_OPTIONS],
    ];
}

const ENUMERATED_FIELDS = [
    ['iosConfig.urlSessionOption', ['default', 'ephemeral', 'custom']],
    ['iosConfig.tokenBindingConfiguration.kind', TOKEN_BINDING_KINDS],
    ['iosConfig.tokenBindingConfiguration.keyPairType', ['p256', 'secureEnclave', 'security']],
    ['iosConfig.tokenBoundConfiguration.keyPairType', ['p256', 'secureEnclave', 'security']],
    ['iosConfig.keychainConfiguration.accessibility', ['afterFirstUnlockThisDeviceOnly', 'whenUnlockedThisDeviceOnly']],
    ...clientAuthenticationFields('iosConfig'),
    ['androidConfig.httpUrlConnectionProviderOption', DEFAULT_OR_CUSTOM],
    ['androidConfig.currentTimeMillisProviderOption', DEFAULT_OR_CUSTOM],
    ['androidConfig.tokenEndpointResponseListenerOption', ['none', 'custom']],
    ['androidConfig.applicationContextOption', DEFAULT_OR_CUSTOM],
    ['androidConfig.tokenBindingConfiguration.kind', TOKEN_BINDING_KINDS],
    ['androidConfig.tokenBindingConfiguration.keyType', ['auto', 'hardware', 'software']],
    ['androidConfig.tokenBindingConfiguration.storageOption', DEFAULT_OR_CUSTOM],
    ['androidConfig.tokenBoundConfiguration.storageOption', DEFAULT_OR_CUSTOM],
    // `KeyPairAlgorithmConfig` entries, which Android maps by their `jwtAlgorithm`.
    ['androidConfig.tokenBindingConfiguration.keyPairAlgorithmConfiguration.jwtAlgorithm', ['ES256', 'ES384', 'ES512']],
    ['androidConfig.tokenBoundConfiguration.keyPairAlgorithmConfiguration.jwtAlgorithm', ['ES256', 'ES384', 'ES512']],
    ...clientAuthenticationFields('androidConfig'),
    ['androidConfig.dcrConfiguration.contextOption', DEFAULT_OR_CUSTOM],
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateConfiguration', () => {
    test('accepts configurations built with the public factories', () => {
        expect(() => validateConfiguration(crossPlatformConfiguration())).not.toThrow();
        expect(() => validateConfiguration(symmetricConfiguration())).not.toThrow();
    });

    test('accepts optional enumerated fields that are absent or null', () => {
        const configuration = withValue(
            withValue(symmetricConfiguration(), 'iosConfig.tokenBoundConfiguration', null),
            'iosConfig.dcrConfiguration',
            undefined,
        );
        expect(() => validateConfiguration(configuration)).not.toThrow();
    });

    ENUMERATED_FIELDS.forEach(([path, allowed]) => {
        test(`${path} accepts every supported value`, () => {
            allowed.forEach(value => {
                expect(() => validateConfiguration(withValue(crossPlatformConfiguration(), path, value))).not.toThrow();
            });
        });

        test(`${path} rejects a supported value in the wrong case, naming the field, the value and the allowed values`, () => {
            const wrongCase = allowed[0] === allowed[0].toUpperCase() ? allowed[0].toLowerCase() : allowed[0].toUpperCase();
            const error = rejection(() =>
                validateConfiguration(withValue(crossPlatformConfiguration(), path, wrongCase)),
            );
            expectInvalidConfiguration(error);
            expect(error.errorDescription).toContain(path);
            expect(error.errorDescription).toContain(JSON.stringify(wrongCase));
            allowed.forEach(value => expect(error.errorDescription).toContain(value));
        });
    });

    test('rejects a JWT algorithm that differs from a supported one only in case', () => {
        const error = rejection(() =>
            validateConfiguration(
                withValue(symmetricConfiguration(), 'iosConfig.clientAuthenticationMethodConfiguration.symmetricAlgorithm', 'hs256'),
            ),
        );
        expectInvalidConfiguration(error);
        expect(error.errorDescription).toContain('"hs256"');
        expect(error.errorDescription).toContain('HS256');
    });

    test('does not echo a string longer than every value the field takes, such as a secret in the wrong field', () => {
        // An algorithm is at most five characters, so a 32-character value is no typo of one: it
        // is most likely the secret meant for `secretKey`.
        const pasted = 'k'.repeat(32);
        const error = rejection(() =>
            validateConfiguration(
                withValue(symmetricConfiguration(), 'iosConfig.clientAuthenticationMethodConfiguration.symmetricAlgorithm', pasted),
            ),
        );
        expectInvalidConfiguration(error);
        expect(error.errorDescription).not.toContain(pasted);
        expect(error.errorDescription).toContain('a string');
    });

    test('does not echo a short value that is no supported value in another case, such as a passphrase in the wrong field', () => {
        const error = rejection(() =>
            validateConfiguration(
                withValue(crossPlatformConfiguration(), 'iosConfig.clientAuthenticationMethodConfiguration.kind', 'changeit'),
            ),
        );
        expectInvalidConfiguration(error);
        expect(error.errorDescription).not.toContain('changeit');
        expect(error.errorDescription).toContain('a string');
    });

    test('describes a long string by its type instead of echoing it', () => {
        const pasted = 'x'.repeat(65);
        const error = rejection(() =>
            validateConfiguration(withValue(crossPlatformConfiguration(), 'iosConfig.urlSessionOption', pasted)),
        );
        expectInvalidConfiguration(error);
        expect(error.errorDescription).not.toContain(pasted);
        expect(error.errorDescription).toContain('a string');
    });

    test('describes a non-string value by its type', () => {
        const number = rejection(() =>
            validateConfiguration(withValue(crossPlatformConfiguration(), 'androidConfig.httpUrlConnectionProviderOption', 42)),
        );
        expectInvalidConfiguration(number);
        expect(number.errorDescription).toContain('a number');

        const object = rejection(() =>
            validateConfiguration(
                withValue(crossPlatformConfiguration(), 'androidConfig.tokenBindingConfiguration.storageOption', { secret: 's3cr3t' }),
            ),
        );
        expectInvalidConfiguration(object);
        expect(object.errorDescription).toContain('an object');
        expect(object.errorDescription).not.toContain('s3cr3t');
    });

    describe('iosConfig.keychainConfiguration.accessGroup', () => {
        const path = 'iosConfig.keychainConfiguration.accessGroup';

        test('accepts an access group, an absent one, and an empty keychain configuration', () => {
            expect(() =>
                validateConfiguration(withValue(crossPlatformConfiguration(), path, 'ABCDE12345.com.example.shared')),
            ).not.toThrow();
            expect(() =>
                validateConfiguration(withValue(crossPlatformConfiguration(), 'iosConfig.keychainConfiguration', {})),
            ).not.toThrow();
        });

        ['', '   '].forEach(blank => {
            test(`rejects ${JSON.stringify(blank)} instead of reading it as no access group, naming the field`, () => {
                const error = rejection(() => validateConfiguration(withValue(crossPlatformConfiguration(), path, blank)));
                expectInvalidConfiguration(error);
                expect(error.errorDescription).toContain(path);
            });
        });

        test('rejects a non-string access group, describing it by its type', () => {
            const error = rejection(() => validateConfiguration(withValue(crossPlatformConfiguration(), path, 42)));
            expectInvalidConfiguration(error);
            expect(error.errorDescription).toContain(path);
            expect(error.errorDescription).toContain('a number');
        });
    });
});

describe('validateLoggerConfiguration', () => {
    test('accepts every supported log level', () => {
        ['debug', 'info', 'warning', 'error'].forEach(logLevel => {
            expect(() => validateLoggerConfiguration({ logLevel, isSensitiveValueMasked: true })).not.toThrow();
        });
        expect(() => validateLoggerConfiguration({ logLevel: RNLogLevel.Warning, isSensitiveValueMasked: false })).not.toThrow();
    });

    test('rejects an unsupported log level with the typed configuration error', () => {
        const error = rejection(() => validateLoggerConfiguration({ logLevel: 'verbose', isSensitiveValueMasked: true }));
        expectInvalidConfiguration(error);
        expect(error.errorDescription).toContain('logLevel');
        expect(error.errorDescription).toContain('a string');
        ['debug', 'info', 'warning', 'error'].forEach(value => expect(error.errorDescription).toContain(value));
    });
});
