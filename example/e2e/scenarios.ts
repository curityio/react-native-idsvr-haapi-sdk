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
    HaapiErrorCode,
    isHaapiError,
    ProblemType,
    type TokenResponse,
} from '@curity/identityserver-haapi-react-native-sdk';
import type {AssertionResult} from './results';
import {
    authenticateForCode,
    fetchTokens,
    walkAuthentication,
    withHaapiAccessor,
    withOAuthAccessor,
    type ScenarioContext,
    AuthenticatorPreference,
} from './flow-helpers';

/**
 * The twelve executable scenarios, keyed by the ids in `registry.ts`.
 *
 * Each returns the assertions it executed; `results.settle()` turns those into a status, and
 * fails any scenario that asserted nothing — so a runner that returns early cannot report
 * green. Nothing here throws for an expected outcome: an expected refusal is an *assertion*,
 * not an exception.
 */

export type ScenarioRun = (context: ScenarioContext) => Promise<AssertionResult[]>;

export interface ScenarioRunner {
    readonly run: ScenarioRun;
    /**
     * Set only where an attestation refusal is the behaviour under test, so the
     * skip-on-attestation-rejection rule (FR-010) does not swallow that scenario's subject.
     */
    readonly attestationRejectionIsExpected?: boolean;
}

/**
 * Problem types that mean "the server evaluated these credentials and said no".
 *
 * All three are client-side refusals: which one an authenticator picks is its own business
 * (html-form may report a wrong password as invalid input on the field rather than as an
 * authentication failure), and pinning to a single type would make this scenario brittle
 * against a server-configuration change that is not a defect.
 *
 * What matters is the boundary this list draws. `UnexpectedProblem` and `Other` — which is
 * where an unrecognised type URI lands, including a 5xx fault rendered as a problem document —
 * are outside it, so an Identity Server that fell over instead of checking the password can no
 * longer be mistaken for one that refused it.
 */
const CREDENTIAL_REFUSAL_PROBLEMS: ProblemType[] = [
    ProblemType.IncorrectCredentialsProblem,
    ProblemType.AuthenticationFailedProblem,
    ProblemType.InvalidInputProblem,
];

const INVALID_AUTHORIZATION_CODE = 'invalid-code';
const INVALID_REFRESH_TOKEN = 'not-a-refresh-token';

function check(name: string, ok: boolean, detail?: string): AssertionResult {
    return detail === undefined ? {name, ok} : {name, ok, detail};
}

function describeTokens(tokens: TokenResponse): string {
    return tokens.responseType === 'success'
        ? 'success'
        : `error ${tokens.error}${tokens.errorDescription ? ` (${tokens.errorDescription})` : ''}`;
}

/** Asserts a token response is a successful one carrying a usable access token. */
function assertSuccessfulTokens(label: string, tokens: TokenResponse): AssertionResult[] {
    if (tokens.responseType !== 'success') {
        return [check(label, false, describeTokens(tokens))];
    }
    return [
        check(label, true),
        check(
            `${label}: access token present`,
            typeof tokens.accessToken === 'string' && tokens.accessToken.length > 0
        ),
        check(`${label}: positive lifetime`, tokens.expiresIn > 0, `expiresIn=${tokens.expiresIn}`),
    ];
}

/** Asserts a token response is the specific OAuth error the server should have returned. */
function assertTokenError(
    label: string,
    tokens: TokenResponse,
    expectedError: string
): AssertionResult[] {
    if (tokens.responseType !== 'error') {
        return [check(label, false, `expected ${expectedError}, got a successful response`)];
    }
    return [
        check(label, true),
        check(
            `${label}: error is ${expectedError}`,
            tokens.error === expectedError,
            `actual: ${tokens.error}`
        ),
    ];
}

/** Authenticate then exchange the code — the shared opening of most token scenarios. */
async function authenticateAndFetch(
    context: ScenarioContext
): Promise<{assertions: AssertionResult[]; tokens: TokenResponse}> {
    return withHaapiAccessor(context, async accessor => {
        const code = await authenticateForCode(accessor, context);
        const tokens = await fetchTokens(accessor, code);
        return {assertions: assertSuccessfulTokens('fetch tokens', tokens), tokens};
    });
}

const authHappy: ScenarioRun = context =>
    withHaapiAccessor(context, async accessor => {
        const result = await walkAuthentication(accessor, context);
        return [
            check(
                'reached an authorization response',
                result.code !== undefined,
                `steps: [${result.steps.join(', ')}]`
            ),
            check(
                'authorization code is non-empty',
                (result.code ?? '').length > 0,
                result.code === undefined ? 'no code returned' : undefined
            ),
        ];
    });

const authBadCredentials: ScenarioRun = context =>
    withHaapiAccessor(context, async accessor => {
        // Explicitly the credential-checking authenticator: the passwordless one this suite
        // otherwise prefers has no password to get wrong, so it would issue a code and this
        // scenario would assert the opposite of what it means to.
        const result = await walkAuthentication(
            accessor,
            context,
            {
                username: context.credentials.username,
                password: `${context.credentials.password}-wrong`,
            },
            AuthenticatorPreference.Credentials
        );
        // Asserting only "the walk stopped" would pass on *any* dead end — including a server
        // that never evaluated the password. A CI run hit exactly that: the Identity Server's
        // data source refused a connection mid-scenario (`external_service_error`) and the walk
        // stopped without a code, which the old assertions accepted as a credential refusal.
        // The refusal has to be identified by what came back, not by the absence of a code.
        const stop = result.stoppedAt;
        const problem = stop !== undefined && stop.responseCategory === 'problem'
            ? stop.problem
            : undefined;

        return [
            check(
                'wrong credentials did not authenticate',
                result.code === undefined,
                result.code === undefined ? undefined : 'a code was issued for a wrong password'
            ),
            check(
                'the server answered with a problem',
                problem !== undefined,
                problem !== undefined
                    ? undefined
                    : `expected a problem response, got ${
                          stop === undefined ? 'no stop at all' : stop.responseCategory
                      } — steps: [${result.steps.join(', ')}]`
            ),
            check(
                'the problem is a credential refusal, not a server fault',
                problem !== undefined && CREDENTIAL_REFUSAL_PROBLEMS.includes(problem.type),
                problem === undefined
                    ? 'no problem to classify'
                    : `problem type was ${problem.type}`
            ),
        ];
    });

const fetchHappy: ScenarioRun = async context => (await authenticateAndFetch(context)).assertions;

const fetchInvalidCode: ScenarioRun = context =>
    withHaapiAccessor(context, async accessor => {
        const tokens = await fetchTokens(accessor, INVALID_AUTHORIZATION_CODE);
        return assertTokenError('invalid code rejected', tokens, 'invalid_grant');
    });

const refreshHappy: ScenarioRun = context =>
    withHaapiAccessor(context, async accessor => {
        const code = await authenticateForCode(accessor, context);
        const first = await fetchTokens(accessor, code);
        if (first.responseType !== 'success' || first.refreshToken === undefined) {
            return [check('initial fetch issued a refresh token', false, describeTokens(first))];
        }

        const refreshed = await accessor.oauthTokenManager.refreshAccessToken(first.refreshToken);
        const assertions = assertSuccessfulTokens('refresh', refreshed);
        if (refreshed.responseType === 'success') {
            assertions.push(
                check(
                    'refreshed access token differs from the original',
                    refreshed.accessToken !== first.accessToken,
                    'refresh returned the same access token'
                )
            );
        }
        return assertions;
    });

const refreshInvalidToken: ScenarioRun = context =>
    withOAuthAccessor(context, async accessor => {
        const refreshed = await accessor.oauthTokenManager.refreshAccessToken(INVALID_REFRESH_TOKEN);
        return assertTokenError('invalid refresh token rejected', refreshed, 'invalid_grant');
    });

const revokeAccessRefreshWorks: ScenarioRun = context =>
    withHaapiAccessor(context, async accessor => {
        const code = await authenticateForCode(accessor, context);
        const tokens = await fetchTokens(accessor, code);
        if (tokens.responseType !== 'success' || tokens.refreshToken === undefined) {
            return [check('fetch issued both tokens', false, describeTokens(tokens))];
        }

        await accessor.oauthTokenManager.revokeAccessToken(tokens.accessToken);
        const refreshed = await accessor.oauthTokenManager.refreshAccessToken(tokens.refreshToken);

        return [
            check('access token revoked without error', true),
            ...assertSuccessfulTokens('refresh still works after revoking the access token', refreshed),
        ];
    });

const revokeRefreshRefreshDies: ScenarioRun = context =>
    withHaapiAccessor(context, async accessor => {
        const code = await authenticateForCode(accessor, context);
        const tokens = await fetchTokens(accessor, code);
        if (tokens.responseType !== 'success' || tokens.refreshToken === undefined) {
            return [check('fetch issued both tokens', false, describeTokens(tokens))];
        }

        await accessor.oauthTokenManager.revokeRefreshToken(tokens.refreshToken);

        // The revoked token may be rejected as a typed error response or as a thrown
        // HaapiError; either proves it is dead, and only success proves it is not.
        try {
            const refreshed = await accessor.oauthTokenManager.refreshAccessToken(
                tokens.refreshToken
            );
            return [
                check('refresh token revoked without error', true),
                check(
                    'refresh fails after revoking the refresh token',
                    refreshed.responseType === 'error',
                    describeTokens(refreshed)
                ),
            ];
        } catch (error) {
            return [
                check('refresh token revoked without error', true),
                check('refresh fails after revoking the refresh token', true, describeThrown(error)),
            ];
        }
    });

const attestationFails: ScenarioRun = async context => {
    // The client is configured so a genuine attestation is refused by the server; the refusal
    // may surface when the accessor is built or when the flow starts.
    try {
        return await withHaapiAccessor(context, async accessor => {
            const result = await walkAuthentication(accessor, context);
            return [
                check(
                    'attestation refusal surfaced as an error',
                    false,
                    `flow proceeded instead; steps: [${result.steps.join(', ')}]`
                ),
            ];
        });
    } catch (error) {
        const code = errorCodeOf(error);
        return [
            check('failure is a typed HaapiError', isHaapiError(error), describeThrown(error)),
            check(
                'error code is an attestation code',
                code !== undefined && code.startsWith('HAAPI_ATTESTATION'),
                `code: ${code ?? 'none'}`
            ),
        ];
    }
};

/**
 * The genuine attestation failure, and the one that is the *same* on both platforms.
 *
 * `attestation-fails` cannot run on iOS: it needs the server to refuse an attestation the device
 * created, and the iOS server never validates App Attest against Apple, so it has nothing to
 * refuse (see `registry.ts`, and HSI-536). This scenario takes the other route into the same
 * area — the app sends **no** attestation to a `…-secret` client that mandates one. All four
 * secret clients in `configs/docker-config.xml` declare `<attestation>` with no
 * `allow-without-attestation`, so the requirement is real on every lane and needs no new
 * server-side client.
 *
 * It must be a client that can authenticate some other way. Against a no-auth client the SDK
 * refuses the configuration locally — "If ClientAuthenticationMethodConfiguration is None then
 * attestation needs to be enabled" — and the request never reaches the server, so the scenario
 * would be testing the config validator rather than the refusal. See `registry.ts`.
 *
 * The assertions name the server's own refusal, and that precision is not decoration. A first
 * draft asserted merely "a typed error whose code is not HAAPI_UNEXPECTED", and it **passed on a
 * physical Android device that could not reach the server at all** — `HAAPI_COMMUNICATION:
 * Failed to connect to the server host` satisfied it. A scenario that goes green during a network
 * outage is worse than no scenario, and this repo has been here before with
 * `auth-bad-credentials` passing on a server outage. Requiring the server error *and* the phrase
 * it refuses with means an unreachable server now fails this, as it must.
 *
 * The expected wording was taken from real runs, not guessed — both platforms agree:
 *   ios-sim     HAAPI_SERVER_ERROR  400 invalid_request — "Missing client_attestation in request."
 *   android-emu HAAPI_SERVER_ERROR  "Missing client_attestation in request."
 */
const attestationRequiredButMissing: ScenarioRun = async context => {
    try {
        return await withHaapiAccessor(
            context,
            async accessor => {
                const result = await walkAuthentication(accessor, context);
                return [
                    check(
                        'a client that mandates attestation refuses an unattested app',
                        false,
                        `flow proceeded instead; steps: [${result.steps.join(', ')}]`
                    ),
                ];
            },
            {attest: false}
        );
    } catch (error) {
        const code = errorCodeOf(error);
        const described = describeThrown(error);
        return [
            check('failure is a typed HaapiError', isHaapiError(error), described),
            check(
                'the server refused it, rather than the request never arriving',
                code === HaapiErrorCode.ServerError,
                `code: ${code ?? 'none'}`
            ),
            check(
                'the server names the missing attestation',
                described.includes('client_attestation'),
                described
            ),
        ];
    }
};

const dpopNonceHappy: ScenarioRun = async context =>
    (await authenticateAndFetch(context)).assertions;

const secretAuthHappy: ScenarioRun = async context =>
    (await authenticateAndFetch(context)).assertions;

const accessorLifecycle: ScenarioRun = async context => {
    const configuration = context.buildConfiguration(context.clientId);
    const first = await context.initializeForHaapi(configuration);
    try {
        const second = await context.initializeForHaapi(configuration);
        second.close();
        return [
            check(
                're-initialising an open accessor is rejected',
                false,
                'a second accessor was created while one was open'
            ),
        ];
    } catch (error) {
        return [
            check('failure is a typed HaapiError', isHaapiError(error), describeThrown(error)),
            check(
                'error code is HAAPI_ACCESSOR_ALREADY_INITIALIZED',
                errorCodeOf(error) === 'HAAPI_ACCESSOR_ALREADY_INITIALIZED',
                `code: ${errorCodeOf(error) ?? 'none'}`
            ),
        ];
    } finally {
        try {
            first.close();
        } catch {
            // See closeQuietly in flow-helpers: a close() failure must not replace the result.
        }
    }
};

function errorCodeOf(error: unknown): string | undefined {
    const code = (error as {code?: unknown} | null)?.code;
    return typeof code === 'string' ? code : undefined;
}

function describeThrown(error: unknown): string {
    const code = errorCodeOf(error);
    const message = (error as {message?: unknown} | null)?.message;
    return [code, typeof message === 'string' ? message : null]
        .filter(part => part !== null && part !== undefined)
        .join(': ');
}

export const SCENARIO_RUNNERS: Record<string, ScenarioRunner> = {
    'auth-happy': {run: authHappy},
    'auth-bad-credentials': {run: authBadCredentials},
    'fetch-happy': {run: fetchHappy},
    'fetch-invalid-code': {run: fetchInvalidCode},
    'refresh-happy': {run: refreshHappy},
    'refresh-invalid-token': {run: refreshInvalidToken},
    'revoke-access-refresh-works': {run: revokeAccessRefreshWorks},
    'revoke-refresh-refresh-dies': {run: revokeRefreshRefreshDies},
    'attestation-fails': {run: attestationFails, attestationRejectionIsExpected: true},
    'attestation-required-but-missing': {
        run: attestationRequiredButMissing,
        attestationRejectionIsExpected: true,
    },
    'dpop-nonce-happy': {run: dpopNonceHappy},
    'secret-auth-happy': {run: secretAuthHappy},
    'accessor-lifecycle': {run: accessorLifecycle},
};
