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
    createAndroidConfiguration,
    HttpUrlConnectionProviderOption,
    CurrentTimeMillisProviderOption,
    KeyPairAlgorithmConfig,
    StorageOption,

    TokenEndpointResponseListenerOption,
    ApplicationContextOption,
} from '../android-configuration';
import {
    secretAuthentication,
    AndroidJwtAsymmetricAuthentication,
    JwtAsymmetricAlgorithm,
} from '../clientAuthenticationMethods';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const minDcrConfig = {
    templateClientId: 'dcr-template',
    clientRegistrationEndpointUrl: 'https://idsvr.example.com/dcr',
    contextOption: ApplicationContextOption.Default,
};

const requiredParams = {
    clientId: 'android-test-client',
    appRedirect: 'testapp://callback',
    dcrConfiguration: minDcrConfig,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createAndroidConfiguration', () => {
    // ---- Default values ----

    describe('default values', () => {
        let config;

        beforeAll(() => {
            config = createAndroidConfiguration(requiredParams);
        });

        it('sets keyStoreAlias to "default_keystore_alias"', () => {
            expect(config.keyStoreAlias).toBe('default_keystore_alias');
        });

        it('sets httpUrlConnectionProviderOption to Default', () => {
            expect(config.httpUrlConnectionProviderOption).toBe(HttpUrlConnectionProviderOption.Default);
        });

        it('sets currentTimeMillisProviderOption to Default', () => {
            expect(config.currentTimeMillisProviderOption).toBe(CurrentTimeMillisProviderOption.Default);
        });

        it('sets attestationConfiguration with useAttestation=true', () => {
            expect(config.attestationConfiguration).toEqual({
                useAttestation: true,
            });
        });

        it('sets tokenBoundConfiguration defaults', () => {
            expect(config.tokenBoundConfiguration).toEqual({
                keyAlias: 'haapi_token_bound_key',
                keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES256,
                storageOption: StorageOption.Default,
            });
        });

        it('sets clientAuthenticationMethodConfiguration to none', () => {
            expect(config.clientAuthenticationMethodConfiguration).toEqual({ kind: 'none' });
        });

        it('sets tokenEndpointResponseListenerOption to None', () => {
            expect(config.tokenEndpointResponseListenerOption).toBe(
                TokenEndpointResponseListenerOption.None
            );
        });
    });

    // ---- Required field passthrough ----

    describe('required field passthrough', () => {
        it('passes through clientId, appRedirect, and dcrConfiguration', () => {
            const config = createAndroidConfiguration(requiredParams);
            expect(config.clientId).toBe('android-test-client');
            expect(config.appRedirect).toBe('testapp://callback');
            expect(config.dcrConfiguration).toEqual(minDcrConfig);
        });
    });

    // ---- Optional overrides ----

    describe('optional overrides', () => {
        it('accepts custom keyStoreAlias', () => {
            const config = createAndroidConfiguration({
                ...requiredParams,
                keyStoreAlias: 'my_custom_alias',
            });
            expect(config.keyStoreAlias).toBe('my_custom_alias');
        });

        it('accepts HttpUrlConnectionProviderOption.Custom', () => {
            const config = createAndroidConfiguration({
                ...requiredParams,
                httpUrlConnectionProviderOption: HttpUrlConnectionProviderOption.Custom,
            });
            expect(config.httpUrlConnectionProviderOption).toBe(HttpUrlConnectionProviderOption.Custom);
        });

        it('accepts CurrentTimeMillisProviderOption.Custom', () => {
            const config = createAndroidConfiguration({
                ...requiredParams,
                currentTimeMillisProviderOption: CurrentTimeMillisProviderOption.Custom,
            });
            expect(config.currentTimeMillisProviderOption).toBe(CurrentTimeMillisProviderOption.Custom);
        });

        it('accepts custom attestation configuration', () => {
            const attestation = { useAttestation: false };
            const config = createAndroidConfiguration({
                ...requiredParams,
                attestationConfiguration: attestation,
            });
            expect(config.attestationConfiguration).toEqual(attestation);
        });

        it('accepts custom tokenBoundConfiguration with ES384', () => {
            const tokenBound = {
                keyAlias: 'custom_key',
                keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES384,
                storageOption: StorageOption.Custom,
            };
            const config = createAndroidConfiguration({
                ...requiredParams,
                tokenBoundConfiguration: tokenBound,
            });
            expect(config.tokenBoundConfiguration).toEqual(tokenBound);
        });

        it('accepts custom tokenBoundConfiguration with ES512', () => {
            const tokenBound = {
                keyAlias: 'es512_key',
                keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES512,
                storageOption: StorageOption.Default,
            };
            const config = createAndroidConfiguration({
                ...requiredParams,
                tokenBoundConfiguration: tokenBound,
            });
            expect(config.tokenBoundConfiguration.keyPairAlgorithmConfiguration.jwtAlgorithm).toBe('ES512');
            expect(config.tokenBoundConfiguration.keyPairAlgorithmConfiguration.curve).toBe('secp521r1');
        });

        it('accepts secret authentication method', () => {
            const config = createAndroidConfiguration({
                ...requiredParams,
                clientAuthenticationMethodConfig: secretAuthentication('android-secret'),
            });
            expect(config.clientAuthenticationMethodConfiguration).toEqual({
                kind: 'secret',
                secret: 'android-secret',
            });
        });

        it('accepts JWT asymmetric authentication method', () => {
            const authMethod = AndroidJwtAsymmetricAuthentication({
                asymmetricAlgorithm: JwtAsymmetricAlgorithm.RS256,
                alias: 'my-alias',
            });
            const config = createAndroidConfiguration({
                ...requiredParams,
                clientAuthenticationMethodConfig: authMethod,
            });
            expect(config.clientAuthenticationMethodConfiguration).toEqual({
                kind: 'jwtAsymmetric',
                asymmetricAlgorithm: 'RS256',
                alias: 'my-alias',
                clientKeyStoreOption: 'client',
            });
        });

        it('accepts TokenEndpointResponseListenerOption.Custom', () => {
            const config = createAndroidConfiguration({
                ...requiredParams,
                tokenEndpointResponseListenerOption: TokenEndpointResponseListenerOption.Custom,
            });
            expect(config.tokenEndpointResponseListenerOption).toBe(
                TokenEndpointResponseListenerOption.Custom
            );
        });

        it('accepts DCR with custom context option', () => {
            const customDcr = {
                templateClientId: 'dcr-custom',
                clientRegistrationEndpointUrl: 'https://other.example.com/dcr',
                contextOption: ApplicationContextOption.Custom,
            };
            const config = createAndroidConfiguration({
                ...requiredParams,
                dcrConfiguration: customDcr,
            });
            expect(config.dcrConfiguration!.contextOption).toBe(ApplicationContextOption.Custom);
        });
    });

    // ---- Validation ----

    describe('validation', () => {
        it('throws when clientId is empty', () => {
            expect(() =>
                createAndroidConfiguration({ ...requiredParams, clientId: '' })
            ).toThrow('clientId');
        });

        it('throws when appRedirect is empty', () => {
            expect(() =>
                createAndroidConfiguration({ ...requiredParams, appRedirect: '' })
            ).toThrow('appRedirect');
        });

        it('allows dcrConfiguration to be undefined', () => {
            const config = createAndroidConfiguration({
                ...requiredParams,
                dcrConfiguration: undefined,
            });
            expect(config.dcrConfiguration).toBeUndefined();
        });
    });

    // ---- JSON serializability ----

    describe('JSON serializability', () => {
        it('round-trips through JSON.stringify / JSON.parse', () => {
            const config = createAndroidConfiguration(requiredParams);
            const parsed = JSON.parse(JSON.stringify(config));
            expect(parsed).toEqual(config);
        });
    });

    // ---- Enum string values ----

    describe('enum string values match native bridge expectations', () => {
        it('HttpUrlConnectionProviderOption', () => {
            expect(HttpUrlConnectionProviderOption.Default).toBe('default');
            expect(HttpUrlConnectionProviderOption.Custom).toBe('custom');
        });

        it('CurrentTimeMillisProviderOption', () => {
            expect(CurrentTimeMillisProviderOption.Default).toBe('default');
            expect(CurrentTimeMillisProviderOption.Custom).toBe('custom');
        });

        it('StorageOption', () => {
            expect(StorageOption.Default).toBe('default');
            expect(StorageOption.Custom).toBe('custom');
        });

        it('TokenEndpointResponseListenerOption', () => {
            expect(TokenEndpointResponseListenerOption.None).toBe('none');
            expect(TokenEndpointResponseListenerOption.Custom).toBe('custom');
        });

        it('ApplicationContextOption', () => {
            expect(ApplicationContextOption.Default).toBe('default');
            expect(ApplicationContextOption.Custom).toBe('custom');
        });
    });

    // ---- KeyPairAlgorithmConfig constrained entries ----

    describe('KeyPairAlgorithmConfig entries', () => {
        it('ES256 has correct algorithm, curve, and type', () => {
            expect(KeyPairAlgorithmConfig.ES256).toEqual({
                jwtAlgorithm: 'ES256',
                curve: 'secp256r1',
                algorithmType: 'EC',
            });
        });

        it('ES384 has correct algorithm, curve, and type', () => {
            expect(KeyPairAlgorithmConfig.ES384).toEqual({
                jwtAlgorithm: 'ES384',
                curve: 'secp384r1',
                algorithmType: 'EC',
            });
        });

        it('ES512 has correct algorithm, curve, and type', () => {
            expect(KeyPairAlgorithmConfig.ES512).toEqual({
                jwtAlgorithm: 'ES512',
                curve: 'secp521r1',
                algorithmType: 'EC',
            });
        });

        it('has exactly 3 entries', () => {
            expect(Object.keys(KeyPairAlgorithmConfig)).toHaveLength(3);
        });

        it('all entries share algorithmType "EC"', () => {
            Object.values(KeyPairAlgorithmConfig).forEach((entry) => {
                expect(entry.algorithmType).toBe('EC');
            });
        });
    });
});
