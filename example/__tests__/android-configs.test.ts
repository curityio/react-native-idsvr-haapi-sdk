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
    noTokenBinding,
} from '@curity/identityserver-haapi-react-native-sdk';

import {
    AndroidClientName,
    ANDROID_CLIENT_DEFS,
    isEmulator,
    isPhysical,
    createAppAndroidConfiguration,
    createDcrConfiguration,
} from '../android-configs';
import {BASE_URL} from '../shared';
import {tokenBoundClientIdsByConfig} from './token-bound-clients';

// ---------------------------------------------------------------------------
// Shared helpers & fixtures
// ---------------------------------------------------------------------------

var EMULATOR_NAMES = Object.values(AndroidClientName.Emulator);
var PHYSICAL_NAMES = Object.values(AndroidClientName.Physical);
var ALL_NAMES = EMULATOR_NAMES.concat(PHYSICAL_NAMES);

function buildConfig(clientNameType, overrides) {
    return createAppAndroidConfiguration({
        clientNameType: clientNameType,
        useDcrConfiguration:
            overrides && overrides.useDcrConfiguration !== undefined
                ? overrides.useDcrConfiguration
                : false,
        tokenBindingConfiguration: overrides && overrides.tokenBindingConfiguration,
        httpUrlConnectionProviderOption:
            overrides && overrides.httpUrlConnectionProviderOption,
        currentTimeMillisProviderOption:
            overrides && overrides.currentTimeMillisProviderOption,
        tokenEndpointResponseListenerOption:
            overrides && overrides.tokenEndpointResponseListenerOption,
        applicationContextOption: overrides && overrides.applicationContextOption,
    });
}

// ---------------------------------------------------------------------------
// Enum / lookup-table completeness
// ---------------------------------------------------------------------------

describe('AndroidClientName + ANDROID_CLIENT_DEFS completeness', function () {
    it('emulator and physical families are both populated', function () {
        expect(EMULATOR_NAMES).toHaveLength(23);
        expect(PHYSICAL_NAMES).toHaveLength(30);
    });

    it('client names are unique across both families', function () {
        expect(new Set(ALL_NAMES).size).toBe(ALL_NAMES.length);
    });

    it('every client name has a definition and every definition has a name', function () {
        var defKeys = Object.keys(ANDROID_CLIENT_DEFS);
        ALL_NAMES.forEach(function (name) {
            expect(ANDROID_CLIENT_DEFS[name]).toBeDefined();
        });
        expect(defKeys.slice().sort()).toEqual(ALL_NAMES.slice().sort());
    });

    it('emulator names carry the emulator marker and physical names the real marker', function () {
        EMULATOR_NAMES.forEach(function (name) {
            expect(name.indexOf('haapi-android-client-emulator')).toBe(0);
        });
        PHYSICAL_NAMES.forEach(function (name) {
            expect(name.indexOf('haapi-android-client-real')).toBe(0);
        });
    });

    it('isEmulator / isPhysical classify every client exactly once', function () {
        EMULATOR_NAMES.forEach(function (name) {
            expect(isEmulator(name)).toBe(true);
            expect(isPhysical(name)).toBe(false);
        });
        PHYSICAL_NAMES.forEach(function (name) {
            expect(isPhysical(name)).toBe(true);
            expect(isEmulator(name)).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// Attestation — asserted from the client family, not a hand-kept name list
// ---------------------------------------------------------------------------

describe('createAppAndroidConfiguration — attestation', function () {
    // Mirrors the iOS suite and the AttestationConfiguration doc comment in
    // android-configs.ts:
    //   '-without-attestation' -> client sends none; server allows it.
    //   '-attestation-fails'   -> client DOES attest; the server's deliberately wrong
    //                             package name refuses it. That refusal (and the DCR
    //                             fallback behind it) is the behaviour under test.
    //   anything else          -> client attests normally.
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

    it('every -attestation-fails client supports DCR, since DCR fallback is what the refusal exercises', function () {
        var failsClients = ALL_NAMES.filter(function (name) {
            return name.indexOf('-attestation-fails') !== -1;
        });
        expect(failsClients.length).toBeGreaterThan(0);
        failsClients.forEach(function (name) {
            expect(ANDROID_CLIENT_DEFS[name].isSupportingDcr).toBe(true);
        });
    });
});

// ---------------------------------------------------------------------------
// Client authentication method — also derived from the client name
// ---------------------------------------------------------------------------

describe('createAppAndroidConfiguration — client authentication', function () {
    // The client name encodes the auth method the server has configured for it, so
    // name and auth method must not drift apart. Checked most-specific-first:
    // 'asym-' and '-symmetric' are disjoint, so no ordering trap between them.
    function expectedAuthKind(name) {
        if (name.indexOf('mtls') !== -1) {
            return 'mtls';
        }
        if (name.indexOf('asym-') !== -1) {
            return 'jwtAsymmetric';
        }
        if (name.indexOf('symmetric') !== -1) {
            return 'jwtSymmetric';
        }
        if (name.indexOf('secret') !== -1) {
            return 'secret';
        }
        return 'none';
    }

    ALL_NAMES.forEach(function (name) {
        var expected = expectedAuthKind(name);
        it(name + ' uses auth kind "' + expected + '"', function () {
            var config = buildConfig(name);
            expect(config.clientAuthenticationMethodConfiguration.kind).toBe(expected);
        });
    });

    it('ships a placeholder for the symmetric clients, not the test servers\' shared secret', function () {
        // The E2E runner supplies the real secret to its own builds; the example a host app
        // copies from carries none.
        ALL_NAMES.filter(function (name) {
            return expectedAuthKind(name) === 'jwtSymmetric';
        }).forEach(function (name) {
            expect(buildConfig(name).clientAuthenticationMethodConfiguration.secretKey).toMatch(/^<[a-z-]+>$/);
        });
    });
});

// ---------------------------------------------------------------------------
// Factory wiring
// ---------------------------------------------------------------------------

describe('createAppAndroidConfiguration — wiring', function () {
    it('uses the client name as both clientId and keyStoreAlias', function () {
        ALL_NAMES.forEach(function (name) {
            var config = buildConfig(name);
            expect(config.clientId).toBe(name);
            expect(config.keyStoreAlias).toBe(name);
        });
    });

    it('sets the app redirect for every client', function () {
        ALL_NAMES.forEach(function (name) {
            var config = buildConfig(name);
            expect(config.appRedirect).toBe('app://haapi');
        });
    });

    it('omits dcrConfiguration unless requested', function () {
        var config = buildConfig(AndroidClientName.Emulator.NoAuth);
        expect(config.dcrConfiguration).toBeUndefined();
    });

    it('builds dcrConfiguration when requested', function () {
        var config = buildConfig(AndroidClientName.Emulator.NoAuth, {
            useDcrConfiguration: true,
        });
        expect(config.dcrConfiguration).toEqual(createDcrConfiguration({baseUrl: BASE_URL}));
    });
});

// Clients whose server config sets `issue-token-bound-authorization-code` to true, read from
// configs/dev-config.xml and configs/docker-config.xml. Their codes can only be exchanged with a
// DPoP proof, so the app must bind; every other client must not.
var TOKEN_BOUND_BY_CONFIG = tokenBoundClientIdsByConfig('haapi-android-client-');
var TOKEN_BOUND_CLIENTS = TOKEN_BOUND_BY_CONFIG['dev-config.xml'];

describe('createAppAndroidConfiguration — token binding', function () {
    it('binds tokens for every client that issues token-bound authorization codes', function () {
        TOKEN_BOUND_CLIENTS.forEach(function (name) {
            expect(buildConfig(name).tokenBindingConfiguration).toEqual(AndroidTokenBinding());
        });
    });

    it('leaves every other client unbound', function () {
        ALL_NAMES.filter(function (name) {
            return TOKEN_BOUND_CLIENTS.indexOf(name) === -1;
        }).forEach(function (name) {
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

    // The refusal scenario's premise: an unbound app against a client that issues token-bound codes.
    it('lets an explicit tokenBindingConfiguration override the client definition', function () {
        var config = buildConfig(AndroidClientName.Emulator.NoAuthDpopNonceBoundToken, {
            tokenBindingConfiguration: noTokenBinding(),
        });
        expect(config.tokenBindingConfiguration).toEqual(noTokenBinding());
    });
});
