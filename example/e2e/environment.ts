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

/**
 * Test-environment configuration for the E2E harness.
 *
 * Values arrive as `EXPO_PUBLIC_*` variables baked into the bundle at build time, so a lane
 * is selected by how the app is built — no runtime plumbing and no committed file to edit
 * per run. Deliberately free of any `react-native` import so it can be unit-tested in plain
 * node: the platform is a parameter, and the caller passes `Platform.OS`.
 */

/** Where the E2E lanes run. The platform decides the host default. */
export type PlatformOs = 'ios' | 'android';

/** Variable source — `process.env` in the app, a literal object in tests. */
export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

/**
 * Members of a server-side client family, expressed as the suffix appended to the base
 * client id. One base id therefore selects a whole family, which is what makes the
 * emulator-to-device switch a single variable change.
 */
export enum ClientVariant {
    Plain = '',
    Secret = '-secret',
    DpopNonce = '-dpop-nonce',
    AttestationFails = '-attestation-fails',
    WithoutAttestation = '-without-attestation',
}

export interface EnvironmentConfig {
    /** Server base URL, without a trailing slash. */
    readonly baseUrl: string;
    /** Base client id; family members are derived from it via {@link clientIdFor}. */
    readonly clientIdBase: string;
    /** Server version, or `Latest` for the newest build. Gates version-dependent scenarios. */
    readonly idsvrVersion: string;
    /** True when the app should render the scenario harness instead of the demo UI. */
    readonly e2eMode: boolean;
    /**
     * Non-null when the environment cannot be trusted. The harness refuses to run and
     * reports it, so a misconfigured lane fails loudly instead of silently testing the
     * wrong server.
     */
    readonly configError: string | null;
}

/** Matches an un-substituted template token such as `@LOGIN_DOMAIN@`. */
const PLACEHOLDER_PATTERN = /@[A-Z0-9_]+@/;

const DEFAULT_CLIENT_ID_BASE: Record<PlatformOs, string> = {
    ios: 'haapi-ios-client-emulator',
    android: 'haapi-android-client-emulator',
};

export const LATEST_SERVER_VERSION = 'Latest';

function readRaw(source: EnvironmentSource, key: string): string | undefined {
    const value = source[key];
    if (value === undefined) {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * Reads the environment, collecting *every* problem rather than failing on the first, so a
 * single run tells the developer everything that needs fixing.
 */
export function readEnvironment(
    source: EnvironmentSource,
    platformOs: PlatformOs
): EnvironmentConfig {
    const problems: string[] = [];

    const rawBaseUrl = source.EXPO_PUBLIC_BASE_URL;
    const rawClientId = source.EXPO_PUBLIC_CLIENT_ID;
    const rawVersion = source.EXPO_PUBLIC_IDSVR_VERSION;

    const baseUrl = resolveBaseUrl(rawBaseUrl, problems);
    const clientIdBase = resolveClientIdBase(rawClientId, platformOs, problems);
    const idsvrVersion = readRaw(source, 'EXPO_PUBLIC_IDSVR_VERSION') ?? LATEST_SERVER_VERSION;

    if (rawVersion !== undefined && PLACEHOLDER_PATTERN.test(rawVersion)) {
        problems.push(`EXPO_PUBLIC_IDSVR_VERSION is an unsubstituted placeholder (${rawVersion.trim()})`);
    }

    return {
        baseUrl,
        clientIdBase,
        idsvrVersion,
        e2eMode: source.EXPO_PUBLIC_E2E === '1',
        configError: problems.length === 0 ? null : problems.join('; '),
    };
}

/**
 * There is deliberately no default here. A per-platform guess (`localhost` for iOS, `10.0.2.2`
 * for Android) reaches whatever happens to be listening on the host and looks like it worked,
 * so a lane whose `--base-url` never made it into the bundle runs happily against the wrong
 * server — the failure then surfaces as unrelated protocol errors. The runner already refuses
 * to guess (`resolveBaseUrl` in e2e/lib/lanes.js); the app must refuse too.
 */
function resolveBaseUrl(raw: string | undefined, problems: string[]): string {
    if (raw === undefined) {
        problems.push('EXPO_PUBLIC_BASE_URL is not set — the lane must pass one explicitly');
        return '';
    }

    const value = raw.trim();

    if (value.length === 0) {
        problems.push('EXPO_PUBLIC_BASE_URL is set but empty');
        return '';
    }
    if (PLACEHOLDER_PATTERN.test(value)) {
        problems.push(`EXPO_PUBLIC_BASE_URL is an unsubstituted placeholder (${value})`);
        return value;
    }
    if (!/^https?:\/\//.test(value)) {
        problems.push(`EXPO_PUBLIC_BASE_URL must start with http:// or https:// (got "${value}")`);
        return value;
    }

    return value.replace(/\/+$/, '');
}

function resolveClientIdBase(
    raw: string | undefined,
    platformOs: PlatformOs,
    problems: string[]
): string {
    if (raw === undefined) {
        return DEFAULT_CLIENT_ID_BASE[platformOs];
    }

    const value = raw.trim();

    if (value.length === 0) {
        problems.push('EXPO_PUBLIC_CLIENT_ID is set but empty');
        return DEFAULT_CLIENT_ID_BASE[platformOs];
    }
    if (PLACEHOLDER_PATTERN.test(value)) {
        problems.push(`EXPO_PUBLIC_CLIENT_ID is an unsubstituted placeholder (${value})`);
        return value;
    }

    return value;
}

/**
 * The validated `EXPO_PUBLIC_BASE_URL` override, or `null` when it is unset or unusable.
 *
 * For platform-neutral callers that must not import `react-native` — notably the demo app's
 * `shared.ts`, which the node-based unit tests load. Platform-specific defaults (Android's
 * `10.0.2.2`) need a platform and therefore live in {@link readEnvironment}; every E2E lane
 * sets the variable explicitly, so the platform default is only a developer convenience.
 */
export function readBaseUrlOverride(source: EnvironmentSource): string | null {
    const raw = source.EXPO_PUBLIC_BASE_URL;
    if (raw === undefined) {
        return null;
    }

    const value = raw.trim();
    if (value.length === 0 || PLACEHOLDER_PATTERN.test(value) || !/^https?:\/\//.test(value)) {
        return null;
    }

    return value.replace(/\/+$/, '');
}

/** Resolves a family member's client id from the configured base. */
export function clientIdFor(config: EnvironmentConfig, variant: ClientVariant): string {
    return `${config.clientIdBase}${variant}`;
}

/**
 * True when a server of `serverVersion` satisfies `minimumVersion`. `Latest` denotes the
 * newest build and satisfies everything; comparison is numeric per component, so 10 ranks
 * above 9 (a lexical compare would wrongly skip scenarios).
 */
export function canServerVersionSupport(
    serverVersion: string,
    minimumVersion?: string
): boolean {
    if (minimumVersion === undefined || minimumVersion.trim().length === 0) {
        return true;
    }
    if (serverVersion.trim() === LATEST_SERVER_VERSION) {
        return true;
    }
    return compareVersions(serverVersion, minimumVersion) >= 0;
}

function compareVersions(left: string, right: string): number {
    const leftParts = versionComponents(left);
    const rightParts = versionComponents(right);
    const length = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < length; index += 1) {
        const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
        if (difference !== 0) {
            return difference < 0 ? -1 : 1;
        }
    }
    return 0;
}

function versionComponents(version: string): number[] {
    return version
        .trim()
        .split('.')
        .map(part => {
            const parsed = parseInt(part, 10);
            return Number.isNaN(parsed) ? 0 : parsed;
        });
}
