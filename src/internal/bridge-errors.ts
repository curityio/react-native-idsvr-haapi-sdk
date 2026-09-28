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

import type { HaapiError, RecoverySuggestion } from '../errors';

/**
 * @internal
 *
 * Builds a TS-side `HaapiError` instance for the synchronous-throw paths
 * inside the JS bridge wrappers (e.g. calling a manager method after
 * `accessor.close()`). The runtime shape mirrors the envelope the native
 * sides produce, so host apps see the same fields regardless of where
 * the error originated.
 *
 * `nativeCause` defaults to `"TSBridge"` so diagnostic tooling can
 * distinguish TS-originated bridge errors from native ones.
 */
export function makeBridgeError(args: {
    code: string;
    message: string;
    recovery: RecoverySuggestion;
    nativeCause?: string;
}): HaapiError {
    const err = new Error(args.message);
    const mutable = err as Error & { [key: string]: unknown };
    mutable.code = args.code;
    mutable.category = 'bridge';
    mutable.errorDescription = args.message;
    mutable.recovery = args.recovery;
    mutable.nativeCause = args.nativeCause ?? 'TSBridge';
    return err as unknown as HaapiError;
}