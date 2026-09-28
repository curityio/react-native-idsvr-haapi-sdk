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
    createIOSConfiguration,
    URLSessionOption,
    CryptoKeyType,
} from '../ios-configuration';
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

        it('sets tokenBoundConfiguration with SecureEnclave key type', () => {
            expect(config.tokenBoundConfiguration).toEqual({
                keyPairType: CryptoKeyType.SecureEnclave,
            });
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

        it('accepts P256 key pair type', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                tokenBoundConfiguration: { keyPairType: CryptoKeyType.P256 },
            });
            expect(config.tokenBoundConfiguration.keyPairType).toBe(CryptoKeyType.P256);
        });

        it('accepts Security key pair type', () => {
            const config = createIOSConfiguration({
                ...requiredParams,
                tokenBoundConfiguration: { keyPairType: CryptoKeyType.Security },
            });
            expect(config.tokenBoundConfiguration.keyPairType).toBe(CryptoKeyType.Security);
        });

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
