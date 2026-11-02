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
import {HaapiErrorCode, isHaapiError} from '@curity/identityserver-haapi-react-native-sdk';
import type {OAuthTokenManager} from '@curity/identityserver-haapi-react-native-sdk';
import type {AssertionResult} from './results';
import {
    callWithDpop,
    fetchTransport,
    nativeTransport,
    userinfoUrl,
    type DpopCallResult,
    type DpopTransport,
    type ProofFactory,
} from './dpop-helpers';
import {
    androidHooks,
    authenticateForCode,
    describeTokens,
    fetchTokens,
    withHaapiAccessor,
    withOAuthAccessor,
    type BuildConfigurationOptions,
    type ScenarioContext,
} from './flow-helpers';

/**
 * The DPoP proof scenarios: a proof `OAuthTokenManager.createDpopProof` signs is accepted by a DPoP-protected
 * resource server — the identity server's own userinfo endpoint, which also demands a nonce of its own — and
 * a proof made for another request is refused. The request goes through the example's native hook, which
 * accepts a development server's certificate; the sign-in asks for `openid`, the scope userinfo answers.
 */

const SIGN_IN: BuildConfigurationOptions = {scope: ['openid']};

function check(name: string, ok: boolean, detail?: string): AssertionResult {
    return detail === undefined ? {name, ok} : {name, ok, detail};
}

/** What userinfo answered, attempt by attempt — statuses and challenges only, never a token or a body. */
function describeAttempts(result: DpopCallResult): string {
    if (result.attempts.length === 0) {
        return result.noProof ? 'no proof, nothing sent' : 'nothing sent';
    }
    return result.attempts
        .map(attempt => `${attempt.status}${attempt.wwwAuthenticate ? ` ${attempt.wwwAuthenticate}` : ''}`)
        .join(' → ');
}

function nativeHookMissing(): AssertionResult {
    return check(
        'the example app has its native request hook (example/e2e-native)',
        false,
        'HaapiE2e native module not found — rebuild the example app'
    );
}

/** Signs with the SDK for one request, collecting the proofs it hands out. */
function signing(
    manager: OAuthTokenManager,
    accessToken: string,
    httpMethod: string,
    url: string,
    proofs: string[] = []
): ProofFactory {
    return async nonce => {
        const proof = await manager.createDpopProof(accessToken, httpMethod, url, nonce);
        if (proof !== null) {
            proofs.push(proof);
        }
        return proof;
    };
}

/** A proof's header (`0`) or claims (`1`), decoded; `null` when it doesn't decode. */
function jwsPart(proof: string, index: 0 | 1): Record<string, any> | null {
    try {
        const segment = proof.split('.')[index].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(segment + '='.repeat((4 - (segment.length % 4)) % 4)));
    } catch {
        return null;
    }
}

/**
 * The SDK adds no nonce of its own, and puts exactly the one it is given in the proof: the first proof has
 * none, the retry's is the one userinfo issued. Values are compared, never reported.
 */
function assertNonceClaims(proofs: string[], result: DpopCallResult): AssertionResult[] {
    const first = proofs[0] === undefined ? null : jwsPart(proofs[0], 1);
    const retry = proofs[1] === undefined ? null : jwsPart(proofs[1], 1);
    const issued = result.attempts[0]?.dpopNonce ?? null;
    return [
        check('the first proof carries no nonce', first !== null && first.nonce === undefined),
        check(
            "the retry's proof carries the nonce userinfo issued",
            retry !== null && issued !== null && retry.nonce === issued
        ),
    ];
}

function hasSubject(body: string): boolean {
    try {
        return typeof JSON.parse(body).sub === 'string';
    } catch {
        return false;
    }
}

/** Userinfo asks for its own nonce, then accepts the proof that carries it and answers for the user. */
function assertAcceptedAfterNonce(result: DpopCallResult): AssertionResult[] {
    const first = result.attempts[0];
    const accepted = result.final?.status === 200;
    return [
        check('the SDK signed a proof for the access token', !result.noProof, describeAttempts(result)),
        check(
            'userinfo challenged the first request for a nonce of its own',
            first !== undefined && first.status === 401 && first.dpopNonce !== null,
            describeAttempts(result)
        ),
        check('userinfo accepted the proof carrying that nonce', accepted, describeAttempts(result)),
        check('userinfo answered for the signed-in user', accepted && hasSubject(result.final?.body ?? '')),
    ];
}

function isRefusedProof(result: DpopCallResult): boolean {
    return (
        !result.noProof &&
        result.final?.status === 401 &&
        (result.final.wwwAuthenticate ?? '').includes('invalid_dpop_proof')
    );
}

/**
 * Signs in bound and calls userinfo with a proof over `transport` — the documented recipe. The method is signed in
 * lower case on purpose: the SDK upper-cases it as `fetch` does.
 */
async function signedUserinfoCall(context: ScenarioContext, transport: DpopTransport): Promise<AssertionResult[]> {
    return withHaapiAccessor(
        context,
        async accessor => {
            const tokens = await fetchTokens(accessor, await authenticateForCode(accessor, context));
            if (tokens.responseType !== 'success') {
                return [check('the token-bound sign-in issued tokens', false, describeTokens(tokens))];
            }
            const url = userinfoUrl(context.baseUrl);
            const proofs: string[] = [];
            const result = await callWithDpop(
                transport,
                signing(accessor.oauthTokenManager, tokens.accessToken, 'get', url, proofs),
                {url, method: 'GET', accessToken: tokens.accessToken}
            );
            return [
                check('the access token is DPoP-bound', tokens.tokenType?.toLowerCase() === 'dpop', tokens.tokenType),
                ...assertAcceptedAfterNonce(result),
                ...assertNonceClaims(proofs, result),
                check('each proof is a fresh one', proofs.length === 2 && proofs[0] !== proofs[1], `${proofs.length} proofs`),
            ];
        },
        SIGN_IN
    );
}

/** `dpop-proof-userinfo`: through the example's native request hook, which accepts a development certificate. */
export async function dpopProofUserinfo(context: ScenarioContext): Promise<AssertionResult[]> {
    const hooks = context.e2eNative;
    if (hooks === undefined || hooks === null) {
        return [nativeHookMissing()];
    }
    return signedUserinfoCall(context, nativeTransport(hooks));
}

/**
 * `dpop-proof-userinfo-fetch`: the same recipe with the app's own `fetch`, as an integrator writes it. The registry
 * runs it only where the server's certificate is publicly trusted.
 */
export async function dpopProofUserinfoFetch(context: ScenarioContext): Promise<AssertionResult[]> {
    return signedUserinfoCall(context, fetchTransport());
}

/** `dpop-proof-wrong-request-rejected`: a proof is bound to the method and URL it was made for. */
export async function dpopProofWrongRequestRejected(context: ScenarioContext): Promise<AssertionResult[]> {
    const hooks = context.e2eNative;
    if (hooks === undefined || hooks === null) {
        return [nativeHookMissing()];
    }
    return withHaapiAccessor(
        context,
        async accessor => {
            const tokens = await fetchTokens(accessor, await authenticateForCode(accessor, context));
            if (tokens.responseType !== 'success') {
                return [check('the token-bound sign-in issued tokens', false, describeTokens(tokens))];
            }
            const url = userinfoUrl(context.baseUrl);
            const transport = nativeTransport(hooks);
            const manager = accessor.oauthTokenManager;
            const request = {url, method: 'GET', accessToken: tokens.accessToken};
            const wrongMethod = await callWithDpop(transport, signing(manager, tokens.accessToken, 'POST', url), request);
            const elsewhere = `${context.baseUrl}/dev/oauth/not-userinfo`;
            const wrongUrl = await callWithDpop(transport, signing(manager, tokens.accessToken, 'GET', elsewhere), request);
            return [
                check('userinfo refuses a proof made for POST on a GET', isRefusedProof(wrongMethod), describeAttempts(wrongMethod)),
                check('userinfo refuses a proof made for another URL', isRefusedProof(wrongUrl), describeAttempts(wrongUrl)),
            ];
        },
        SIGN_IN
    );
}

/**
 * `dpop-proof-oauth-accessor-after-refresh`: an OAuth-only accessor — a fresh native manager that never ran
 * the flow — refreshes the bound sign-in and signs for the new access token with the key from secure storage.
 */
export async function dpopProofOAuthAccessorAfterRefresh(context: ScenarioContext): Promise<AssertionResult[]> {
    const hooks = context.e2eNative;
    if (hooks === undefined || hooks === null) {
        return [nativeHookMissing()];
    }
    const tokens = await withHaapiAccessor(
        context,
        async accessor => fetchTokens(accessor, await authenticateForCode(accessor, context)),
        SIGN_IN
    );
    if (tokens.responseType !== 'success' || tokens.refreshToken === undefined) {
        return [check('the token-bound sign-in issued a refresh token', false, describeTokens(tokens))];
    }
    const refreshToken = tokens.refreshToken;
    return withOAuthAccessor(
        context,
        async oauth => {
            const refreshed = await oauth.oauthTokenManager.refreshAccessToken(refreshToken);
            if (refreshed.responseType !== 'success') {
                return [check('the OAuth-only accessor refreshed the bound sign-in', false, describeTokens(refreshed))];
            }
            const url = userinfoUrl(context.baseUrl);
            const result = await callWithDpop(
                nativeTransport(hooks),
                signing(oauth.oauthTokenManager, refreshed.accessToken, 'GET', url),
                {url, method: 'GET', accessToken: refreshed.accessToken}
            );
            return [check('the OAuth-only accessor refreshed the bound sign-in', true), ...assertAcceptedAfterNonce(result)];
        },
        SIGN_IN
    );
}

/** The no-key scenario's own Android Keystore alias, so what it finds there is what it left. */
const NO_KEY_ALIAS = 'dpop-proof-no-key';
/** The divergence scenario's alias: its unbound start leaves a key under it, removed again at the end. */
const OLDER_KEY_ALIAS = 'dpop-proof-older-key';
/** The native ticket for the Android divergence. */
const ANDROID_OLDER_KEY_TICKET = 'HSA-536';

/** The public key a proof's header carries, as `crv:x:y` — enough to tell two keys apart — or `null`. */
function proofKey(proof: string | null): string | null {
    const jwk = proof === null ? undefined : jwsPart(proof, 0)?.jwk;
    return jwk ? `${jwk.crv}:${jwk.x}:${jwk.y}` : null;
}

/**
 * `dpop-proof-no-key`: after a refresh, no proof comes for the access token it superseded, for a refresh
 * token, for a token the SDK never issued, nor for the current access token once it is revoked — while that
 * token did have one, so the nulls aren't vacuous. Nothing is sent to a server: this is about what the SDK
 * answers. On Android the scenario first removes anything under its own Keystore alias.
 */
export async function dpopProofNoKey(context: ScenarioContext): Promise<AssertionResult[]> {
    const hooks = context.e2eNative;
    if (hooks === undefined || hooks === null) {
        return [nativeHookMissing()];
    }
    androidHooks(hooks)?.deleteKeyStoreEntry(NO_KEY_ALIAS);
    return withHaapiAccessor(
        context,
        async accessor => {
            const tokens = await fetchTokens(accessor, await authenticateForCode(accessor, context));
            if (tokens.responseType !== 'success' || tokens.refreshToken === undefined) {
                return [check('the token-bound sign-in issued a refresh token', false, describeTokens(tokens))];
            }
            const manager = accessor.oauthTokenManager;
            const refreshed = await manager.refreshAccessToken(tokens.refreshToken);
            if (refreshed.responseType !== 'success') {
                return [check('the token-bound sign-in refreshed', false, describeTokens(refreshed))];
            }
            const url = userinfoUrl(context.baseUrl);
            const proofFor = (token: string) => manager.createDpopProof(token, 'GET', url);
            const current = await proofFor(refreshed.accessToken);
            const superseded = await proofFor(tokens.accessToken);
            const refreshToken = await proofFor(refreshed.refreshToken ?? tokens.refreshToken);
            const unknown = await proofFor('not-a-token');
            await manager.revokeAccessToken(refreshed.accessToken);
            const revoked = await proofFor(refreshed.accessToken);
            return [
                check('the current access token has a key to sign with', current !== null),
                check('no proof for the access token the refresh superseded', superseded === null),
                check('no proof for a refresh token', refreshToken === null),
                check('no proof for a token the SDK never issued', unknown === null),
                check('no proof for the access token once it is revoked', revoked === null),
            ];
        },
        {keyStoreAlias: NO_KEY_ALIAS}
    );
}

/**
 * `dpop-proof-unbound-accessor`: an accessor without token binding answers no proof, even for a still-valid
 * access token a bound sign-in minted and could sign for. iOS's native SDK would sign it; the bridge gates.
 */
export async function dpopProofUnboundAccessor(context: ScenarioContext): Promise<AssertionResult[]> {
    const url = userinfoUrl(context.baseUrl);
    const signedIn = await withHaapiAccessor(context, async accessor => {
        const tokens = await fetchTokens(accessor, await authenticateForCode(accessor, context));
        const proof =
            tokens.responseType === 'success'
                ? await accessor.oauthTokenManager.createDpopProof(tokens.accessToken, 'GET', url)
                : null;
        return {tokens, proof};
    });
    if (signedIn.tokens.responseType !== 'success') {
        return [check('the token-bound sign-in issued tokens', false, describeTokens(signedIn.tokens))];
    }
    const accessToken = signedIn.tokens.accessToken;
    const unbound = await withOAuthAccessor(
        context,
        oauth => oauth.oauthTokenManager.createDpopProof(accessToken, 'GET', url),
        {tokenBinding: false}
    );
    return [
        check('the bound sign-in signs for its access token', signedIn.proof !== null),
        check('an OAuth-only accessor without token binding has no proof for it', unbound === null),
    ];
}

/**
 * `dpop-proof-android-older-key-divergence`: a token the SDK doesn't track. iOS has no proof for it. Android
 * 5.7.0 signs it with the key an earlier unbound start left under the Keystore alias — not the sign-in's — the
 * known divergence this pins until the native fix. Compared by the proofs' public keys; nothing reaches a
 * server, which would refuse an unknown token whatever its proof. On Android the key is removed at the end.
 */
export async function dpopProofAndroidOlderKeyDivergence(context: ScenarioContext): Promise<AssertionResult[]> {
    const hooks = context.e2eNative;
    if (hooks === undefined || hooks === null) {
        return [nativeHookMissing()];
    }
    const android = androidHooks(hooks);
    const url = userinfoUrl(context.baseUrl);
    try {
        await withHaapiAccessor(
            context,
            async accessor => {
                await accessor.haapiManager.start();
            },
            {tokenBinding: false, keyStoreAlias: OLDER_KEY_ALIAS}
        );
        return await withHaapiAccessor(
            context,
            async accessor => {
                const tokens = await fetchTokens(accessor, await authenticateForCode(accessor, context));
                if (tokens.responseType !== 'success') {
                    return [check('the token-bound sign-in issued tokens', false, describeTokens(tokens))];
                }
                const manager = accessor.oauthTokenManager;
                const signInKey = proofKey(await manager.createDpopProof(tokens.accessToken, 'GET', url));
                const unknown = await manager.createDpopProof('not-a-token', 'GET', url);
                const signsWithItsKey = check("the sign-in's access token is signed with its key", signInKey !== null);
                if (android === null) {
                    return [signsWithItsKey, check('a token the SDK does not track gets no proof', unknown === null)];
                }
                const unknownKey = proofKey(unknown);
                return [
                    signsWithItsKey,
                    check(
                        `Android 5.7.0 signs a token it does not track with an older key (known divergence, ${ANDROID_OLDER_KEY_TICKET})`,
                        unknownKey !== null && unknownKey !== signInKey,
                        unknown === null
                            ? 'no proof: the divergence is gone — update the docs and close the native ticket'
                            : unknownKey === signInKey
                              ? "signed with the sign-in's own key"
                              : undefined
                    ),
                ];
            },
            {keyStoreAlias: OLDER_KEY_ALIAS}
        );
    } finally {
        android?.deleteKeyStoreEntry(OLDER_KEY_ALIAS);
    }
}

/** A request no proof can be made for, and the value in it that must not come back in the error. */
interface InvalidRequest {
    readonly label: string;
    readonly httpMethod: string;
    readonly url: string;
    readonly nonce?: string;
    readonly offending?: string;
}

/** The SDK refuses `request` as a caller error, and its description doesn't repeat the offending value. */
async function refusedAsInvalidArgument(manager: OAuthTokenManager, request: InvalidRequest): Promise<AssertionResult> {
    const name = `${request.label} is refused as HAAPI_INVALID_ARGUMENT`;
    try {
        await manager.createDpopProof('an-access-token', request.httpMethod, request.url, request.nonce);
        return check(name, false, 'no error');
    } catch (error) {
        if (!isHaapiError(error)) {
            return check(name, false, 'not a HaapiError');
        }
        const typed =
            error.code === HaapiErrorCode.InvalidArgument &&
            error.category === 'bridge' &&
            error.recovery?.kind === 'unrecoverable' &&
            error.recovery.action?.kind === 'introspectCause';
        const echoed = request.offending !== undefined && (error.errorDescription ?? '').includes(request.offending);
        return check(name, typed && !echoed, echoed ? 'the description repeats the input' : `${error.code} ${error.category}`);
    }
}

/**
 * `dpop-proof-invalid-input`: input no proof can be made for — a URL with user credentials, a relative URL, an
 * empty nonce, a method that isn't an HTTP token — is refused before any key is looked up, the same way on both
 * platforms. No sign-in is needed: the check comes first.
 */
export async function dpopProofInvalidInput(context: ScenarioContext): Promise<AssertionResult[]> {
    const url = userinfoUrl(context.baseUrl);
    const withCredentials = url.replace('://', '://user:secret@');
    const requests: InvalidRequest[] = [
        {label: 'a URL with user credentials', httpMethod: 'GET', url: withCredentials, offending: 'user:secret'},
        {label: 'a relative URL', httpMethod: 'GET', url: '/dev/oauth/userinfo', offending: '/dev/oauth/userinfo'},
        {label: 'an empty nonce', httpMethod: 'GET', url, nonce: ''},
        {label: 'a method with a space', httpMethod: 'GE T', url, offending: 'GE T'},
    ];
    return withOAuthAccessor(context, async oauth => {
        const results: AssertionResult[] = [];
        for (const request of requests) {
            results.push(await refusedAsInvalidArgument(oauth.oauthTokenManager, request));
        }
        return results;
    });
}
