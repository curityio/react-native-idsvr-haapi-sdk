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
    CryptoKeyType,
    iOSTokenBinding,
    noTokenBinding,
    URLSessionOption,
} from '@curity/identityserver-haapi-react-native-sdk';

import {
    IosClientName,
    IOS_CLIENT_DEFS,
    isEmulator,
    isPhysical,
    createAppIosConfiguration,
    createDcrConfiguration,
} from '../ios-configs';
import {BASE_URL} from '../shared';
import {tokenBoundClientIdsByConfig} from './token-bound-clients';

// ---------------------------------------------------------------------------
// Shared helpers & fixtures
// ---------------------------------------------------------------------------

var EMULATOR_NAMES = Object.values(IosClientName.Emulator);
var PHYSICAL_NAMES = Object.values(IosClientName.Physical);
var ALL_NAMES = EMULATOR_NAMES.concat(PHYSICAL_NAMES);

function buildConfig(clientNameType, overrides) {
    return createAppIosConfiguration({
        clientNameType: clientNameType,
        useDcrConfiguration:
            overrides && overrides.useDcrConfiguration !== undefined
                ? overrides.useDcrConfiguration
                : false,
        useRiskAssessmentConfiguration:
            overrides && overrides.useRiskAssessmentConfiguration !== undefined
                ? overrides.useRiskAssessmentConfiguration
                : false,
        urlSessionOption:
            overrides && overrides.urlSessionOption !== undefined
                ? overrides.urlSessionOption
                : URLSessionOption.Default,
        tokenBindingConfiguration: overrides && overrides.tokenBindingConfiguration,
        authorizationParameters: overrides && overrides.authorizationParameters,
        httpHeaders: overrides && overrides.httpHeaders,
        keychainConfiguration: overrides && overrides.keychainConfiguration,
    });
}

// ---------------------------------------------------------------------------
// Enum completeness
// ---------------------------------------------------------------------------

describe('IosClientName enums', function () {
    it('Emulator has 20 members', function () {
        expect(EMULATOR_NAMES).toHaveLength(20);
    });

    it('Physical has 22 members', function () {
        expect(PHYSICAL_NAMES).toHaveLength(22);
    });

    it('all 42 names are unique strings', function () {
        var unique = new Set(ALL_NAMES);
        expect(unique.size).toBe(ALL_NAMES.length);
        expect(ALL_NAMES).toHaveLength(42);
    });

    it('every name has an entry in IOS_CLIENT_DEFS', function () {
        ALL_NAMES.forEach(function (name) {
            expect(IOS_CLIENT_DEFS[name]).toBeDefined();
        });
    });

    it('IOS_CLIENT_DEFS has exactly 42 entries', function () {
        expect(Object.keys(IOS_CLIENT_DEFS)).toHaveLength(42);
    });
});

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

describe('isEmulator / isPhysical', function () {
    it('isEmulator returns true for all Emulator members', function () {
        EMULATOR_NAMES.forEach(function (name) {
            expect(isEmulator(name)).toBe(true);
        });
    });

    it('isEmulator returns false for all Physical members', function () {
        PHYSICAL_NAMES.forEach(function (name) {
            expect(isEmulator(name)).toBe(false);
        });
    });

    it('isPhysical returns true for all Physical members', function () {
        PHYSICAL_NAMES.forEach(function (name) {
            expect(isPhysical(name)).toBe(true);
        });
    });

    it('isPhysical returns false for all Emulator members', function () {
        EMULATOR_NAMES.forEach(function (name) {
            expect(isPhysical(name)).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// createIOSConfiguration — common properties
// ---------------------------------------------------------------------------

describe('createIOSConfiguration — common properties', function () {
    it('sets clientId to the client name', function () {
        var config = buildConfig(IosClientName.Emulator.NoAuth);
        expect(config.clientId).toBe(IosClientName.Emulator.NoAuth);
    });

    it('sets name to the client name', function () {
        var config = buildConfig(IosClientName.Emulator.NoAuth);
        expect(config.name).toBe(IosClientName.Emulator.NoAuth);
    });

    it('sets appRedirect to haapi:start', function () {
        var config = buildConfig(IosClientName.Emulator.NoAuth);
        expect(config.appRedirect).toBe('haapi:start');
    });

    it('sets urlSessionOption to Default', function () {
        var config = buildConfig(IosClientName.Emulator.NoAuth);
        expect(config.urlSessionOption).toBe(URLSessionOption.Default);
    });

    it('sets useRiskAssessmentConfiguration to false by default', function () {
        var config = buildConfig(IosClientName.Emulator.NoAuth);
        expect(config.useRiskAssessmentConfiguration).toBe(false);
    });

    it('leaves dcrConfiguration undefined when not provided', function () {
        var config = buildConfig(IosClientName.Emulator.NoAuth);
        expect(config.dcrConfiguration).toBeUndefined();
    });

    it('defaults tokenBindingConfiguration to no token binding when not provided', function () {
        var config = buildConfig(IosClientName.Emulator.NoAuth);
        expect(config.tokenBindingConfiguration).toEqual({ kind: 'unbound' });
    });
});

// ---------------------------------------------------------------------------
// Keychain configuration — only the scenarios that set it change the storage
// ---------------------------------------------------------------------------

describe('createIOSConfiguration — keychain configuration', function () {
    it('leaves keychainConfiguration undefined for every client when not provided', function () {
        ALL_NAMES.forEach(function (name) {
            expect(buildConfig(name).keychainConfiguration).toBeUndefined();
        });
    });

    it('passes a given keychain configuration through to the iOS configuration', function () {
        var config = buildConfig(IosClientName.Emulator.NoAuthDpopNonceTokenBound, {
            keychainConfiguration: { accessGroup: 'ALY8Q7BNK9.io.curity.cat.ios.client.shared' },
        });
        expect(config.keychainConfiguration).toEqual({ accessGroup: 'ALY8Q7BNK9.io.curity.cat.ios.client.shared' });
    });
});

// ---------------------------------------------------------------------------
// Token binding follows the server client configuration
// ---------------------------------------------------------------------------

// Clients whose server config sets `issue-token-bound-authorization-code` to true, read from
// configs/dev-config.xml and configs/docker-config.xml. Their codes can only be exchanged with a
// DPoP proof, so the app must bind; every other client must not.
var TOKEN_BOUND_BY_CONFIG = tokenBoundClientIdsByConfig('haapi-ios-client-');
var TOKEN_BOUND_CLIENTS = TOKEN_BOUND_BY_CONFIG['dev-config.xml'];

describe('createIOSConfiguration — token binding', function () {
    it('binds tokens for every client that issues token-bound authorization codes', function () {
        TOKEN_BOUND_CLIENTS.forEach(function (name) {
            expect(buildConfig(name).tokenBindingConfiguration).toEqual(iOSTokenBinding());
        });
    });

    it('leaves every other client unbound, including the -token-bound-change clients', function () {
        var unbound = ALL_NAMES.filter(function (name) {
            return TOKEN_BOUND_CLIENTS.indexOf(name) === -1;
        });
        expect(unbound).toContain(IosClientName.Physical.NoAuthDpopNonceTokenBoundChange);
        unbound.forEach(function (name) {
            expect(buildConfig(name).tokenBindingConfiguration).toEqual(noTokenBinding());
        });
    });

    it('reads the same token-bound clients from both server configs', function () {
        expect(TOKEN_BOUND_CLIENTS.length).toBeGreaterThan(0);
        expect(TOKEN_BOUND_BY_CONFIG['docker-config.xml']).toEqual(TOKEN_BOUND_CLIENTS);
    });

    it('names only clients that exist in the matrix', function () {
        TOKEN_BOUND_CLIENTS.forEach(function (name) {
            expect(ALL_NAMES).toContain(name);
        });
    });
});

// ---------------------------------------------------------------------------
// Authentication methods
// ---------------------------------------------------------------------------

describe('createIOSConfiguration — authentication methods', function () {
    describe('noAuthentication clients', function () {
        var noAuthEmulators = [
            IosClientName.Emulator.NoAuth,
            IosClientName.Emulator.NoAuthDpopNonce,
            IosClientName.Emulator.NoAuthDpopNonceTokenBound,
            IosClientName.Emulator.NoAuthDpopNonceTokenBoundChange,
        ];
        var noAuthPhysicals = [
            IosClientName.Physical.NoAuth,
            IosClientName.Physical.NoAuthDpopNonce,
            IosClientName.Physical.NoAuthDpopNonceTokenBound,
            IosClientName.Physical.NoAuthDpopNonceTokenBoundChange,
            IosClientName.Physical.NoAuthAttestationFails,
        ];

        noAuthEmulators.concat(noAuthPhysicals).forEach(function (name) {
            it(name + ' uses kind "none"', function () {
                var config = buildConfig(name);
                expect(config.clientAuthenticationMethodConfiguration.kind).toBe('none');
            });
        });
    });

    describe('secret authentication clients', function () {
        var secretClients = [
            IosClientName.Emulator.Secret,
            IosClientName.Emulator.SecretDpopNonceTokenBound,
            IosClientName.Emulator.SecretWithoutAttestation,
            IosClientName.Physical.Secret,
            IosClientName.Physical.SecretDpopNonceTokenBound,
            IosClientName.Physical.SecretWithoutAttestation,
            IosClientName.Physical.SecretAttestationFails,
        ];

        secretClients.forEach(function (name) {
            it(name + ' uses kind "secret"', function () {
                var config = buildConfig(name);
                expect(config.clientAuthenticationMethodConfiguration.kind).toBe('secret');
            });
        });
    });

    describe('MTLS authentication clients', function () {
        var mtlsClients = [
            IosClientName.Emulator.Mtls,
            IosClientName.Physical.Mtls,
        ];

        mtlsClients.forEach(function (name) {
            it(name + ' uses kind "mtls"', function () {
                var config = buildConfig(name);
                var auth = config.clientAuthenticationMethodConfiguration;
                expect(auth.kind).toBe('mtls');
                expect(auth.pkcs12Filename).toBe('mutual_tls_client');
                expect(auth.pkcs12Passphrase).toBe('changeit');
                expect(auth.serverPEMFilename).toBe('localhost');
            });
        });
    });

    describe('asymmetric RSA JWT clients', function () {
        var rsaClients = [
            IosClientName.Emulator.AsymRSA,
            IosClientName.Emulator.AsymRSAWithoutAttestation,
            IosClientName.Physical.AsymRSA,
            IosClientName.Physical.AsymRSAWithoutAttestation,
        ];

        rsaClients.forEach(function (name) {
            it(name + ' uses kind "jwt-asymmetric" with RS256', function () {
                var config = buildConfig(name);
                var auth = config.clientAuthenticationMethodConfiguration;
                expect(auth.kind).toBe('jwtAsymmetric');
                expect(auth.asymmetricAlgorithm).toBe('RS256');
                expect(auth.pemFilename).toBe('rsa-private');
            });
        });
    });

    describe('asymmetric EC 256 JWT clients', function () {
        var ec256Clients = [
            IosClientName.Emulator.AsymEC256,
            IosClientName.Emulator.AsymEC256WithoutAttestation,
            IosClientName.Physical.AsymEC256,
            IosClientName.Physical.AsymEC256WithoutAttestation,
        ];

        ec256Clients.forEach(function (name) {
            it(name + ' uses kind "jwt-asymmetric" with ES256', function () {
                var config = buildConfig(name);
                var auth = config.clientAuthenticationMethodConfiguration;
                expect(auth.kind).toBe('jwtAsymmetric');
                expect(auth.asymmetricAlgorithm).toBe('ES256');
                expect(auth.pemFilename).toBe('ec_256-private');
            });
        });
    });

    describe('asymmetric EC 384 JWT clients', function () {
        var ec384Clients = [
            IosClientName.Emulator.AsymEC384,
            IosClientName.Emulator.AsymEC384WithoutAttestation,
            IosClientName.Physical.AsymEC384,
            IosClientName.Physical.AsymEC384WithoutAttestation,
        ];

        ec384Clients.forEach(function (name) {
            it(name + ' uses kind "jwt-asymmetric" with ES384', function () {
                var config = buildConfig(name);
                var auth = config.clientAuthenticationMethodConfiguration;
                expect(auth.kind).toBe('jwtAsymmetric');
                expect(auth.asymmetricAlgorithm).toBe('ES384');
                expect(auth.pemFilename).toBe('ec_384-private');
            });
        });
    });

    describe('asymmetric EC 512 JWT clients', function () {
        var ec512Clients = [
            IosClientName.Emulator.AsymEC512,
            IosClientName.Emulator.AsymEC512WithoutAttestation,
            IosClientName.Physical.AsymEC512,
            IosClientName.Physical.AsymEC512WithoutAttestation,
        ];

        ec512Clients.forEach(function (name) {
            it(name + ' uses kind "jwt-asymmetric" with ES512', function () {
                var config = buildConfig(name);
                var auth = config.clientAuthenticationMethodConfiguration;
                expect(auth.kind).toBe('jwtAsymmetric');
                expect(auth.asymmetricAlgorithm).toBe('ES512');
                expect(auth.pemFilename).toBe('ec_512-private');
            });
        });
    });

    describe('symmetric JWT clients', function () {
        it('emulator symmetric uses kind "jwt-symmetric" with HS256', function () {
            var config = buildConfig(IosClientName.Emulator.Symmetric);
            var auth = config.clientAuthenticationMethodConfiguration;
            expect(auth.kind).toBe('jwtSymmetric');
            expect(auth.symmetricAlgorithm).toBe('HS256');
        });

        it('physical symmetric uses kind "jwt-symmetric" with HS256', function () {
            var config = buildConfig(IosClientName.Physical.Symmetric);
            var auth = config.clientAuthenticationMethodConfiguration;
            expect(auth.kind).toBe('jwtSymmetric');
            expect(auth.symmetricAlgorithm).toBe('HS256');
        });

        it('ships a placeholder, not the test servers\' shared secret', function () {
            // The E2E runner supplies the real secret to its own builds; the example a host app
            // copies from carries none.
            [IosClientName.Emulator.Symmetric, IosClientName.Physical.Symmetric].forEach(function (name) {
                expect(buildConfig(name).clientAuthenticationMethodConfiguration.secretKey).toMatch(/^<[a-z-]+>$/);
            });
        });
    });
});

// ---------------------------------------------------------------------------
// Attestation
// ---------------------------------------------------------------------------

describe('createIOSConfiguration — attestation', function () {
    // Attestation follows the server-side client family, identified by the client-name
    // suffix (see the AttestationConfiguration doc comment in ios-configs.ts):
    //   '-without-attestation' -> client sends none; server allows it.
    //   '-attestation-fails'   -> client DOES attest; the server's deliberately wrong
    //                             app id refuses it. That refusal is the behaviour under
    //                             test, so attestation must stay on.
    //   anything else          -> client attests normally.
    // Asserting by suffix (instead of a hand-maintained name list) keeps new clients
    // covered automatically.
    function expectedUseAttestation(name) {
        return name.indexOf('-without-attestation') === -1;
    }

    describe('useAttestation follows the client family', function () {
        ALL_NAMES.forEach(function (name) {
            var expected = expectedUseAttestation(name);
            it(name + ' has useAttestation = ' + expected, function () {
                var config = buildConfig(name);
                expect(config.attestationConfiguration.useAttestation).toBe(expected);
            });
        });
    });

    it('every -attestation-fails client attests, so the server has something to refuse', function () {
        var failsClients = ALL_NAMES.filter(function (name) {
            return name.indexOf('-attestation-fails') !== -1;
        });
        expect(failsClients.length).toBeGreaterThan(0);
        failsClients.forEach(function (name) {
            var config = buildConfig(name);
            expect(config.attestationConfiguration.useAttestation).toBe(true);
        });
    });

    it('every -without-attestation client sends no attestation', function () {
        var withoutClients = ALL_NAMES.filter(function (name) {
            return name.indexOf('-without-attestation') !== -1;
        });
        expect(withoutClients.length).toBeGreaterThan(0);
        withoutClients.forEach(function (name) {
            var config = buildConfig(name);
            expect(config.attestationConfiguration.useAttestation).toBe(false);
        });
    });

    it('all attestation configs include attestationMaxRetries = 3', function () {
        ALL_NAMES.forEach(function (name) {
            var config = buildConfig(name);
            expect(config.attestationConfiguration.attestationMaxRetries).toBe(3);
        });
    });
});

// ---------------------------------------------------------------------------
// Optional parameter forwarding
// ---------------------------------------------------------------------------

describe('createIOSConfiguration — optional parameters', function () {
    it('enables dcrConfiguration when useDcrConfiguration is true', function () {
        var dcr = createDcrConfiguration(BASE_URL);
        var config = buildConfig(IosClientName.Emulator.NoAuth, {
            useDcrConfiguration: true,
        });
        expect(config.dcrConfiguration).toEqual(dcr);
    });

    it('forwards useRiskAssessmentConfiguration = true', function () {
        var config = buildConfig(IosClientName.Emulator.NoAuth, {
            useRiskAssessmentConfiguration: true,
        });
        expect(config.useRiskAssessmentConfiguration).toBe(true);
    });

    it('forwards urlSessionOption', function () {
        var config = buildConfig(IosClientName.Emulator.NoAuth, {
            urlSessionOption: URLSessionOption.Ephemeral,
        });
        expect(config.urlSessionOption).toBe(URLSessionOption.Ephemeral);
    });

    it('forwards tokenBindingConfiguration', function () {
        var tokenBinding = iOSTokenBinding({ keyPairType: CryptoKeyType.P256 });
        var config = buildConfig(IosClientName.Emulator.NoAuth, {
            tokenBindingConfiguration: tokenBinding,
        });
        expect(config.tokenBindingConfiguration).toEqual(tokenBinding);
    });

    // The refusal scenario's premise: an unbound app against a client that issues token-bound codes.
    it('lets an explicit tokenBindingConfiguration override the client definition', function () {
        var config = buildConfig(IosClientName.Emulator.NoAuthDpopNonceTokenBound, {
            tokenBindingConfiguration: noTokenBinding(),
        });
        expect(config.tokenBindingConfiguration).toEqual({ kind: 'unbound' });
    });

    it('forwards authorizationParameters', function () {
        var authParams = { scope: ['openid', 'profile'] };
        var config = buildConfig(IosClientName.Emulator.NoAuth, {
            authorizationParameters: authParams,
        });
        expect(config.authorizationParameters).toEqual(authParams);
    });

    it('forwards httpHeaders', function () {
        var headers = { 'X-Test': 'value' };
        var config = buildConfig(IosClientName.Emulator.NoAuth, {
            httpHeaders: headers,
        });
        expect(config.httpHeaders).toEqual(headers);
    });
});

// ---------------------------------------------------------------------------
// createDcrConfiguration
// ---------------------------------------------------------------------------

describe('createDcrConfiguration', function () {
    it('sets templateClientId to the iOS DCR template', function () {
        var dcr = createDcrConfiguration('https://example.com');
        expect(dcr.templateClientId).toBe('dcr-template-client-haapi-ios');
    });

    it('builds clientRegistrationEndpointUrl from baseUrl', function () {
        var dcr = createDcrConfiguration('https://example.com');
        expect(dcr.clientRegistrationEndpointUrl).toBe(
            'https://example.com/oauth/oauth-client-registration'
        );
    });
});

// ---------------------------------------------------------------------------
// JSON serializability
// ---------------------------------------------------------------------------

describe('JSON serializability', function () {
    it('every client config round-trips through JSON', function () {
        ALL_NAMES.forEach(function (name) {
            var config = buildConfig(name);
            var parsed = JSON.parse(JSON.stringify(config));
            expect(parsed).toEqual(config);
        });
    });
});
