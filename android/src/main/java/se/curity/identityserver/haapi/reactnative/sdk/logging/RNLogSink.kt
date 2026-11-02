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

import expo.modules.kotlin.modules.Module
import se.curity.identityserver.haapi.android.driver.HaapiLogger
import se.curity.identityserver.haapi.android.driver.LogSink
import java.lang.ref.WeakReference

/**
 * Bridges native HAAPI SDK logs to the Expo event system so JavaScript can
 * receive them via the `onLog` event.
 *
 * Process-wide singleton ([shared]) because [HaapiLogger] only exposes
 * [HaapiLogger.appendLogSink] with no public `remove`/`replace` counterpart
 * (the driver's `removeLogSink` is `internal` to that module). The module's
 * `OnCreate` fires on every JS-context reload, so appending a fresh sink each
 * time would grow the global logger's sink list without bound and pin every
 * dead module instance. Keeping a single sink whose active module is rebound
 * via [attach] on each `OnCreate` (and cleared via [detach] on each
 * `OnDestroy`) installs the sink exactly once and never retains a stale
 * module. The module reference is held weakly so even a missed [detach]
 * cannot leak the module.
 */
internal class RNLogSink private constructor() : LogSink {
    @Volatile
    private var moduleRef: WeakReference<Module>? = null

    /**
     * Rebinds the sink to [module] so the current JS context receives log
     * events. Overwrites any previous binding — the prior (now-dead) module's
     * weak reference is dropped without explicit teardown.
     */
    fun attach(module: Module) {
        moduleRef = WeakReference(module)
    }

    /**
     * Clears the active module binding. After this, log events are dropped
     * until the next [attach].
     */
    fun detach() {
        moduleRef = null
    }

    override fun writeLog(
        logLevel: HaapiLogger.LogLevel,
        sender: String?,
        followUpTag: HaapiLogger.FollowUpTag?,
        message: String,
        throwable: Throwable?,
    ) {
        val module = moduleRef?.get() ?: return
        val level = mapLogLevel(logLevel)
        val fullMessage = if (throwable != null) "$message\n${throwable.stackTraceToString()}" else message
        module.sendEvent(
            "onLog",
            mapOf(
                "level" to level,
                "message" to fullMessage,
                "tag" to (sender ?: "HaapiSDK"),
            ),
        )
    }

    internal fun mapLogLevel(logLevel: HaapiLogger.LogLevel): String =
        when (logLevel) {
            HaapiLogger.LogLevel.ERROR -> "error"
            HaapiLogger.LogLevel.WARN -> "warning"
            HaapiLogger.LogLevel.INFO -> "info"
            else -> "debug"
        }

    companion object {
        /** Process-wide sink shared across JS-context reloads. */
        val shared = RNLogSink()
    }
}
