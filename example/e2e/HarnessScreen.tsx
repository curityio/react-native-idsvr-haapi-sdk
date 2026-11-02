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
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Button, Platform, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {
    initializeForHaapi,
    initializeForOAuth,
} from '@curity/identityserver-haapi-react-native-sdk';
import {readEnvironment, type PlatformOs} from './environment';
import {BUNDLED_ENVIRONMENT} from './bundled-environment';
import {SCENARIOS} from './registry';
import {runLane, runScenario, resolveLane} from './harness';
import {pendingScenarioId} from './storage-migration';
import {haapiE2eNative} from 'haapi-e2e-native';
import {ScenarioStatus, formatResultLine, formatConfigErrorLine, idle, running, type ScenarioResult} from './results';

/**
 * The E2E harness screen — rendered instead of the demo UI when `EXPO_PUBLIC_E2E=1`.
 *
 * Thin by design: all orchestration lives in `harness.ts`, which is unit-tested in node.
 * This file only renders results under the testID vocabulary the drivers rely on
 * (contracts/harness-driver-contract.md) and wires autorun.
 */

const SEEDED_CREDENTIALS = {username: 'testuser', password: 'Password1'};

/**
 * Result lines go to the console, which React Native forwards to the platform's native log
 * (`com.facebook.react.log:javascript` → os_log on iOS, logcat on Android) — verified on a
 * Release build. That is the **only** channel the device lanes have, since Maestro cannot
 * build its iOS driver on Xcode 26.x (research.md §D1, T004).
 *
 * Deliberately NOT the SDK's `RNLogger`: it applies sensitive-value masking, which is right
 * for SDK logs but could rewrite the middle of a JSON payload the runner has to parse. The
 * console path is verbatim.
 *
 * Reading these back needs `log show --info` on iOS — os_log hides info-level messages by
 * default, which makes a working harness look silent.
 */
function emitLine(line: string): void {
    console.log(line);
}

export default function HarnessScreen() {
    const platformOs = Platform.OS as PlatformOs;
    const config = useMemo(() => readEnvironment(BUNDLED_ENVIRONMENT, platformOs), [platformOs]);
    const lane = useMemo(() => resolveLane(BUNDLED_ENVIRONMENT, platformOs), [platformOs]);

    const [results, setResults] = useState<Record<string, ScenarioResult>>(() => {
        const initial: Record<string, ScenarioResult> = {};
        SCENARIOS.forEach(spec => {
            initial[spec.id] = idle(spec.id);
        });
        return initial;
    });
    const [busy, setBusy] = useState(false);
    const started = useRef(false);

    const laneOptions = useMemo(
        () => ({
            lane,
            config,
            platformOs,
            credentials: SEEDED_CREDENTIALS,
            initializeForHaapi,
            initializeForOAuth,
            e2eNative: haapiE2eNative,
            emit: emitLine,
            onResult: (result: ScenarioResult) =>
                setResults(previous => ({...previous, [result.id]: result})),
        }),
        [lane, config, platformOs]
    );

    const runAll = useCallback(async () => {
        setBusy(true);
        try {
            await runLane(laneOptions);
        } finally {
            setBusy(false);
        }
    }, [laneOptions]);

    const runOne = useCallback(
        async (id: string) => {
            const spec = SCENARIOS.find(candidate => candidate.id === id);
            if (spec === undefined) {
                return;
            }
            setBusy(true);
            setResults(previous => ({...previous, [id]: running(previous[id])}));
            try {
                const result = await runScenario(spec, laneOptions);
                setResults(previous => ({...previous, [id]: result}));
                emitLine(formatResultLine(result));
            } finally {
                setBusy(false);
            }
        },
        [laneOptions]
    );

    // Autorun: the device lanes have no driver to tap buttons, so the app runs itself.
    useEffect(() => {
        if (started.current) {
            return;
        }
        started.current = true;

        if (config.configError !== null) {
            emitLine(formatConfigErrorLine(config.configError));
            return;
        }
        if (BUNDLED_ENVIRONMENT.EXPO_PUBLIC_E2E_AUTORUN === '1') {
            // A relaunch of a multi-launch scenario continues that scenario alone; the runner
            // restarts the app for it after the matrix (e2e-run.js, relaunchAndroidWhileAwaiting).
            const pending = pendingScenarioId(haapiE2eNative);
            void (pending === null ? runAll() : runOne(pending));
        }
    }, [config.configError, runAll, runOne]);

    // Room below the last row, so a driver that centres each scenario before tapping it (Maestro's
    // `centerElement`) can centre the last one too; without it the scroll ends with that row at the
    // screen edge, where a tap can miss.
    const {height} = useWindowDimensions();
    const listStyle = useMemo(() => ({paddingBottom: height / 2}), [height]);

    if (config.configError !== null) {
        return (
            <SafeAreaView style={styles.container}>
                <Text testID="e2e-suite-status" style={styles.status}>
                    CONFIG_ERROR
                </Text>
                <Text testID="e2e-config-error">{config.configError}</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.container} contentContainerStyle={listStyle}>
                <Text style={styles.header}>HAAPI E2E Harness</Text>
                <Text testID="e2e-suite-status" style={styles.status}>
                    {busy ? 'RUNNING' : 'READY'}
                </Text>
                <Text style={styles.detail}>
                    {lane} · {config.clientIdBase} · {config.baseUrl}
                </Text>

                <View style={styles.runAll}>
                    <Button testID="e2e-run-all" title="Run all scenarios" onPress={runAll} disabled={busy} />
                </View>

                {SCENARIOS.map(spec => {
                    const result = results[spec.id];
                    return (
                        <View key={spec.id} style={styles.row}>
                            <Button
                                testID={`e2e-scenario-${spec.id}`}
                                title={spec.id}
                                onPress={() => runOne(spec.id)}
                                disabled={busy}
                            />
                            <Text testID={`e2e-status-${spec.id}`} style={styles.status}>
                                {result.status}
                            </Text>
                            <Text testID={`e2e-detail-${spec.id}`} style={styles.detail}>
                                {detailFor(result)}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

/** First failed assertion, or the skip reason — whatever a reader needs to act on. */
function detailFor(result: ScenarioResult): string {
    if (result.status === ScenarioStatus.Skipped) {
        return result.skipReason ?? '';
    }
    if (result.status === ScenarioStatus.Fail) {
        const firstFailure = result.assertions.find(assertion => !assertion.ok);
        if (firstFailure !== undefined) {
            return firstFailure.detail === undefined
                ? firstFailure.name
                : `${firstFailure.name}: ${firstFailure.detail}`;
        }
        return result.error ?? '';
    }
    return '';
}

const styles = StyleSheet.create({
    container: {flex: 1, padding: 10},
    header: {fontSize: 20, fontWeight: 'bold', marginBottom: 8},
    status: {fontWeight: 'bold'},
    detail: {color: '#555', fontSize: 12},
    row: {marginBottom: 12},
    runAll: {marginBottom: 16},
});
