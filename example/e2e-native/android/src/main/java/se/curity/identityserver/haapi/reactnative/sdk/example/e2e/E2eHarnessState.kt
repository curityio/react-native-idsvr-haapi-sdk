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
package se.curity.identityserver.haapi.reactnative.sdk.example.e2e

import android.content.Context

/**
 * The E2E harness's state across app restarts. Only a scenario that spans launches keeps one — the
 * storage move's — and only while it waits for its next launch.
 */
object E2eHarnessState {
    private const val FILE = "e2e_harness_state"
    private const val STATE = "state"

    fun load(context: Context): String? = prefs(context).getString(STATE, null)

    fun save(
        context: Context,
        json: String,
    ) = prefs(context).edit().putString(STATE, json).commit()

    fun clear(context: Context) = prefs(context).edit().remove(STATE).commit()

    /** Whether this launch continues a scenario that an earlier launch started. */
    fun continuesAScenario(context: Context): Boolean = load(context) != null

    private fun prefs(context: Context) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
}
