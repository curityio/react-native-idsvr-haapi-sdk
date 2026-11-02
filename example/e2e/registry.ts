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
    ClientVariant,
    EnvironmentConfig,
    canServerVersionSupport,
    clientIdFor,
} from './environment';

/**
 * The v1 scenario matrix, as **data**.
 *
 * Deliberately holds no behaviour: which client a scenario runs as, which lanes it belongs to
 * and which server version it needs are all values, so tuning the matrix against real-run
 * feedback (expected — see the spec's Clarifications) is an edit here rather than a redesign.
 * The executable flows live in `scenarios.ts` and are joined to these specs by `id`, which
 * also keeps this module independent of them.
 *
 * The ids are fixed by the specs (HSRN-27 FR-003; HSRN-49 added the storage migration); they are used
 * verbatim as testIDs, Maestro flow filenames and JUnit test-case names, so renaming one is a
 * contract change.
 */

/** A run target: a device kind paired with a client-family grade. */
export enum Lane {
    IosSim = 'ios-sim',
    AndroidEmu = 'android-emu',
    IosDevice = 'ios-device',
    AndroidDevice = 'android-device',
}

export const ALL_LANES: readonly Lane[] = [
    Lane.IosSim,
    Lane.AndroidEmu,
    Lane.IosDevice,
    Lane.AndroidDevice,
];

export interface ScenarioSpec {
    readonly id: string;
    readonly title: string;
    /** Which member of the server-side client family this scenario needs. */
    readonly variant: ClientVariant;
    readonly lanes: readonly Lane[];
    /** Minimum Curity Identity Server version; below it the scenario skips with a reason. */
    readonly minServerVersion?: string;
    /**
     * Runs only where the server's certificate is publicly trusted (a tunnel), because the scenario uses the
     * app's own `fetch`; elsewhere it skips with that reason.
     */
    readonly requiresTrustedTls?: boolean;
}

/** DPoP-nonce handling requires this server version, matching the sibling SDK suites. */
const DPOP_NONCE_MIN_SERVER_VERSION = '7.1.0';

/** A HAAPI client can be set to issue DPoP-bound access tokens from this server version. */
const DPOP_BOUND_ACCESS_TOKEN_MIN_SERVER_VERSION = '11.5.0';

export const SCENARIOS: readonly ScenarioSpec[] = [
    {
        id: 'auth-happy',
        title: 'Authentication flow reaches an authorization response',
        variant: ClientVariant.Plain,
        lanes: ALL_LANES,
    },
    {
        id: 'auth-bad-credentials',
        title: 'Invalid credentials surface a problem step',
        variant: ClientVariant.Plain,
        lanes: ALL_LANES,
    },
    {
        id: 'fetch-happy',
        title: 'Authorization code exchanges for tokens',
        variant: ClientVariant.Plain,
        lanes: ALL_LANES,
    },
    {
        id: 'fetch-invalid-code',
        title: 'Invalid authorization code is rejected as invalid_grant',
        variant: ClientVariant.Plain,
        lanes: ALL_LANES,
    },
    {
        id: 'refresh-happy',
        title: 'Refresh returns tokens that differ from the originals',
        variant: ClientVariant.Plain,
        lanes: ALL_LANES,
    },
    {
        id: 'refresh-invalid-token',
        title: 'Invalid refresh token is rejected',
        variant: ClientVariant.Plain,
        lanes: ALL_LANES,
    },
    {
        id: 'refresh-survives-second-sign-in',
        title: 'A token-bound sign-in still refreshes after a second sign-in',
        // Plain clients already bind the refresh token to the DPoP key, which is the binding a
        // second sign-in must not disturb; no token-bound-code client is needed.
        variant: ClientVariant.Plain,
        lanes: ALL_LANES,
    },
    {
        id: 'revoke-access-refresh-works',
        title: 'Revoking the access token leaves refresh working',
        variant: ClientVariant.Plain,
        lanes: ALL_LANES,
    },
    {
        id: 'revoke-refresh-refresh-dies',
        title: 'Revoking the refresh token makes refresh fail',
        variant: ClientVariant.Plain,
        lanes: ALL_LANES,
    },
    {
        id: 'attestation-fails',
        title: 'Server refusal of attestation surfaces as a typed attestation error',
        variant: ClientVariant.AttestationFails,
        // **Android lanes only, and that is a property of the platforms, not a gap.**
        //
        // The behaviour under test is the server *actively refusing an attestation the device
        // created successfully*. That path exists on Android — the server validates the key
        // attestation's certificate chain and signature, so it can genuinely deny an
        // attestation the device produced — and the `-attestation-fails` client's wrong package
        // name is simply a convenient way to make it deny. On iOS the server does not validate
        // the App Attest attestation against Apple at all, so there is no valid attestation for
        // it to refuse and no fixture can manufacture one.
        //
        // The iOS `-attestation-fails` client (wrong `app-id`) does *not* reproduce it: the app
        // attests correctly and the server rejects the mismatch as configuration —
        // `403 access_denied, "attested RP ID does not match app ID digest"` — which the SDK
        // correctly reports as a server error, because re-attesting cannot fix a misconfigured
        // deployment. `HaapiError.attestationRefusedByServer` is reserved for a genuinely
        // invalid attestation *state*, which the server signals with its curated
        // `provided-attestation-state-is-invalid:` descriptor. Investigated and declined as an
        // SDK defect in HSI-536; do not "fix" this by widening the assertion to accept
        // HAAPI_SERVER_ERROR, which would let a real Android regression pass unnoticed.
        //
        // ios-sim is excluded for a second, independent reason: App Attest does not exist on a
        // simulator and the emulator clients disable attestation validation server-side.
        //
        // Both iOS lanes therefore report SKIPPED-with-reason, never a silent drop. The genuine
        // iOS attestation failure — attestation missing on a client that mandates it — is a
        // different error path and belongs in its own scenario.
        lanes: [Lane.AndroidEmu, Lane.AndroidDevice],
    },
    {
        id: 'attestation-required-but-missing',
        title: 'A client that mandates attestation refuses an app that sends none',
        // The **secret** client, deliberately paired with attestation switched off in the app.
        // The mismatch is the premise, expressed by `{attest: false}` in the scenario rather than
        // by a client id, because no client family encodes "required but absent".
        //
        // Secret rather than plain, and the first local run is why. Against the no-auth client
        // the SDK rejects the configuration before any request leaves the device —
        // `If ClientAuthenticationMethodConfiguration is None then attestation needs to be
        // enabled` — because a public client with neither authentication nor attestation cannot
        // identify itself at all. That is a sound rule, but it meant the scenario was exercising
        // the SDK's config validator instead of the server's attestation requirement. A secret
        // gives the client another way to authenticate, so the request reaches the server and the
        // refusal under test is the server's. All four `…-secret` clients declare `<attestation>`
        // with no `allow-without-attestation`, so the requirement is genuinely there.
        variant: ClientVariant.Secret,
        // All four lanes, and that symmetry is the point: unlike `attestation-fails`, this route
        // into an attestation refusal exists identically on both platforms, so it is the one
        // place the matrix can compare them directly. Every plain client in docker-config.xml
        // declares `<attestation>` with no `allow-without-attestation`, on both platforms and
        // for both emulator and real families, so the requirement is genuinely there in all four.
        lanes: ALL_LANES,
    },
    {
        id: 'dpop-nonce-happy',
        title: 'Flow and tokens succeed against a DPoP-nonce client',
        variant: ClientVariant.DpopNonce,
        lanes: ALL_LANES,
        minServerVersion: DPOP_NONCE_MIN_SERVER_VERSION,
    },
    {
        id: 'secret-auth-happy',
        title: 'Flow and tokens succeed with secret client authentication',
        variant: ClientVariant.Secret,
        lanes: ALL_LANES,
    },
    {
        id: 'symmetric-jwt-auth-happy',
        title: 'Flow, tokens and revocation succeed with symmetric JWT client authentication',
        variant: ClientVariant.SymmetricJwt,
        lanes: ALL_LANES,
    },
    // One per algorithm the example's asymmetric clients sign with. The example holds no private
    // keys; the lane runner adds the test keys to its own harness builds.
    {
        id: 'asymmetric-jwt-rs256-auth-happy',
        title: 'Flow, tokens and revocation succeed with asymmetric JWT client authentication (RS256)',
        variant: ClientVariant.AsymmetricJwtRs256,
        lanes: ALL_LANES,
    },
    {
        id: 'asymmetric-jwt-es256-auth-happy',
        title: 'Flow, tokens and revocation succeed with asymmetric JWT client authentication (ES256)',
        variant: ClientVariant.AsymmetricJwtEs256,
        lanes: ALL_LANES,
    },
    {
        id: 'asymmetric-jwt-es384-auth-happy',
        title: 'Flow, tokens and revocation succeed with asymmetric JWT client authentication (ES384)',
        variant: ClientVariant.AsymmetricJwtEs384,
        lanes: ALL_LANES,
    },
    {
        id: 'asymmetric-jwt-es512-auth-happy',
        title: 'Flow, tokens and revocation succeed with asymmetric JWT client authentication (ES512)',
        variant: ClientVariant.AsymmetricJwtEs512,
        lanes: ALL_LANES,
    },
    {
        id: 'accessor-lifecycle',
        title: 'Re-initialising an open accessor reports the already-initialized error',
        variant: ClientVariant.Plain,
        lanes: ALL_LANES,
    },
    {
        id: 'storage-migration-keeps-sign-in',
        title: 'Moving token-binding storage into the default storage keeps the sign-in across restarts',
        // Bound tokens: the server refuses a refresh signed with any other key, so refreshing across
        // the restarts proves the SDK kept its key; the probe proves the move's copy, switch and
        // cleanup. See storage-migration.ts.
        variant: ClientVariant.DpopNonceBoundToken,
        // Android only, because the subject is: the default storage, its migration and the
        // how-to's recipe are Android's (iOS keeps keys in the keychain, with nothing to move).
        // The native hooks it needs are built for Android only.
        lanes: [Lane.AndroidEmu, Lane.AndroidDevice],
        minServerVersion: DPOP_NONCE_MIN_SERVER_VERSION,
    },
    {
        id: 'token-binding-unbound-rejected',
        title: 'A token-bound client refuses the code exchange of an app with token binding off',
        // The client issues token-bound codes, so an exchange without a DPoP proof must be
        // refused — and the refusal must reach the app as a token error, on both platforms.
        variant: ClientVariant.DpopNonceBoundToken,
        lanes: ALL_LANES,
        minServerVersion: DPOP_NONCE_MIN_SERVER_VERSION,
    },
    {
        id: 'token-binding-bound-happy',
        title: 'Tokens issued with token binding on refresh with the same key',
        variant: ClientVariant.DpopNonceBoundToken,
        lanes: ALL_LANES,
        minServerVersion: DPOP_NONCE_MIN_SERVER_VERSION,
    },
    {
        id: 'token-binding-unbound-refresh-survives-new-flow',
        title: 'An unbound refresh token still refreshes after a new sign-in flow',
        // A new flow creates a new DPoP key for the HAAPI session. Unbound tokens must not care.
        variant: ClientVariant.Plain,
        lanes: ALL_LANES,
    },
    {
        id: 'token-binding-key-type-software',
        title: 'With attestation off, the software key policy binds the sign-in to a software key',
        // The key policy only applies without attestation, hence the client that doesn't require it.
        variant: ClientVariant.DpopNonceBoundTokenWithoutAttestation,
        // Android only: the key policy is an Android setting (iOS chooses the key type directly).
        lanes: [Lane.AndroidEmu, Lane.AndroidDevice],
        minServerVersion: DPOP_NONCE_MIN_SERVER_VERSION,
    },
    {
        id: 'token-binding-key-type-hardware',
        title: 'With attestation off, the hardware key policy binds the sign-in to a hardware-backed key',
        variant: ClientVariant.DpopNonceBoundTokenWithoutAttestation,
        lanes: [Lane.AndroidEmu, Lane.AndroidDevice],
        minServerVersion: DPOP_NONCE_MIN_SERVER_VERSION,
    },
    {
        id: 'keychain-access-group-keeps-sign-in',
        title: 'A token-bound sign-in keeps refreshing with its keychain items in an entitled access group',
        // Bound tokens: the server refuses a refresh without the sign-in's key, so refreshing proves
        // the key was stored in, and read back from, the shared group.
        variant: ClientVariant.DpopNonceBoundToken,
        // iOS only: the keychain access group is an iOS setting.
        lanes: [Lane.IosSim, Lane.IosDevice],
        minServerVersion: DPOP_NONCE_MIN_SERVER_VERSION,
    },
    {
        id: 'keychain-access-group-not-entitled',
        title: 'An access group the app is not entitled to gets the refresh refused with invalid_dpop_proof',
        // The failing counterpart: had the group been ignored, the refresh would succeed.
        variant: ClientVariant.DpopNonceBoundToken,
        // Device only until a simulator run shows the refusal: whether the simulator enforces the
        // Keychain Sharing entitlement is unmeasured, and where it doesn't, this scenario fails.
        lanes: [Lane.IosDevice],
        minServerVersion: DPOP_NONCE_MIN_SERVER_VERSION,
    },
    {
        id: 'dpop-proof-userinfo',
        title: 'A DPoP proof the SDK signs is accepted by a DPoP-protected resource server',
        // A proof is checked only for a DPoP-bound access token; a bearer one is accepted without it.
        variant: ClientVariant.DpopNonceBoundAccessToken,
        lanes: ALL_LANES,
        minServerVersion: DPOP_BOUND_ACCESS_TOKEN_MIN_SERVER_VERSION,
    },
    {
        id: 'dpop-proof-wrong-request-rejected',
        title: 'A DPoP proof is refused for any request other than the one it was made for',
        variant: ClientVariant.DpopNonceBoundAccessToken,
        lanes: ALL_LANES,
        minServerVersion: DPOP_BOUND_ACCESS_TOKEN_MIN_SERVER_VERSION,
    },
    {
        id: 'dpop-proof-oauth-accessor-after-refresh',
        title: 'An OAuth-only accessor signs an accepted DPoP proof for a refreshed access token',
        variant: ClientVariant.DpopNonceBoundAccessToken,
        lanes: ALL_LANES,
        minServerVersion: DPOP_BOUND_ACCESS_TOKEN_MIN_SERVER_VERSION,
    },
    {
        id: 'dpop-proof-no-key',
        title: 'No DPoP proof for a superseded, refresh, unknown or revoked token',
        variant: ClientVariant.DpopNonceBoundAccessToken,
        lanes: ALL_LANES,
        minServerVersion: DPOP_BOUND_ACCESS_TOKEN_MIN_SERVER_VERSION,
    },
    {
        id: 'dpop-proof-unbound-accessor',
        title: 'An accessor without token binding signs no DPoP proof, even for a token minted while bound',
        variant: ClientVariant.DpopNonceBoundAccessToken,
        lanes: ALL_LANES,
        minServerVersion: DPOP_BOUND_ACCESS_TOKEN_MIN_SERVER_VERSION,
    },
    {
        id: 'dpop-proof-android-older-key-divergence',
        title: 'An untracked token gets no DPoP proof on iOS, and one from an older key on Android 5.7.0',
        variant: ClientVariant.DpopNonceBoundAccessToken,
        lanes: ALL_LANES,
        minServerVersion: DPOP_BOUND_ACCESS_TOKEN_MIN_SERVER_VERSION,
    },
    {
        id: 'dpop-proof-invalid-input',
        title: 'Input no DPoP proof can be made for is refused as HAAPI_INVALID_ARGUMENT',
        variant: ClientVariant.DpopNonceBoundAccessToken,
        lanes: ALL_LANES,
        minServerVersion: DPOP_BOUND_ACCESS_TOKEN_MIN_SERVER_VERSION,
    },
    {
        id: 'dpop-proof-userinfo-fetch',
        title: "The documented DPoP recipe works with the app's own fetch",
        variant: ClientVariant.DpopNonceBoundAccessToken,
        lanes: ALL_LANES,
        minServerVersion: DPOP_BOUND_ACCESS_TOKEN_MIN_SERVER_VERSION,
        requiresTrustedTls: true,
    },
];

export const SCENARIO_IDS: readonly string[] = SCENARIOS.map(scenario => scenario.id);

/** The client id a scenario runs as, derived from the configured base. */
export function clientIdForScenario(spec: ScenarioSpec, config: EnvironmentConfig): string {
    return clientIdFor(config, spec.variant);
}

/** Every scenario assigned to `lane` (membership only — see {@link skipReasonFor}). */
export function scenariosForLane(lane: Lane): readonly ScenarioSpec[] {
    return SCENARIOS.filter(scenario => scenario.lanes.indexOf(lane) !== -1);
}

/**
 * Why `spec` cannot run, or `null` when it can.
 *
 * Returns a *reason* rather than filtering the scenario away, so the run reports it as
 * SKIPPED-with-reason. A silently omitted scenario reads as covered when it never ran.
 */
export function skipReasonFor(
    spec: ScenarioSpec,
    config: EnvironmentConfig,
    lane: Lane
): string | null {
    if (spec.lanes.indexOf(lane) === -1) {
        return `Not run on ${lane}`;
    }

    if (
        spec.minServerVersion !== undefined &&
        !canServerVersionSupport(config.idsvrVersion, spec.minServerVersion)
    ) {
        return `Requires server >= ${spec.minServerVersion} (configured: ${config.idsvrVersion})`;
    }

    if (spec.requiresTrustedTls === true && !config.trustedTls) {
        return "The server's certificate is not publicly trusted, so the app's own fetch can't reach it — " +
            'run against a tunnel (--base-url)';
    }

    return null;
}
