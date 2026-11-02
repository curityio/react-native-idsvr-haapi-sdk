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
    ActionType,
    HaapiAccessor,
    OAuthAccessor,
    RNHaapiConfiguration,
    StepType,
    type DpopKeyPolicy,
    type HaapiResponse,
    type IOSKeychainConfiguration,
    type StorageOption,
    type TokenResponse,
} from '@curity/identityserver-haapi-react-native-sdk';
import type {HaapiE2eAndroidNative, HaapiE2eNative} from 'haapi-e2e-native';

/**
 * The reusable walk from `start()` to an authorization code, plus accessor-lifecycle
 * wrappers. Every scenario is built from these, so no scenario re-implements the flow and
 * they cannot drift apart (the sibling SDKs learned this the hard way — each of their live
 * suites composes one shared `FlowHelper`).
 *
 * Uses the SDK's **public** API only, exactly as a consumer app would.
 */

export interface Credentials {
    readonly username: string;
    readonly password: string;
}

/**
 * Everything a scenario needs, injected rather than imported, so scenarios are unit-testable
 * in plain node and a lane can swap the client or the configuration without touching them.
 */
/**
 * Per-scenario deviations from the client definition's own configuration.
 *
 * Only one knob so far, and it earns its place: `attest: false` against a client that mandates
 * attestation is the "attestation required but missing" refusal, which no client id can express
 * on its own — every plain client declares `<attestation>` with no `allow-without-attestation`.
 */
export interface BuildConfigurationOptions {
    /** Send no attestation, whatever the client definition says. Defaults to the definition. */
    readonly attest?: boolean;
    /**
     * Token binding, whatever the client definition says. Unset follows the definition, which
     * binds only the clients that issue token-bound authorization codes. `false` turns binding
     * off — against a token-bound client that is the refused code exchange. An object binds: on
     * Android with those `AndroidTokenBinding()` options (unset ones take the SDK's defaults); on
     * iOS with the SDK's defaults, since iOS has none of these settings.
     */
    readonly tokenBinding?:
        | false
        | {
              readonly keyType?: DpopKeyPolicy;
              readonly migrateFromLegacyAlias?: string | null;
              readonly storageOption?: StorageOption;
          };
    /**
     * Android key-store alias, instead of the client id. New DPoP keys are named after it, and each
     * start removes keys under it that the store in use doesn't track — so a scenario on its own
     * store (storage-migration) needs its own alias to keep its keys apart from other scenarios'.
     */
    readonly keyStoreAlias?: string;
    /**
     * iOS keychain access group and accessibility level for the SDK's keychain items. Unset keeps the
     * SDK's default storage; Android has no such setting and ignores it.
     */
    readonly keychainConfiguration?: IOSKeychainConfiguration;
    /** Scopes to request; unset requests none. The userinfo endpoint answers only `openid`. */
    readonly scope?: readonly string[];
}

export interface ScenarioContext {
    readonly clientId: string;
    /** The server's base URL, without a trailing slash — where the scenarios call its endpoints. */
    readonly baseUrl: string;
    /** Whether the app's own `fetch` can trust the server's certificate (see `EnvironmentConfig`). */
    readonly trustedTls: boolean;
    readonly buildConfiguration: (
        clientId: string,
        options?: BuildConfigurationOptions
    ) => RNHaapiConfiguration;
    readonly initializeForHaapi: (configuration: RNHaapiConfiguration) => Promise<HaapiAccessor>;
    readonly initializeForOAuth: (configuration: RNHaapiConfiguration) => Promise<OAuthAccessor>;
    readonly credentials: Credentials;
    /** The example app's native E2E hooks; absent where they aren't built (iOS, node tests). */
    readonly e2eNative?: HaapiE2eNative | null;
}

/**
 * The Android build's further native hooks, or `null` on iOS (whose build has only the DPoP request hook)
 * and wherever the module isn't built.
 */
export function androidHooks(hooks: HaapiE2eNative | null | undefined): HaapiE2eAndroidNative | null {
    const candidate = hooks as Partial<HaapiE2eAndroidNative> | null | undefined;
    return typeof candidate?.migrationState === 'function' ? (candidate as HaapiE2eAndroidNative) : null;
}

export interface WalkResult {
    /** The authorization code, when the walk reached an authorization response. */
    readonly code?: string;
    /** Step types observed, in order — the evidence that the flow went where expected. */
    readonly steps: string[];
    /** The response that ended the walk without a code (a problem, or an unhandled step). */
    readonly stoppedAt?: HaapiResponse;
}

/**
 * A real flow is a handful of steps; this cap only exists so a server that keeps returning
 * the same step cannot hang a lane forever.
 */
const MAX_FLOW_STEPS = 12;

/** Server-side authenticator this suite drives; the others need interactive hardware. */
const HTML_FORM_AUTHENTICATOR_TYPE = 'html-form';
/** Curity's passwordless authenticator — a username alone completes the flow. */
const USERNAME_AUTHENTICATOR_TYPE = 'username';

/**
 * Which authenticator a scenario needs.
 *
 * `Passwordless` is the default because it needs no seeded account and no password policy — the
 * username alone completes the flow, so a happy path stays green on any server. `Credentials`
 * exists for the negative scenario: a wrong password can only be refused by an authenticator that
 * checks one, and against the passwordless authenticator the server issues a code regardless.
 */
export enum AuthenticatorPreference {
    Passwordless = 'passwordless',
    Credentials = 'credentials',
}

/**
 * Runs `body` with a HAAPI accessor, closing it whatever happens.
 *
 * Scenario isolation depends on this: a leaked open accessor makes the *next* scenario fail
 * with `HAAPI_ACCESSOR_ALREADY_INITIALIZED`, which looks like a bug in the wrong place. A
 * failure from `close()` is swallowed so it can never mask the body's error.
 */
export async function withHaapiAccessor<T>(
    context: ScenarioContext,
    body: (accessor: HaapiAccessor) => Promise<T>,
    options?: BuildConfigurationOptions
): Promise<T> {
    const accessor = await context.initializeForHaapi(
        context.buildConfiguration(context.clientId, options)
    );
    try {
        return await body(accessor);
    } finally {
        closeQuietly(accessor);
    }
}

export async function withOAuthAccessor<T>(
    context: ScenarioContext,
    body: (accessor: OAuthAccessor) => Promise<T>,
    options?: BuildConfigurationOptions
): Promise<T> {
    const accessor = await context.initializeForOAuth(
        context.buildConfiguration(context.clientId, options)
    );
    try {
        return await body(accessor);
    } finally {
        closeQuietly(accessor);
    }
}

function closeQuietly(accessor: {close: () => void}): void {
    try {
        accessor.close();
    } catch {
        // Intentionally ignored: the body's outcome is the scenario's result, and a close()
        // failure reported here would replace it with a misleading one.
    }
}

/**
 * Walks the authentication flow as far as it goes: picks a drivable authenticator from the
 * selector, submits whatever its form asks for, and returns either the authorization code or the
 * response that stopped progress. The flow is multi-step, so this loops until it reaches an
 * authorization response, a problem, or a step it does not drive.
 *
 * Returns rather than throws on a problem, because "the server refused these credentials" is
 * the expected outcome of one of the scenarios.
 */
export async function walkAuthentication(
    accessor: HaapiAccessor,
    context: ScenarioContext,
    credentials: Credentials = context.credentials,
    preference: AuthenticatorPreference = AuthenticatorPreference.Passwordless
): Promise<WalkResult> {
    const steps: string[] = [];
    let response = await accessor.haapiManager.start();

    for (let visited = 0; visited < MAX_FLOW_STEPS; visited += 1) {
        if (response.responseCategory !== 'representation') {
            return {steps, stoppedAt: response};
        }

        const step = response.representation;
        steps.push(step.stepType);

        if (step.stepType === StepType.OAuthAuthorizationResponse) {
            const code = (step as {oauthProperties?: {code?: string}}).oauthProperties?.code;
            return code === undefined || code.length === 0
                ? {steps, stoppedAt: response}
                : {code, steps};
        }

        const next = await advance(accessor, step, credentials, preference);
        if (next === null) {
            return {steps, stoppedAt: response};
        }
        response = next;
    }

    return {steps, stoppedAt: response};
}

/** Submits whatever this step needs, or `null` when the step is not one we drive. */
async function advance(
    accessor: HaapiAccessor,
    step: unknown,
    credentials: Credentials,
    preference: AuthenticatorPreference
): Promise<HaapiResponse | null> {
    const typed = step as {
        stepType: string;
        authenticators?: {type?: string; title?: {literal?: string}; action: unknown}[];
        actions?: {actionType?: string; model?: {fields?: {name: string; fieldType?: string}[]}}[];
    };

    if (typed.stepType === StepType.AuthenticatorSelector) {
        const authenticators = typed.authenticators ?? [];
        const chosen = pickAuthenticator(authenticators, preference);
        if (chosen === undefined) {
            // Naming what the server did offer turns "stopped at authenticatorSelector" from a
            // dead end into an actionable server-configuration finding.
            throw new Error(
                'No drivable authenticator in the selector. Offered: ' +
                    describeAuthenticators(authenticators)
            );
        }
        return accessor.haapiManager.submitForm(chosen.action as never, {});
    }

    if (typed.stepType === StepType.InteractiveForm) {
        const formAction = (typed.actions ?? []).find(
            action => action.actionType === ActionType.Form
        );
        if (formAction === undefined) {
            return null;
        }
        return accessor.haapiManager.submitForm(
            formAction as never,
            credentialParameters(formAction.model?.fields ?? [], credentials)
        );
    }

    return null;
}

/**
 * Picks the authenticator the lane can actually complete, in order of preference.
 *
 * `username` is Curity's passwordless authenticator: submit a username and the flow proceeds to
 * the authorization code. It is preferred because it depends on nothing but the username, so the
 * lane stays green without a seeded password — whereas `html-form` validates against a data
 * source and answers `incorrect-credentials` on any server whose account set differs.
 *
 * Selecting the first entry instead would pick whatever the server happens to list first
 * (BankID, WebAuthn, passkeys…), none of which can be driven without real hardware.
 */
function pickAuthenticator<T extends {type?: string; title?: {literal?: string}}>(
    authenticators: readonly T[],
    preference: AuthenticatorPreference
): T | undefined {
    // Name the SQL-backed one; do not take whichever `html-form` the server happens to list
    // first. `docker-config.xml` defines thirteen html-form authenticators and only two —
    // `htmlSql` and `htmlSql1`, via `default-account-manager`/`default-credential-manager` —
    // resolve to `default-datasource`, the one data source that actually runs inside the
    // container. The rest are backed by `DefaultHSQLDB` (a networked HSQLDB nothing starts),
    // Active Directory, LDAP, SCIM or JSON webservices, none of which exist there.
    //
    // First-match picked `bcrypt` → `DefaultHSQLDB`, so the server answered HTTP 500
    // `external_service_error` instead of evaluating the password, and `auth-bad-credentials`
    // reported `ProblemType.UnexpectedProblem`. `htmlSql` is also what the rest of the config
    // treats as canonical — it is the `required-authenticator-for-registration` and
    // `previous-authenticator` throughout, and it is a standard authenticator in the base
    // configuration the dev flavor overlays, so naming it works on both flavors.
    const credentialChecking =
        authenticators.find(entry => (entry.title?.literal ?? '').toLowerCase() === 'htmlsql') ??
        authenticators.find(entry => (entry.title?.literal ?? '').toLowerCase().includes('sql')) ??
        authenticators.find(entry => entry.type === HTML_FORM_AUTHENTICATOR_TYPE);

    if (preference === AuthenticatorPreference.Credentials) {
        return credentialChecking;
    }
    return (
        authenticators.find(entry => entry.type === USERNAME_AUTHENTICATOR_TYPE) ??
        credentialChecking
    );
}

/** Describes what the server offered, so an unusable selector says which options it had. */
export function describeAuthenticators(
    authenticators: readonly {type?: string; title?: {literal?: string}}[]
): string {
    if (authenticators.length === 0) {
        return 'none';
    }
    return authenticators
        .map(entry => entry.type ?? entry.title?.literal ?? 'unknown')
        .join(', ');
}

/**
 * Maps credentials onto the form's own field names rather than assuming `userName`/`password`,
 * so a server-side field rename surfaces as a real failure instead of silently submitting an
 * empty form.
 */
function credentialParameters(
    fields: readonly {name: string; fieldType?: string}[],
    credentials: Credentials
): Record<string, string> {
    const parameters: Record<string, string> = {};

    for (const field of fields) {
        const name = field.name.toLowerCase();
        if (name.includes('user')) {
            parameters[field.name] = credentials.username;
        } else if (name.includes('pass')) {
            parameters[field.name] = credentials.password;
        }
    }

    return parameters;
}

/** {@link walkAuthentication}, for the scenarios that require a code to continue. */
export async function authenticateForCode(
    accessor: HaapiAccessor,
    context: ScenarioContext,
    credentials?: Credentials
): Promise<string> {
    const result = await walkAuthentication(accessor, context, credentials);
    if (result.code === undefined) {
        throw new Error(
            `Authentication did not reach an authorization code. Steps: [${result.steps.join(
                ', '
            )}]; stopped at: ${describeStop(result.stoppedAt)}`
        );
    }
    return result.code;
}

function describeStop(response?: HaapiResponse): string {
    if (response === undefined) {
        return 'no response';
    }
    if (response.responseCategory === 'problem') {
        const problem = response.problem as {type?: string};
        return `problem (${problem.type ?? 'unknown type'})`;
    }
    return `step ${(response.representation as {stepType?: string}).stepType ?? 'unknown'}`;
}

/** A token response as a check's detail: `success`, or the error and its description. */
export function describeTokens(tokens: TokenResponse): string {
    return tokens.responseType === 'success'
        ? 'success'
        : `error ${tokens.error}${tokens.errorDescription ? ` (${tokens.errorDescription})` : ''}`;
}

export function fetchTokens(
    accessor: HaapiAccessor | OAuthAccessor,
    code: string
): Promise<TokenResponse> {
    return accessor.oauthTokenManager.fetchAccessToken(code);
}
