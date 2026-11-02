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
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import se.curity.identityserver.haapi.reactnative.sdk.RNStorage
import se.curity.identityserver.haapi.reactnative.sdk.configurations.StorageOption
import se.curity.identityserver.haapi.reactnative.sdk.toStorage

/**
 * The default Android storage: values encrypted at rest, with every entry an earlier SDK
 * version left in the plaintext store moved across when the storage is opened. The two
 * stores are in-memory fakes that persist across "restarts" the way their files do, so a
 * second [open] over the same fakes is the next process start.
 */
class DefaultStorageTest {
    private val journal = mutableListOf<String>()
    private val plaintext = InMemorySharedPreferences(journal)
    private val encrypted = InMemoryStorage(journal)
    private val encryptedFactory = EncryptedStoreFactory(encrypted)
    private val log = RecordingLog()

    /** What the encrypted store's file shows without the Keystore: the names of its entries. */
    private val encryptedEntryNames = { encrypted.contents.keys.toSet() }

    private fun open(): RNStorage =
        openDefaultStorage(plaintext, encryptedFactory, encryptedEntryNames, log.warn, log.info)

    /** The plaintext store's values; its non-text bookkeeping entries are not values. */
    private fun InMemorySharedPreferences.textEntries(): Map<String, Any?> = all.filterValues { it is String }

    // region US1 — stored values are encrypted at rest

    @Test
    fun freshInstallKeepsWrittenValuesInTheEncryptedStoreOnly() {
        val key = softwareKeyName("haapi_token_bound_key")
        val value = storedSoftwareKeyPair()
        val storage = open()

        storage.set(value, key)

        assertEquals("read-back", value, storage.get(key))
        assertEquals("listing", mapOf(key to value), storage.getAll())
        assertEquals("encrypted store contents", mapOf(key to value), encrypted.contents)
        assertTrue("plaintext store stays empty", plaintext.textEntries().isEmpty())
        assertTrue("plaintext store holds no values", plaintext.textEntries().isEmpty())
    }

    @Test
    fun deletedValuesAreGoneAndStayGoneAfterARestart() {
        val first = softwareKeyName("first")
        val second = softwareKeyName("second")
        val storage = open()
        storage.set(storedSoftwareKeyPair(), first)
        storage.set(storedSoftwareKeyPair(), second)

        storage.delete(first)

        assertNull("deleted key reads back empty", storage.get(first))
        assertEquals("listing keeps the other key", setOf(second), storage.getAll().keys)
        assertEquals("after restart", setOf(second), open().getAll().keys)
    }

    @Test
    fun nativeBulkDeleteThroughTheBridgeLeavesNothingBehind() {
        val storage = open()
        storage.set(storedSoftwareKeyPair(), softwareKeyName("first"))
        storage.set(storedSoftwareKeyPair(), softwareKeyName("second"))
        val native = storage.toStorage()

        // The pattern the native SDK uses to remove every software key: list, then delete each.
        native
            .getAll()
            .keys
            .filter { it.startsWith(SOFTWARE_KEY_PREFIX) }
            .forEach(native::delete)

        assertTrue("nothing listed", storage.getAll().isEmpty())
        assertTrue("nothing reappears after restart", open().getAll().isEmpty())
        assertTrue("plaintext store stays empty", plaintext.textEntries().isEmpty())
    }

    @Test
    fun resolverServesTheDefaultStorageOnlyForTheDefaultOption() {
        val storage = open()
        val resolver = StorageResolver { storage }

        assertSame("default option", storage, resolver.resolve(StorageOption.DEFAULT.value))
        assertNull("custom option is left to host-registered resolvers", resolver.resolve(StorageOption.CUSTOM.value))
        assertNull("unknown option", resolver.resolve("unknown"))
    }

    // endregion

    // region US2 — existing values move into the encrypted store when the storage opens

    @Test
    fun upgradeMovesEveryPlaintextEntryIntoTheEncryptedStore() {
        val previousVersion = previousVersionEntries()
        plaintext.seed(previousVersion)

        val storage = open()

        previousVersion.forEach { (key, value) -> assertEquals("read-back of $key", value, storage.get(key)) }
        assertEquals("listing", previousVersion, storage.getAll())
        assertEquals("encrypted store contents", previousVersion, encrypted.contents)
        assertTrue("plaintext store emptied", plaintext.textEntries().isEmpty())
    }

    @Test
    fun upgradeErasesPlaintextOnlyAfterEveryEntryIsInTheEncryptedStore() {
        val previousVersion = previousVersionEntries()
        plaintext.seed(previousVersion)

        open()

        val writes = previousVersion.keys.map { "encrypted.set($it)" }
        val erased = (previousVersion.keys + UNAVAILABLE_OPENS_KEY).joinToString(prefix = "[", postfix = "]")
        val erase = "plaintext.commit(put=[], remove=$erased)"
        assertEquals("every encrypted write, then one committed erase", writes + erase, journal)
    }

    @Test
    fun upgradeLogsHowManyEntriesMovedAndNothingElse() {
        val previousVersion = previousVersionEntries()
        plaintext.seed(previousVersion)

        open()

        assertEquals(listOf("Moved 3 stored entries into encrypted storage."), log.infos)
        assertTrue("no warnings", log.warnings.isEmpty())
    }

    @Test
    fun migratedKeyPairsAreStillUsable() {
        val key = softwareKeyName("haapi_token_bound_key")
        plaintext.seed(mapOf(key to storedSoftwareKeyPair()))

        val storage = open()

        assertTrue("migrated key pair signs and verifies", isUsableKeyPair(storage.get(key)!!))
    }

    @Test
    fun reopeningAfterAMigrationCopiesAndErasesNothing() {
        val previousVersion = previousVersionEntries()
        plaintext.seed(previousVersion)
        open()
        val writesAfterMigration = encrypted.setCalls.size
        val plaintextEditsAfterMigration = plaintext.persistedEdits

        val reopened = open()

        assertEquals("no further encrypted writes", writesAfterMigration, encrypted.setCalls.size)
        assertEquals("no further plaintext edits", plaintextEditsAfterMigration, plaintext.persistedEdits)
        assertEquals("values unchanged", previousVersion, reopened.getAll())
        assertEquals("only the first open logs a move", 1, log.infos.size)
    }

    @Test
    fun emptyPlaintextStoreMigratesNothing() {
        plaintext.seed(emptyMap())

        open()

        assertTrue("no encrypted writes", encrypted.setCalls.isEmpty())
        assertTrue("no values written to plaintext", plaintext.textEntries().isEmpty())
        assertTrue("nothing logged", log.infos.isEmpty() && log.warnings.isEmpty())
    }

    @Test
    fun nonTextPlaintextEntriesAreNeitherMovedNorRemoved() {
        // The SDK only ever wrote strings; anything else in the file isn't ours to move.
        val key = softwareKeyName("haapi_token_bound_key")
        val value = storedSoftwareKeyPair()
        plaintext.seed(mapOf(key to value, "some_counter" to 7, "some_flag" to true))

        val storage = open()

        assertEquals("only the text entry moves", mapOf(key to value), encrypted.contents)
        assertEquals("non-text entries left in place", 7, plaintext.all["some_counter"])
        assertEquals("non-text entries left in place", true, plaintext.all["some_flag"])
        assertEquals("listing holds only text entries", mapOf(key to value), storage.getAll())
    }

    @Test
    fun anEncryptedValueIsKeptOverAPlaintextCopyForTheSameKey() {
        // A key the encrypted store already holds keeps its value, migrated before or not: a copy
        // planted in the plaintext file alone doesn't take over a stored key (FR-005).
        val key = softwareKeyName("haapi_token_bound_key")
        val stored = storedSoftwareKeyPair()
        val copy = storedSoftwareKeyPair()
        val untouched = softwareKeyName("other")
        encrypted.contents[key] = stored
        encrypted.contents[untouched] = "other-value"
        plaintext.seed(mapOf(key to copy))

        val storage = open()

        assertEquals("stored value kept", stored, storage.get(key))
        assertEquals("other encrypted entries untouched", "other-value", storage.get(untouched))
        assertTrue("the plaintext copy is removed", plaintext.textEntries().isEmpty())
        assertEquals(listOf("Dropped 1 stored entries that encrypted storage already holds."), log.warnings)
    }

    // endregion

    // region US3 — failures never cost a session

    @Test
    fun unavailableKeystoreKeepsTheUnmigratedPlaintextValuesInCharge() {
        val previousVersion = previousVersionEntries()
        plaintext.seed(previousVersion)
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")

        val storage = open()
        val newKey = softwareKeyName("new")
        storage.set("new-value", newKey)

        previousVersion.forEach { (key, value) -> assertEquals("read-back of $key", value, storage.get(key)) }
        assertEquals("new writes land in the plaintext store", "new-value", plaintext.getString(newKey, null))
        assertEquals("plaintext entries kept", previousVersion + (newKey to "new-value"), plaintext.textEntries())
        assertEquals(
            "warning names only the failure's class",
            listOf(
                "Encrypted storage is unavailable (KeyStoreException); using the existing store until the next start.",
            ),
            log.warnings,
        )
    }

    @Test
    fun failedCopyRemovesNothingAndKeepsThePlaintextStoreInCharge() {
        val previousVersion = previousVersionEntries()
        plaintext.seed(previousVersion)
        encrypted.failSetOnCall = 2

        val storage = open()

        assertEquals("plaintext entries untouched", previousVersion, plaintext.textEntries())
        previousVersion.forEach { (key, value) -> assertEquals("read-back of $key", value, storage.get(key)) }
        assertEquals(
            listOf(
                "Moving stored entries into encrypted storage failed (IllegalStateException); using the existing store until the next start.",
            ),
            log.warnings,
        )
    }

    @Test
    fun failedCopyIsRetriedAndCompletesAtTheNextStart() {
        val previousVersion = previousVersionEntries()
        plaintext.seed(previousVersion)
        encrypted.failSetOnCall = 2
        open()

        encrypted.failSetOnCall = null
        val restarted = open()

        assertEquals("every entry moved", previousVersion, encrypted.contents)
        assertTrue("plaintext store emptied", plaintext.textEntries().isEmpty())
        assertEquals("values unchanged", previousVersion, restarted.getAll())
    }

    @Test
    fun uncommittedEraseKeepsThePlaintextStoreInCharge() {
        val previousVersion = previousVersionEntries()
        plaintext.seed(previousVersion)
        plaintext.commitBehaviour = CommitBehaviour.RETURNS_FALSE

        val storage = open()
        val key = softwareKeyName("haapi_token_bound_key")
        storage.set("written-this-run", key)

        assertEquals("writes go to the plaintext store", "written-this-run", plaintext.getString(key, null))
        assertEquals("the encrypted copy is not served", "written-this-run", storage.get(key))
        assertEquals(
            listOf(
                "Encrypted storage could not remove the plaintext copies; using the existing store until the next start.",
            ),
            log.warnings,
        )
        assertTrue("no move reported", log.infos.isEmpty())
    }

    @Test
    fun eraseThatThrowsKeepsThePlaintextStoreInCharge() {
        val previousVersion = previousVersionEntries()
        plaintext.seed(previousVersion)
        plaintext.commitBehaviour = CommitBehaviour.THROWS

        val storage = open()

        assertEquals("plaintext entries untouched", previousVersion, plaintext.textEntries())
        assertEquals("listing served from plaintext", previousVersion, storage.getAll())
        assertEquals(
            listOf(
                "Moving stored entries into encrypted storage failed (IllegalStateException); using the existing store until the next start.",
            ),
            log.warnings,
        )
    }

    @Test
    fun failedEraseIsRetriedAndCompletesAtTheNextStart() {
        val previousVersion = previousVersionEntries()
        plaintext.seed(previousVersion)
        plaintext.commitBehaviour = CommitBehaviour.RETURNS_FALSE
        open()

        plaintext.commitBehaviour = CommitBehaviour.SUCCEEDS
        val restarted = open()

        assertTrue("plaintext store emptied", plaintext.textEntries().isEmpty())
        assertEquals("values unchanged", previousVersion, restarted.getAll())
        assertEquals(
            "the copies already made complete the move",
            listOf("Moved 3 stored entries into encrypted storage."),
            log.infos,
        )
        assertEquals(
            "identical copies are not reported as dropped",
            listOf(
                "Encrypted storage could not remove the plaintext copies; using the existing store until the next start.",
            ),
            log.warnings,
        )
    }

    @Test
    fun afterMigrationAKeyRegeneratedDuringAFallbackRunDoesNotReplaceTheStoredOne() {
        // Once migrated, a plaintext copy can't override what the encrypted store holds: that would
        // let anyone able to write the app's files plant a key. The cost is one new sign-in for a
        // key regenerated while the Keystore was down.
        val key = softwareKeyName("haapi_token_bound_key")
        val original = storedSoftwareKeyPair()
        plaintext.seed(mapOf(key to original))
        open()
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")
        repeat(3) { runCatching { open() } }
        open().set(storedSoftwareKeyPair(), key)

        encryptedFactory.failure = null
        val recovered = open()

        assertEquals("the stored key is kept", original, recovered.get(key))
        assertTrue("plaintext store emptied again", plaintext.textEntries().isEmpty())
        assertEquals(
            "warning",
            "Dropped 1 stored entries that encrypted storage already holds.",
            log.warnings.last(),
        )
    }

    @Test
    fun aPlaintextValuePlantedAfterMigrationCannotReplaceTheStoredKey() {
        val key = softwareKeyName("haapi_token_bound_key")
        val original = storedSoftwareKeyPair()
        plaintext.seed(mapOf(key to original))
        open()
        plaintext.seed(mapOf(key to storedSoftwareKeyPair()))

        val reopened = open()

        assertEquals("the stored key is kept", original, reopened.get(key))
        assertEquals("encrypted store unchanged", original, encrypted.contents[key])
        assertTrue("the planted copy is removed", plaintext.textEntries().isEmpty())
    }

    @Test
    fun afterMigrationAPlaintextEntryForANewKeyIsStillMoved() {
        plaintext.seed(previousVersionEntries())
        open()
        val newKey = softwareKeyName("written-while-the-keystore-was-down")
        plaintext.seed(mapOf(newKey to "new-value"))

        val reopened = open()

        assertEquals("moved", "new-value", reopened.get(newKey))
        assertTrue("plaintext store emptied", plaintext.textEntries().isEmpty())
    }

    @Test
    fun aTamperedFailureCountCannotBlockTheApp() {
        listOf(Int.MIN_VALUE, -1, 1_000).forEach { tampered ->
            val store = InMemorySharedPreferences()
            store.seed(mapOf(UNAVAILABLE_OPENS_KEY to tampered))
            val broken = EncryptedStoreFactory(InMemoryStorage()).apply { failure = java.security.KeyStoreException() }

            // The encrypted file holds values, so a sane count would fail this open.
            val opened =
                runCatching {
                    openDefaultStorage(
                        store,
                        broken,
                        { setOf(softwareKeyName("held")) },
                        log.warn,
                        log.info,
                    )
                }

            assertTrue("count $tampered falls back instead of failing", opened.isSuccess)
        }
    }

    @Test
    fun migratedValuesAreUnavailableOnlyAfterTheRetryBudgetAndReturnWhenTheKeystoreRecovers() {
        val key = softwareKeyName("haapi_token_bound_key")
        val value = storedSoftwareKeyPair()
        plaintext.seed(mapOf(key to value))
        open()

        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")
        repeat(3) { runCatching { open() } }
        val whileDown = open()

        assertNull("encrypted values can't be read without the Keystore", whileDown.get(key))
        assertEquals("nothing deleted from the encrypted store", value, encrypted.contents[key])

        encryptedFactory.failure = null
        assertEquals("readable again after recovery", value, open().get(key))
    }

    @Test
    fun deleteWhilePlaintextIsInChargeAlsoRemovesTheEncryptedCopy() {
        val previousVersion = previousVersionEntries()
        plaintext.seed(previousVersion)
        plaintext.commitBehaviour = CommitBehaviour.RETURNS_FALSE
        val storage = open()
        val key = softwareKeyName("haapi_token_bound_key")

        storage.delete(key)

        assertNull("gone from the plaintext store", plaintext.getString(key, null))
        assertNull("gone from the encrypted store", encrypted.contents[key])
        plaintext.commitBehaviour = CommitBehaviour.SUCCEEDS
        assertNull("does not come back at the next start", open().get(key))
    }

    @Test
    fun failedEncryptedDeleteWhilePlaintextIsInChargeIsLoggedNotThrown() {
        plaintext.seed(previousVersionEntries())
        plaintext.commitBehaviour = CommitBehaviour.RETURNS_FALSE
        val storage = open()
        val key = softwareKeyName("haapi_token_bound_key")
        encrypted.deleteFailure = IllegalStateException("Keystore operation failed")
        log.warnings.clear()

        storage.delete(key)

        assertNull("plaintext delete still happens", plaintext.getString(key, null))
        assertEquals(
            listOf("Could not remove an entry from encrypted storage (IllegalStateException)."),
            log.warnings,
        )
    }

    @Test
    fun entryThatCanNoLongerBeDecryptedIsTreatedAsAbsentAndRemoved() {
        listOf(
            javax.crypto.AEADBadTagException("Tag mismatch"),
            IllegalArgumentException("Encrypted value is truncated"),
            // A non-text value in the encrypted file can never decode either.
            ClassCastException("java.lang.Boolean cannot be cast to java.lang.String"),
        ).forEach { failure ->
            val storage = InMemoryStorage()
            val key = softwareKeyName("haapi_token_bound_key")
            val other = softwareKeyName("other")
            storage.contents[key] = "ciphertext-under-a-lost-key"
            storage.contents[other] = storedSoftwareKeyPair()
            storage.getFailures[key] = failure
            val warnings = RecordingLog()
            val opened =
                openDefaultStorage(
                    InMemorySharedPreferences(),
                    EncryptedStoreFactory(storage),
                    { storage.contents.keys.toSet() },
                    warnings.warn,
                    warnings.info,
                )

            val name = failure.javaClass.simpleName
            assertNull("$name: read returns nothing", opened.get(key))
            assertEquals("$name: entry removed", listOf(key), storage.deleteCalls)
            assertEquals("$name: other entries still listed", setOf(other), opened.getAll().keys)
            assertEquals(
                "$name: warning",
                listOf("A stored entry could not be decrypted ($name) and was removed."),
                warnings.warnings,
            )
        }
    }

    @Test
    fun transientKeystoreFailureOnReadPropagatesAndDeletesNothing() {
        listOf(
            java.security.KeyStoreException("Keystore busy"),
            java.security.ProviderException("Keystore operation failed"),
        ).forEach { failure ->
            val storage = InMemoryStorage()
            val key = softwareKeyName("haapi_token_bound_key")
            storage.contents[key] = "still-valid-ciphertext"
            storage.getFailures[key] = failure
            val opened =
                openDefaultStorage(InMemorySharedPreferences(), EncryptedStoreFactory(storage), {
                    storage.contents.keys.toSet()
                }, {}, {})

            val thrown =
                try {
                    opened.get(key)
                    null
                } catch (e: Exception) {
                    e
                }

            val name = failure.javaClass.simpleName
            assertSame("$name: the same failure reaches the caller", failure, thrown)
            assertTrue("$name: nothing deleted", storage.deleteCalls.isEmpty())
            assertEquals("$name: value kept", "still-valid-ciphertext", storage.contents[key])
        }
    }

    @Test
    fun concurrentOpensRunOneAtATime() {
        // init -> close() -> init can overlap two opens (close() frees the store's reservation while a
        // build is still running). On a first start both would provision the encrypted store's
        // Keystore key, and the second key would strand every value the first open migrated.
        plaintext.seed(previousVersionEntries())
        val firstOpenInside = java.util.concurrent.CountDownLatch(1)
        val releaseFirstOpen = java.util.concurrent.CountDownLatch(1)
        val secondFactoryCalled = java.util.concurrent.CountDownLatch(1)
        val blockingFactory = {
            firstOpenInside.countDown()
            releaseFirstOpen.await()
            encrypted
        }
        val trackingFactory = {
            secondFactoryCalled.countDown()
            encrypted
        }
        val first =
            Thread {
                openDefaultStorage(plaintext, blockingFactory, encryptedEntryNames, log.warn, log.info)
            }.apply { start() }
        assertTrue("first open started", firstOpenInside.await(5, java.util.concurrent.TimeUnit.SECONDS))
        val second =
            Thread {
                openDefaultStorage(plaintext, trackingFactory, encryptedEntryNames, log.warn, log.info)
            }.apply { start() }

        val secondEnteredWhileFirstRunning = secondFactoryCalled.await(500, java.util.concurrent.TimeUnit.MILLISECONDS)
        releaseFirstOpen.countDown()
        first.join(5_000)
        second.join(5_000)

        assertTrue("second open must wait for the first", !secondEnteredWhileFirstRunning)
        assertEquals("second open ran after the first", 0, secondFactoryCalled.count)
        assertTrue("migration completed once", plaintext.textEntries().isEmpty())
    }

    // endregion

    // region Realignment 2026-09-24 — surface an unavailable Keystore instead of re-keying (FR-017)

    @Test
    fun unavailableKeystoreAfterMigrationFailsTheOpenAndKeepsTheValues() {
        val previousVersion = previousVersionEntries()
        plaintext.seed(previousVersion)
        open()
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")

        val thrown = runCatching { open() }.exceptionOrNull()

        assertTrue("open fails with the storage-unavailable error", thrown is DefaultStorageUnavailableException)
        assertEquals("nothing deleted from the encrypted store", previousVersion, encrypted.contents)
        assertTrue("no values written to plaintext", plaintext.textEntries().isEmpty())
        assertEquals(
            listOf("Encrypted storage is unavailable (KeyStoreException); failing so the app can retry (1 of 3)."),
            log.warnings,
        )
    }

    @Test
    fun retryAfterTheKeystoreRecoversKeepsTheSignIn() {
        val previousVersion = previousVersionEntries()
        plaintext.seed(previousVersion)
        open()
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")
        repeat(2) { runCatching { open() } }

        encryptedFactory.failure = null
        val recovered = open()

        assertEquals("every value reads back", previousVersion, recovered.getAll())
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")
        assertTrue(
            "the retry budget restarts after a good open",
            runCatching { open() }.exceptionOrNull() is DefaultStorageUnavailableException,
        )
        assertTrue("counted from 1 again", log.warnings.last().endsWith("(1 of 3)."))
    }

    @Test
    fun afterThreeFailedOpensTheNextFallsBackSoTheAppIsNeverBlocked() {
        plaintext.seed(previousVersionEntries())
        open()
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")

        val outcomes = (1..5).map { runCatching { open() }.isSuccess }

        assertEquals("fail, fail, fail, then fall back", listOf(false, false, false, true, true), outcomes)
    }

    @Test
    fun theRetryBudgetSurvivesAProcessRestart() {
        plaintext.seed(previousVersionEntries())
        open()
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")
        repeat(2) { runCatching { open() } }

        // A new process: same files, fresh in-memory objects. The count lives in the plaintext file.
        val restarted = InMemorySharedPreferences().apply { seed(plaintext.all) }
        val third =
            runCatching { openDefaultStorage(restarted, encryptedFactory, encryptedEntryNames, log.warn, log.info) }
        val fourth =
            runCatching { openDefaultStorage(restarted, encryptedFactory, encryptedEntryNames, log.warn, log.info) }

        assertTrue("third failure still fails", third.exceptionOrNull() is DefaultStorageUnavailableException)
        assertTrue("fourth falls back", fourth.isSuccess)
    }

    @Test
    fun valuesWrittenBeforeTheFirstOpenAreProtectedWhenTheKeystoreIsUnavailable() {
        // The app or the native SDK wrote into the encrypted store before this SDK ever opened it
        // (a migration from another store, or an app already on the native default store).
        val key = softwareKeyName("haapi-dpop-default_keystore_alias")
        val value = storedSoftwareKeyPair()
        encrypted.contents[key] = value
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")

        val first = runCatching { open() }

        assertTrue("fails so the app can retry", first.exceptionOrNull() is DefaultStorageUnavailableException)
        assertEquals("value kept", value, encrypted.contents[key])
        encryptedFactory.failure = null
        assertEquals("served once the Keystore recovers", value, open().get(key))
    }

    @Test
    fun valuesWrittenBeforeTheFirstOpenFallBackAfterTheRetryBudget() {
        encrypted.contents[softwareKeyName("haapi-dpop-default_keystore_alias")] = storedSoftwareKeyPair()
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")

        val outcomes = (1..4).map { runCatching { open() }.isSuccess }

        assertEquals("fail, fail, fail, then fall back", listOf(false, false, false, true), outcomes)
    }

    @Test
    fun plaintextValuesStillServeWhenTheKeystoreIsUnavailableEvenIfEncryptedAlsoHoldsValues() {
        // Plaintext still holds values, so the encrypted copies aren't the only ones: nothing to protect.
        plaintext.seed(previousVersionEntries())
        encrypted.contents[softwareKeyName("other")] = storedSoftwareKeyPair()
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")

        val opened = runCatching { open() }

        assertTrue(opened.isSuccess)
        previousVersionEntries().keys.forEach { key -> assertTrue("$key served", opened.getOrThrow().get(key) != null) }
        // Its listing is refused, though: the encrypted entry it can't see would read as unused.
        assertTrue(runCatching { opened.getOrThrow().getAll() }.isFailure)
    }

    @Test
    fun unavailableKeystoreNeverFailsWhenNothingWasMovedYet() {
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")

        val freshInstall = runCatching { open() }
        plaintext.seed(previousVersionEntries())
        val notYetMigrated = runCatching { open() }

        assertTrue("fresh install opens (EC-15)", freshInstall.isSuccess)
        assertTrue("unmigrated values open from plaintext (EC-15)", notYetMigrated.isSuccess)
        assertEquals(previousVersionEntries().keys, notYetMigrated.getOrThrow().getAll().keys)
    }

    @Test
    fun anEmptyEncryptedStoreNeverFailsTheOpenWhenTheKeystoreBreaksLater() {
        // A fresh install's first good open used the encrypted store while it held nothing, as does
        // every open after a sign-out emptied it: there is still nothing to lose (EC-15).
        open()
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")

        val next = runCatching { open() }

        assertTrue("opens instead of failing", next.isSuccess)
        assertEquals(
            listOf(
                "Encrypted storage is unavailable (KeyStoreException); using the existing store until the next start.",
            ),
            log.warnings,
        )
    }

    @Test
    fun bookkeepingIsNeverMigratedOrListed() {
        plaintext.seed(previousVersionEntries())
        open()
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")
        runCatching { open() }
        encryptedFactory.failure = null

        val storage = open()

        assertEquals("only real values listed", previousVersionEntries().keys, storage.getAll().keys)
        assertEquals("only real values encrypted", previousVersionEntries().keys, encrypted.contents.keys)
    }

    // endregion

    // region Review fixes — lazy open (FR-019) and edge hardening (D16)

    @Test
    fun theDefaultStorageOpensOnlyWhenTheDefaultOptionIsResolved() {
        var opens = 0
        val resolver =
            StorageResolver {
                opens++
                open()
            }

        assertEquals("building the resolver opens nothing", 0, opens)
        resolver.resolve(StorageOption.CUSTOM.value)
        assertEquals("a custom option never opens it", 0, opens)
        val first = resolver.resolve(StorageOption.DEFAULT.value)
        val second = resolver.resolve(StorageOption.DEFAULT.value)
        assertEquals("opened once", 1, opens)
        assertSame("reused", first, second)
    }

    @Test
    fun undecryptableEntryStillReadsAsAbsentWhenItsRemovalFails() {
        val key = softwareKeyName("haapi_token_bound_key")
        encrypted.contents[key] = "ciphertext-under-a-lost-key"
        encrypted.getFailures[key] = javax.crypto.AEADBadTagException("Tag mismatch")
        encrypted.deleteFailure = IllegalStateException("Keystore operation failed")
        val storage = open()

        assertNull("still reads as absent", storage.get(key))
        assertEquals(
            listOf(
                "A stored entry could not be decrypted (AEADBadTagException) and could not be removed " +
                    "(IllegalStateException).",
            ),
            log.warnings,
        )
    }

    @Test
    fun unreadablePlaintextStoreFallsBackInsteadOfFailingInit() {
        val broken =
            object : android.content.SharedPreferences by plaintext {
                override fun getAll(): Map<String, *> = throw IllegalStateException("prefs load failed")
            }

        val opened =
            runCatching { openDefaultStorage(broken, encryptedFactory, encryptedEntryNames, log.warn, log.info) }

        assertTrue("open does not fail", opened.isSuccess)
        assertEquals(
            listOf(
                "Moving stored entries into encrypted storage failed (IllegalStateException); " +
                    "using the existing store until the next start.",
            ),
            log.warnings,
        )
    }

    // endregion

    // region Native 5.7.0 — a fallback run never lets the native SDK judge stored keys unused

    @Test
    fun upgradeMovesEveryEntryNative570WritesIntoTheEncryptedStore() {
        // Per-session key material and the tracking entries that bind each sign-in to its key; the
        // move filters nothing by alias, so all of them must arrive or a sign-in loses its key.
        val written = signInEntries("aaaaaaaaaaaaaaaa") + ("haapi-dpop-reserved-$SESSION_B" to "1727770000000")
        plaintext.seed(written)

        val storage = open()

        assertEquals("encrypted store contents", written, encrypted.contents)
        assertEquals("listing", written, storage.getAll())
        assertTrue("plaintext store emptied", plaintext.textEntries().isEmpty())
        assertTrue("moved key still signs", isUsableKeyPair(storage.get(softwareKeyName(SESSION_A))!!))
    }

    @Test
    fun fallbackRunRefusesToListWhenTheEncryptedStoreHoldsEntriesItCannotSee() {
        val signIn = signInEntries("aaaaaaaaaaaaaaaa")
        val whileDown = fallBackWithOnlyEncryptedCopies(signIn)

        val listing = runCatching { whileDown.getAll() }

        assertTrue("listing refused", listing.exceptionOrNull() is IllegalStateException)
        assertEquals("encrypted copies untouched", signIn, encrypted.contents)
    }

    @Test
    fun fallbackRunStillReadsWritesAndDeletesWhileItsListingIsRefused() {
        val whileDown = fallBackWithOnlyEncryptedCopies(signInEntries("aaaaaaaaaaaaaaaa"))

        whileDown.set("B", SESSION_POINTER)
        assertEquals("write lands in plaintext", "B", plaintext.getString(SESSION_POINTER, null))
        assertEquals("read-back", "B", whileDown.get(SESSION_POINTER))
        whileDown.delete(SESSION_POINTER)
        assertNull("deleted", whileDown.get(SESSION_POINTER))
    }

    @Test
    fun fallbackRunListsNormallyWhenTheEncryptedStoreIsEmpty() {
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")
        val whileDown = open()
        whileDown.set("B", SESSION_POINTER)

        assertEquals("plaintext entries listed", mapOf(SESSION_POINTER to "B"), whileDown.getAll())
    }

    @Test
    fun fallbackRunListsNormallyWhenPlaintextHoldsEveryEncryptedName() {
        val signIn = signInEntries("aaaaaaaaaaaaaaaa")
        val whileDown = fallBackWithOnlyEncryptedCopies(signIn)

        // Each check reads the encrypted file's names again, so the run's own writes count.
        signIn.forEach { (key, value) -> whileDown.set(value, key) }

        assertEquals("listing served once nothing is hidden", signIn, whileDown.getAll())
    }

    @Test
    fun fallbackRunRefusesToListWhenTheEncryptedFileCannotBeRead() {
        // Not knowing what the encrypted store holds is treated like knowing it holds something.
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")
        val whileDown =
            openDefaultStorage(plaintext, encryptedFactory, { error("file unreadable") }, log.warn, log.info)

        assertTrue("listing refused", runCatching { whileDown.getAll() }.isFailure)
    }

    @Test
    fun aFailedMoveRefusesToListEncryptedEntriesThePlaintextStoreLacks() {
        // The encrypted store opens, but the move fails, so plaintext stays in charge for the run.
        val signIn = signInEntries("aaaaaaaaaaaaaaaa")
        encrypted.contents.putAll(signIn)
        plaintext.seed(mapOf(SESSION_POINTER to "B"))
        plaintext.commitBehaviour = CommitBehaviour.RETURNS_FALSE

        val inCharge = open()

        assertEquals("plaintext kept in charge", "B", inCharge.get(SESSION_POINTER))
        assertTrue("listing refused", runCatching { inCharge.getAll() }.isFailure)
    }

    @Test
    fun refusedListingsWarnOncePerRunWithoutNamingEntries() {
        val signIn = signInEntries("aaaaaaaaaaaaaaaa")
        val whileDown = fallBackWithOnlyEncryptedCopies(signIn)
        val before = log.warnings.size

        repeat(3) { runCatching { whileDown.getAll() } }

        val added = log.warnings.drop(before)
        assertEquals("one warning for three refusals", 1, added.size)
        signIn.forEach { (key, value) ->
            assertTrue("names no entry", !added.single().contains(key) && !added.single().contains(value))
        }
    }

    @Test
    fun nativeKeyCleanupRemovesNothingDuringAFallbackRun() {
        // The live sign-in's key A is referenced only by tracking entries the fallback run can't read.
        val signIn = signInEntries("aaaaaaaaaaaaaaaa")
        val whileDown = fallBackWithOnlyEncryptedCopies(signIn)
        whileDown.set(SESSION_B, SESSION_POINTER)

        val removed = nativeRotationCleanup(whileDown.toStorage(), mutableSetOf(SESSION_A, SESSION_B), SESSION_B)

        assertTrue("no session key removed", removed.isEmpty())
        // Why refusing matters: the same pass over the partial listing would remove the live key.
        val partial = nativeRotationCleanup(PlaintextListing(plaintext), mutableSetOf(SESSION_A, SESSION_B), SESSION_B)
        assertEquals("a partial listing would remove the live key", setOf(SESSION_A), partial)
    }

    @Test
    fun anOlderTrackingValueWinsAfterAFallbackRunAndTheSignInStillResolves() {
        // Native 5.7.0 rewrites the session pointer under the same name at every HAAPI start, so after a
        // fallback run the encrypted store's older value is kept; a new sign-in's entries move across.
        val first = signInEntries("aaaaaaaaaaaaaaaa")
        val whileDown = fallBackWithOnlyEncryptedCopies(first)
        whileDown.set(SESSION_B, SESSION_POINTER)
        whileDown.set(SESSION_B, refreshEntry(SECOND_REFRESH_DIGEST))

        encryptedFactory.failure = null
        val recovered = open()

        assertEquals("older session pointer kept", SESSION_A, recovered.get(SESSION_POINTER))
        assertEquals("first sign-in still resolves", SESSION_A, recovered.get(refreshEntry(FIRST_REFRESH_DIGEST)))
        assertEquals("second sign-in moved", SESSION_B, recovered.get(refreshEntry(SECOND_REFRESH_DIGEST)))
        assertTrue("plaintext emptied", plaintext.textEntries().isEmpty())
        assertEquals(
            "warning",
            "Dropped 1 stored entries that encrypted storage already holds.",
            log.warnings.last(),
        )
    }

    @Test
    fun aHardwareBackedSignInSurvivesAFallbackRunAndResolvesAfterRecovery() {
        // A hardware key lives in the Keystore, outside the storage, so only the cleanup's verdict
        // protects it: this is the key a partial listing would have deleted.
        val signIn = signInEntries("aaaaaaaaaaaaaaaa", location = "Hardware")
        val keystore = mutableSetOf(SESSION_A, SESSION_B)
        val whileDown = fallBackWithOnlyEncryptedCopies(signIn)
        whileDown.set(SESSION_B, SESSION_POINTER)
        nativeRotationCleanup(whileDown.toStorage(), keystore, current = SESSION_B)

        encryptedFactory.failure = null
        val recovered = open()

        assertTrue("hardware key still in the Keystore", SESSION_A in keystore)
        signIn.forEach { (key, value) -> assertEquals("$key unchanged", value, encrypted.contents[key]) }
        // The refresh lookup: the sign-in's tracking entry names its key, and its location record is intact.
        val alias = recovered.get(refreshEntry(FIRST_REFRESH_DIGEST))
        assertEquals("bound alias", SESSION_A, alias)
        assertEquals("location", "Hardware", recovered.get("HAAPI_KP_LOCATION_$alias"))
    }

    /**
     * Migrates [entries] into the encrypted store, then breaks the Keystore past the retry budget, so
     * the returned storage is a fallback run whose plaintext store holds none of them.
     */
    private fun fallBackWithOnlyEncryptedCopies(entries: Map<String, String>): RNStorage {
        plaintext.seed(entries)
        open()
        encryptedFactory.failure = java.security.KeyStoreException("AndroidKeyStore not found")
        repeat(MAX_UNAVAILABLE_OPENS) { runCatching { open() } }
        return open()
    }

    /** One token-bound sign-in as native 5.7.0 stores it on the legacy path, keyed to [SESSION_A]. */
    private fun signInEntries(
        accessDigestSeed: String,
        location: String = "Software",
    ): Map<String, String> =
        linkedMapOf(
            softwareKeyName(SESSION_A) to storedSoftwareKeyPair(),
            "HAAPI_KP_LOCATION_$SESSION_A" to location,
            refreshEntry(FIRST_REFRESH_DIGEST) to SESSION_A,
            "haapi-dpop-at-${accessDigestSeed.repeat(4)}" to SESSION_A,
            "haapi-dpop-ptr-$FIRST_REFRESH_DIGEST" to accessDigestSeed.repeat(4),
            SESSION_POINTER to SESSION_A,
        )

    private fun refreshEntry(digest: String) = "haapi-dpop-rt-$digest"

    /**
     * The decision native 5.7.0 makes at every HAAPI start: list the storage, collect the aliases its
     * tracking entries reference, and remove every other session key in the Keystore except the current
     * one. A listing that fails removes nothing. Removes them from [keystore] and returns them.
     */
    private fun nativeRotationCleanup(
        storage: se.curity.identityserver.haapi.android.driver.Storage,
        keystore: MutableSet<String>,
        current: String,
    ): Set<String> {
        val listing = runCatching { storage.getAll() }.getOrNull() ?: return emptySet()
        val referenced =
            listing.filterKeys { it.startsWith("haapi-dpop-rt-") || it.startsWith("haapi-dpop-at-") }.values.toSet()
        val unused = keystore.filter { it != current && it !in referenced }.toSet()
        keystore.removeAll(unused)
        return unused
    }

    /** A storage whose listing shows only the plaintext store, as the fallback run's did before. */
    private class PlaintextListing(
        private val plaintext: android.content.SharedPreferences,
    ) : se.curity.identityserver.haapi.android.driver.Storage by InMemoryStorage() {
        override fun getAll(): Map<String, String> =
            plaintext.all.filterValues { it is String }.mapValues { it.value as String }
    }

    private companion object {
        const val STEM = "haapi-dpop-haapi_token_bound_key"
        const val SESSION_A = "$STEM-s-aaaaaaaaaaaaaaaa"
        const val SESSION_B = "$STEM-s-bbbbbbbbbbbbbbbb"
        const val SESSION_POINTER = "haapi-dpop-session-$STEM"
        const val FIRST_REFRESH_DIGEST = "1111111111111111111111111111111111111111111111111111111111111111"
        const val SECOND_REFRESH_DIGEST = "2222222222222222222222222222222222222222222222222222222222222222"
    }

    // endregion

    /** What an earlier SDK version left behind: two software key pairs and another text entry. */
    private fun previousVersionEntries(): Map<String, String> =
        linkedMapOf(
            softwareKeyName("haapi_token_bound_key") to storedSoftwareKeyPair(),
            softwareKeyName("haapi_token_bound_key-s-0123456789abcdef") to storedSoftwareKeyPair(),
            "HAAPI_KP_LOCATION_haapi_token_bound_key" to "Software",
        )
}
