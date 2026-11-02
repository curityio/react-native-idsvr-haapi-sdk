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

import type { RNLogLevel } from "./rn-log-level";

/**
 * A log event emitted by the native HAAPI module or by TypeScript code.
 */
export interface RNLogEvent {
    /** The severity level. */
    readonly level: RNLogLevel;
    /** The log message. */
    readonly message: string;
    /** Optional source identifier (e.g., class name, module area). */
    readonly tag?: string;
}
