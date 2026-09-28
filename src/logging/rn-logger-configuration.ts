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
 * Configuration applied to the native HAAPI logger when {@link RNLogger}
 * is constructed.
 *
 * @remarks
 * Both fields are forwarded to the native HAAPI logger
 * (`HaapiLogger` on iOS / Android) in a single bridge call so the
 * level and masking flag are always applied atomically.
 */
export interface RNLoggerConfiguration {
    /** Minimum severity level emitted by the native HAAPI logger. */
    readonly logLevel: RNLogLevel;

    /** When `true`, sensitive values in native HAAPI logs are masked. */
    readonly isSensitiveValueMasked: boolean;
}
