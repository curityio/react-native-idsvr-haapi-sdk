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

internal class RNModuleLogger(
    private val module: Module,
    private val defaultTag: String = "IdsvrHaapiRN",
) {
    fun debug(
        message: String,
        tag: String = defaultTag,
    ) {
        send(RNLogLevel.DEBUG, message, tag)
    }

    fun info(
        message: String,
        tag: String = defaultTag,
    ) {
        send(RNLogLevel.INFO, message, tag)
    }

    fun warning(
        message: String,
        tag: String = defaultTag,
    ) {
        send(RNLogLevel.WARNING, message, tag)
    }

    fun error(
        message: String,
        tag: String = defaultTag,
    ) {
        send(RNLogLevel.ERROR, message, tag)
    }

    private fun send(
        level: RNLogLevel,
        message: String,
        tag: String,
    ) {
        module.sendEvent(
            "onLog",
            mapOf(
                "level" to level.value,
                "message" to message,
                "tag" to tag,
            ),
        )
    }
}
