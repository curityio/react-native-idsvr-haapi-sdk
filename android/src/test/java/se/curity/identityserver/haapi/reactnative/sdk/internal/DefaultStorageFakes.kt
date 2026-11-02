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
package se.curity.identityserver.haapi.reactnative.sdk.internal

import android.content.SharedPreferences
import android.os.Parcel
import se.curity.identityserver.haapi.android.driver.Storage

// Test doubles for the default-storage migration. The encrypted store needs AndroidKeyStore,
// which the JVM doesn't have, so these stand in for the two stores. Both write every mutation
// to a shared [journal] so tests can assert ordering across stores (e.g. no plaintext erase
// before every encrypted write).

/** How [InMemorySharedPreferences]'s `commit()` behaves. */
internal enum class CommitBehaviour { SUCCEEDS, RETURNS_FALSE, THROWS }

/**
 * An in-memory [SharedPreferences] with real editor semantics: edits are invisible until
 * `commit()` / `apply()`, and a failed `commit()` leaves the contents untouched.
 */
internal class InMemorySharedPreferences(
    private val journal: MutableList<String> = mutableListOf(),
) : SharedPreferences {
    private val contents = linkedMapOf<String, Any?>()

    var commitBehaviour = CommitBehaviour.SUCCEEDS

    /** Number of edits that reached the store, by `commit()` or `apply()`. */
    var persistedEdits = 0
        private set

    /** Puts entries directly, as a previous SDK version would have left them on disk. */
    fun seed(entries: Map<String, Any?>) {
        contents.putAll(entries)
    }

    override fun getAll(): Map<String, *> = LinkedHashMap(contents)

    override fun getString(
        key: String,
        defValue: String?,
    ): String? = contents[key] as? String ?: defValue

    @Suppress("UNCHECKED_CAST")
    override fun getStringSet(
        key: String,
        defValues: Set<String>?,
    ): Set<String>? = contents[key] as? Set<String> ?: defValues

    override fun getInt(
        key: String,
        defValue: Int,
    ): Int = contents[key] as? Int ?: defValue

    override fun getLong(
        key: String,
        defValue: Long,
    ): Long = contents[key] as? Long ?: defValue

    override fun getFloat(
        key: String,
        defValue: Float,
    ): Float = contents[key] as? Float ?: defValue

    override fun getBoolean(
        key: String,
        defValue: Boolean,
    ): Boolean = contents[key] as? Boolean ?: defValue

    override fun contains(key: String): Boolean = contents.containsKey(key)

    override fun edit(): SharedPreferences.Editor = Editor()

    override fun registerOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener,
    ) = Unit

    override fun unregisterOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener,
    ) = Unit

    private inner class Editor : SharedPreferences.Editor {
        private val puts = linkedMapOf<String, Any?>()
        private val removals = linkedSetOf<String>()
        private var clearAll = false

        override fun putString(
            key: String,
            value: String?,
        ) = apply { puts[key] = value }

        override fun putStringSet(
            key: String,
            values: Set<String>?,
        ) = apply { puts[key] = values }

        override fun putInt(
            key: String,
            value: Int,
        ) = apply { puts[key] = value }

        override fun putLong(
            key: String,
            value: Long,
        ) = apply { puts[key] = value }

        override fun putFloat(
            key: String,
            value: Float,
        ) = apply { puts[key] = value }

        override fun putBoolean(
            key: String,
            value: Boolean,
        ) = apply { puts[key] = value }

        override fun remove(key: String) = apply { removals += key }

        override fun clear() = apply { clearAll = true }

        override fun commit(): Boolean =
            when (commitBehaviour) {
                CommitBehaviour.SUCCEEDS -> {
                    persist("commit")
                    true
                }

                CommitBehaviour.RETURNS_FALSE -> {
                    false
                }

                CommitBehaviour.THROWS -> {
                    throw IllegalStateException("disk full")
                }
            }

        override fun apply() = persist("apply")

        private fun persist(how: String) {
            if (clearAll) contents.clear()
            removals.forEach { contents.remove(it) }
            puts.forEach { (key, value) -> if (value == null) contents.remove(key) else contents[key] = value }
            persistedEdits++
            journal += "plaintext.$how(put=${puts.keys}, remove=$removals)"
        }
    }
}

/**
 * An in-memory stand-in for the native encrypted [Storage], with failure injection. Survives
 * "restarts" the way the real store's file does: tests reuse one instance across constructions.
 */
internal class InMemoryStorage(
    private val journal: MutableList<String> = mutableListOf(),
) : Storage {
    val contents = linkedMapOf<String, String>()
    val setCalls = mutableListOf<String>()
    val deleteCalls = mutableListOf<String>()

    /** 1-based `set` call number that throws, counted across the instance's lifetime. */
    var failSetOnCall: Int? = null

    /** Exception thrown by `get` for any key in [getFailures]. */
    val getFailures = mutableMapOf<String, Exception>()

    /** Exception thrown by every `delete`, when set. */
    var deleteFailure: Exception? = null

    override fun set(
        value: String,
        key: String,
    ) {
        setCalls += key
        if (setCalls.size == failSetOnCall) throw IllegalStateException("Keystore operation failed")
        contents[key] = value
        journal += "encrypted.set($key)"
    }

    override fun get(key: String): String? {
        getFailures[key]?.let { throw it }
        return contents[key]
    }

    override fun delete(key: String) {
        deleteCalls += key
        deleteFailure?.let { throw it }
        contents.remove(key)
        journal += "encrypted.delete($key)"
    }

    override fun getAll(): Map<String, String> = LinkedHashMap(contents)

    override fun describeContents(): Int = 0

    override fun writeToParcel(
        dest: Parcel,
        flags: Int,
    ) = Unit
}

/**
 * The "build the encrypted store" factory. Returns the same [store] on every call (the real
 * store is backed by one file), or throws [failure] when set, as a broken Keystore would.
 */
internal class EncryptedStoreFactory(
    val store: InMemoryStorage,
) : () -> Storage {
    var failure: Exception? = null
    var builds = 0
        private set

    override fun invoke(): Storage {
        builds++
        failure?.let { throw it }
        return store
    }
}

/** Captures what the default storage logs. */
internal class RecordingLog {
    val warnings = mutableListOf<String>()
    val infos = mutableListOf<String>()

    val warn: (String) -> Unit = { warnings += it }
    val info: (String) -> Unit = { infos += it }
}
