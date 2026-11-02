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
    /** Authenticates the client with a JWT signed with a shared key (HS256). */
    SymmetricJwt = '-symmetric',
    /** Authenticates the client with a JWT signed with its private key, using RS256. */
    AsymmetricJwtRs256 = '-asym-rsa',
    /** As {@link AsymmetricJwtRs256}, using ES256. */
    AsymmetricJwtEs256 = '-asym-ec-256',
    /** As {@link AsymmetricJwtRs256}, using ES384. */
    AsymmetricJwtEs384 = '-asym-ec-384',
    /** As {@link AsymmetricJwtRs256}, using ES512. */
    AsymmetricJwtEs512 = '-asym-ec-512',
    DpopNonce = '-dpop-nonce',
    AttestationFails = '-attestation-fails',
    WithoutAttestation = '-without-attestation',
    /**
     * Server binds the code and tokens to the DPoP key and checks the proof on every refresh. The
     * server configs name it per platform: this suffix on Android, `-dpop-nonce-token-bound` on iOS
     * (see {@link clientIdFor}).
     */
    DpopNonceBoundToken = '-dpop-nonce-bound-token',
    /**
     * Token-bound like {@link DpopNonceBoundToken}, and the access token is DPoP-bound too
     * (`issue-dpop-bound-access-tokens`, Identity Server 11.5+): the server returns `token_type: DPoP`
     * and its protected endpoints require a proof with the token. Without it the access token is a
     * bearer token.
     */
    DpopNonceBoundAccessToken = '-dpop-nonce-bound-access-token',
    /**
     * Android only. Token-bound like {@link DpopNonceBoundToken}, but attestation isn't required, so the
     * app's key policy decides the DPoP key. The emulator family names it differently (see
     * {@link clientIdFor}).
     */
    DpopNonceBoundTokenWithoutAttestation = '-dpop-nonce-secret-without-attestation-bound-token',
}

/**
 * Family-specific names of a member, keyed by the family's base id, where one family's server config
 * departs from the suffix the others use.
 */
const FAMILY_SUFFIXES: Partial<Record<ClientVariant, Readonly<Record<string, string>>>> = {
    [ClientVariant.DpopNonceBoundTokenWithoutAttestation]: {
        'haapi-android-client-emulator': '-dpop-nonce-secret-bound-token-without-attestation-bound-token',
    },
};

/** Platform-specific names of a family member, where the server configs disagree. */
const PLATFORM_SUFFIXES: Partial<Record<ClientVariant, Record<PlatformOs, string>>> = {
    [ClientVariant.DpopNonceBoundToken]: {
        ios: '-dpop-nonce-token-bound',
        android: '-dpop-nonce-bound-token',
    },
};

export interface EnvironmentConfig {
    /** The platform the lane runs on; picks the per-platform client names. */
    readonly platformOs: PlatformOs;
    /** Server base URL, without a trailing slash. */
    readonly baseUrl: string;
    /** Base client id; family members are derived from it via {@link clientIdFor}. */
    readonly clientIdBase: string;
    /** Server version, or `Latest` for the newest build. Gates version-dependent scenarios. */
    readonly idsvrVersion: string;
    /** True when the app should render the scenario harness instead of the demo UI. */
    readonly e2eMode: boolean;
    /**
     * The symmetric JWT clients' shared secret, supplied by the lane runner to its own builds;
     * `null` otherwise (the example itself carries only a placeholder). Never part of
     * {@link configError} or any log line.
     */
    readonly symmetricJwtSecret: string | null;
    /**
     * True when the lane runner says the server presents a publicly trusted certificate, so the app's
     * own `fetch` can reach it. A locally installed server's self-signed one is accepted only by the
     * example's native transports.
     */
    readonly trustedTls: boolean;
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
        platformOs,
        baseUrl,
        clientIdBase,
        idsvrVersion,
        e2eMode: source.EXPO_PUBLIC_E2E === '1',
        symmetricJwtSecret: readRaw(source, 'EXPO_PUBLIC_E2E_SYMMETRIC_JWT_SECRET') ?? null,
        trustedTls: source.EXPO_PUBLIC_E2E_TRUSTED_TLS === '1',
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
    const suffix =
        FAMILY_SUFFIXES[variant]?.[config.clientIdBase] ??
        PLATFORM_SUFFIXES[variant]?.[config.platformOs] ??
        variant;
    return `${config.clientIdBase}${suffix}`;
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
