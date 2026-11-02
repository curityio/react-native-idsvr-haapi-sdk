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

import {StorageOption, type HaapiResponse, type TokenResponse} from '@curity/identityserver-haapi-react-native-sdk';
import type {HaapiE2eAndroidNative, HaapiE2eNative, MigrationState} from 'haapi-e2e-native';
import type {AssertionResult} from './results';
import {
    androidHooks,
    authenticateForCode,
    fetchTokens,
    withHaapiAccessor,
    withOAuthAccessor,
    type BuildConfigurationOptions,
    type ScenarioContext,
} from './flow-helpers';

/**
 * `storage-migration-keeps-sign-in`: the migration how-to's recipe, end to end, on the real SDK
 * against a real server, across real process restarts.
 *
 * The example app runs the recipe (`example/e2e-native`, called first in
 * `MainApplication.onCreate()`), over a test store standing in for the app's existing one. The app
 * signs in on that store; the move then copies every entry into the SDK's default storage and
 * switches to it, never writing to the existing store. Four launches, because the move needs them:
 *   1. the app before the move — `MainApplication` runs it only in launches that continue the
 *      scenario: sign in on the existing store; the SDK creates the DPoP key and records which key
 *      the sign-in is bound to;
 *   2. the move copied the store at process start and left its canary; a refresh, still on the
 *      existing store;
 *   3. the canary read back, so the move copied the store again — with launch 2's refresh — deleted
 *      the copies of the records that refresh replaced, and switched; a refresh on the default
 *      storage;
 *   4. a refresh, the existing store still intact; then the negative control below.
 *
 * Launches 2–4 start a new HAAPI flow before their refresh, as an app that signs in at every launch
 * does: each flow gives the HAAPI session a new key, so the store differs at every start, and the
 * key clean-up at the flow's start runs on the store in use — after the switch, on the copy.
 *
 * **Which key.** Native 5.7.0 gives each HAAPI session its own key and records, under a digest of
 * each refresh token, which key that sign-in is bound to. So the probe is always asked about a
 * refresh token: the key the store in use binds it to. A refresh moves the record to the new
 * token, which is why launch 2 checks the first copy through the token it saw, launch 3 checks the
 * switching copy before its refresh and the deleted copy through launch 1's token, and everything
 * else goes through the newest one.
 *
 * **What each check proves.** The server binds the refresh token to the key that signed the token
 * request and rejects a refresh signed with any other key with `invalid_grant`; the negative
 * control at the end proves that on this server (replace the key, the next refresh must be
 * refused — it ends the sign-in, so it runs only after everything else passed). A refresh that
 * succeeds after a restart therefore proves the SDK still signs with the original key, and the
 * key's fingerprint (the Keystore public key; a software key's stored value) shows it unchanged.
 * The move itself — the copy, the switch and the cleanup — is proven by the probe's checks, not by
 * the server: on a device with a working Keystore the SDK always creates a hardware key at sign-in
 * (the bridge can't ask for a software one), and the SDK finds a hardware key in the Keystore even
 * without its stored record. The software key, which exists only in storage and so depends on the
 * move, is covered by the on-device storage suite.
 *
 * Every launch but the last reports FAIL with `awaitingRelaunch`, so a lane that never restarts
 * the app can never report this scenario green. The Maestro flow relaunches within the flow; the
 * autorun device lane's runner relaunches the app and the harness continues from the persisted
 * state (see {@link pendingScenarioId}).
 */

export const STORAGE_MIGRATION_ID = 'storage-migration-keeps-sign-in';
export const STORAGE_MIGRATION_LAUNCHES = 4;
/**
 * Its own key-store alias, so no other scenario's key can be mistaken for this one's — and so the key
 * clean-up at another scenario's start, on the default storage, never sees this scenario's keys.
 */
export const STORAGE_MIGRATION_KEY_STORE_ALIAS = 'e2e-storage-migration';
/** What the native SDK names this alias's session keys and pointer after. */
const STORAGE_MIGRATION_KEY_STEM = `haapi-dpop-${STORAGE_MIGRATION_KEY_STORE_ALIAS}`;
const LOCATION_PREFIX = 'HAAPI_KP_LOCATION_';

const TOKEN_BINDING: BuildConfigurationOptions = {
    tokenBinding: {storageOption: StorageOption.Custom},
    keyStoreAlias: STORAGE_MIGRATION_KEY_STORE_ALIAS,
};

/** Which key the SDK signs with: its alias, where it lives, and a fingerprint that identifies it. */
interface KeyInUse {
    readonly alias: string | null;
    readonly location: string | null;
    readonly fingerprint: string | null;
}

/** What survives a restart. The refresh token is a test user's, on a test server. */
interface PersistedRun {
    readonly id: string;
    readonly nextLaunch: number;
    readonly refreshToken: string;
    /** The token launch 2's copy saw, whose copied record launch 3's switch must delete. */
    readonly copiedRefreshToken?: string;
    readonly key: KeyInUse;
    readonly assertions: AssertionResult[];
}

/** A scenario's outcome when it needs the app restarted before it can finish. */
export interface ScenarioOutcome {
    readonly assertions: AssertionResult[];
    readonly awaitingRelaunch: boolean;
}

/** The scenario the persisted state says is waiting for a relaunch, or `null`. */
export function pendingScenarioId(e2eNative: HaapiE2eNative | null | undefined): string | null {
    return load(androidHooks(e2eNative))?.id ?? null;
}

export async function storageMigrationKeepsSignIn(context: ScenarioContext): Promise<ScenarioOutcome> {
    const probe = androidHooks(context.e2eNative);
    if (probe === null) {
        return finish(undefined, [
            check(
                'the example app has its native hooks (example/e2e-native)',
                false,
                'the Android E2E hooks are not built — an Android build of the example app is required'
            ),
        ]);
    }

    const run = load(probe);
    try {
        return await (run === null ? firstLaunch(context, probe) : laterLaunch(context, probe, run));
    } catch (error) {
        // A launch that throws ends the run: no later start may continue it.
        probe.clearHarnessState();
        throw error;
    }
}

async function firstLaunch(context: ScenarioContext, probe: HaapiE2eAndroidNative): Promise<ScenarioOutcome> {
    const dirty = dirtyReason(probe.migrationState(null));
    if (dirty !== null) {
        return finish(probe, [check('launch 1: a clean start (clear the app data first)', false, dirty)]);
    }

    const tokens = await withHaapiAccessor(
        context,
        async accessor => fetchTokens(accessor, await authenticateForCode(accessor, context)),
        TOKEN_BINDING
    );
    const state = probe.migrationState(refreshTokenOf(tokens));
    const key = keyInUse(state);

    const assertions = [
        ...signedIn('launch 1: sign-in', tokens),
        check(
            'launch 1: the SDK recorded its DPoP key in the existing store',
            key.alias !== null && key.location !== null && key.fingerprint !== null,
            `location ${key.location ?? 'none'}; stored ${listed(state.existingStoreKeys)}`
        ),
        check('launch 1: still on the existing store', !state.moved),
    ];
    return next(probe, 1, tokens, key, assertions);
}

async function laterLaunch(
    context: ScenarioContext,
    probe: HaapiE2eAndroidNative,
    run: PersistedRun
): Promise<ScenarioOutcome> {
    const launch = run.nextLaunch;
    // Before this launch's SDK work: what the move left at process start.
    const atStart = launch === 3 ? probe.migrationState(run.refreshToken) : null;
    const started = await startFlow(context);
    const tokens = await refresh(context, run.refreshToken);
    const state = probe.migrationState(refreshTokenOf(tokens));
    const label = `launch ${launch}:`;
    const current = keyInUse(state);

    const assertions = [
        ...run.assertions,
        check(
            `${label} a new HAAPI flow started`,
            started.responseCategory === 'representation',
            started.responseCategory
        ),
        ...signedIn(`${label} refresh keeps the sign-in`, tokens),
        check(`${label} the SDK signs with the same key`, sameAs(run.key, current), describeKey(current)),
    ];
    if (launch === 2) {
        // The copy was taken at process start, before this launch's refresh: it tracks the earlier token.
        const copy = probe.migrationState(run.refreshToken);
        assertions.push(
            check(`${label} the move copied the key's record into encrypted storage`, copiedIntact(run.key, copy)),
            check(`${label} still on the existing store until the copy survives a restart`, !state.moved)
        );
    } else if (launch === 3) {
        const replaced = probe.migrationState(run.copiedRefreshToken ?? null);
        assertions.push(
            check(`${label} the switch to the default storage happened during this init`, state.moved),
            check(
                `${label} the switch copied the sign-in as it was at this start`,
                atStart !== null && copiedIntact(run.key, atStart)
            ),
            check(
                `${label} the copy of the earlier refresh token's record is gone`,
                run.copiedRefreshToken !== undefined && replaced.encryptedBoundAlias === null
            )
        );
    } else {
        assertions.push(
            check(`${label} still on the default storage`, state.moved),
            check(
                `${label} the old store still holds the key's record (the move deletes nothing)`,
                run.key.alias !== null && state.existingStoreKeys.includes(`${LOCATION_PREFIX}${run.key.alias}`),
                listed(state.existingStoreKeys)
            )
        );
        if (assertions.every(a => a.ok) && tokens.responseType === 'success' && tokens.refreshToken) {
            assertions.push(await refusedWithAReplacedKey(context, probe, tokens.refreshToken));
        }
    }
    const copiedRefreshToken = launch === 2 ? run.refreshToken : run.copiedRefreshToken;
    return next(probe, launch, tokens, run.key, assertions, copiedRefreshToken);
}

/** A new HAAPI flow, as an app that signs in at every launch starts one. Its session gets a new key. */
function startFlow(context: ScenarioContext): Promise<HaapiResponse> {
    return withHaapiAccessor(context, accessor => accessor.haapiManager.start(), TOKEN_BINDING);
}

/**
 * The negative control: replace the key the SDK signs with, and require the server to refuse the
 * next refresh. Without it, a refresh that succeeds proves nothing — a server that did not bind
 * the token would accept any key. Destructive: the sign-in cannot survive it.
 */
async function refusedWithAReplacedKey(
    context: ScenarioContext,
    probe: HaapiE2eAndroidNative,
    refreshToken: string
): Promise<AssertionResult> {
    const name = 'launch 4: the server refuses a refresh signed with a replaced key';
    if (!probe.replaceDpopKey(refreshToken)) {
        return check(name, false, 'no key to replace');
    }
    // `invalid_grant` is the server's answer to a proof from a key the token isn't bound to. Any
    // other failure — the network, a malformed proof — says nothing about the binding.
    try {
        const refreshed = await refresh(context, refreshToken);
        return check(name, refreshed.responseType === 'error' && refreshed.error === 'invalid_grant', describe(refreshed));
    } catch (error) {
        return check(name, false, describeThrown(error));
    }
}

function refresh(context: ScenarioContext, refreshToken: string): Promise<TokenResponse> {
    return withOAuthAccessor(
        context,
        accessor => accessor.oauthTokenManager.refreshAccessToken(refreshToken),
        TOKEN_BINDING
    );
}

/** Saves the state for the next launch, or finishes the run when it failed or was the last. */
function next(
    probe: HaapiE2eAndroidNative,
    launch: number,
    tokens: TokenResponse,
    key: KeyInUse,
    assertions: AssertionResult[],
    copiedRefreshToken?: string
): ScenarioOutcome {
    const refreshToken = tokens.responseType === 'success' ? tokens.refreshToken : undefined;
    if (launch >= STORAGE_MIGRATION_LAUNCHES || assertions.some(a => !a.ok) || refreshToken === undefined) {
        return finish(probe, assertions);
    }
    const persisted: PersistedRun = {
        id: STORAGE_MIGRATION_ID,
        nextLaunch: launch + 1,
        refreshToken,
        copiedRefreshToken,
        key,
        assertions,
    };
    probe.saveHarnessState(JSON.stringify(persisted));
    return {
        assertions: [
            ...assertions,
            check(
                `all ${STORAGE_MIGRATION_LAUNCHES} launches completed`,
                false,
                `launch ${launch} of ${STORAGE_MIGRATION_LAUNCHES} done — relaunch the app to continue`
            ),
        ],
        awaitingRelaunch: true,
    };
}

function finish(probe: HaapiE2eAndroidNative | undefined, assertions: AssertionResult[]): ScenarioOutcome {
    probe?.clearHarnessState();
    return {assertions, awaitingRelaunch: false};
}

function load(probe: HaapiE2eAndroidNative | null | undefined): PersistedRun | null {
    const raw = probe?.loadHarnessState() ?? null;
    if (raw === null) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw) as PersistedRun;
        return parsed.id === STORAGE_MIGRATION_ID ? parsed : null;
    } catch {
        return null;
    }
}

/** The key the SDK signs with, as the store currently in use records it. */
function keyInUse(state: MigrationState): KeyInUse {
    const alias = state.moved ? state.encryptedBoundAlias : state.existingBoundAlias;
    const location = state.moved ? state.encryptedLocation : state.existingLocation;
    const softwareFingerprint = state.moved ? state.encryptedKeyFingerprint : state.existingKeyFingerprint;
    const fingerprint =
        location === 'Hardware' ? state.hardwareKeyFingerprint : location === 'Software' ? softwareFingerprint : null;
    return {alias, location, fingerprint};
}

/**
 * The encrypted copy binds the sign-in to the same key: its tracking entry names the same alias,
 * with the same location, and the same value for a software key.
 */
function copiedIntact(key: KeyInUse, state: MigrationState): boolean {
    return (
        key.alias !== null &&
        state.encryptedBoundAlias === key.alias &&
        state.encryptedLocation === key.location &&
        (key.location !== 'Software' || state.encryptedKeyFingerprint === key.fingerprint)
    );
}

function sameAs(expected: KeyInUse, actual: KeyInUse): boolean {
    return (
        expected.fingerprint !== null &&
        expected.alias === actual.alias &&
        expected.location === actual.location &&
        expected.fingerprint === actual.fingerprint
    );
}

function describeKey(key: KeyInUse): string {
    return `${key.location ?? 'no'} key ${key.fingerprint ?? 'not found'}`;
}

/** Why the device isn't a clean start for this scenario, or `null` when it is. */
function dirtyReason(state: MigrationState): string | null {
    if (state.moved) {
        return 'the move already switched to the default storage';
    }
    if (state.existingStoreKeys.length > 0) {
        return `the existing store holds ${listed(state.existingStoreKeys)}`;
    }
    // This scenario's key material and session pointer all carry its key stem; other scenarios share
    // the default storage, so only entries under this stem mean an earlier run was left behind.
    const leftover = state.encryptedStoreKeys.filter(key => key.includes(STORAGE_MIGRATION_KEY_STEM));
    return leftover.length > 0 ? `encrypted storage already holds ${leftover.join(', ')}` : null;
}

/**
 * Store entries for an assertion detail. Entries named after a token's digest (which sign-in a key
 * belongs to) are counted, not named: a digest identifies a token, and details reach the harness
 * screen and the lane reports.
 */
function listed(keys: readonly string[]): string {
    const digestNamed = keys.filter(key => TOKEN_DIGEST_ENTRY.test(key));
    const named = keys.filter(key => !TOKEN_DIGEST_ENTRY.test(key));
    const parts = digestNamed.length > 0 ? [...named, `${digestNamed.length} token-tracking entries`] : named;
    return parts.join(', ') || 'nothing';
}

const TOKEN_DIGEST_ENTRY = /^haapi-dpop-(rt|at|ptr)-/;

function refreshTokenOf(tokens: TokenResponse): string | null {
    return tokens.responseType === 'success' && tokens.refreshToken ? tokens.refreshToken : null;
}

function signedIn(label: string, tokens: TokenResponse): AssertionResult[] {
    return [
        check(label, tokens.responseType === 'success', describe(tokens)),
        check(
            `${label}: a refresh token for the next launch`,
            tokens.responseType === 'success' && typeof tokens.refreshToken === 'string' && tokens.refreshToken.length > 0
        ),
    ];
}

function describe(tokens: TokenResponse): string {
    return tokens.responseType === 'success'
        ? 'success'
        : `error ${tokens.error}${tokens.errorDescription ? ` (${tokens.errorDescription})` : ''}`;
}

function describeThrown(error: unknown): string {
    const {code, message} = (error ?? {}) as {code?: unknown; message?: unknown};
    return [code, message].filter(part => typeof part === 'string').join(': ') || 'thrown';
}

function check(name: string, ok: boolean, detail?: string): AssertionResult {
    return detail === undefined ? {name, ok} : {name, ok, detail};
}
