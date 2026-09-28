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
package se.curity.identityserver.haapi.reactnative.sdk.logging

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/**
 * Configuration applied to the native HAAPI logger at construction time
 * of the JavaScript `RNLogger`.
 *
 * Mirrors the TypeScript `RNLoggerConfiguration` interface so the log
 * level and sensitive-value masking flag are forwarded to `HaapiLogger`
 * in a single bridge call.
 */
class RNLoggerConfigurationRecord : Record {
    /** Minimum severity level emitted by the native HAAPI logger. */
    @Field
    var logLevel: RNLogLevel = RNLogLevel.ERROR

    /** When `true`, sensitive values in native HAAPI logs are masked. */
    @Field
    var isSensitiveValueMasked: Boolean = true

    override fun toString(): String =
        "RNLoggerConfigurationRecord(" +
            "logLevel=$logLevel, " +
            "isSensitiveValueMasked=$isSensitiveValueMasked)"
}
