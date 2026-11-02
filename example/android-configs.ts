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
    AndroidAttestationConfiguration,
    AndroidConfiguration,
    AndroidDcrConfiguration,
    AndroidTokenBinding,
    AndroidTokenBindingConfiguration,
    ApplicationContextOption,
    ClientAuthenticationMethodConfiguration,
    createAndroidConfiguration,
    CurrentTimeMillisProviderOption,
    HttpUrlConnectionProviderOption,
    JwtAsymmetricAlgorithm,
    AndroidJwtAsymmetricAuthentication,
    JwtSymmetricAlgorithm,
    jwtSymmetricAuthentication,
    AndroidMtlsAuthentication,
    KeyStoreOption,
    noAuthentication,
    noTokenBinding,
    secretAuthentication,
    TokenEndpointResponseListenerOption,
} from "@curity/identityserver-haapi-react-native-sdk";
import {BASE_URL} from "./shared";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const APP_REDIRECT = 'app://haapi';
const ANDROID_DCR_TEMPLATE_CLIENT_ID = 'dcr-template-client-haapi-android';

const FULL_SCOPES = ['address', 'email', 'openid', 'phone', 'profile', 'read', 'write'];
const READ_SCOPES = ['read'];

/**
 * Which clients attest, by server-side client family:
 *
 * - plain clients (`…-emulator`, `…-real`) — attest; the server validates (emulator
 *   clients pass because their server config relaxes the attestation policy).
 * - `…-without-attestation` — do not attest; the server permits it via
 *   `allow-without-attestation`.
 * - `…-attestation-fails` — **do** attest. The server client deliberately declares a
 *   wrong package name, so a genuine attestation gets refused; that refusal (and the
 *   DCR fallback behind it) is the behaviour under test. Disabling attestation here
 *   would send nothing for the server to refuse and silently test nothing.
 */
const AttestationConfiguration = {
    Enabled: {
        useAttestation: true,
    } satisfies AndroidAttestationConfiguration,
    Disabled: {
        useAttestation: false,
    } satisfies AndroidAttestationConfiguration,
}

// ---------------------------------------------------------------------------
// Auth method constants
//
// MTLS, asymmetric JWT, and symmetric JWT require client-side key material
// (PKCS12 bundles, KeyStore files, shared secrets) that is NOT present in
// the server XML config. The values below use conventional filenames derived
// from the server certificate IDs. Host apps must bundle the actual key files.
//
// Android asymmetric JWT uses KeyStore files (keyStoreFilename, keyStorePassword,
// alias) instead of the PEM files used on iOS.
// ---------------------------------------------------------------------------

const NO_AUTH = noAuthentication();
const SECRET_AUTH = secretAuthentication('foo');

const MTLS_AUTH = AndroidMtlsAuthentication({
    clientKeyStoreOption: KeyStoreOption.Client,
    serverKeyStoreOption: KeyStoreOption.Server,
});

const ASYM_RSA = AndroidJwtAsymmetricAuthentication({
    asymmetricAlgorithm: JwtAsymmetricAlgorithm.RS256,
    alias: 'asym-rsa',
});

const ASYM_EC_256 = AndroidJwtAsymmetricAuthentication({
    asymmetricAlgorithm: JwtAsymmetricAlgorithm.ES256,
    alias: 'asym-ec-256',
});

const ASYM_EC_384 = AndroidJwtAsymmetricAuthentication({
    asymmetricAlgorithm: JwtAsymmetricAlgorithm.ES384,
    alias: 'asym-ec-384',
});

const ASYM_EC_512 = AndroidJwtAsymmetricAuthentication({
    asymmetricAlgorithm: JwtAsymmetricAlgorithm.ES512,
    alias: 'asym-ec-512',
});

// Symmetric: the shared secret must match what the server expects. Replace the placeholder with
// your client's secret.
const SYMMETRIC_AUTH = jwtSymmetricAuthentication({
    symmetricAlgorithm: JwtSymmetricAlgorithm.HS256,
    secretKey: '<symmetric-shared-secret>',
});

export namespace AndroidClientName {
    export enum Emulator {
        // --- No authentication ---
        NoAuth = "haapi-android-client-emulator",
        NoAuthAttestationFails = "haapi-android-client-emulator-attestation-fails",
        NoAuthDpopNonce = "haapi-android-client-emulator-dpop-nonce",
        NoAuthDpopNonceBoundToken = "haapi-android-client-emulator-dpop-nonce-bound-token",
        NoAuthDpopNonceBoundAccessToken = "haapi-android-client-emulator-dpop-nonce-bound-access-token",

        // --- Secret authentication ---
        Secret = "haapi-android-client-emulator-secret",
        SecretWithoutAttestation = "haapi-android-client-emulator-secret-without-attestation",
        SecretAttestationFails = "haapi-android-client-emulator-secret-attestation-fails",
        SecretDpopNonce = "haapi-android-client-emulator-dpop-nonce-secret",
        SecretDpopNonceWithoutAttestation = "haapi-android-client-emulator-dpop-nonce-secret-without-attestation",
        SecretDpopNonceBoundToken = "haapi-android-client-emulator-dpop-nonce-secret-bound-token",
        SecretDpopNonceBoundTokenWithoutAttestation = "haapi-android-client-emulator-dpop-nonce-secret-bound-token-without-attestation-bound-token",

        // --- MTLS authentication ---
        Mtls = "haapi-android-client-emulator-mtls",

        // --- Asymmetric RSA JWT ---
        AsymRSA = "haapi-android-client-emulator-asym-rsa",
        AsymRSAWithoutAttestation = "haapi-android-client-emulator-asym-rsa-without-attestation",

        // --- Asymmetric EC 256 JWT ---
        AsymEC256 = "haapi-android-client-emulator-asym-ec-256",
        AsymEC256WithoutAttestation = "haapi-android-client-emulator-asym-ec-256-without-attestation",

        // --- Asymmetric EC 384 JWT ---
        AsymEC384 = "haapi-android-client-emulator-asym-ec-384",
        AsymEC384WithoutAttestation = "haapi-android-client-emulator-asym-ec-384-without-attestation",

        // --- Asymmetric EC 512 JWT ---
        AsymEC512 = "haapi-android-client-emulator-asym-ec-512",
        AsymEC512WithoutAttestation = "haapi-android-client-emulator-asym-ec-512-without-attestation",

        // --- Symmetric JWT ---
        Symmetric = "haapi-android-client-emulator-symmetric",
        SymmetricWithoutAttestation = "haapi-android-client-emulator-symmetric-without-attestation",
    }

    export enum Physical {
        // --- No authentication ---
        NoAuth = "haapi-android-client-real",
        NoAuthAttestationFails = "haapi-android-client-real-attestation-fails",
        NoAuthDpopNonce = "haapi-android-client-real-dpop-nonce",
        NoAuthDpopNonceBoundToken = "haapi-android-client-real-dpop-nonce-bound-token",
        NoAuthDpopNonceBoundAccessToken = "haapi-android-client-real-dpop-nonce-bound-access-token",

        // --- Secret authentication ---
        Secret = "haapi-android-client-real-secret",
        SecretWithoutAttestation = "haapi-android-client-real-secret-without-attestation",
        SecretAttestationFails = "haapi-android-client-real-secret-attestation-fails",
        SecretDpopNonce = "haapi-android-client-real-dpop-nonce-secret",
        SecretDpopNonceWithoutAttestation = "haapi-android-client-real-dpop-nonce-secret-without-attestation",
        SecretDpopNonceBoundToken = "haapi-android-client-real-dpop-nonce-secret-bound-token",
        SecretDpopNonceWithoutAttestationBoundToken = "haapi-android-client-real-dpop-nonce-secret-without-attestation-bound-token",

        // --- MTLS authentication ---
        Mtls = "haapi-android-client-real-mtls",
        MtlsAttestationFails = "haapi-android-client-real-mtls-attestation-fails",
        MtlsWithoutAttestation = "haapi-android-client-real-mtls-without-attestation",

        // --- Asymmetric RSA JWT ---
        AsymRSA = "haapi-android-client-real-asym-rsa",
        AsymRSAWithoutAttestation = "haapi-android-client-real-asym-rsa-without-attestation",
        AsymRSAAttestationFails = "haapi-android-client-real-asym-rsa-attestation-fails",

        // --- Asymmetric EC 256 JWT ---
        AsymEC256 = "haapi-android-client-real-asym-ec-256",
        AsymEC256WithoutAttestation = "haapi-android-client-real-asym-ec-256-without-attestation",
        AsymEC256AttestationFails = "haapi-android-client-real-asym-ec-256-attestation-fails",

        // --- Asymmetric EC 384 JWT ---
        AsymEC384 = "haapi-android-client-real-asym-ec-384",
        AsymEC384WithoutAttestation = "haapi-android-client-real-asym-ec-384-without-attestation",
        AsymEC384AttestationFails = "haapi-android-client-real-asym-ec-384-attestation-fails",

        // --- Asymmetric EC 512 JWT ---
        AsymEC512 = "haapi-android-client-real-asym-ec-512",
        AsymEC512WithoutAttestation = "haapi-android-client-real-asym-ec-512-without-attestation",
        AsymEC512AttestationFails = "haapi-android-client-real-asym-ec-512-attestation-fails",

        // --- Symmetric JWT ---
        Symmetric = "haapi-android-client-real-symmetric",
        SymmetricWithoutAttestation = "haapi-android-client-real-symmetric-without-attestation",
        SymmetricAttestationFails = "haapi-android-client-real-symmetric-attestation-fails",
    }
}

export type AndroidClientNameType = AndroidClientName.Emulator | AndroidClientName.Physical;

// ---------------------------------------------------------------------------
// Config lookup table
// ---------------------------------------------------------------------------

export interface AndroidClientDef {
    authentication: ClientAuthenticationMethodConfiguration;
    attestation: AndroidAttestationConfiguration;
    isSupportingDcr: boolean;
    /**
     * Set only for clients whose server config issues token-bound authorization codes
     * (`issue-token-bound-authorization-code`): their codes need a DPoP proof to be exchanged.
     * Every other client runs unbound.
     */
    tokenBinding?: AndroidTokenBindingConfiguration;
}

const TOKEN_BINDING = AndroidTokenBinding();

export const ANDROID_CLIENT_DEFS: Record<AndroidClientNameType, AndroidClientDef> = {
    // -----------------------------------------------------------------------
    // Emulator clients
    // -----------------------------------------------------------------------

    [AndroidClientName.Emulator.NoAuth]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [AndroidClientName.Emulator.NoAuthAttestationFails]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Emulator.NoAuthDpopNonce]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [AndroidClientName.Emulator.NoAuthDpopNonceBoundToken]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false, tokenBinding: TOKEN_BINDING },
    [AndroidClientName.Emulator.NoAuthDpopNonceBoundAccessToken]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false, tokenBinding: TOKEN_BINDING },

    [AndroidClientName.Emulator.Secret]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [AndroidClientName.Emulator.SecretWithoutAttestation]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Disabled, isSupportingDcr: true },
    [AndroidClientName.Emulator.SecretAttestationFails]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Emulator.SecretDpopNonce]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Emulator.SecretDpopNonceWithoutAttestation]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },
    [AndroidClientName.Emulator.SecretDpopNonceBoundToken]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false, tokenBinding: TOKEN_BINDING },
    [AndroidClientName.Emulator.SecretDpopNonceBoundTokenWithoutAttestation]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false, tokenBinding: TOKEN_BINDING },

    [AndroidClientName.Emulator.Mtls]: { authentication: MTLS_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },

    [AndroidClientName.Emulator.AsymRSA]: { authentication: ASYM_RSA, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Emulator.AsymRSAWithoutAttestation]: { authentication: ASYM_RSA, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },

    [AndroidClientName.Emulator.AsymEC256]: { authentication: ASYM_EC_256, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Emulator.AsymEC256WithoutAttestation]: { authentication: ASYM_EC_256, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },

    [AndroidClientName.Emulator.AsymEC384]: { authentication: ASYM_EC_384, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Emulator.AsymEC384WithoutAttestation]: { authentication: ASYM_EC_384, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },

    [AndroidClientName.Emulator.AsymEC512]: { authentication: ASYM_EC_512, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Emulator.AsymEC512WithoutAttestation]: { authentication: ASYM_EC_512, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },

    [AndroidClientName.Emulator.Symmetric]: { authentication: SYMMETRIC_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Emulator.SymmetricWithoutAttestation]: { authentication: SYMMETRIC_AUTH, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },

    // -----------------------------------------------------------------------
    // Physical (real device) clients
    // -----------------------------------------------------------------------

    [AndroidClientName.Physical.NoAuth]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [AndroidClientName.Physical.NoAuthAttestationFails]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Physical.NoAuthDpopNonce]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false },
    [AndroidClientName.Physical.NoAuthDpopNonceBoundToken]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false, tokenBinding: TOKEN_BINDING },
    [AndroidClientName.Physical.NoAuthDpopNonceBoundAccessToken]: { authentication: NO_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false, tokenBinding: TOKEN_BINDING },

    [AndroidClientName.Physical.Secret]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Physical.SecretWithoutAttestation]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Disabled, isSupportingDcr: true },
    [AndroidClientName.Physical.SecretAttestationFails]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Physical.SecretDpopNonce]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Physical.SecretDpopNonceWithoutAttestation]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },
    [AndroidClientName.Physical.SecretDpopNonceBoundToken]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: false, tokenBinding: TOKEN_BINDING },
    [AndroidClientName.Physical.SecretDpopNonceWithoutAttestationBoundToken]: { authentication: SECRET_AUTH, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false, tokenBinding: TOKEN_BINDING },

    [AndroidClientName.Physical.Mtls]: { authentication: MTLS_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Physical.MtlsAttestationFails]: { authentication: MTLS_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Physical.MtlsWithoutAttestation]: { authentication: MTLS_AUTH, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },

    [AndroidClientName.Physical.AsymRSA]: { authentication: ASYM_RSA, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Physical.AsymRSAWithoutAttestation]: { authentication: ASYM_RSA, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },
    [AndroidClientName.Physical.AsymRSAAttestationFails]: { authentication: ASYM_RSA, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },

    [AndroidClientName.Physical.AsymEC256]: { authentication: ASYM_EC_256, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Physical.AsymEC256WithoutAttestation]: { authentication: ASYM_EC_256, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },
    [AndroidClientName.Physical.AsymEC256AttestationFails]: { authentication: ASYM_EC_256, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },

    [AndroidClientName.Physical.AsymEC384]: { authentication: ASYM_EC_384, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Physical.AsymEC384WithoutAttestation]: { authentication: ASYM_EC_384, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },
    [AndroidClientName.Physical.AsymEC384AttestationFails]: { authentication: ASYM_EC_384, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },

    [AndroidClientName.Physical.AsymEC512]: { authentication: ASYM_EC_512, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Physical.AsymEC512WithoutAttestation]: { authentication: ASYM_EC_512, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },
    [AndroidClientName.Physical.AsymEC512AttestationFails]: { authentication: ASYM_EC_512, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },

    [AndroidClientName.Physical.Symmetric]: { authentication: SYMMETRIC_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
    [AndroidClientName.Physical.SymmetricWithoutAttestation]: { authentication: SYMMETRIC_AUTH, attestation: AttestationConfiguration.Disabled, isSupportingDcr: false },
    [AndroidClientName.Physical.SymmetricAttestationFails]: { authentication: SYMMETRIC_AUTH, attestation: AttestationConfiguration.Enabled, isSupportingDcr: true },
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function isEmulator(clientNameType: AndroidClientNameType): clientNameType is AndroidClientName.Emulator {
    return Object.values(AndroidClientName.Emulator).includes(clientNameType as AndroidClientName.Emulator);
}

export function isPhysical(clientNameType: AndroidClientNameType): clientNameType is AndroidClientName.Physical {
    return Object.values(AndroidClientName.Physical).includes(clientNameType as AndroidClientName.Physical);
}

export type CreateAppAndroidConfigurationOptions = {
    clientNameType: AndroidClientNameType;
    /** Defaults to the client id. New token-binding keys are named after it. */
    keyStoreAlias?: string;
    tokenBindingConfiguration?: AndroidTokenBindingConfiguration;
    useDcrConfiguration: boolean;
    httpUrlConnectionProviderOption?: HttpUrlConnectionProviderOption;
    currentTimeMillisProviderOption?: CurrentTimeMillisProviderOption;
    tokenEndpointResponseListenerOption?: TokenEndpointResponseListenerOption;
    applicationContextOption?: ApplicationContextOption;
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
     * Mirrors `attestationOverride` in `ios-configs.ts`; keep the two in step.
     */
    attestationOverride?: AndroidAttestationConfiguration;
};

export function createAppAndroidConfiguration({
    clientNameType,
    keyStoreAlias,
    tokenBindingConfiguration,
    useDcrConfiguration = false,
    httpUrlConnectionProviderOption = HttpUrlConnectionProviderOption.Default,
    currentTimeMillisProviderOption = CurrentTimeMillisProviderOption.Default,
    tokenEndpointResponseListenerOption = TokenEndpointResponseListenerOption.None,
    applicationContextOption,
    attestationOverride,
}: CreateAppAndroidConfigurationOptions): AndroidConfiguration {
    const clientDef = ANDROID_CLIENT_DEFS[clientNameType];
    if (clientDef === undefined) {
        // Without this the next line reads `.attestation` off `undefined`. Callers build this at
        // module scope, where that TypeError takes the whole bundle down and the app renders a
        // blank screen — a symptom that names neither the client id nor this file.
        throw new Error(
            `Unknown Android client id "${clientNameType}". ` +
                'It is not defined in ANDROID_CLIENT_DEFS (example/android-configs.ts) — an iOS ' +
                'client id or a typo reaches here as an unknown id.'
        );
    }
    const dcrConfiguration: AndroidDcrConfiguration | undefined = useDcrConfiguration ?
            createDcrConfiguration({
                baseUrl: BASE_URL,
                contextOption: ApplicationContextOption.Default
            })
        : undefined;

    return createAndroidConfiguration({
        clientId: clientNameType,
        appRedirect: APP_REDIRECT,
        dcrConfiguration: dcrConfiguration,
        keyStoreAlias: keyStoreAlias ?? clientNameType,
        httpUrlConnectionProviderOption,
        currentTimeMillisProviderOption,
        attestationConfiguration: attestationOverride ?? clientDef.attestation,
        clientAuthenticationMethodConfig: clientDef.authentication,
        tokenBindingConfiguration: tokenBindingConfiguration ?? clientDef.tokenBinding ?? noTokenBinding(),
        tokenEndpointResponseListenerOption,
        applicationContextOption,
    });
}

export type CreateDcrConfigurationOptions = {
    baseUrl: string;
    contextOption?: ApplicationContextOption;
};

export function createDcrConfiguration({
    baseUrl,
    contextOption = ApplicationContextOption.Default,
}: CreateDcrConfigurationOptions): AndroidDcrConfiguration {
    return {
        templateClientId: ANDROID_DCR_TEMPLATE_CLIENT_ID,
        clientRegistrationEndpointUrl: `${baseUrl}/oauth-dev/oauth-registration`,
        contextOption,
    };
}
