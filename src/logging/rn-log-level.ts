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
 * Log severity levels for the unified HAAPI logger.
 *
 * @remarks
 * Maps to native log levels on both platforms:
 * - iOS: `LogType` (debug, info/default, error, fault)
 * - Android: `HaapiLogger.LogLevel` (DEBUG, INFO, WARN, ERROR)
 */
export enum RNLogLevel {
    Debug = "debug",
    Info = "info",
    Warning = "warning",
    Error = "error",
}
