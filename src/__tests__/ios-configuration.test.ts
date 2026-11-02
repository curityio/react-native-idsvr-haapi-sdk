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
import {
    BoundTokenConfiguration,
    createIOSConfiguration,
    iOSTokenBinding,
    UnboundedTokenConfiguration,
    URLSessionOption,
    CryptoKeyType,
    KeychainAccessibility,
} from '../ios-configuration';
import { noTokenBinding } from '../token-binding';
import {
    secretAuthentication,
    iOSJwtAsymmetricAuthentication,
    JwtAsymmetricAlgorithm,
} from '../clientAuthenticationMethods';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const requiredParams = {
    clientId: 'ios-test-client',
    appRedirect: 'testapp://callback',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createIOSConfiguration', () => {
    // ---- Default values ----

    describe('default values', () => {
        let config;

        beforeAll(() => {
            config = createIOSConfiguration(requiredParams);
        });

        it('sets name to "default-ios-configuration"', () => {
            expect(config.name).toBe('default-ios-configuration');
        });

        it('sets urlSessionOption to Default', () => {
            expect(config.urlSessionOption).toBe(URLSessionOption.Default);
        });

        it('sets attestationConfiguration with useAttestation=true and maxRetries=3', () => {
            expect(config.attestationConfiguration).toEqual({
                useAttestation: true,
                attestationMaxRetries: 3,
            });
        });

        it('sets tokenBindingConfiguration to no token binding', () => {
            expect(config.tokenBindingConfiguration).toEqual(noTokenBinding());
        });

        // The defect: the old "unbound" and "bound" values serialised identically, so the bridge
        // could not tell them apart and always bound. They must never cross the bridge alike.
        it('serialises the default differently from a bound configuration', () => {
            expect(JSON.stringify(config.tokenBindingConfiguration)).not.toEqual(
                JSON.stringify(iOSTokenBinding()),
            );
        });

        it('sets clientAuthenticationMethodConfiguration to none', () => {
            expect(config.clientAuthenticationMethodConfiguration).toEqual({ kind: 'none' });
        });

        it('sets useRiskAssessmentConfiguration to false', () => {
            expect(config.useRiskAssessmentConfiguration).toBe(false);
        });

        it('leaves dcrConfiguration undefined', () => {
            expect(config.dcrConfiguration).toBeUndefined();
        });

        it('leaves authorizationParameters undefined', () => {
            expect(config.authorizationParameters).toBeUndefined();
        });

        it('leaves httpHeaders undefined', () => {
            expect(config.httpHeaders).toBeUndefined();
        });

        it('sends no keychain configuration across the bridge, so the native default storage applies', () => {
            expect(config.keychainConfiguration).toBeUndefined();
            expect(Object.keys(JSON.parse(JSON.stringify(config)))).not.toContain('keychainConfiguration');
        });
    });

    // ---- Required field passthrough ----

    describe('required field passthrough', () => {
        it('passes through clientId and appRedirect', () => {
            const config = createIOSConfiguration(requiredParams);
            expect(config.clientId).toBe('ios-test-client');
            expect(config.appRedirect).toBe('testapp://callback');
        });
    });

    // ---- Optional overrides ----

    describe('optional overrides', () => {
        it('accepts custom name', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                name: 'my-custom-config',
            });
            expect(config.name).toBe('my-custom-config');
        });

        it('accepts URLSessionOption.Ephemeral', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                urlSessionOption: URLSessionOption.Ephemeral,
            });
            expect(config.urlSessionOption).toBe(URLSessionOption.Ephemeral);
        });

        it('accepts URLSessionOption.Custom', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                urlSessionOption: URLSessionOption.Custom,
            });
            expect(config.urlSessionOption).toBe(URLSessionOption.Custom);
        });

        it('accepts custom attestation configuration', () => {
            const attestation = { useAttestation: false, attestationMaxRetries: 0 };
            const config = createIOSConfiguration({
                ...requiredParams,
                attestationConfiguration: attestation,
            });
            expect(config.attestationConfiguration).toEqual(attestation);
        });

        it('passes an explicit no-binding configuration through', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                tokenBindingConfiguration: noTokenBinding(),
            });
            expect(config.tokenBindingConfiguration).toEqual({ kind: 'unbound' });
        });

        it('binds with a Secure Enclave key by default when binding is chosen', () => {
            expect(iOSTokenBinding()).toEqual({
                kind: 'bound',
                keyPairType: CryptoKeyType.SecureEnclave,
            });
        });

        it.each([CryptoKeyType.P256, CryptoKeyType.SecureEnclave, CryptoKeyType.Security])(
            'passes a bound configuration with the %s key type through',
            (keyPairType) => {
                const config = createIOSConfiguration({
                    ...requiredParams,
                    tokenBindingConfiguration: iOSTokenBinding({ keyPairType }),
                });
                expect(config.tokenBindingConfiguration).toEqual({ kind: 'bound', keyPairType });
            },
        );

        it('accepts secret authentication method', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                clientAuthenticationMethodConfig: secretAuthentication('my-secret'),
            });
            expect(config.clientAuthenticationMethodConfiguration).toEqual({
                kind: 'secret',
                secret: 'my-secret',
            });
        });

        it('accepts JWT asymmetric authentication method', () => {
            const authMethod = iOSJwtAsymmetricAuthentication({
                asymmetricAlgorithm: JwtAsymmetricAlgorithm.ES256,
                pemFilename: 'private-key',
            });
            const config = createIOSConfiguration({
                ...requiredParams,
                clientAuthenticationMethodConfig: authMethod,
            });
            expect(config.clientAuthenticationMethodConfiguration).toEqual({
                kind: 'jwtAsymmetric',
                asymmetricAlgorithm: 'ES256',
                pemFilename: 'private-key',
                bundleOption: 'main',
            });
        });

        it('accepts DCR configuration', () => {
            const dcr = {
                templateClientId: 'dcr-template',
                clientRegistrationEndpointUrl: 'https://idsvr.example.com/dcr',
            };
            const config = createIOSConfiguration({
                ...requiredParams,
                dcrConfiguration: dcr,
            });
            expect(config.dcrConfiguration).toEqual(dcr);
        });

        it('accepts useRiskAssessmentConfiguration = true', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                useRiskAssessmentConfiguration: true,
            });
            expect(config.useRiskAssessmentConfiguration).toBe(true);
        });

        it('accepts per-platform authorization parameters', () => {
            const params = { scope: ['openid'], nonce: 'n1' };
            const config = createIOSConfiguration({
                ...requiredParams,
                authorizationParameters: params,
            });
            expect(config.authorizationParameters).toEqual(params);
        });

        it('accepts per-platform HTTP headers', () => {
            const headers = { 'X-Platform': 'iOS' };
            const config = createIOSConfiguration({
                ...requiredParams,
                httpHeaders: headers,
            });
            expect(config.httpHeaders).toEqual(headers);
        });

        it('passes a keychain configuration through unchanged', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                keychainConfiguration: {
                    accessGroup: 'ABCDE12345.com.example.shared',
                    accessibility: KeychainAccessibility.WhenUnlockedThisDeviceOnly,
                },
            });
            expect(config.keychainConfiguration).toEqual({
                accessGroup: 'ABCDE12345.com.example.shared',
                accessibility: 'whenUnlockedThisDeviceOnly',
            });
        });

        it('passes an App Group identifier through as the access group', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                keychainConfiguration: { accessGroup: 'group.com.example.shared' },
            });
            expect(config.keychainConfiguration).toEqual({ accessGroup: 'group.com.example.shared' });
        });

        it('passes an accessibility level without an access group through unchanged', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                keychainConfiguration: { accessibility: KeychainAccessibility.WhenUnlockedThisDeviceOnly },
            });
            expect(config.keychainConfiguration).toEqual({ accessibility: 'whenUnlockedThisDeviceOnly' });
        });
    });

    // ---- Validation ----

    describe('validation', () => {
        it('throws when clientId is empty', () => {
            expect(() =>
                createIOSConfiguration({ ...requiredParams, clientId: '' })
            ).toThrow('clientId');
        });

        it('throws when appRedirect is empty', () => {
            expect(() =>
                createIOSConfiguration({ ...requiredParams, appRedirect: '' })
            ).toThrow('appRedirect');
        });

        it('throws when keychainConfiguration.accessGroup is empty', () => {
            expect(() =>
                createIOSConfiguration({ ...requiredParams, keychainConfiguration: { accessGroup: '' } })
            ).toThrow('keychainConfiguration.accessGroup');
        });

        it('throws when keychainConfiguration.accessGroup is only whitespace', () => {
            expect(() =>
                createIOSConfiguration({ ...requiredParams, keychainConfiguration: { accessGroup: '   ' } })
            ).toThrow('keychainConfiguration.accessGroup');
        });

        it('throws the access-group error, not a TypeError, when accessGroup is not a string', () => {
            // A plain-JavaScript caller can pass anything; the initialisation check rejects a
            // non-string group too, so the factory names the field rather than failing on `trim`.
            expect(() =>
                createIOSConfiguration({ ...requiredParams, keychainConfiguration: { accessGroup: 42 } })
            ).toThrow('IOSConfiguration: `keychainConfiguration.accessGroup` must be a non-empty string');
        });

        it('treats a null accessGroup as no group, as the initialisation check does', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                keychainConfiguration: { accessGroup: null },
            });
            expect(config.keychainConfiguration).toEqual({ accessGroup: null });
        });

    });

    // ---- deprecated tokenBoundConfiguration ----

    // Kept working (deprecated) so existing configurations upgrade without a code change. The
    // classes serialise identically, so the factory must tell them apart before the bridge.
    describe('deprecated tokenBoundConfiguration', () => {
        it('keeps a BoundTokenConfiguration bound, with its key type', () => {
            const options = {
                ...requiredParams,
                tokenBoundConfiguration: new BoundTokenConfiguration(CryptoKeyType.P256),
            };
            const config = createIOSConfiguration(options);
            expect(config.tokenBindingConfiguration).toEqual(
                iOSTokenBinding({ keyPairType: CryptoKeyType.P256 })
            );
        });

        it('keeps the default BoundTokenConfiguration key type', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                tokenBoundConfiguration: new BoundTokenConfiguration(),
            });
            expect(config.tokenBindingConfiguration).toEqual(iOSTokenBinding());
        });

        it('turns an UnboundedTokenConfiguration into no token binding', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                tokenBoundConfiguration: new UnboundedTokenConfiguration(),
            });
            expect(config.tokenBindingConfiguration).toEqual(noTokenBinding());
        });

        it('keeps a plain { keyPairType } object bound, as the bridge always treated it', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                tokenBoundConfiguration: { keyPairType: CryptoKeyType.P256 },
            });
            expect(config.tokenBindingConfiguration).toEqual(
                iOSTokenBinding({ keyPairType: CryptoKeyType.P256 })
            );
        });

        it('sends only the new field across the bridge', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                tokenBoundConfiguration: new BoundTokenConfiguration(),
            });
            expect(Object.keys(config)).not.toContain('tokenBoundConfiguration');
            expect(JSON.parse(JSON.stringify(config)).tokenBindingConfiguration).toEqual({
                kind: 'bound',
                keyPairType: CryptoKeyType.SecureEnclave,
            });
        });

        // `tokenBoundConfiguration: null` was the only way to turn iOS binding off before this fix.
        it('treats a null tokenBoundConfiguration as no token binding', () => {
            const options = { ...requiredParams, tokenBoundConfiguration: null };
            expect(createIOSConfiguration(options).tokenBindingConfiguration).toEqual(noTokenBinding());
        });

        it('lets tokenBindingConfiguration win over a null tokenBoundConfiguration', () => {
            const options = {
                ...requiredParams,
                tokenBoundConfiguration: null,
                tokenBindingConfiguration: iOSTokenBinding(),
            };
            expect(createIOSConfiguration(options).tokenBindingConfiguration).toEqual(
                iOSTokenBinding()
            );
        });

        it('rejects both names at once rather than guessing which one is meant', () => {
            expect(() =>
                createIOSConfiguration({
                    ...requiredParams,
                    tokenBoundConfiguration: new BoundTokenConfiguration(),
                    tokenBindingConfiguration: noTokenBinding(),
                })
            ).toThrow(/both `tokenBindingConfiguration` and the deprecated `tokenBoundConfiguration`/);
        });
    });

    // ---- JSON serializability ----

    describe('JSON serializability', () => {
        it('round-trips through JSON.stringify / JSON.parse', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                dcrConfiguration: {
                    templateClientId: 'dcr-tpl',
                    clientRegistrationEndpointUrl: 'https://idsvr.example.com/dcr',
                },
                authorizationParameters: { scope: ['openid'] },
                httpHeaders: { 'X-Test': 'value' },
            });
            const parsed = JSON.parse(JSON.stringify(config));
            expect(parsed).toEqual(config);
        });

        it('round-trips a keychain configuration through JSON.stringify / JSON.parse', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                keychainConfiguration: {
                    accessGroup: 'ABCDE12345.com.example.shared',
                    accessibility: KeychainAccessibility.AfterFirstUnlockThisDeviceOnly,
                },
            });
            const parsed = JSON.parse(JSON.stringify(config));
            expect(parsed.keychainConfiguration).toEqual({
                accessGroup: 'ABCDE12345.com.example.shared',
                accessibility: 'afterFirstUnlockThisDeviceOnly',
            });
        });
    });

    // ---- Enum string values ----

    describe('enum string values', () => {
        it('URLSessionOption values match native bridge expectations', () => {
            expect(URLSessionOption.Default).toBe('default');
            expect(URLSessionOption.Ephemeral).toBe('ephemeral');
            expect(URLSessionOption.Custom).toBe('custom');
        });

        it('CryptoKeyType values match native bridge expectations', () => {
            expect(CryptoKeyType.P256).toBe('p256');
            expect(CryptoKeyType.SecureEnclave).toBe('secureEnclave');
            expect(CryptoKeyType.Security).toBe('security');
        });
    });
});
