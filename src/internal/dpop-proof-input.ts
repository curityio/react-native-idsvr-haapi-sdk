//
// Copyright (C) 2026 Curity AB. All rights reserved.
//
// The contents of this file are the property of Curity AB.
// You may not copy or use this file, in either source code
// or executable form, except in compliance with terms
// set by Curity AB.
//
// For further information, please contact Curity AB.
//

import { HaapiErrorCode } from '../errors';
import type { HaapiError } from '../errors';
import { makeBridgeError } from './bridge-errors';

// The six methods `fetch` upper-cases before sending (Fetch standard,
// "normalize a method"). A proof must name the method the server receives,
// so these are signed in upper case and every other method exactly as given.
const NORMALIZED_METHODS = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

export function normalizeHttpMethod(httpMethod: string): string {
    const upper = httpMethod.toUpperCase();
    return NORMALIZED_METHODS.indexOf(upper) >= 0 ? upper : httpMethod;
}

// An RFC 9110 `token`: the characters a method name may have (`fetch` refuses any other).
const METHOD_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
// RFC 3986 outside the authority: unreserved, sub-delims, `:` `@` `/` `?`, and `%` with two hex digits.
const URL_CHARACTERS = /^(?:[A-Za-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9A-Fa-f]{2})*$/;
// A host name (RFC 3986 `reg-name`): ASCII only, so a non-ASCII host must come as punycode.
const REG_NAME = /^(?:[A-Za-z0-9\-._~!$&'()*+,;=]|%[0-9A-Fa-f]{2})+$/;
const IP_LITERAL = /^\[[0-9A-Fa-f:.]+\]$/;
const PORT = /^[0-9]{1,5}$/;

const NOT_ABSOLUTE = 'url must be an absolute http or https URL.';
const CREDENTIALS = 'url must not carry user credentials.';
const BAD_PORT = 'url must have no port, or a port of 1 to 5 digits.';
const NOT_ENCODED = 'url must contain only URL characters; percent-encode anything else.';

/**
 * Why `url` can't be signed for, or `null` when it can. Checked on the string — the natives parse URLs
 * differently, and `fetch` would encode what they disagree on — so both platforms get the same answer.
 */
function urlProblem(url: string): string | null {
    const scheme = /^https?:\/\//i.exec(url);
    if (scheme === null) {
        return NOT_ABSOLUTE;
    }
    const rest = url.slice(scheme[0].length);
    const end = rest.search(/[/?#]/);
    const authority = end === -1 ? rest : rest.slice(0, end);
    const remainder = end === -1 ? '' : rest.slice(end);
    if (authority.indexOf('@') !== -1) {
        return CREDENTIALS;
    }
    // The host ends at an IP literal's `]`, or else at the first `:`; anything after it is the port.
    const hostEnd = authority.startsWith('[') ? authority.indexOf(']') + 1 : authority.indexOf(':');
    const host = hostEnd <= 0 ? authority : authority.slice(0, hostEnd);
    const port = hostEnd <= 0 || hostEnd === authority.length ? null : authority.slice(hostEnd);
    // No host, or an IP literal with no closing `]`: the natives can't find a host in either.
    if (host === '' || host.startsWith(':') || (host.startsWith('[') && !host.endsWith(']'))) {
        return NOT_ABSOLUTE;
    }
    if (!(host.startsWith('[') ? IP_LITERAL : REG_NAME).test(host)) {
        return NOT_ENCODED;
    }
    if (port !== null && !(port.startsWith(':') && PORT.test(port.slice(1)))) {
        return BAD_PORT;
    }
    const fragment = remainder.indexOf('#');
    const parts = fragment === -1 ? [remainder] : [remainder.slice(0, fragment), remainder.slice(fragment + 1)];
    return parts.every(part => URL_CHARACTERS.test(part)) ? null : NOT_ENCODED;
}

function invalidArgument(description: string): HaapiError {
    return makeBridgeError({
        code: HaapiErrorCode.InvalidArgument,
        message: description,
        category: 'bridge',
        recovery: { kind: 'unrecoverable', action: { kind: 'introspectCause' } },
    });
}

/**
 * Throws `HAAPI_INVALID_ARGUMENT` for input no proof can be made for, before any key is looked up. The
 * description names the parameter and the rule, never the value: the URL may carry credentials. The types
 * are checked too: a JavaScript caller isn't held to the signature, and a non-string would otherwise fail
 * later as a plain `TypeError` or a raw bridge error.
 */
export function validateDpopProofInput(accessToken: string, httpMethod: string, url: string, nonce?: string): void {
    if (typeof accessToken !== 'string' || accessToken === '') {
        throw invalidArgument('accessToken must be a non-empty string.');
    }
    if (typeof httpMethod !== 'string' || !METHOD_TOKEN.test(httpMethod)) {
        throw invalidArgument('httpMethod must be an HTTP method token.');
    }
    const problem = typeof url === 'string' ? urlProblem(url) : NOT_ABSOLUTE;
    if (problem !== null) {
        throw invalidArgument(problem);
    }
    if (nonce != null && (typeof nonce !== 'string' || nonce === '')) {
        throw invalidArgument('nonce must be a non-empty string; leave it out instead.');
    }
}
