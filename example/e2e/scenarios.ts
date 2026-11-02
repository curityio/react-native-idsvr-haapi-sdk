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
    DpopKeyPolicy,
    HaapiErrorCode,
    isHaapiError,
    ProblemType,
    StorageOption,
    type TokenResponse,
} from '@curity/identityserver-haapi-react-native-sdk';
import type {AssertionResult} from './results';
import {STORAGE_MIGRATION_ID, storageMigrationKeepsSignIn, type ScenarioOutcome} from './storage-migration';
import {
    dpopProofAndroidOlderKeyDivergence,
    dpopProofInvalidInput,
    dpopProofNoKey,
    dpopProofOAuthAccessorAfterRefresh,
    dpopProofUnboundAccessor,
    dpopProofUserinfo,
    dpopProofUserinfoFetch,
    dpopProofWrongRequestRejected,
} from './dpop-scenarios';
import {
    androidHooks,
    authenticateForCode,
    describeTokens,
    fetchTokens,
    walkAuthentication,
    withHaapiAccessor,
    withOAuthAccessor,
    type BuildConfigurationOptions,
    type ScenarioContext,
    AuthenticatorPreference,
} from './flow-helpers';

/**
 * The executable scenarios, keyed by the ids in `registry.ts`.
 *
 * Each returns the assertions it executed; `results.settle()` turns those into a status, and
 * fails any scenario that asserted nothing — so a runner that returns early cannot report
 * green. Nothing here throws for an expected outcome: an expected refusal is an *assertion*,
 * not an exception.
 */

export type ScenarioRun = (context: ScenarioContext) => Promise<AssertionResult[] | ScenarioOutcome>;

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

/**
 * Token binding stated explicitly (the SDK's defaults, on the default storage), so the scenario keeps
 * testing a bound sign-in whatever the SDK's default binding is. Applies on Android; iOS binds by
 * its own configuration.
 */
const BOUND_WITH_DEFAULTS: BuildConfigurationOptions = {
    tokenBinding: {storageOption: StorageOption.Default},
};

/**
 * Two sign-ins, one after the other, each on its own accessor and so its own HAAPI start; then both
 * refresh. Every HAAPI start mints a new key for its session and removes keys no sign-in is bound to,
 * on the same key store both sign-ins use — so refreshing the *first* sign-in proves that start left
 * its key alone.
 */
const refreshSurvivesSecondSignIn: ScenarioRun = async context => {
    const signIn = () =>
        withHaapiAccessor(
            context,
            async accessor => fetchTokens(accessor, await authenticateForCode(accessor, context)),
            BOUND_WITH_DEFAULTS
        );
    const first = await signIn();
    if (first.responseType !== 'success' || first.refreshToken === undefined) {
        return [check('first sign-in issued a refresh token', false, describeTokens(first))];
    }
    const second = await signIn();
    if (second.responseType !== 'success' || second.refreshToken === undefined) {
        return [check('second sign-in issued a refresh token', false, describeTokens(second))];
    }

    const firstRefreshToken = first.refreshToken;
    const secondRefreshToken = second.refreshToken;
    return withOAuthAccessor(
        context,
        async accessor => [
            ...assertSuccessfulTokens(
                'refresh the first sign-in after a second sign-in',
                await accessor.oauthTokenManager.refreshAccessToken(firstRefreshToken)
            ),
            ...assertSuccessfulTokens(
                'refresh the second sign-in',
                await accessor.oauthTokenManager.refreshAccessToken(secondRefreshToken)
            ),
        ],
        BOUND_WITH_DEFAULTS
    );
};

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

/**
 * A client authentication method through the whole token lifecycle: the flow, the code exchange,
 * and revoking the refresh token — revocation must authenticate the client the same way the token
 * request does. The scenario's client decides the method.
 */
const clientAuthLifecycle: ScenarioRun = context =>
    withHaapiAccessor(context, async accessor => {
        const code = await authenticateForCode(accessor, context);
        const tokens = await fetchTokens(accessor, code);
        const assertions = assertSuccessfulTokens('fetch tokens', tokens);
        if (tokens.responseType !== 'success' || tokens.refreshToken === undefined) {
            return [...assertions, check('fetch issued a refresh token', false, describeTokens(tokens))];
        }

        // Each revocation authenticates the client, so both token kinds exercise the method.
        await accessor.oauthTokenManager.revokeAccessToken(tokens.accessToken);
        assertions.push(check('access token revoked without error', true));
        await accessor.oauthTokenManager.revokeRefreshToken(tokens.refreshToken);
        assertions.push(check('refresh token revoked without error', true));
        // As in revoke-refresh-refresh-dies: a typed error response or a thrown HaapiError both
        // prove the token is dead.
        try {
            const refreshed = await accessor.oauthTokenManager.refreshAccessToken(tokens.refreshToken);
            assertions.push(
                check(
                    'refresh fails after revoking the refresh token',
                    refreshed.responseType === 'error',
                    describeTokens(refreshed)
                )
            );
        } catch (error) {
            assertions.push(check('refresh fails after revoking the refresh token', true, describeThrown(error)));
        }
        return assertions;
    });

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

/**
 * Token binding off, against a client that issues token-bound authorization codes: the code
 * cannot be exchanged without a DPoP proof. The refusal must *resolve* as a token error on both
 * platforms — a rejected call is a failure, not a pass (FR-005a). The server's code is recorded,
 * not pinned: which one it picks is the server's business.
 */
const tokenBindingUnboundRejected: ScenarioRun = context =>
    withHaapiAccessor(
        context,
        async accessor => {
            const code = await authenticateForCode(accessor, context);
            let tokens: TokenResponse;
            try {
                tokens = await fetchTokens(accessor, code);
            } catch (error) {
                return [
                    check(
                        'the refused exchange resolves as a token error, not a rejected call',
                        false,
                        describeThrown(error)
                    ),
                ];
            }
            return [
                check(
                    'the unbound exchange is refused by the token-bound client',
                    tokens.responseType === 'error',
                    describeTokens(tokens)
                ),
            ];
        },
        {tokenBinding: false}
    );

/** Token binding on (the client definition binds this client): exchange, then refresh. */
const tokenBindingBoundHappy: ScenarioRun = context =>
    withHaapiAccessor(context, async accessor => {
        const code = await authenticateForCode(accessor, context);
        const tokens = await fetchTokens(accessor, code);
        if (tokens.responseType !== 'success' || tokens.refreshToken === undefined) {
            return [check('bound fetch issued a refresh token', false, describeTokens(tokens))];
        }
        const refreshed = await accessor.oauthTokenManager.refreshAccessToken(tokens.refreshToken);
        return [
            ...assertSuccessfulTokens('bound fetch', tokens),
            ...assertSuccessfulTokens('bound refresh', refreshed),
        ];
    });

/**
 * With attestation off the key policy decides the DPoP key: a sign-in with `keyType` set must be bound
 * to a key of that kind, and refresh with it. The probe reads where the key lives through the refresh
 * token's record in the SDK's default storage. The binding names the alias earlier SDK versions bound
 * to: no key exists there on these devices, so adopting it must not get in the way of a new sign-in.
 */
function keyTypeScenario(keyType: DpopKeyPolicy, expectedLocation: 'Software' | 'Hardware'): ScenarioRun {
    return context =>
        withHaapiAccessor(
            context,
            async accessor => {
                const code = await authenticateForCode(accessor, context);
                const tokens = await fetchTokens(accessor, code);
                if (tokens.responseType !== 'success' || tokens.refreshToken === undefined) {
                    return [check('bound fetch issued a refresh token', false, describeTokens(tokens))];
                }
                const probe = androidHooks(context.e2eNative);
                if (probe === null) {
                    return [
                        check(
                            'the example app has its native hooks (example/e2e-native)',
                            false,
                            'the Android E2E hooks are not built — an Android build of the example app is required'
                        ),
                    ];
                }
                const location = probe.migrationState(tokens.refreshToken).encryptedLocation;
                const refreshed = await accessor.oauthTokenManager.refreshAccessToken(tokens.refreshToken);
                return [
                    ...assertSuccessfulTokens('bound fetch', tokens),
                    check(
                        `the sign-in is bound to a ${expectedLocation.toLowerCase()} key`,
                        location === expectedLocation,
                        `key location: ${location ?? 'none recorded'}`
                    ),
                    ...assertSuccessfulTokens('bound refresh', refreshed),
                ];
            },
            {tokenBinding: {keyType, migrateFromLegacyAlias: 'haapi_token_bound_key'}}
        );
}

/**
 * Token binding off: a new sign-in flow gives the HAAPI session a new DPoP key, and an unbound
 * refresh token must not depend on it (SC-007).
 */
const tokenBindingUnboundRefreshSurvivesNewFlow: ScenarioRun = context =>
    withHaapiAccessor(context, async accessor => {
        const code = await authenticateForCode(accessor, context);
        const tokens = await fetchTokens(accessor, code);
        if (tokens.responseType !== 'success' || tokens.refreshToken === undefined) {
            return [check('unbound fetch issued a refresh token', false, describeTokens(tokens))];
        }
        const second = await walkAuthentication(accessor, context);
        if (second.code === undefined) {
            return [
                check(
                    'a second sign-in flow reaches a code',
                    false,
                    `steps: [${second.steps.join(', ')}]`
                ),
            ];
        }
        const refreshed = await accessor.oauthTokenManager.refreshAccessToken(tokens.refreshToken);
        return [
            check('a second sign-in flow reaches a code', true),
            ...assertSuccessfulTokens('refresh after the new flow', refreshed),
        ];
    });

function errorCodeOf(error: unknown): string | undefined {
    const code = (error as {code?: unknown} | null)?.code;
    return typeof code === 'string' ? code : undefined;
}

/**
 * The Keychain Sharing group the example app is entitled to (`app.json` → `ios.entitlements`), with the
 * team prefix the keychain needs at runtime (the team in `plugins/withExampleIosBuildSettings.js`) —
 * and one the app is not entitled to.
 */
const ENTITLED_KEYCHAIN: BuildConfigurationOptions = {
    keychainConfiguration: {accessGroup: 'ALY8Q7BNK9.io.curity.cat.ios.client.shared'},
};
const NOT_ENTITLED_KEYCHAIN: BuildConfigurationOptions = {
    keychainConfiguration: {accessGroup: 'ALY8Q7BNK9.io.curity.cat.ios.client.not-entitled'},
};

/**
 * A token-bound sign-in with the SDK's keychain items in the entitled shared access group. The code
 * exchange stores the sign-in's key there; the refresh on the HAAPI accessor, then the one on an
 * OAuth-only accessor built with the same configuration, can only succeed by reading it back.
 */
const keychainAccessGroupKeepsSignIn: ScenarioRun = async context => {
    const signIn = await withHaapiAccessor(
        context,
        async accessor => {
            const tokens = await fetchTokens(accessor, await authenticateForCode(accessor, context));
            const refreshed = tokens.responseType === 'success' && tokens.refreshToken !== undefined
                ? await accessor.oauthTokenManager.refreshAccessToken(tokens.refreshToken)
                : undefined;
            return {tokens, refreshed};
        },
        ENTITLED_KEYCHAIN
    );
    if (signIn.refreshed === undefined) {
        return [check('bound fetch issued a refresh token', false, describeTokens(signIn.tokens))];
    }
    const refreshed = signIn.refreshed;
    const assertions = [
        ...assertSuccessfulTokens('bound fetch', signIn.tokens),
        ...assertSuccessfulTokens('refresh on the HAAPI accessor', refreshed),
    ];
    if (refreshed.responseType !== 'success' || refreshed.refreshToken === undefined) {
        return assertions;
    }
    const refreshToken = refreshed.refreshToken;
    const refreshedAgain = await withOAuthAccessor(
        context,
        accessor => accessor.oauthTokenManager.refreshAccessToken(refreshToken),
        ENTITLED_KEYCHAIN
    );
    return [...assertions, ...assertSuccessfulTokens('refresh on an OAuth-only accessor', refreshedAgain)];
};

/**
 * A token-bound sign-in with an access group the app is not entitled to. The native SDK only logs the
 * failed write of the sign-in's key, so the code exchange succeeds; the refresh cannot read the key back,
 * goes out unsigned, and the server refuses it with `invalid_dpop_proof` — proof the group reached the
 * keychain and the SDK did not fall back to the app's private keychain area. The native SDK passes that
 * answer through as an error response (it reports the unreadable key only for `invalid_request`).
 */
const keychainAccessGroupNotEntitled: ScenarioRun = context =>
    withHaapiAccessor(
        context,
        async accessor => {
            const tokens = await fetchTokens(accessor, await authenticateForCode(accessor, context));
            if (tokens.responseType !== 'success' || tokens.refreshToken === undefined) {
                return [check('sign-in completes despite the failed key write', false, describeTokens(tokens))];
            }
            const signedIn = check('sign-in completes despite the failed key write', true);
            try {
                const refreshed = await accessor.oauthTokenManager.refreshAccessToken(tokens.refreshToken);
                return [
                    signedIn,
                    check(
                        'the refresh is refused with invalid_dpop_proof because the key cannot be read back',
                        refreshed.responseType === 'error' && refreshed.error === 'invalid_dpop_proof',
                        describeTokens(refreshed)
                    ),
                ];
            } catch (error) {
                return [
                    signedIn,
                    check(
                        'the refresh is refused with invalid_dpop_proof because the key cannot be read back',
                        false,
                        `refresh rejected: ${describeThrown(error)}`
                    ),
                ];
            }
        },
        NOT_ENTITLED_KEYCHAIN
    );

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
    'refresh-survives-second-sign-in': {run: refreshSurvivesSecondSignIn},
    'revoke-access-refresh-works': {run: revokeAccessRefreshWorks},
    'revoke-refresh-refresh-dies': {run: revokeRefreshRefreshDies},
    'attestation-fails': {run: attestationFails, attestationRejectionIsExpected: true},
    'attestation-required-but-missing': {
        run: attestationRequiredButMissing,
        attestationRejectionIsExpected: true,
    },
    'dpop-nonce-happy': {run: dpopNonceHappy},
    'secret-auth-happy': {run: clientAuthLifecycle},
    'symmetric-jwt-auth-happy': {run: clientAuthLifecycle},
    'asymmetric-jwt-rs256-auth-happy': {run: clientAuthLifecycle},
    'asymmetric-jwt-es256-auth-happy': {run: clientAuthLifecycle},
    'asymmetric-jwt-es384-auth-happy': {run: clientAuthLifecycle},
    'asymmetric-jwt-es512-auth-happy': {run: clientAuthLifecycle},
    'accessor-lifecycle': {run: accessorLifecycle},
    [STORAGE_MIGRATION_ID]: {run: storageMigrationKeepsSignIn},
    'token-binding-unbound-rejected': {run: tokenBindingUnboundRejected},
    'token-binding-bound-happy': {run: tokenBindingBoundHappy},
    'token-binding-unbound-refresh-survives-new-flow': {run: tokenBindingUnboundRefreshSurvivesNewFlow},
    'token-binding-key-type-software': {run: keyTypeScenario(DpopKeyPolicy.Software, 'Software')},
    'token-binding-key-type-hardware': {run: keyTypeScenario(DpopKeyPolicy.Hardware, 'Hardware')},
    'keychain-access-group-keeps-sign-in': {run: keychainAccessGroupKeepsSignIn},
    'keychain-access-group-not-entitled': {run: keychainAccessGroupNotEntitled},
    'dpop-proof-userinfo': {run: dpopProofUserinfo},
    'dpop-proof-wrong-request-rejected': {run: dpopProofWrongRequestRejected},
    'dpop-proof-oauth-accessor-after-refresh': {run: dpopProofOAuthAccessorAfterRefresh},
    'dpop-proof-no-key': {run: dpopProofNoKey},
    'dpop-proof-unbound-accessor': {run: dpopProofUnboundAccessor},
    'dpop-proof-android-older-key-divergence': {run: dpopProofAndroidOlderKeyDivergence},
    'dpop-proof-invalid-input': {run: dpopProofInvalidInput},
    'dpop-proof-userinfo-fetch': {run: dpopProofUserinfoFetch},
};
