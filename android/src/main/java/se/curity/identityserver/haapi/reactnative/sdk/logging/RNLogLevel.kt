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

import expo.modules.kotlin.types.Enumerable
import se.curity.identityserver.haapi.android.driver.HaapiLogger

enum class RNLogLevel(
    val value: String,
) : Enumerable {
    DEBUG("debug"),
    INFO("info"),
    WARNING("warning"),
    ERROR("error"),
    ;

    /** Converts this level to the native [HaapiLogger.LogLevel]. */
    fun toHaapiLogLevel(): HaapiLogger.LogLevel =
        when (this) {
            DEBUG -> HaapiLogger.LogLevel.DEBUG
            INFO -> HaapiLogger.LogLevel.INFO
            WARNING -> HaapiLogger.LogLevel.WARN
            ERROR -> HaapiLogger.LogLevel.ERROR
        }
}
