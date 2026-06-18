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
import { createHaapiConfiguration } from '../haapi-configuration';
import { createIOSConfiguration } from '../ios-configuration';
import { createAndroidConfiguration, ApplicationContextOption } from '../android-configuration';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const minIosConfig = createIOSConfiguration({
    clientId: 'ios-test-client',
    appRedirect: 'testapp://callback',
});

const minAndroidConfig = createAndroidConfiguration({
    clientId: 'android-test-client',
    appRedirect: 'testapp://callback',
    dcrConfiguration: {
        templateClientId: 'dcr-template',
        clientRegistrationEndpointUrl: 'https://idsvr.example.com/dcr',
        contextOption: ApplicationContextOption.Default,
    },
});

/** Minimal valid params for `createHaapiConfiguration`. */
const validParams = {
    baseUrl: 'https://idsvr.example.com',
    authorizationEndpointUrl: 'https://idsvr.example.com/oauth/authorize',
    tokenEndpointUrl: 'https://idsvr.example.com/oauth/token',
    iosConfig: minIosConfig,
    androidConfig: minAndroidConfig,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createHaapiConfiguration', () => {
    // ---- Default values ----

    describe('default values', () => {
        let config;

        beforeAll(() => {
            config = createHaapiConfiguration(validParams);
        });

        it('sets isAutoRedirect to true', () => {
            expect(config.isAutoRedirect).toBe(true);
        });

        it('sets minTokenTtl to 60', () => {
            expect(config.minTokenTtl).toBe(60);
        });

        it('leaves revocationEndpointUrl undefined', () => {
            expect(config.revocationEndpointUrl).toBeUndefined();
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
        it('passes through all URL fields', () => {
            const config = createHaapiConfiguration(validParams);
            expect(config.baseUrl).toBe(validParams.baseUrl);
            expect(config.authorizationEndpointUrl).toBe(validParams.authorizationEndpointUrl);
            expect(config.tokenEndpointUrl).toBe(validParams.tokenEndpointUrl);
            expect(config.revocationEndpointUrl).toBeUndefined();
        });

        it('passes through platform configs', () => {
            const config = createHaapiConfiguration(validParams);
            expect(config.iosConfig).toBe(minIosConfig);
            expect(config.androidConfig).toBe(minAndroidConfig);
        });
    });

    // ---- Optional overrides ----

    describe('optional overrides', () => {
        it('accepts isAutoRedirect = false', () => {
            const config = createHaapiConfiguration({ ...validParams, isAutoRedirect: false });
            expect(config.isAutoRedirect).toBe(false);
        });

        it('accepts custom minTokenTtl', () => {
            const config = createHaapiConfiguration({ ...validParams, minTokenTtl: 120 });
            expect(config.minTokenTtl).toBe(120);
        });

        it('accepts minTokenTtl = 0', () => {
            const config = createHaapiConfiguration({ ...validParams, minTokenTtl: 0 });
            expect(config.minTokenTtl).toBe(0);
        });

        it('passes through authorizationParameters', () => {
            const authParams = {
                scope: ['openid', 'profile'],
                nonce: 'test-nonce',
                acrValues: ['urn:se:curity:authentication:html-form:html1'],
                extraRequestParameters: { prompt: 'login' },
            };
            const config = createHaapiConfiguration({
                ...validParams,
                authorizationParameters: authParams,
            });
            expect(config.authorizationParameters).toEqual(authParams);
        });

        it('passes through httpHeaders', () => {
            const headers = { 'X-Correlation-ID': 'abc-123', 'X-App-Version': '1.0' };
            const config = createHaapiConfiguration({ ...validParams, httpHeaders: headers });
            expect(config.httpHeaders).toEqual(headers);
        });

        it('passes through revocationEndpointUrl when provided', () => {
            const config = createHaapiConfiguration({
                ...validParams,
                revocationEndpointUrl: 'https://idsvr.example.com/oauth/revoke',
            });
            expect(config.revocationEndpointUrl).toBe('https://idsvr.example.com/oauth/revoke');
        });
    });

    // ---- Validation ----

    describe('validation', () => {
        it.each([
            ['baseUrl', ''],
            ['authorizationEndpointUrl', ''],
            ['tokenEndpointUrl', ''],
        ])('throws when %s is empty', (field, value) => {
            expect(() =>
                createHaapiConfiguration({ ...validParams, [field]: value })
            ).toThrow(field);
        });

        it('throws when both androidConfig and iosConfig are missing', () => {
            expect(() =>
                createHaapiConfiguration({
                    baseUrl: validParams.baseUrl,
                    authorizationEndpointUrl: validParams.authorizationEndpointUrl,
                    tokenEndpointUrl: validParams.tokenEndpointUrl,
                })
            ).toThrow('androidConfig');
        });

        it('accepts only iosConfig without androidConfig', () => {
            const config = createHaapiConfiguration({
                baseUrl: validParams.baseUrl,
                authorizationEndpointUrl: validParams.authorizationEndpointUrl,
                tokenEndpointUrl: validParams.tokenEndpointUrl,
                iosConfig: minIosConfig,
            });
            expect(config.iosConfig).toBe(minIosConfig);
            expect(config.androidConfig).toBeUndefined();
        });

        it('accepts only androidConfig without iosConfig', () => {
            const config = createHaapiConfiguration({
                baseUrl: validParams.baseUrl,
                authorizationEndpointUrl: validParams.authorizationEndpointUrl,
                tokenEndpointUrl: validParams.tokenEndpointUrl,
                androidConfig: minAndroidConfig,
            });
            expect(config.androidConfig).toBe(minAndroidConfig);
            expect(config.iosConfig).toBeUndefined();
        });

        it('throws when minTokenTtl is negative', () => {
            expect(() =>
                createHaapiConfiguration({ ...validParams, minTokenTtl: -1 })
            ).toThrow('minTokenTtl');
        });

        it('throws when minTokenTtl is NaN', () => {
            expect(() =>
                createHaapiConfiguration({ ...validParams, minTokenTtl: NaN })
            ).toThrow('minTokenTtl');
        });

        it('throws when minTokenTtl is Infinity', () => {
            expect(() =>
                createHaapiConfiguration({ ...validParams, minTokenTtl: Infinity })
            ).toThrow('minTokenTtl');
        });
    });

    // ---- JSON serializability ----

    describe('JSON serializability', () => {
        it('round-trips through JSON.stringify / JSON.parse', () => {
            const config = createHaapiConfiguration({
                ...validParams,
                authorizationParameters: { scope: ['openid'] },
                httpHeaders: { 'X-Test': 'value' },
            });
            const parsed = JSON.parse(JSON.stringify(config));
            expect(parsed).toEqual(config);
        });
    });
});
