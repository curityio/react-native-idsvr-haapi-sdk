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
import android.util.Log
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import io.mockk.verify
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import se.curity.identityserver.haapi.reactnative.sdk.RNStorage
import java.security.MessageDigest

/**
 * The storage move the how-to publishes, launch by launch. Each [launch] is one app start: the
 * move runs, then the test plays the native SDK's work on the existing store until the next start
 * — a refresh rotates the sign-in's tracking entries, a new HAAPI session adds a key — exactly as
 * native 5.7.0 names and rewrites them. The default storage and the move's state survive between
 * launches, as their files do across restarts.
 */
class TokenBindingStorageMigrationTest {
    private val previous = ExistingStore(signedIn())
    private val defaultStorage = MemoryStorage()
    private val state = MemoryPreferences()
    private val context =
        mockk<Context> {
            every { getSharedPreferences("token_binding_migration", Context.MODE_PRIVATE) } returns state
        }

    @Test
    fun theFirstLaunchCopiesTheExistingStoreAndKeepsUsingIt() {
        launch()

        assertEquals(previous.entries, sdkEntries(defaultStorage))
        assertFalse(switched())
    }

    @Test
    fun theCanaryIsTheOnlyOtherEntryAndIsNamedOutsideTheSdksOwn() {
        launch()

        // The native SDK reads every entry under these prefixes as its own.
        val others = defaultStorage.entries.keys - previous.entries.keys
        assertEquals(1, others.size)
        assertFalse(others.single().startsWith("HAAPI_KP_"))
        assertFalse(others.single().startsWith("haapi-dpop-"))
    }

    @Test
    fun theNextLaunchSwitchesOnceTheCanaryReadsBack() {
        launch()
        launch()

        assertTrue(switched())
    }

    @Test
    fun theSwitchingLaunchLeavesTheDefaultStorageHoldingWhatTheExistingStoreHoldsThen() {
        launch()
        previous.refreshed(from = 1, to = 2)
        launch()

        assertTrue(switched())
        // The refresh after the first copy is in: rt-2's entries are copied, and the copies of rt-1's,
        // which the refresh removed from the existing store, are gone.
        assertEquals(previous.entries, sdkEntries(defaultStorage))
        assertNull(defaultStorage.get(refreshEntry("rt-1")))
    }

    @Test
    fun theSwitchDeletesNothingItDidNotCopy() {
        // Another manager's sign-in, on the default storage under its own key-store alias.
        val otherSession = "haapi-dpop-other-s-aaaaaaaaaaaaaaaa"
        val another = mapOf(refreshEntry("rt-other") to otherSession, location(otherSession) to "Hardware")
        another.forEach { (name, value) -> defaultStorage.set(value, name) }

        launch()
        previous.refreshed(from = 1, to = 2)
        launch()

        assertTrue(switched())
        another.forEach { (name, value) -> assertEquals(value, defaultStorage.get(name)) }
    }

    @Test
    fun theSwitchHappensAtTheSecondLaunchEvenWhenEveryLaunchStartsANewSession() {
        // An app that starts a HAAPI flow at every launch adds a session key every time, so the store
        // is never the same at two starts.
        launch()
        previous.newSession(SESSION_2)
        previous.refreshed(from = 1, to = 2)
        launch()

        assertTrue(switched())
        assertEquals(previous.entries, sdkEntries(defaultStorage))
    }

    @Test
    fun theExistingStoreIsNeverWritten() {
        launch { Failing(defaultStorage, "set", after = 1) }
        launch()
        previous.refreshed(from = 1, to = 2)
        launch()
        previous.refreshed(from = 2, to = 3)
        launch()

        assertTrue(switched())
        assertEquals(emptyList<String>(), previous.writes)
    }

    @Test
    fun aMissingCanaryKeepsTheExistingStoreAndTheNextLaunchTriesAgain() {
        launch()
        // The default storage lost what it held: its Keystore key was reset since the last launch.
        val reset = MemoryStorage()

        launch { reset }
        assertFalse(switched())

        launch { reset }
        assertTrue(switched())
        assertEquals(previous.entries, sdkEntries(reset))
    }

    @Test
    fun aDefaultStorageThatCannotOpenChangesNothing() {
        launch { throw IllegalStateException("The Keystore key is unusable") }

        assertTrue(defaultStorage.entries.isEmpty())
        assertTrue(state.all.isEmpty())

        // The failed launch prepared nothing: the next one prepares, and only the one after switches.
        launch()
        assertFalse(switched())
        launch()
        assertTrue(switched())
    }

    @Test
    fun anUnreadableCanaryKeepsTheExistingStore() {
        launch()

        launch { Failing(defaultStorage, "get") }
        assertFalse(switched())

        launch()
        assertTrue(switched())
    }

    @Test
    fun launchesThatNeverSwitchKeepNoStaleCopiesNorTheirNames() {
        // The default storage never gives the marker back, so the move never switches, while refreshes
        // keep replacing the sign-in's tracking entries.
        launch { Failing(defaultStorage, "get") }
        for (refresh in 1..3) {
            previous.refreshed(from = refresh, to = refresh + 1)
            launch { Failing(defaultStorage, "get") }
        }

        assertFalse(switched())
        assertEquals(previous.entries, sdkEntries(defaultStorage))
        assertEquals(previous.entries.keys, state.getStringSet("copiedNames", null))
    }

    @Test
    fun anUnreadableExistingStoreChangesNothing() {
        launch()
        val before = state.all

        state.restart()
        TokenBindingStorageMigration.move(Failing(previous, "getAll"), { defaultStorage }, state)

        assertEquals(before, state.all)
        assertFalse(switched())
        launch()
        assertTrue(switched())
    }

    @Test
    fun aCopyCutShortInTheSwitchingLaunchIsCompletedAndCleanedUpAtTheNext() {
        launch()
        previous.refreshed(from = 1, to = 2)
        // Every entry but the last reaches the default storage, rt-2's among them.
        launch { Failing(defaultStorage, "set", after = previous.entries.size - 1) }
        assertFalse(switched())
        assertEquals(SESSION_1, defaultStorage.get(refreshEntry("rt-2")))

        previous.refreshed(from = 2, to = 3)
        launch()

        assertTrue(switched())
        // Including the copies of rt-2's entries the failed launch wrote before the refresh removed them.
        assertEquals(previous.entries, sdkEntries(defaultStorage))
    }

    @Test
    fun aCanaryThatCanNoLongerBeDecryptedIsReplaced() {
        launch()
        // The default storage's Keystore key was replaced: its file is still there, but no entry in it
        // can be decrypted again until it is written anew.
        val afterKeyLoss = UndecryptableUntilRewritten(defaultStorage)

        launch { afterKeyLoss }
        assertFalse(switched())

        launch { afterKeyLoss }
        assertTrue(switched())
        assertEquals(previous.entries, sdkEntries(defaultStorage))
    }

    @Test
    fun aSwitchThatCannotBeSavedKeepsTheExistingStoreInThisProcess() {
        launch()
        // The disk fills up just as the switch is recorded. Android still holds the failed write in memory.
        state.unsavable = setOf("switched")

        launch()
        assertFalse("this process stays on the existing store, as the next one will", switched())

        state.unsavable = emptySet()
        launch()
        assertTrue(switched())
        assertEquals(previous.entries, sdkEntries(defaultStorage))
    }

    @Test
    fun aSwitchThatCannotBeSavedKeepsTheMovesRecordsWhenTheDiskRecoversRightAfter() {
        launch()
        // The disk is full for the switch's write only: the undo that follows reaches it, and saves whatever
        // memory holds then.
        state.unsavableOnce = setOf("switched")
        launch()
        assertFalse(switched())

        // A refresh before the next launch removes rt-1's entries, whose copies the earlier launches wrote.
        previous.refreshed(from = 1, to = 2)
        launch()

        assertEquals(previous.entries, sdkEntries(defaultStorage))
        assertTrue(switched())
    }

    @Test
    fun theSwitchKeepsNoRecordOfWhatItCopiedNorItsMarker() {
        // The names it copied include the digests of the sign-ins' tokens.
        launch()
        previous.refreshed(from = 1, to = 2)
        launch()
        state.restart()

        assertTrue(switched())
        assertEquals(setOf("switched"), state.all.keys)
        assertEquals(previous.entries, defaultStorage.entries)
    }

    @Test
    fun aPostponedMoveNamesTheFailureWithoutQuotingTheStore() {
        mockkStatic(Log::class)
        try {
            every { Log.w(any(), any<String>()) } returns 0
            every { Log.w(any(), any<String>(), any()) } returns 0
            // The app's own store fails with an exception that quotes a value it holds.
            val value = previous.entries.getValue(refreshEntry("rt-1"))
            val quoting =
                object : RNStorage by previous {
                    override fun getAll(): Map<String, String> = throw IllegalStateException("Unreadable value: $value")
                }

            state.restart()
            TokenBindingStorageMigration.move(quoting, { defaultStorage }, state)

            verify {
                Log.w("TokenBindingStorageMigration", match<String> { "IllegalStateException" in it && value !in it })
            }
            verify(exactly = 0) { Log.w(any(), any<String>(), any()) }
        } finally {
            unmockkStatic(Log::class)
        }
    }

    @Test
    fun aStateThatCannotBeSavedCopiesNothing() {
        state.commits = false

        launch()

        assertTrue(defaultStorage.entries.isEmpty())
        assertFalse(switched())
    }

    @Test
    fun afterTheSwitchTheMoveDoesNothing() {
        launch()
        launch()
        val switchedWith = defaultStorage.entries.toMap()
        previous.refreshed(from = 1, to = 2)

        var opened = false
        launch {
            opened = true
            defaultStorage
        }

        assertFalse(opened)
        assertEquals(switchedWith, defaultStorage.entries)
        assertTrue(switched())
    }

    /** One app start, a new process: the move, as `Application.onCreate()` runs it before the SDK starts. */
    private fun launch(openDefaultStorage: () -> RNStorage = { defaultStorage }) {
        state.restart()
        TokenBindingStorageMigration.move(previous, openDefaultStorage, state)
    }

    private fun switched() = TokenBindingStorageMigration.useDefaultStorage(context)

    private open class MemoryStorage(
        initial: Map<String, String> = emptyMap(),
    ) : RNStorage {
        val entries = LinkedHashMap(initial)

        override fun delete(key: String) {
            entries.remove(key)
        }

        override fun get(key: String): String? = entries[key]

        override fun getAll(): Map<String, String> = entries.toMap()

        override fun set(
            value: String,
            key: String,
        ) {
            entries[key] = value
        }
    }

    /** The app's existing store. The tests play the SDK's writes on [entries]; [writes] are the move's. */
    private class ExistingStore(
        initial: Map<String, String>,
    ) : MemoryStorage(initial) {
        val writes = mutableListOf<String>()

        override fun delete(key: String) {
            writes += "delete $key"
            super.delete(key)
        }

        override fun set(
            value: String,
            key: String,
        ) {
            writes += "set $key"
            super.set(value, key)
        }

        /** A refresh, as native 5.7.0 records it: the new tokens' entries in, the old ones' out. */
        fun refreshed(
            from: Int,
            to: Int,
        ) {
            entries[refreshEntry("rt-$to")] = SESSION_1
            entries[accessEntry("at-$to")] = SESSION_1
            entries.remove(accessEntry("at-$from"))
            entries[pointerEntry("rt-$to")] = digest("at-$to")
            entries.remove(refreshEntry("rt-$from"))
            entries.remove(pointerEntry("rt-$from"))
        }

        /** A new HAAPI session: a key under a fresh session alias, which the session pointer names. */
        fun newSession(alias: String) {
            entries[location(alias)] = "Hardware"
            entries[SESSION_POINTER] = alias
        }
    }

    /** [backing], with [operation] failing from its call number [after] + 1 on, as unusable storage does. */
    private class Failing(
        private val backing: RNStorage,
        private val operation: String,
        private val after: Int = 0,
    ) : RNStorage {
        private var calls = 0

        override fun delete(key: String) = attempt("delete") { backing.delete(key) }

        override fun get(key: String): String? = attempt("get") { backing.get(key) }

        override fun getAll(): Map<String, String> = attempt("getAll") { backing.getAll() }

        override fun set(
            value: String,
            key: String,
        ) = attempt("set") { backing.set(value, key) }

        private fun <T> attempt(
            name: String,
            call: () -> T,
        ): T {
            if (name == operation && calls++ >= after) throw IllegalStateException("$name failed")
            return call()
        }
    }

    /**
     * [backing] after its Keystore key was replaced: the entries it holds can't be decrypted, and reading one
     * fails, until it is written again.
     */
    private class UndecryptableUntilRewritten(
        private val backing: RNStorage,
    ) : RNStorage {
        private val undecryptable = backing.getAll().keys.toMutableSet()

        override fun delete(key: String) {
            undecryptable -= key
            backing.delete(key)
        }

        override fun get(key: String): String? {
            if (key in undecryptable) throw IllegalStateException("$key can't be decrypted")
            return backing.get(key)
        }

        override fun getAll(): Map<String, String> = backing.getAll() - undecryptable

        override fun set(
            value: String,
            key: String,
        ) {
            undecryptable -= key
            backing.set(value, key)
        }
    }

    private companion object {
        const val STEM = "haapi-dpop-example"
        const val SESSION_1 = "$STEM-s-0123456789abcdef"
        const val SESSION_2 = "$STEM-s-fedcba9876543210"
        const val SESSION_POINTER = "haapi-dpop-session-$STEM"

        /** What the native SDK holds for one sign-in on a hardware key: rt-1, at-1, bound to [SESSION_1]. */
        fun signedIn(): Map<String, String> =
            linkedMapOf(
                location(SESSION_1) to "Hardware",
                SESSION_POINTER to SESSION_1,
                refreshEntry("rt-1") to SESSION_1,
                accessEntry("at-1") to SESSION_1,
                pointerEntry("rt-1") to digest("at-1"),
            )

        /** The native SDK's entries in [storage], without the move's canary. */
        fun sdkEntries(storage: MemoryStorage): Map<String, String> =
            storage.entries.filterKeys { it.startsWith("HAAPI_KP_") || it.startsWith("haapi-dpop-") }

        fun location(alias: String) = "HAAPI_KP_LOCATION_$alias"

        fun refreshEntry(token: String) = "haapi-dpop-rt-${digest(token)}"

        fun accessEntry(token: String) = "haapi-dpop-at-${digest(token)}"

        fun pointerEntry(refreshToken: String) = "haapi-dpop-ptr-${digest(refreshToken)}"

        /** The lowercase-hex SHA-256 the native SDK names tracking entries after. */
        fun digest(token: String) =
            MessageDigest
                .getInstance("SHA-256")
                .digest(token.toByteArray())
                .joinToString("") { "%02x".format(it) }
    }
}
