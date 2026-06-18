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

/**
 * Coarse error category used when callers cannot branch on a specific code.
 *
 * @remarks
 * Categories are normalized across iOS/Android. Fallback paths may still vary
 * in precision per platform, but category semantics remain stable.
 */
export type HaapiErrorCategory =
    | 'networking'
    | 'attestation'
    | 'dpop'
    | 'haapi'
    | 'configuration'
    | 'bridge'
    | 'unexpected';

/**
 * Retry timing hint for `recovery.kind === "retryable"`.
 */
export type RetryCondition = 'now' | 'whenAppInForeground';

/**
 * Action payload for `recovery.kind === "unrecoverable"`.
 */
export type UnrecoverableAction =
    | { kind: 'introspectCause' }
    | { kind: 'invalidPlatform' }
    | { kind: 'modifyConfiguration'; reason: string };

/**
 * Recovery recommendation surfaced from native SDK semantics.
 *
 * @remarks
 * `newHaapiFlow` is iOS-specific. Android typically emits retryable or
 * unrecoverable actions.
 */
export type RecoverySuggestion =
    | { kind: 'retryable'; condition: RetryCondition }
    | { kind: 'newHaapiFlow' }
    | { kind: 'unrecoverable'; action: UnrecoverableAction };

/**
 * Server-side OAuth/HAAPI error details surfaced on `HAAPI_SERVER_ERROR`.
 *
 * @remarks
 * `statusCode` is guaranteed on iOS server-error paths and opportunistic on
 * Android depending on source exception shape.
 */
export interface HaapiServerErrorInfo {
    readonly error: string;
    readonly errorDescription: string;
    readonly statusCode?: number;
    readonly errorUri?: string;
}

/**
 * Normalized error shape rethrown to JS callers.
 *
 * @remarks
 * Branch application logic on `code` (or `category` as fallback), not
 * `message` and not `nativeCause`.
 *
 * @example
 * ```ts
 * try {
 *   await accessor.haapiManager.start();
 * } catch (e) {
 *   if (isHaapiError(e) && e.code === HaapiErrorCode.AccessorNotInitialized) {
 *     // initialize first
 *   }
 * }
 * ```
 */
export interface HaapiError extends Error {
    readonly code: string;
    readonly category: HaapiErrorCategory;
    readonly errorDescription?: string;
    readonly failureReason?: string;
    readonly recovery?: RecoverySuggestion;
    readonly serverError?: HaapiServerErrorInfo;
    readonly cause?: string;
    readonly nativeCause?: string;
}

/**
 * Stable error-code constants for all normalized bridge errors.
 *
 * @remarks
 * `DpopNonceRequired` is Android-only and appears when the Android SDK emits
 * nonce retry exceptions.
 *
 * `FlowCacheMiss` fires when the bridge cannot resolve a submitted
 * `FormAction` / `Link` back to a native model. Since HSRN-33 the bridge
 * caches models for the full flow lifetime: problem and continuation
 * (`continueSame` / `polling`) responses no longer evict the prior step's
 * actions/links, and only `start()` or a `followLink` to a *new-step*
 * representation resets the cache. The typical remaining cause for this
 * error is host code reusing a `FormAction` / `Link` reference across
 * `close()` + re-init, or after a `followLink` to a new-step
 * representation has reset the cache.
 *
 * @example
 * ```ts
 * if (isHaapiError(err) && err.code === HaapiErrorCode.ServerError) {
 *   // inspect err.serverError
 * }
 *
 * if (isHaapiError(err) && err.code === HaapiErrorCode.Communication) {
 *   // retry path
 * }
 * ```
 */
export const HaapiErrorCode = {
    AccessorAlreadyInitialized: 'HAAPI_ACCESSOR_ALREADY_INITIALIZED',
    AccessorNotInitialized: 'HAAPI_ACCESSOR_NOT_INITIALIZED',
    AccessorWrongKind: 'HAAPI_ACCESSOR_WRONG_KIND',
    FlowCacheMiss: 'HAAPI_FLOW_CACHE_MISS',
    Communication: 'HAAPI_COMMUNICATION',
    ServerError: 'HAAPI_SERVER_ERROR',
    InvalidUrlResponse: 'HAAPI_INVALID_URL_RESPONSE',
    InvalidStatusCode: 'HAAPI_INVALID_STATUS_CODE',
    UnsupportedContentType: 'HAAPI_UNSUPPORTED_CONTENT_TYPE',
    NoResponseData: 'HAAPI_NO_RESPONSE_DATA',
    AttestationNotSupported: 'HAAPI_ATTESTATION_NOT_SUPPORTED',
    AttestationFailure: 'HAAPI_ATTESTATION_FAILURE',
    AttestationKeyGenFailure: 'HAAPI_ATTESTATION_KEY_GEN_FAILURE',
    AttestationRefusedByServer: 'HAAPI_ATTESTATION_REFUSED_BY_SERVER',
    AssertionFailure: 'HAAPI_ASSERTION_FAILURE',
    DpopKeyCreationFailure: 'HAAPI_DPOP_KEY_CREATION_FAILURE',
    DpopProofCreationFailure: 'HAAPI_DPOP_PROOF_CREATION_FAILURE',
    DpopProofFailure: 'HAAPI_DPOP_PROOF_FAILURE',
    DpopNonceRequired: 'HAAPI_DPOP_NONCE_REQUIRED',
    TokenManagerClosed: 'HAAPI_TOKEN_MANAGER_CLOSED',
    TokenManagerExpired: 'HAAPI_TOKEN_MANAGER_EXPIRED',
    TokenManagerAlreadyExists: 'HAAPI_TOKEN_MANAGER_ALREADY_EXISTS',
    IllegalState: 'HAAPI_ILLEGAL_STATE',
    InvalidModel: 'HAAPI_INVALID_MODEL',
    InvalidConfiguration: 'HAAPI_INVALID_CONFIGURATION',
    Unexpected: 'HAAPI_UNEXPECTED',
} as const;

/**
 * Runtime union of all stable error-code values.
 */
export type HaapiErrorCode = typeof HaapiErrorCode[keyof typeof HaapiErrorCode];

const HAAPI_ERROR_CATEGORIES: ReadonlyArray<HaapiErrorCategory> = [
    'networking',
    'attestation',
    'dpop',
    'haapi',
    'configuration',
    'bridge',
    'unexpected',
];

function isKnownCategory(value: string): value is HaapiErrorCategory {
    return HAAPI_ERROR_CATEGORIES.indexOf(value as HaapiErrorCategory) >= 0;
}

/**
 * Type guard for normalized `HaapiError` payloads.
 */
export function isHaapiError(value: unknown): value is HaapiError {
    if (typeof value !== 'object' || value == null) {
        return false;
    }
    const candidate = value as Partial<HaapiError>;
    return (
        typeof candidate.code === 'string' &&
        typeof candidate.category === 'string' &&
        isKnownCategory(candidate.category)
    );
}
