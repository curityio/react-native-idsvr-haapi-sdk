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
 * The twelve ids are fixed by the spec (FR-003, clarified as exhaustive for v1); they are used
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
}

/** DPoP-nonce handling requires this server version, matching the sibling SDK suites. */
const DPOP_NONCE_MIN_SERVER_VERSION = '7.1.0';

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
        id: 'accessor-lifecycle',
        title: 'Re-initialising an open accessor reports the already-initialized error',
        variant: ClientVariant.Plain,
        lanes: ALL_LANES,
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

    return null;
}
