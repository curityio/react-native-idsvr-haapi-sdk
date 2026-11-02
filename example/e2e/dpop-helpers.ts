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
 * Calls a DPoP-protected resource the way the React Native docs tell an app to: the access token
 * under the `DPoP` scheme, a fresh proof per request, and one retry with the resource server's own
 * nonce when it answers with a nonce challenge. The DPoP scenarios run it over two transports — the
 * example's native request hook, which accepts a development server's certificate, and the app's own
 * `fetch`, which is the integrator's path and needs a trusted certificate.
 */
import type {DpopResponse, HaapiE2eNative} from 'haapi-e2e-native';

export type {DpopResponse};

/** Sends one request with the two DPoP headers. */
export type DpopTransport = (
    url: string,
    method: string,
    authorization: string,
    dpop: string
) => Promise<DpopResponse>;

/** Signs a proof for the request, carrying `nonce` when given; `null` when no key is bound to the token. */
export type ProofFactory = (nonce: string | undefined) => Promise<string | null>;

export interface DpopRequest {
    readonly url: string;
    readonly method: string;
    readonly accessToken: string;
}

export interface DpopCallResult {
    /** Every response received, in order — the nonce challenge, when there was one, comes first. */
    readonly attempts: DpopResponse[];
    /** The last response, absent when nothing was sent. */
    readonly final?: DpopResponse;
    /** The factory returned no proof, so the request (or its retry) was never sent. */
    readonly noProof: boolean;
}

type FetchLike = (
    url: string,
    init: {method: string; headers: Record<string, string>}
) => Promise<{status: number; headers: {get(name: string): string | null}; text(): Promise<string>}>;

/** The userinfo endpoint of the example's `dev` profile — the DPoP resource server the scenarios call. */
export function userinfoUrl(baseUrl: string): string {
    return `${baseUrl}/dev/oauth/userinfo`;
}

export async function callWithDpop(
    transport: DpopTransport,
    makeProof: ProofFactory,
    request: DpopRequest
): Promise<DpopCallResult> {
    const authorization = `DPoP ${request.accessToken}`;
    const attempts: DpopResponse[] = [];

    const proof = await makeProof(undefined);
    if (proof === null) {
        return {attempts, noProof: true};
    }
    const first = await transport(request.url, request.method, authorization, proof);
    attempts.push(first);
    if (first.status !== 401 || first.dpopNonce === null) {
        return {attempts, final: first, noProof: false};
    }

    const retryProof = await makeProof(first.dpopNonce);
    if (retryProof === null) {
        return {attempts, final: first, noProof: true};
    }
    const retry = await transport(request.url, request.method, authorization, retryProof);
    attempts.push(retry);
    return {attempts, final: retry, noProof: false};
}

/** The integrator's path: the app's own `fetch`. */
export function fetchTransport(fetchFn: FetchLike = fetch as unknown as FetchLike): DpopTransport {
    return async (url, method, authorization, dpop) => {
        const response = await fetchFn(url, {method, headers: {Authorization: authorization, DPoP: dpop}});
        return {
            status: response.status,
            wwwAuthenticate: response.headers.get('WWW-Authenticate'),
            dpopNonce: response.headers.get('DPoP-Nonce'),
            body: await response.text(),
        };
    };
}

/** The example's native hook, which reaches a development server whose certificate isn't trusted. */
export function nativeTransport(hook: HaapiE2eNative): DpopTransport {
    return (url, method, authorization, dpop) => hook.dpopRequest(url, method, authorization, dpop);
}
