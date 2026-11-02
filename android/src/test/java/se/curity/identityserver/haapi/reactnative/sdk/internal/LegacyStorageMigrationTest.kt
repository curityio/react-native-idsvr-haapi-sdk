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

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * With token binding off the SDK never opens its default storage for binding, so the plaintext
 * leftovers of earlier bound-by-default versions would stay on disk. The migration moves them into
 * the encrypted store without ever failing initialization or deleting anything.
 */
class LegacyStorageMigrationTest {
    private val plaintext = InMemorySharedPreferences()
    private val encrypted = InMemoryStorage()
    private val encryptedFactory = EncryptedStoreFactory(encrypted)
    private val log = RecordingLog()
    private var opens = 0

    /** Opens the default storage the way the SDK's own resolver does. */
    private val openDefaultStore: () -> Unit = {
        opens++
        openDefaultStorage(plaintext, encryptedFactory, { encrypted.contents.keys.toSet() }, log.warn, log.info)
    }

    private val leftoverKey = softwareKeyName("haapi_token_bound_key")

    private fun textEntries(): Map<String, Any?> = plaintext.all.filterValues { it is String }

    @Test
    fun plaintextLeftoversAreMovedIntoTheEncryptedStore() {
        val keyPair = storedSoftwareKeyPair()
        plaintext.edit().putString(leftoverKey, keyPair).commit()

        migrateLegacyDefaultStorage(plaintext, openDefaultStore, log.warn)

        assertEquals(keyPair, encrypted.contents[leftoverKey])
        assertEquals(emptyMap<String, Any?>(), textEntries())
    }

    // Keystore unavailable: init must not fail, nothing is lost, the retry budget of the bound path is
    // untouched, and the next start moves the entries.
    @Test
    fun anUnavailableEncryptedStoreKeepsTheLeftoversForTheNextStart() {
        val keyPair = storedSoftwareKeyPair()
        plaintext.edit().putString(leftoverKey, keyPair).commit()
        encryptedFactory.failure = IllegalStateException("Keystore unavailable")

        migrateLegacyDefaultStorage(plaintext, openDefaultStore, log.warn)

        assertEquals(keyPair, textEntries()[leftoverKey])
        assertFalse(plaintext.contains(UNAVAILABLE_OPENS_KEY))

        encryptedFactory.failure = null
        migrateLegacyDefaultStorage(plaintext, openDefaultStore, log.warn)

        assertEquals(keyPair, encrypted.contents[leftoverKey])
        assertEquals(emptyMap<String, Any?>(), textEntries())
    }

    @Test
    fun aFailingOpenIsLoggedAndNeverThrown() {
        plaintext.edit().putString(leftoverKey, storedSoftwareKeyPair()).commit()

        migrateLegacyDefaultStorage(plaintext, { throw IllegalStateException("boom") }, log.warn)

        assertTrue(log.warnings.any { it.contains("IllegalStateException") })
        assertFalse("never echoes stored values", log.warnings.any { it.contains(leftoverKey) })
    }

    // Nothing to move: the encrypted store (and its Keystore key) is never touched.
    @Test
    fun noLeftoversMeansTheEncryptedStoreIsNeverOpened() {
        migrateLegacyDefaultStorage(plaintext, openDefaultStore, log.warn)

        assertEquals(0, opens)
        assertEquals(0, encryptedFactory.builds)
    }

    @Test
    fun onlyBookkeepingEntriesCountAsNoLeftovers() {
        plaintext.edit().putInt(UNAVAILABLE_OPENS_KEY, 1).commit()

        migrateLegacyDefaultStorage(plaintext, openDefaultStore, log.warn)

        assertEquals(0, opens)
    }
}
