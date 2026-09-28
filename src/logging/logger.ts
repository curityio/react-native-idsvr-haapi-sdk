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
 * Minimal logger contract that the SDK's manager classes depend on.
 *
 * @remarks
 * Decouples the manager classes from the concrete ``RNLogger`` so that
 * host apps can plug in any logger that satisfies these four methods —
 * Bunyan, Pino, a debug-only adapter, or the SDK's own ``RNLogger``.
 *
 * The factory functions (``initializeForHaapi`` / ``initializeForOAuth``)
 * accept this interface as an optional parameter and substitute the
 * internal no-op when omitted, so the bootstrap path is "construct
 * nothing and get no logs" by default. Callers who want observability
 * pass a configured logger explicitly.
 */
export interface Logger {
    debug(message: string, tag?: string): void;
    info(message: string, tag?: string): void;
    warning(message: string, tag?: string): void;
    error(message: string, tag?: string): void;
}

/**
 * Internal sentinel — a logger that swallows every call.
 *
 * @remarks
 * Used as the factory default when the caller doesn't pass a logger.
 * Holds no native subscriptions, writes nowhere, allocates nothing past
 * the singleton itself. Not exported from the package entry — host apps
 * that want a no-op logger simply omit the optional parameter.
 */
export const NO_OP_LOGGER: Logger = {
    debug() {},
    info() {},
    warning() {},
    error() {},
};
