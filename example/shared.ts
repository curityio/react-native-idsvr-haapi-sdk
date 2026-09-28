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
    AndroidConfiguration, createHaapiConfiguration,
    IOSConfiguration,
    OAuthAuthorizationParameters,
    RNHaapiConfiguration
} from "@curity/identityserver-haapi-react-native-sdk";
import {readBaseUrlOverride} from "./e2e/environment";
import {BUNDLED_ENVIRONMENT} from "./e2e/bundled-environment";

/**
 * Where the demo app points when nothing overrides it — a Curity Identity Server on the
 * developer's own machine.
 */
const DEFAULT_BASE_URL = "https://localhost:8443";

/**
 * Set `EXPO_PUBLIC_BASE_URL` at build time to point the app at another server; the E2E lane
 * runner always does, which is how one build serves the simulator, emulator and tunnelled
 * device lanes. It is read through `BUNDLED_ENVIRONMENT` because the bundler only substitutes
 * `EXPO_PUBLIC_*` where it appears as a literal `process.env.KEY` expression — handing
 * `process.env` to a function yields an object without those keys in a built app, so the lane's
 * address is silently dropped and every request goes to the default below. Platform-specific defaults (an Android emulator reaches the host at
 * 10.0.2.2, not localhost) live in `e2e/environment.ts`, which takes the platform as a
 * parameter — resolving it here would mean importing `react-native`, and this module is
 * loaded by the node-based unit tests.
 */
export const BASE_URL = readBaseUrlOverride(BUNDLED_ENVIRONMENT) ?? DEFAULT_BASE_URL;

/**
 * The client the demo app runs with.
 *
 * Defaults to the demo's own choice, but honours `EXPO_PUBLIC_CLIENT_ID` when a lane sets one, so
 * the UI smoke flows exercise the *same* client as the scenario matrix rather than a second,
 * differently-configured one — otherwise a smoke failure could mean either a UI regression or
 * simply a client the simulator cannot satisfy, and the two are indistinguishable from the report.
 *
 * An unsubstituted `@PLACEHOLDER@` is ignored rather than sent as a literal client id, matching
 * how `e2e/environment.ts` treats the same variable.
 *
 * `knownIds` is the asking platform's client matrix. A lane sets one `EXPO_PUBLIC_CLIENT_ID` and it
 * names a client of the lane's own platform, but the demo builds *both* platform configurations, so
 * without this the sibling platform would be handed an id its matrix has no entry for.
 */
export function resolveDemoClientId(
    source: {readonly EXPO_PUBLIC_CLIENT_ID?: string},
    fallback: string,
    knownIds: readonly string[]
): string {
    const raw = (source.EXPO_PUBLIC_CLIENT_ID ?? "").trim();
    if (raw.length === 0 || /@[A-Z0-9_]+@/.test(raw) || !knownIds.includes(raw)) {
        return fallback;
    }
    return raw;
}

export const config = {
    baseUrl: BASE_URL,
    authorizationEndpointUrl: `${BASE_URL}/dev/oauth/authorize`,
    tokenEndpointUrl: `${BASE_URL}/dev/oauth/token`,
    revocationEndpointUrl: `${BASE_URL}/revoke`,
    dcrEndpointUrl: `${BASE_URL}/oauth-dev/oauth-registration`,
};

export function createAppHaapiConfiguration(
    iosConfig?: IOSConfiguration,
    androidConfig?: AndroidConfiguration,
    isAutoRedirect = true,
    minTokenTtl = 60,
    authorizationParameters?: OAuthAuthorizationParameters,
    httpHeaders?: Record<string, string>
): RNHaapiConfiguration {
    return createHaapiConfiguration({
        baseUrl: config.baseUrl,
        authorizationEndpointUrl: config.authorizationEndpointUrl,
        tokenEndpointUrl: config.tokenEndpointUrl,
        revocationEndpointUrl: config.revocationEndpointUrl,
        androidConfig: androidConfig,
        iosConfig: iosConfig,
        isAutoRedirect: isAutoRedirect,
        minTokenTtl: minTokenTtl,
        authorizationParameters: authorizationParameters,
        httpHeaders: httpHeaders
    })
}