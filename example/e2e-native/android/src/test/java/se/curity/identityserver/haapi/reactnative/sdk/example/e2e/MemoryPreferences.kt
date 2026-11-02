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

import android.content.SharedPreferences

/**
 * Plain preferences in memory, behaving as Android's do: an edit applies only when committed, a commit
 * applies to memory first and then writes to disk, and a commit whose write fails still holds in memory
 * for the rest of the process. [restart] is a new process: it keeps what reached the disk, and nothing else.
 *
 * Writes can be made to fail, as a full disk makes them: all of them ([commits]), the ones that change a
 * given key ([unsavable]), or only the next one that does ([unsavableOnce]), after which the disk has room again.
 */
class MemoryPreferences : SharedPreferences {
    private val values = mutableMapOf<String, Any?>()
    private var saved = mapOf<String, Any?>()
    var commits = true
    var unsavable = emptySet<String>()
    var unsavableOnce = emptySet<String>()

    /** A new process: memory holds what reached the disk. */
    fun restart() {
        values.clear()
        values += saved
    }

    override fun getAll(): Map<String, *> = values.toMap()

    override fun getString(
        key: String,
        defValue: String?,
    ): String? = values[key] as String? ?: defValue

    @Suppress("UNCHECKED_CAST")
    override fun getStringSet(
        key: String,
        defValues: Set<String>?,
    ): Set<String>? = values[key] as Set<String>? ?: defValues

    override fun getInt(
        key: String,
        defValue: Int,
    ): Int = values[key] as Int? ?: defValue

    override fun getLong(
        key: String,
        defValue: Long,
    ): Long = values[key] as Long? ?: defValue

    override fun getFloat(
        key: String,
        defValue: Float,
    ): Float = values[key] as Float? ?: defValue

    override fun getBoolean(
        key: String,
        defValue: Boolean,
    ): Boolean = values[key] as Boolean? ?: defValue

    override fun contains(key: String): Boolean = key in values

    override fun edit(): SharedPreferences.Editor = Editor()

    override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) =
        Unit

    override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) =
        Unit

    private inner class Editor : SharedPreferences.Editor {
        private val changes = mutableMapOf<String, Any?>()
        private val removals = mutableSetOf<String>()
        private var clear = false

        override fun putString(
            key: String,
            value: String?,
        ) = put(key, value)

        override fun putStringSet(
            key: String,
            values: Set<String>?,
        ) = put(key, values?.toSet())

        override fun putInt(
            key: String,
            value: Int,
        ) = put(key, value)

        override fun putLong(
            key: String,
            value: Long,
        ) = put(key, value)

        override fun putFloat(
            key: String,
            value: Float,
        ) = put(key, value)

        override fun putBoolean(
            key: String,
            value: Boolean,
        ) = put(key, value)

        override fun remove(key: String) = apply { removals += key }

        override fun clear() = apply { clear = true }

        override fun commit(): Boolean {
            if (clear) values.clear()
            values -= removals
            values += changes
            val keys = changes.keys + removals
            val failsOnce = keys.any { it in unsavableOnce }
            if (failsOnce) unsavableOnce = emptySet()
            val written = commits && !failsOnce && keys.none { it in unsavable }
            if (written) saved = values.toMap()
            return written
        }

        override fun apply() {
            commit()
        }

        private fun put(
            key: String,
            value: Any?,
        ) = apply { changes[key] = value }
    }
}
