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

// The storage move from the how-to "Migrate an Android app to React Native", as published: the E2E
// lane runs this object, and its JVM tests (src/test) hold it to what the how-to promises.

import android.app.ActivityManager
import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.Process
import android.util.Log
import se.curity.identityserver.haapi.android.driver.StorageBuilder
import se.curity.identityserver.haapi.reactnative.sdk.RNStorage
import java.util.UUID

/**
 * Moves the app's token-binding store into the SDK's default storage without ending a sign-in.
 *
 * Until the switch, every launch copies the whole existing store into the default storage, removes
 * the copies of entries the existing store no longer holds, and leaves a marker there. The first
 * launch that finds an earlier launch's marker knows the default storage survives a restart; it
 * copies again and switches. That launch's copy is taken before the SDK starts, so it holds every
 * key and sign-in record the SDK needs. The existing store is never written to.
 */
object TokenBindingStorageMigration {
    private const val STATE_FILE = "token_binding_migration"
    private const val COPIED_NAMES = "copiedNames"
    private const val CANARY_VALUE = "canaryValue"
    private const val SWITCHED = "switched"

    /** The marker's name in the default storage: outside the SDK's own (`HAAPI_KP_*`, `haapi-dpop-*`). */
    private const val CANARY = "token_binding_migration_canary"

    /** The process the move last ran in. */
    @Volatile private var ranInProcess: Int? = null

    /**
     * Call from `Application.onCreate()`, before React Native loads. Every process of the app runs it, but
     * the move runs only in the main process, and once: a copy taken in another process would miss what the
     * main process does after it.
     */
    fun run(
        context: Context,
        previous: RNStorage,
    ) {
        val pid = Process.myPid()
        if (ranInProcess == pid || !isMainProcess(context, pid)) return
        ranInProcess = pid
        move(previous, { NativeStorageAdapter(StorageBuilder.encrypted(context)) }, state(context))
    }

    /** For the app's `Resolver<RNStorage>`: whether the SDK uses its default storage. */
    fun useDefaultStorage(context: Context): Boolean = state(context).getBoolean(SWITCHED, false)

    /** The move, over the existing store, the default storage and the move's own state. */
    internal fun move(
        previous: RNStorage,
        openDefaultStorage: () -> RNStorage,
        state: SharedPreferences,
    ) {
        if (state.getBoolean(SWITCHED, false)) return
        try {
            val storage = openDefaultStorage()
            // Read before this launch writes anything: only a marker an earlier process left proves a restart.
            val canary = state.getString(CANARY_VALUE, null)
            // A marker that can't be read back counts as missing, and preparing again replaces it.
            val marker =
                try {
                    storage.get(CANARY)
                } catch (e: Exception) {
                    null
                }
            val survivedRestart = canary != null && marker == canary
            val entries = previous.getAll()
            // On record before the copy, so that the copies of a copy cut short are cleaned up as well.
            val copied = state.getStringSet(COPIED_NAMES, null).orEmpty() + entries.keys
            if (!state.edit().putStringSet(COPIED_NAMES, copied).commit()) return
            entries.forEach { (name, value) -> storage.set(value, name) }
            // Copies of entries the existing store has since dropped, such as a rotated refresh token's
            // records. Only names this move copied are ever deleted.
            (copied - entries.keys).forEach(storage::delete)
            if (survivedRestart) {
                // The names it copied include the digests of the sign-ins' tokens: switching drops them, and
                // the marker with them.
                if (state.edit().putBoolean(SWITCHED, true).remove(COPIED_NAMES).remove(CANARY_VALUE).commit()) {
                    storage.delete(CANARY)
                } else {
                    // Android keeps a write that failed to reach the disk in memory, and its next write saves
                    // memory whole. Undo all of it, so that this process stays on the existing store, as the
                    // next one will, and the next launch still knows what was copied.
                    state
                        .edit()
                        .remove(SWITCHED)
                        .putStringSet(COPIED_NAMES, copied)
                        .putString(CANARY_VALUE, canary)
                        .apply()
                }
            } else {
                val newMarker = UUID.randomUUID().toString()
                storage.set(newMarker, CANARY)
                // Only this launch's copies are left, so the record stays as small as the existing store.
                state
                    .edit()
                    .putStringSet(COPIED_NAMES, entries.keys)
                    .putString(CANARY_VALUE, newMarker)
                    .commit()
            }
        } catch (e: Exception) {
            // The default storage can't be opened, or a store failed: the app keeps the existing store,
            // and the next launch tries again. Only the failure's class is logged: a store's exception can
            // quote what the store holds.
            Log.w(
                "TokenBindingStorageMigration",
                "Storage move postponed to the next launch (${e.javaClass.simpleName})",
            )
        }
    }

    private fun isMainProcess(
        context: Context,
        pid: Int,
    ): Boolean {
        val name =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                Application.getProcessName()
            } else {
                (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager)
                    .runningAppProcesses
                    ?.firstOrNull { it.pid == pid }
                    ?.processName
            }
        return name == context.applicationInfo.processName
    }

    private fun state(context: Context): SharedPreferences = context.getSharedPreferences(STATE_FILE, Context.MODE_PRIVATE)
}
