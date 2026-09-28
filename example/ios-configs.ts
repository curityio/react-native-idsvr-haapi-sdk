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
    ClientAuthenticationMethodConfiguration,
    createIOSConfiguration,
    CryptoKeyType,
    DcrConfiguration,
    IOSAttestationConfiguration,
    IOSConfiguration,
    IOSDcrConfiguration,
    iOSJwtAsymmetricAuthentication,
    iOSMtlsAuthentication,
    IOSTokenBoundConfiguration,
    JwtAsymmetricAlgorithm,
    JwtSymmetricAlgorithm,
    jwtSymmetricAuthentication,
    noAuthentication,
    OAuthAuthorizationParameters,
    secretAuthentication,
    URLSessionOption,
    BundleOption,
    UnboundedTokenConfiguration,
} from "@curity/identityserver-haapi-react-native-sdk";
import {BASE_URL} from "./shared";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const APP_REDIRECT = 'haapi:start';
const IOS_DCR_TEMPLATE_CLIENT_ID = 'dcr-template-client-haapi-ios';

const FULL_SCOPES = ['address', 'email', 'openid', 'phone', 'profile', 'read', 'write'];
const READ_SCOPES = ['read'];

/**
 * Which clients attest, by server-side client family:
 *
 * - plain clients (`…-emulator`, `…-real`) — attest; the server validates (emulator
 *   clients pass because their server config disables attestation *validation*).
 * - `…-without-attestation` — do not attest; the server permits it via
 *   `allow-without-attestation`.
 * - `…-attestation-fails` — **do** attest. The server client deliberately declares a
 *   wrong app id. Note what this actually produces on iOS, because the name overpromises:
 *   the app attests correctly and the server rejects the *configuration* mismatch with
 *   `403 access_denied, "attested RP ID does not match app ID digest"`, which the SDK
 *   reports as a server error — correctly, since re-attesting cannot fix a misconfigured
 *   deployment. It is **not** a refused attestation: the iOS server never validates the
 *   App Attest attestation against Apple, so it has nothing to refuse. Android is the
 *   opposite — the server validates the key attestation's certificate chain and signature,
 *   so it can genuinely deny an attestation the device produced — which is why the
 *   `attestation-fails` scenario runs on Android lanes only (see `e2e/registry.ts`, and
 *   HSI-536 for the investigation).
 */
const AttestationConfiguration = {
    Enabled: {
        useAttestation: true,
        attestationMaxRetries: 3,
    } satisfies IOSAttestationConfiguration,
    Disabled: {
        useAttestation: false,
        attestationMaxRetries: 3,
    } satisfies IOSAttestationConfiguration,
}

// ---------------------------------------------------------------------------
// Auth method constants
//
// MTLS, asymmetric JWT, and symmetric JWT require client-side key material
// (PKCS12 bundles, PEM private keys, shared secrets) that is NOT present in
// the server XML config. The values below use conventional filenames derived
// from the server certificate IDs. Host apps must bundle the actual key files.
// ---------------------------------------------------------------------------

const NO_AUTH = noAuthentication();
const SECRET_AUTH = secretAuthentication('foo');
const SECRET_KEY_JWT = "_UQ49FAPrM0XOdjNROeVIrbfPvTzqVgfLBi66Nk0mIBttc9ZBakcC9ZiuAu9WCvg";
const PASSPHRASE = "changeit";
const SERVER_PEM_LOCALHOST_FILENAME = 'localhost';

const MTLS_AUTH = iOSMtlsAuthentication({
    pkcs12Filename: "mutual_tls_client",
    pkcs12Passphrase: PASSPHRASE,
    serverPEMFilename: SERVER_PEM_LOCALHOST_FILENAME,
    isValidatingHostname: true,
    bundleOption: BundleOption.Main
});

const ASYM_RSA = iOSJwtAsymmetricAuthentication({
    asymmetricAlgorithm: JwtAsymmetricAlgorithm.RS256,
    pemFilename: 'rsa-private',
    bundleOption: BundleOption.Main
});

const ASYM_EC_256 = iOSJwtAsymmetricAuthentication({
    asymmetricAlgorithm: JwtAsymmetricAlgorithm.ES256,
    pemFilename: 'ec_256-private',
    bundleOption: BundleOption.Main
});

const ASYM_EC_384 = iOSJwtAsymmetricAuthentication({
    asymmetricAlgorithm: JwtAsymmetricAlgorithm.ES384,
    pemFilename: 'ec_384-private',
    bundleOption: BundleOption.Main
});

const ASYM_EC_512 = iOSJwtAsymmetricAuthentication({
    asymmetricAlgorithm: JwtAsymmetricAlgorithm.ES512,
    pemFilename: 'ec_512-private',
    bundleOption: BundleOption.Main
});

// Symmetric: the actual shared secret must match what the server expects.
// The server config stores an encrypted form — these placeholders must be
// replaced with the real plaintext secret for the environment.
const SYMMETRIC_EMULATOR = jwtSymmetricAuthentication({
    symmetricAlgorithm: JwtSymmetricAlgorithm.HS256,
    secretKey: '<emulator-symmetric-shared-secret>',
});

const SYMMETRIC_REAL = jwtSymmetricAuthentication({
    symmetricAlgorithm: JwtSymmetricAlgorithm.HS256,
    secretKey: '<real-device-symmetric-shared-secret>',
});

export namespace IosClientName {
    export enum Emulator {
        // --- No authentication ---
        NoAuth = "haapi-ios-client-emulator",
        NoAuthDpopNonce = "haapi-ios-client-emulator-dpop-nonce",
        NoAuthDpopNonceTokenBound = "haapi-ios-client-emulator-dpop-nonce-token-bound",
        NoAuthDpopNonceTokenBoundChange = "haapi-ios-client-emulator-dpop-nonce-token-bound-change",

        // --- Secret authentication ---
        Secret = "haapi-ios-client-emulator-secret",
        SecretDpopNonceTokenBound = "haapi-ios-client-emulator-dpop-nonce-secret-token-bound",
        SecretWithoutAttestation = "haapi-ios-client-emulator-secret-without-attestation",
        SecretNoAuth = "haapi-ios-client-emulator-secret-and-no-authentication",

        // --- MTLS authentication ---
        Mtls = "haapi-ios-client-emulator-mtls",

        // --- Asymmetric RSA JWT ---
        AsymRSA = "haapi-ios-client-emulator-asym-rsa",
        AsymRSAWithoutAttestation = "haapi-ios-client-emulator-asym-rsa-without-attestation",

        // --- Asymmetric EC 256 JWT ---
        AsymEC256 = "haapi-ios-client-emulator-asym-ec-256",
        AsymEC256WithoutAttestation = "haapi-ios-client-emulator-asym-ec-256-without-attestation",

        // --- Asymmetric EC 384 JWT ---
        AsymEC384 = "haapi-ios-client-emulator-asym-ec-384",
        AsymEC384WithoutAttestation = "haapi-ios-client-emulator-asym-ec-384-without-attestation",

        // --- Asymmetric EC 512 JWT ---
        AsymEC512 = "haapi-ios-client-emulator-asym-ec-512",
        AsymEC512WithoutAttestation = "haapi-ios-client-emulator-asym-ec-512-without-attestation",

        // --- Symmetric JWT ---
        Symmetric = "haapi-ios-client-emulator-symmetric",
        SymmetricWithoutAttestation = "haapi-ios-client-emulator-symmetric-without-attestation",
    }

    export enum Physical {
        // --- No authentication ---
        NoAuth = "haapi-ios-client-real",
        NoAuthDpopNonce = "haapi-ios-client-real-dpop-nonce",
        NoAuthDpopNonceTokenBound = "haapi-ios-client-real-dpop-nonce-token-bound",
        NoAuthDpopNonceTokenBoundChange = "haapi-ios-client-real-dpop-nonce-token-bound-change",
        NoAuthAttestationFails = "haapi-ios-client-real-attestation-fails",

        // --- Secret authentication ---
        Secret = "haapi-ios-client-real-secret",
        SecretDpopNonceTokenBound = "haapi-ios-client-real-dpop-nonce-secret-token-bound",
        SecretWithoutAttestation = "haapi-ios-client-real-secret-without-attestation",
        SecretAttestationFails = "haapi-ios-client-real-secret-attestation-fails",
        SecretNoAuth = "haapi-ios-client-real-secret-and-no-authentication",

        // --- MTLS authentication ---
        Mtls = "haapi-ios-client-real-mtls",

        // --- Asymmetric RSA JWT ---
        AsymRSA = "haapi-ios-client-real-asym-rsa",
        AsymRSAWithoutAttestation = "haapi-ios-client-real-asym-rsa-without-attestation",

        // --- Asymmetric EC 256 JWT ---
        AsymEC256 = "haapi-ios-client-real-asym-ec-256",
        AsymEC256WithoutAttestation = "haapi-ios-client-real-asym-ec-256-without-attestation",

        // --- Asymmetric EC 384 JWT ---
        AsymEC384 = "haapi-ios-client-real-asym-ec-384",
        AsymEC384WithoutAttestation = "haapi-ios-client-real-asym-ec-384-without-attestation",

        // --- Asymmetric EC 512 JWT ---
        AsymEC512 = "haapi-ios-client-real-asym-ec-512",
        AsymEC512WithoutAttestation = "haapi-ios-client-real-asym-ec-512-without-attestation",

        // --- Symmetric JWT ---
        Symmetric = "haapi-ios-client-real-symmetric",
        SymmetricWithoutAttestation = "haapi-ios-client-real-symmetric-without-attestation",
    }
}

export type IOSClientNameType = IosClientName.Emulator | IosClientName.Physical;

// ---------------------------------------------------------------------------
// Config lookup table
// ---------------------------------------------------------------------------

export interface IosClientDef {
    authentication: ClientAuthenticationMethodConfiguration;
    attestation: IOSAttestationConfiguration;
    isSupportingDcr: boolean;
}

export const IOS_CLIENT_DEFS: Record<IOSClientNameType, IosClientDef> = {
    [IosClientName.Emulator.NoAuth]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Emulator.NoAuthDpopNonce]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Emulator.NoAuthDpopNonceTokenBound]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Emulator.NoAuthDpopNonceTokenBoundChange]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },

    [IosClientName.Emulator.Secret]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Emulator.SecretDpopNonceTokenBound]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Emulator.SecretWithoutAttestation]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Disabled, isSupportingDcr: true },
    [IosClientName.Emulator.SecretNoAuth]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },

    [IosClientName.Emulator.Mtls]: { authentication: MTLS_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },

    [IosClientName.Emulator.AsymRSA]: { authentication: ASYM_RSA, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Emulator.AsymRSAWithoutAttestation]: { authentication: ASYM_RSA, attestation: AttestationConfiguration.Disabled, isSupportingDcr: true },

    [IosClientName.Emulator.AsymEC256]: { authentication: ASYM_EC_256, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Emulator.AsymEC256WithoutAttestation]: { authentication: ASYM_EC_256, attestation: AttestationConfiguration.Disabled, isSupportingDcr: true },

    [IosClientName.Emulator.AsymEC384]: { authentication: ASYM_EC_384, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Emulator.AsymEC384WithoutAttestation]: { authentication: ASYM_EC_384, attestation: AttestationConfiguration.Disabled, isSupportingDcr: true },

    [IosClientName.Emulator.AsymEC512]: { authentication: ASYM_EC_512, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Emulator.AsymEC512WithoutAttestation]: { authentication: ASYM_EC_512, attestation: AttestationConfiguration.Disabled, isSupportingDcr: true },

    [IosClientName.Emulator.Symmetric]: { authentication: SYMMETRIC_EMULATOR, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Emulator.SymmetricWithoutAttestation]: { authentication: SYMMETRIC_EMULATOR, attestation: AttestationConfiguration.Disabled, isSupportingDcr: true },

    [IosClientName.Physical.NoAuth]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Physical.NoAuthDpopNonce]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Physical.NoAuthDpopNonceTokenBound]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Physical.NoAuthDpopNonceTokenBoundChange]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Physical.NoAuthAttestationFails]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },

    [IosClientName.Physical.Secret]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [IosClientName.Physical.SecretDpopNonceTokenBound]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Physical.SecretWithoutAttestation]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Disabled, isSupportingDcr: true },
    [IosClientName.Physical.SecretAttestationFails]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [IosClientName.Physical.SecretNoAuth]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },

    [IosClientName.Physical.Mtls]: { authentication: MTLS_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },

    [IosClientName.Physical.AsymRSA]: { authentication: ASYM_RSA, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Physical.AsymRSAWithoutAttestation]: { authentication: ASYM_RSA, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },

    [IosClientName.Physical.AsymEC256]: { authentication: ASYM_EC_256, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Physical.AsymEC256WithoutAttestation]: { authentication: ASYM_EC_256, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },

    [IosClientName.Physical.AsymEC384]: { authentication: ASYM_EC_384, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Physical.AsymEC384WithoutAttestation]: { authentication: ASYM_EC_384, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },

    [IosClientName.Physical.AsymEC512]: { authentication: ASYM_EC_512, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Physical.AsymEC512WithoutAttestation]: { authentication: ASYM_EC_512, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },

    [IosClientName.Physical.Symmetric]: { authentication: SYMMETRIC_REAL, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [IosClientName.Physical.SymmetricWithoutAttestation]: { authentication: SYMMETRIC_REAL, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function isEmulator(clientNameType: IOSClientNameType): clientNameType is IosClientName.Emulator {
    return Object.values(IosClientName.Emulator).includes(clientNameType as IosClientName.Emulator);
}

export function isPhysical(clientNameType: IOSClientNameType): clientNameType is IosClientName.Physical {
    return Object.values(IosClientName.Physical).includes(clientNameType as IosClientName.Physical);
}

export type CreateIosConfigurationOptions = {
    clientNameType: IOSClientNameType;
    useDcrConfiguration: boolean;
    useRiskAssessmentConfiguration?: boolean;
    hasTokenEndpointResponseListener?: boolean;
    urlSessionOption?: URLSessionOption;
    tokenBoundConfiguration?: IOSTokenBoundConfiguration;
    authorizationParameters?: OAuthAuthorizationParameters;
    httpHeaders?: Record<string, string>;
    /**
     * Overrides the attestation setting the client definition carries.
     *
     * Exists for one deliberate mismatch: pointing the app at a client that **mandates**
     * attestation while sending none, which is the genuine "attestation required but missing"
     * refusal. Every plain client in `configs/docker-config.xml` declares `<attestation>` with no
     * `allow-without-attestation`, so the pairing is only expressible by overriding here — the
     * definition map is keyed by client id and would otherwise force attestation on.
     *
     * Not a general escape hatch: leave it unset unless a scenario's premise *is* the mismatch.
     */
    attestationOverride?: IOSAttestationConfiguration;
};

export function createAppIosConfiguration({
    clientNameType,
    useDcrConfiguration = false,
    useRiskAssessmentConfiguration = false,
    hasTokenEndpointResponseListener = false,
    urlSessionOption = URLSessionOption.Default,
    tokenBoundConfiguration = new UnboundedTokenConfiguration(),
    authorizationParameters,
    httpHeaders,
    attestationOverride,
}: CreateIosConfigurationOptions): IOSConfiguration {
    const clientDef = IOS_CLIENT_DEFS[clientNameType];
    if (clientDef === undefined) {
        // Without this the next line reads `.attestation` off `undefined`. Callers build this at
        // module scope, where that TypeError takes the whole bundle down and the app renders a
        // blank screen — a symptom that names neither the client id nor this file.
        throw new Error(
            `Unknown iOS client id "${clientNameType}". ` +
                'It is not defined in IOS_CLIENT_DEFS (example/ios-configs.ts) — an Android ' +
                'client id or a typo reaches here as an unknown id.'
        );
    }
    const dcrConfiguration: IOSDcrConfiguration | undefined = useDcrConfiguration
        ? createDcrConfiguration(BASE_URL)
        : undefined;
    return createIOSConfiguration({
        clientId: clientNameType,
        appRedirect: APP_REDIRECT,
        name: clientNameType,
        urlSessionOption: urlSessionOption,
        attestationConfiguration: attestationOverride ?? clientDef.attestation,
        tokenBoundConfiguration: tokenBoundConfiguration,
        clientAuthenticationMethodConfig: clientDef.authentication,
        dcrConfiguration: dcrConfiguration,
        useRiskAssessmentConfiguration: useRiskAssessmentConfiguration,
        hasTokenEndpointResponseListener: hasTokenEndpointResponseListener,
        authorizationParameters: authorizationParameters,
        httpHeaders: httpHeaders,
    });
}

export function createDcrConfiguration(baseUrl: string): DcrConfiguration {
    return {
        templateClientId: IOS_DCR_TEMPLATE_CLIENT_ID,
        clientRegistrationEndpointUrl: `${baseUrl}/oauth/oauth-client-registration`,
    }
}