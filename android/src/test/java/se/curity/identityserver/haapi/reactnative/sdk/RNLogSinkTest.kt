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
package se.curity.identityserver.haapi.reactnative.sdk

import expo.modules.kotlin.modules.Module
import io.mockk.mockk
import io.mockk.verify
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import se.curity.identityserver.haapi.android.driver.HaapiLogger
import se.curity.identityserver.haapi.reactnative.sdk.logging.RNLogSink

class RNLogSinkTest {
    private val logSink = RNLogSink.shared

    @After
    fun tearDown() {
        // RNLogSink.shared is process-wide; reset its binding so each test
        // (and the module-level tests) start from a known, unbound state.
        logSink.detach()
    }

    // region log-level mapping

    @Test
    fun errorLogLevelMapsToError() {
        assertEquals("error", logSink.mapLogLevel(HaapiLogger.LogLevel.ERROR))
    }

    @Test
    fun warnLogLevelMapsToWarning() {
        assertEquals("warning", logSink.mapLogLevel(HaapiLogger.LogLevel.WARN))
    }

    @Test
    fun infoLogLevelMapsToInfo() {
        assertEquals("info", logSink.mapLogLevel(HaapiLogger.LogLevel.INFO))
    }

    @Test
    fun debugLogLevelMapsToDebug() {
        assertEquals("debug", logSink.mapLogLevel(HaapiLogger.LogLevel.DEBUG))
    }

    // endregion

    // region attach / detach lifecycle (HSRN-34 — Rovo review)

    @Test
    fun `writeLog routes to the attached module`() {
        val module = mockk<Module>(relaxed = true)
        logSink.attach(module)

        logSink.writeLog(HaapiLogger.LogLevel.ERROR, "Sender", null, "boom", null)

        verify(exactly = 1) {
            module.sendEvent(
                "onLog",
                match<Map<String, Any?>> {
                    it["level"] == "error" && it["message"] == "boom" && it["tag"] == "Sender"
                },
            )
        }
    }

    @Test
    fun `writeLog after detach is a no-op`() {
        val module = mockk<Module>(relaxed = true)
        logSink.attach(module)
        logSink.detach()

        logSink.writeLog(HaapiLogger.LogLevel.INFO, "Sender", null, "dropped", null)

        verify(exactly = 0) { module.sendEvent(any(), any<Map<String, Any?>>()) }
    }

    @Test
    fun `attach rebinds so only the newest module receives events`() {
        // Models a JS-context reload: the previous module is replaced, not
        // accumulated — so events never duplicate onto a stale module.
        val firstModule = mockk<Module>(relaxed = true)
        val secondModule = mockk<Module>(relaxed = true)
        logSink.attach(firstModule)
        logSink.attach(secondModule)

        logSink.writeLog(HaapiLogger.LogLevel.WARN, "Sender", null, "after reload", null)

        verify(exactly = 1) { secondModule.sendEvent("onLog", any<Map<String, Any?>>()) }
        verify(exactly = 0) { firstModule.sendEvent(any(), any<Map<String, Any?>>()) }
    }

    // endregion
}
