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

import type {
    HaapiError,
    HaapiErrorCategory,
    RecoverySuggestion,
    RetryCondition,
    UnrecoverableAction,
} from '../errors';

/**
 * @internal
 *
 * Wire-format helpers that translate the native `HAAPI_ERROR_V1::` envelope
 * into a typed {@link HaapiError}. Lives under `src/internal/` so the
 * symbols are not part of the public package entry — `src/index.ts` does
 * not re-export anything from here, and `public-surface.test.ts`
 * negative-asserts that neither name leaks.
 *
 * Strict validation: `decodeEnvelope` rejects payloads whose `category`,
 * `recovery.kind`, `recovery.condition`, `recovery.action.kind`, `cause`,
 * or `serverError.statusCode` violate the documented shape. Malformed
 * payloads return `null` so the bridge wrapper falls back to re-throwing
 * the raw `Error` unchanged — surfacing native-side bugs immediately
 * instead of papering over them with a partially-typed `HaapiError`.
 */

const ENVELOPE_PREFIX = 'HAAPI_ERROR_V1::';

const KNOWN_CATEGORIES: ReadonlyArray<HaapiErrorCategory> = [
    'networking',
    'attestation',
    'dpop',
    'haapi',
    'configuration',
    'bridge',
    'unexpected',
];

const KNOWN_RECOVERY_KINDS: ReadonlyArray<RecoverySuggestion['kind']> = [
    'retryable',
    'newHaapiFlow',
    'unrecoverable',
];

const KNOWN_RETRY_CONDITIONS: ReadonlyArray<RetryCondition> = ['now', 'whenAppInForeground'];

const KNOWN_UNRECOVERABLE_ACTIONS: ReadonlyArray<UnrecoverableAction['kind']> = [
    'introspectCause',
    'invalidPlatform',
    'modifyConfiguration',
];

function isKnownCategory(value: unknown): value is HaapiErrorCategory {
    return typeof value === 'string' && KNOWN_CATEGORIES.indexOf(value as HaapiErrorCategory) >= 0;
}

function isValidRecovery(value: unknown): boolean {
    if (typeof value !== 'object' || value == null) {
        return false;
    }
    const recovery = value as { kind?: unknown; condition?: unknown; action?: unknown };
    if (typeof recovery.kind !== 'string') {
        return false;
    }
    if (KNOWN_RECOVERY_KINDS.indexOf(recovery.kind as RecoverySuggestion['kind']) < 0) {
        return false;
    }
    if (recovery.kind === 'retryable') {
        return (
            typeof recovery.condition === 'string' &&
            KNOWN_RETRY_CONDITIONS.indexOf(recovery.condition as RetryCondition) >= 0
        );
    }
    if (recovery.kind === 'newHaapiFlow') {
        return true;
    }
    // unrecoverable
    if (typeof recovery.action !== 'object' || recovery.action == null) {
        return false;
    }
    const action = recovery.action as { kind?: unknown; reason?: unknown };
    if (typeof action.kind !== 'string') {
        return false;
    }
    if (KNOWN_UNRECOVERABLE_ACTIONS.indexOf(action.kind as UnrecoverableAction['kind']) < 0) {
        return false;
    }
    if (action.kind === 'modifyConfiguration') {
        return typeof action.reason === 'string';
    }
    return true;
}

function isValidServerError(value: unknown): boolean {
    if (typeof value !== 'object' || value == null) {
        return false;
    }
    const server = value as {
        error?: unknown;
        errorDescription?: unknown;
        statusCode?: unknown;
        errorUri?: unknown;
    };
    if (typeof server.error !== 'string' || typeof server.errorDescription !== 'string') {
        return false;
    }
    if (server.statusCode !== undefined && typeof server.statusCode !== 'number') {
        return false;
    }
    if (server.errorUri !== undefined && typeof server.errorUri !== 'string') {
        return false;
    }
    return true;
}

/**
 * Walk `s` starting at index 0, return the substring of the first balanced
 * `{...}` JSON object (string-aware so braces inside JSON strings don't
 * terminate the object early). Returns `null` if no balanced object is found.
 */
function extractFirstJsonObject(s: string): string | null {
    let depth = 0;
    let inString = false;
    let escape = false;
    let start = -1;
    for (let i = 0; i < s.length; i++) {
        const c = s.charAt(i);
        if (escape) {
            escape = false;
            continue;
        }
        if (inString) {
            if (c === '\\') {
                escape = true;
                continue;
            }
            if (c === '"') {
                inString = false;
            }
            continue;
        }
        if (c === '"') {
            inString = true;
            continue;
        }
        if (c === '{') {
            if (depth === 0) {
                start = i;
            }
            depth++;
        } else if (c === '}') {
            depth--;
            if (depth === 0 && start >= 0) {
                return s.slice(start, i + 1);
            }
        }
    }
    return null;
}

/**
 * @internal
 *
 * Decode the `HAAPI_ERROR_V1::` envelope from a native exception message.
 *
 * The envelope can appear anywhere inside `message`: Expo's bridge wraps
 * native exceptions in its own chain (e.g. "Calling 'initializeForHaapi'
 * has failed\\n→ Caused by: HAAPI_ERROR_V1::{...}"), so a prefix-only
 * match would miss every real error. We locate the prefix with `indexOf`
 * and walk the following text with a brace-balanced parser to isolate
 * the JSON object even when more chain content follows it.
 *
 * Returns `null` when no envelope is found, the JSON is malformed, or
 * the payload fails strict shape validation.
 */
export function decodeEnvelope(message: unknown): Partial<HaapiError> | null {
    if (typeof message !== 'string') {
        return null;
    }
    const idx = message.indexOf(ENVELOPE_PREFIX);
    if (idx < 0) {
        return null;
    }
    const jsonStr = extractFirstJsonObject(message.slice(idx + ENVELOPE_PREFIX.length));
    if (jsonStr == null) {
        return null;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonStr);
    } catch {
        return null;
    }
    if (typeof parsed !== 'object' || parsed == null) {
        return null;
    }
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.code !== 'string') {
        return null;
    }
    if (!isKnownCategory(candidate.category)) {
        return null;
    }
    if (candidate.errorDescription !== undefined && typeof candidate.errorDescription !== 'string') {
        return null;
    }
    if (candidate.failureReason !== undefined && typeof candidate.failureReason !== 'string') {
        return null;
    }
    if (candidate.cause !== undefined && typeof candidate.cause !== 'string') {
        return null;
    }
    if (candidate.nativeCause !== undefined && typeof candidate.nativeCause !== 'string') {
        return null;
    }
    if (candidate.recovery !== undefined && !isValidRecovery(candidate.recovery)) {
        return null;
    }
    if (candidate.serverError !== undefined && !isValidServerError(candidate.serverError)) {
        return null;
    }
    return candidate as Partial<HaapiError>;
}

/**
 * @internal
 *
 * Re-throw unknown/native errors as a typed {@link HaapiError} when an
 * envelope is present and valid; otherwise re-throw the original error
 * unchanged. Mutates the original `Error` in place so the stack trace
 * survives the conversion (the JS error semantics treat a thrown value
 * as opaque — losing the stack would make production support harder).
 */
export function rethrowAsHaapiError(error: unknown): never {
    if (!(error instanceof Error)) {
        throw error;
    }
    const decoded = decodeEnvelope(error.message);
    if (!decoded) {
        throw error;
    }
    const readableMessage = decoded.errorDescription ?? decoded.failureReason ?? error.message;
    const target = error as Error & { [key: string]: unknown };
    for (const key of Object.keys(decoded)) {
        target[key] = decoded[key as keyof HaapiError];
    }
    target.message = readableMessage;
    throw target as unknown as HaapiError;
}
