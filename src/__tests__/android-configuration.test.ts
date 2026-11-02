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
    AndroidTokenBinding,
    createAndroidConfiguration,
    DpopKeyPolicy,
    HttpUrlConnectionProviderOption,
    CurrentTimeMillisProviderOption,
    KeyPairAlgorithmConfig,
    StorageOption,

    TokenEndpointResponseListenerOption,
    ApplicationContextOption,
} from '../android-configuration';
import { noTokenBinding } from '../token-binding';
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

        it('sets tokenBindingConfiguration to no token binding', () => {
            expect(config.tokenBindingConfiguration).toEqual(noTokenBinding());
        });

        // Unbound and bound must never cross the bridge alike (the root cause of the iOS defect).
        it('serialises the default differently from a bound configuration', () => {
            expect(JSON.stringify(config.tokenBindingConfiguration)).not.toEqual(
                JSON.stringify(AndroidTokenBinding()),
            );
        });

        it('passes an explicit no-binding configuration through', () => {
            const explicit = createAndroidConfiguration({
                clientId: config.clientId,
                appRedirect: config.appRedirect,
                tokenBindingConfiguration: noTokenBinding(),
            });
            expect(explicit.tokenBindingConfiguration).toEqual({ kind: 'unbound' });
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

        // With no options the binding takes the native SDK's defaults, and adopts no earlier key.
        it('binds with the native defaults when no option is given', () => {
            expect(AndroidTokenBinding()).toEqual({
                kind: 'bound',
                keyType: DpopKeyPolicy.Auto,
                keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES256,
                migrateFromLegacyAlias: null,
                storageOption: StorageOption.Default,
            });
        });

        it('emits exactly the fields the native bridge reads', () => {
            expect(Object.keys(AndroidTokenBinding()).sort()).toEqual([
                'keyPairAlgorithmConfiguration',
                'keyType',
                'kind',
                'migrateFromLegacyAlias',
                'storageOption',
            ]);
        });

        it('passes a bound configuration with a key type, ES384, an alias to adopt and custom storage through', () => {
            const config = createAndroidConfiguration({
                ...requiredParams,
                tokenBindingConfiguration: AndroidTokenBinding({
                    keyType: DpopKeyPolicy.Software,
                    keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES384,
                    migrateFromLegacyAlias: 'legacy_key',
                    storageOption: StorageOption.Custom,
                }),
            });
            expect(config.tokenBindingConfiguration).toEqual({
                kind: 'bound',
                keyType: DpopKeyPolicy.Software,
                keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES384,
                migrateFromLegacyAlias: 'legacy_key',
                storageOption: StorageOption.Custom,
            });
        });

        it.each([DpopKeyPolicy.Auto, DpopKeyPolicy.Hardware, DpopKeyPolicy.Software])(
            'passes the %s key type through',
            (keyType) => {
                expect(AndroidTokenBinding({ keyType }).keyType).toBe(keyType);
            }
        );

        // Adoption is opt-in, as in the native SDK: anything but a non-blank alias means "no adoption".
        it.each([
            ['omitted', {}],
            ['null', { migrateFromLegacyAlias: null }],
            ['empty', { migrateFromLegacyAlias: '' }],
            ['whitespace-only', { migrateFromLegacyAlias: '   ' }],
        ])('adopts no earlier key when the alias is %s', (_label, options) => {
            expect(AndroidTokenBinding(options).migrateFromLegacyAlias).toBeNull();
        });

        // The native SDK uses the alias as given, so the factory must not trim it.
        it('passes a non-blank alias to adopt through unchanged', () => {
            expect(AndroidTokenBinding({ migrateFromLegacyAlias: ' my key ' }).migrateFromLegacyAlias).toBe(
                ' my key '
            );
        });

        it('passes a bound configuration with ES512 through', () => {
            const config = createAndroidConfiguration({
                ...requiredParams,
                tokenBindingConfiguration: AndroidTokenBinding({
                    keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES512,
                }),
            });
            expect(config.tokenBindingConfiguration.keyPairAlgorithmConfiguration.jwtAlgorithm).toBe('ES512');
            expect(config.tokenBindingConfiguration.keyPairAlgorithmConfiguration.curve).toBe('secp521r1');
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

    // ---- deprecated tokenBoundConfiguration ----

    // Kept working (deprecated) so existing configurations upgrade without a code change.
    describe('deprecated tokenBoundConfiguration', () => {
        const legacy = {
            keyAlias: 'app_key',
            keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES384,
            storageOption: StorageOption.Custom,
        };

        // The released setting keeps its sign-ins: its alias becomes the key to adopt, and its algorithm
        // and storage carry over.
        it('keeps the configuration bound, adopting the key at its alias with the same algorithm and storage', () => {
            const options = { ...requiredParams, tokenBoundConfiguration: legacy };
            const config = createAndroidConfiguration(options);
            expect(config.tokenBindingConfiguration).toEqual({
                kind: 'bound',
                keyType: DpopKeyPolicy.Auto,
                keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES384,
                migrateFromLegacyAlias: 'app_key',
                storageOption: StorageOption.Custom,
            });
        });

        it('adopts the key at the default alias earlier versions used when that is what it carries', () => {
            const released = {
                keyAlias: 'haapi_token_bound_key',
                keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES256,
                storageOption: StorageOption.Default,
            };
            const config = createAndroidConfiguration({ ...requiredParams, tokenBoundConfiguration: released });
            expect(config.tokenBindingConfiguration).toEqual(
                AndroidTokenBinding({ migrateFromLegacyAlias: 'haapi_token_bound_key' })
            );
        });

        // A plain-JS app could leave out `keyAlias`; the released SDK then bound to its default alias, so the
        // sign-ins it made sit there.
        it('adopts the key at the released default alias when the setting carries no keyAlias', () => {
            const withoutAlias = {
                keyPairAlgorithmConfiguration: KeyPairAlgorithmConfig.ES256,
                storageOption: StorageOption.Custom,
            };
            const config = createAndroidConfiguration({ ...requiredParams, tokenBoundConfiguration: withoutAlias });
            expect(config.tokenBindingConfiguration).toEqual(
                AndroidTokenBinding({
                    migrateFromLegacyAlias: 'haapi_token_bound_key',
                    storageOption: StorageOption.Custom,
                })
            );
        });

        it('sends only the new field across the bridge', () => {
            const config = createAndroidConfiguration({ ...requiredParams, tokenBoundConfiguration: legacy });
            expect(Object.keys(config)).not.toContain('tokenBoundConfiguration');
            expect(JSON.parse(JSON.stringify(config)).tokenBindingConfiguration.kind).toBe('bound');
        });

        // `tokenBoundConfiguration: null` was the only way to turn iOS binding off before this fix.
        it('treats a null tokenBoundConfiguration as no token binding', () => {
            const options = { ...requiredParams, tokenBoundConfiguration: null };
            expect(createAndroidConfiguration(options).tokenBindingConfiguration).toEqual(noTokenBinding());
        });

        it('lets tokenBindingConfiguration win over a null tokenBoundConfiguration', () => {
            const options = {
                ...requiredParams,
                tokenBoundConfiguration: null,
                tokenBindingConfiguration: AndroidTokenBinding(),
            };
            expect(createAndroidConfiguration(options).tokenBindingConfiguration).toEqual(
                AndroidTokenBinding()
            );
        });

        it('rejects both names at once rather than guessing which one is meant', () => {
            expect(() =>
                createAndroidConfiguration({
                    ...requiredParams,
                    tokenBoundConfiguration: legacy,
                    tokenBindingConfiguration: noTokenBinding(),
                })
            ).toThrow(/both `tokenBindingConfiguration` and the deprecated `tokenBoundConfiguration`/);
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

        it('DpopKeyPolicy', () => {
            expect(Object.values(DpopKeyPolicy)).toEqual(['auto', 'hardware', 'software']);
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
