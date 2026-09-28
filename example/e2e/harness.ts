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
    HttpUrlConnectionProviderOption,
    URLSessionOption,
    type HaapiAccessor,
    type OAuthAccessor,
    type RNHaapiConfiguration,
} from '@curity/identityserver-haapi-react-native-sdk';
import {createAppIosConfiguration} from '../ios-configs';
import {createAppAndroidConfiguration} from '../android-configs';
import {createAppHaapiConfiguration} from '../shared';
import type {EnvironmentConfig, EnvironmentSource, PlatformOs} from './environment';
import {ALL_LANES, Lane, SCENARIOS, ScenarioSpec, clientIdForScenario, skipReasonFor} from './registry';
import {SCENARIO_RUNNERS, type ScenarioRunner} from './scenarios';
import type {BuildConfigurationOptions, Credentials, ScenarioContext} from './flow-helpers';

/**
 * "Do not attest", per platform.
 *
 * Declared here rather than reused from the config modules' own `AttestationConfiguration`
 * tables, because those are keyed to client definitions and this is deliberately *against* what
 * the definition says. `attestationMaxRetries` still has to be a valid number on iOS even when
 * attestation is off — the Record requires it.
 */
const IOS_ATTESTATION_DISABLED = {useAttestation: false, attestationMaxRetries: 3} as const;
const ANDROID_ATTESTATION_DISABLED = {useAttestation: false} as const;
import {
    ScenarioResult,
    formatConfigErrorLine,
    formatReplayLine,
    formatResultLine,
    formatSuiteLine,
    fromThrown,
    settle,
    skipped,
} from './results';

/**
 * Lane orchestration, deliberately free of React so it can be unit-tested in node — the
 * screen is a thin renderer over this.
 *
 * Results go to two places at once: `onResult` drives the on-screen surface that Maestro
 * reads on the simulator/emulator lanes, and `emit` writes the log lines that are the device
 * lanes' only channel (research.md §D1, T004).
 */

export interface LaneRunOptions {
    readonly lane: Lane;
    readonly config: EnvironmentConfig;
    readonly platformOs: PlatformOs;
    readonly credentials: Credentials;
    readonly buildConfiguration?: (clientId: string) => RNHaapiConfiguration;
    readonly initializeForHaapi: (configuration: RNHaapiConfiguration) => Promise<HaapiAccessor>;
    readonly initializeForOAuth: (configuration: RNHaapiConfiguration) => Promise<OAuthAccessor>;
    /** Injectable so tests can drive orchestration without the real flows. */
    readonly runners?: Record<string, ScenarioRunner>;
    readonly emit: (line: string) => void;
    readonly onResult?: (result: ScenarioResult) => void;
}

/**
 * Which lane this build is running as.
 *
 * Explicit via `EXPO_PUBLIC_E2E_LANE` because the app cannot reliably tell a simulator from a
 * device, and the lane decides which scenarios are excluded. Defaults to the platform's
 * simulator/emulator lane, which is what a developer running the app by hand is on.
 */
export function resolveLane(source: EnvironmentSource, platformOs: PlatformOs): Lane {
    const raw = (source.EXPO_PUBLIC_E2E_LANE ?? '').trim();
    const match = ALL_LANES.find(lane => lane === raw);
    if (match !== undefined) {
        return match;
    }
    return platformOs === 'ios' ? Lane.IosSim : Lane.AndroidEmu;
}

export interface CreateContextOptions {
    readonly platformOs: PlatformOs;
    readonly config: EnvironmentConfig;
    readonly clientId: string;
    readonly credentials: Credentials;
    readonly initializeForHaapi: (configuration: RNHaapiConfiguration) => Promise<HaapiAccessor>;
    readonly initializeForOAuth: (configuration: RNHaapiConfiguration) => Promise<OAuthAccessor>;
}

/**
 * Builds the per-scenario context, including the platform-specific configuration.
 *
 * Takes `platformOs` as a value rather than reading `Platform.OS` so this stays importable
 * from node tests; the screen passes the real one.
 */
export function createScenarioContext(options: CreateContextOptions): ScenarioContext {
    return {
        clientId: options.clientId,
        credentials: options.credentials,
        initializeForHaapi: options.initializeForHaapi,
        initializeForOAuth: options.initializeForOAuth,
        buildConfiguration: (clientId: string, buildOptions?: BuildConfigurationOptions) =>
            buildPlatformConfiguration(options.platformOs, clientId, buildOptions),
    };
}

/**
 * Builds the platform configuration for a scenario.
 *
 * Both platforms select the **custom** transport option, which routes through the TLS-bypassing
 * resolvers the example app registers (`UnsafeURLSessionResolver` in AppDelegate.swift,
 * `UnsafeHttpURLConnectionResolver` in MainApplication.kt). A locally installed Identity Server
 * presents a self-signed certificate for the host's IP, which the default transports reject
 * (iOS: `NSURLErrorDomain -1202`). This is a development-only affordance of the example app; the
 * SDK ships no such bypass.
 */
function buildPlatformConfiguration(
    platformOs: PlatformOs,
    clientId: string,
    options: BuildConfigurationOptions = {}
): RNHaapiConfiguration {
    if (platformOs === 'ios') {
        return createAppHaapiConfiguration(
            createAppIosConfiguration({
                clientNameType: clientId as never,
                useDcrConfiguration: false,
                useRiskAssessmentConfiguration: false,
                urlSessionOption: URLSessionOption.Custom,
                attestationOverride: options.attest === false
                    ? IOS_ATTESTATION_DISABLED
                    : undefined,
            }),
            undefined
        );
    }

    return createAppHaapiConfiguration(
        undefined,
        createAppAndroidConfiguration({
            clientNameType: clientId as never,
            useDcrConfiguration: false,
            httpUrlConnectionProviderOption: HttpUrlConnectionProviderOption.Custom,
            attestationOverride: options.attest === false
                ? ANDROID_ATTESTATION_DISABLED
                : undefined,
        })
    );
}

/**
 * Runs one scenario, or produces the SKIPPED result explaining why it did not run.
 *
 * A skip is decided *before* the runner is invoked, so an excluded scenario cannot make a
 * network call or leave an accessor open.
 */
export async function runScenario(
    spec: ScenarioSpec,
    options: LaneRunOptions
): Promise<ScenarioResult> {
    const skipReason = skipReasonFor(spec, options.config, options.lane);
    if (skipReason !== null) {
        return skipped(spec.id, skipReason);
    }

    const runners = options.runners ?? SCENARIO_RUNNERS;
    const runner = runners[spec.id];
    if (runner === undefined) {
        return settle(spec.id, [
            {name: 'scenario has a runner', ok: false, detail: `no runner registered for ${spec.id}`},
        ]);
    }

    const clientId = clientIdForScenario(spec, options.config);
    const context: ScenarioContext = {
        clientId,
        credentials: options.credentials,
        initializeForHaapi: options.initializeForHaapi,
        initializeForOAuth: options.initializeForOAuth,
        buildConfiguration:
            options.buildConfiguration ??
            ((id: string, buildOptions?: BuildConfigurationOptions) =>
                buildPlatformConfiguration(options.platformOs, id, buildOptions)),
    };

    try {
        return settle(spec.id, await runner.run(context));
    } catch (error) {
        return fromThrown(spec.id, error, {
            attestationRejectionIsExpected: runner.attestationRejectionIsExpected,
        });
    }
}

/**
 * Runs the whole matrix for a lane, sequentially.
 *
 * Sequential on purpose: the SDK allows one open accessor at a time, so concurrent scenarios
 * would collide on `HAAPI_ACCESSOR_ALREADY_INITIALIZED` and produce failures that say nothing
 * about the SDK.
 *
 * Iterates **every** scenario rather than only those assigned to the lane, so a lane-excluded
 * scenario still appears in the report as SKIPPED. A short report reads as "everything ran".
 */
export async function runLane(options: LaneRunOptions): Promise<ScenarioResult[]> {
    if (options.config.configError !== null) {
        options.emit(formatConfigErrorLine(options.config.configError));
        return [];
    }

    const results: ScenarioResult[] = [];

    for (const spec of SCENARIOS) {
        const result = await runScenario(spec, options);
        results.push(result);
        options.emit(formatResultLine(result));
        options.onResult?.(result);
    }

    // Every result again, in one pass, before the suite line — the runner stops reading at the
    // suite line, so a replay after it would arrive to an empty room. iOS's unified log drops
    // messages: one lost result line failed PR-37's whole ios-device lane, and this is the copy
    // that makes that survivable. The originals are spread across the minutes the matrix takes, so
    // the two copies of a result are far apart — except for the last scenario, whose copies are
    // necessarily adjacent and would go together. See REPLAY_LINE_PREFIX.
    results.forEach(result => options.emit(formatReplayLine(result)));

    options.emit(formatSuiteLine(results.length));
    return results;
}
