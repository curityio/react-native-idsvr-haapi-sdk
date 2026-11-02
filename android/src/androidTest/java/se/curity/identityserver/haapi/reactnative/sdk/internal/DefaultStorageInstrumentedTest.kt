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

import android.content.Context
import android.util.Base64
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import se.curity.identityserver.haapi.android.driver.StorageBuilder
import se.curity.identityserver.haapi.reactnative.sdk.RNStorage
import se.curity.identityserver.haapi.reactnative.sdk.configurations.StorageOption
import se.curity.identityserver.haapi.reactnative.sdk.toStorage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.ObjectInputStream
import java.io.ObjectOutputStream
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/**
 * The default storage against the real AndroidKeyStore and SharedPreferences, which the JVM
 * tests replace with fakes. Every test starts and ends with both stores and the encrypted
 * store's Keystore key removed, so no test sees another's state.
 */
@RunWith(AndroidJUnit4::class)
class DefaultStorageInstrumentedTest {
    private val context: Context = InstrumentationRegistry.getInstrumentation().targetContext

    @Before
    fun wipeBefore() = wipeStores()

    @After
    fun wipeAfter() = wipeStores()

    @Test
    fun nativeEncryptedStoreRoundTripsOnThisDevice() {
        val value = storedSoftwareKeyPair()
        val store = StorageBuilder.encrypted(context)

        store.set(value, softwareKeyName("infra"))

        assertEquals(value, store.get(softwareKeyName("infra")))
    }

    // region US1 — stored values are encrypted at rest

    @Test
    fun freshInstallStoresAUsableKeyPairWithNoPlaintextOnDisk() {
        val key = softwareKeyName("haapi_token_bound_key")
        val value = storedSoftwareKeyPair()

        defaultStorage().set(value, key)

        val readBack = defaultStorage().get(key)
        assertEquals("read-back", value, readBack)
        assertTrue("still a usable key pair", isUsableKeyPair(readBack!!))
        assertNoPrefsFileContains(value)
    }

    @Test
    fun bulkDeleteThroughTheBridgeLeavesNothingAfterARestart() {
        val storage = defaultStorage()
        storage.set(storedSoftwareKeyPair(), softwareKeyName("first"))
        storage.set(storedSoftwareKeyPair(), softwareKeyName("second"))
        val native = storage.toStorage()

        native
            .getAll()
            .keys
            .filter { it.startsWith(SOFTWARE_KEY_PREFIX) }
            .forEach(native::delete)

        val restarted = defaultStorage()
        assertTrue("nothing listed after restart", restarted.getAll().isEmpty())
        assertNull("deleted key stays gone", restarted.get(softwareKeyName("first")))
        assertFalse("encrypted file holds no entry", rawPrefsFile(ENCRYPTED_STORE).contains(SOFTWARE_KEY_PREFIX))
    }

    // endregion

    // region US2 — existing values move into the encrypted store when the storage opens

    @Test
    fun upgradeMovesPreviousVersionKeysIntoEncryptedStorageAndEmptiesThePlaintextFile() {
        val previousVersion =
            mapOf(
                softwareKeyName("haapi_token_bound_key") to storedSoftwareKeyPair(),
                softwareKeyName("haapi_token_bound_key-s-0123456789abcdef") to storedSoftwareKeyPair(),
            )
        writeAsPreviousVersion(previousVersion)

        val storage = defaultStorage()

        previousVersion.forEach { (key, value) ->
            assertEquals("read-back of $key", value, storage.get(key))
            assertTrue("$key still a usable key pair", isUsableKeyPair(storage.get(key)!!))
        }
        assertFalse("plaintext file holds no entries", rawPrefsFile(PLAINTEXT_STORE).contains("<string"))
        previousVersion.values.forEach(::assertNoPrefsFileContains)
    }

    // With token binding off nothing else opens the default storage, so the SDK moves the leftovers of
    // a bound-by-default version itself — leaving no key material in clear on disk.
    @Test
    fun unboundMigrationMovesLeftoversIntoEncryptedStorageAndLeavesNoPlaintext() {
        val key = softwareKeyName("haapi_token_bound_key")
        val value = storedSoftwareKeyPair()
        writeAsPreviousVersion(mapOf(key to value))
        val resolver = StorageResolver(context, warn = {}, info = {})

        migrateLegacyDefaultStorage(
            plaintext = context.getSharedPreferences(PLAINTEXT_STORE, Context.MODE_PRIVATE),
            open = { resolver.resolve(StorageOption.DEFAULT.value) },
            warn = {},
        )

        assertFalse("plaintext file holds no entries", rawPrefsFile(PLAINTEXT_STORE).contains("<string"))
        assertNoPrefsFileContains(value)
        assertEquals(value, StorageBuilder.encrypted(context).get(key))
    }

    @Test
    fun reopeningAfterTheUpgradeLeavesTheEncryptedFileUntouched() {
        val key = softwareKeyName("haapi_token_bound_key")
        val value = storedSoftwareKeyPair()
        writeAsPreviousVersion(mapOf(key to value))
        defaultStorage()
        val migratedFile = rawPrefsFile(ENCRYPTED_STORE)

        val reopened = defaultStorage()

        assertEquals("value unchanged", value, reopened.get(key))
        assertEquals("encrypted file byte-for-byte unchanged", migratedFile, rawPrefsFile(ENCRYPTED_STORE))
    }

    @Test
    fun anEncryptedValueIsKeptOverAPlaintextCopyForTheSameKey() {
        val key = softwareKeyName("haapi_token_bound_key")
        val stored = storedSoftwareKeyPair()
        StorageBuilder.encrypted(context).set(stored, key)
        writeAsPreviousVersion(mapOf(key to storedSoftwareKeyPair()))

        assertEquals("stored value kept", stored, defaultStorage().get(key))
        assertFalse("plaintext copy removed", rawPrefsFile(PLAINTEXT_STORE).contains("<string"))
    }

    // endregion

    // region US3 — failures never cost a session

    @Test
    fun entryWhoseKeystoreKeyIsGoneReadsAsAbsentAndStorageRecovers() {
        // Deleting the Keystore key reproduces a backup restored onto another device: the
        // encrypted file is there, the key that encrypted it is not.
        val key = softwareKeyName("haapi_token_bound_key")
        defaultStorage().set(storedSoftwareKeyPair(), key)
        KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(ENCRYPTED_STORE_KEK)
        val warnings = mutableListOf<String>()

        val restored =
            StorageResolver(
                context,
                warn = { warnings += it },
                info = {},
            ).resolve(StorageOption.DEFAULT.value)!!

        assertNull("undecryptable entry reads as absent", restored.get(key))
        assertEquals(
            "warning",
            listOf("A stored entry could not be decrypted (AEADBadTagException) and was removed."),
            warnings,
        )
        assertFalse("entry removed from the encrypted file", rawPrefsFile(ENCRYPTED_STORE).contains(key))
        assertTrue("listing is empty", restored.getAll().isEmpty())
        val fresh = storedSoftwareKeyPair()
        restored.set(fresh, key)
        assertEquals("a new key can be stored", fresh, defaultStorage().get(key))
    }

    @Test
    fun theEntryNamesCheckReadsTheFileTheNativeEncryptedStoreWrites() {
        assertTrue("fresh install", encryptedStoreEntryNames(context).isEmpty())
        val native = StorageBuilder.encrypted(context)

        native.set(storedSoftwareKeyPair(), softwareKeyName("app-written"))
        assertEquals("after a native write", setOf(softwareKeyName("app-written")), encryptedStoreEntryNames(context))

        native.delete(softwareKeyName("app-written"))
        assertTrue("after the native delete", encryptedStoreEntryNames(context).isEmpty())
    }

    @Test
    fun valuesTheAppWroteBeforeTheFirstOpenSurviveAnUnavailableKeystore() {
        val key = softwareKeyName("haapi-dpop-default_keystore_alias")
        val value = storedSoftwareKeyPair()
        StorageBuilder.encrypted(context).set(value, key)
        val plaintext = context.getSharedPreferences(PLAINTEXT_STORE, Context.MODE_PRIVATE)

        val unavailable =
            runCatching {
                openDefaultStorage(
                    plaintext,
                    { throw java.security.KeyStoreException("unavailable") },
                    { encryptedStoreEntryNames(context) },
                    {},
                    {},
                )
            }

        assertTrue(
            "init fails so the app can retry",
            unavailable.exceptionOrNull() is DefaultStorageUnavailableException,
        )
        assertEquals("the value is served once the Keystore works", value, defaultStorage().get(key))
    }

    @Test
    fun unavailableEncryptedStoreKeepsThePlaintextFileUntilAHealthyStart() {
        val key = softwareKeyName("haapi_token_bound_key")
        val value = storedSoftwareKeyPair()
        writeAsPreviousVersion(mapOf(key to value))
        val plaintext = context.getSharedPreferences(PLAINTEXT_STORE, Context.MODE_PRIVATE)

        val broken =
            openDefaultStorage(
                plaintext,
                { throw java.security.KeyStoreException("unavailable") },
                { encryptedStoreEntryNames(context) },
                {},
                {},
            )

        assertEquals("value served from the plaintext file", value, broken.get(key))
        assertTrue("plaintext file kept", rawPrefsFile(PLAINTEXT_STORE).contains(key))

        val healthy = defaultStorage()

        assertEquals("moved at the next healthy start", value, healthy.get(key))
        assertFalse("plaintext file emptied", rawPrefsFile(PLAINTEXT_STORE).contains("<string"))
    }

    @Test
    fun aFallbackRunRefusesToListWhileTheEncryptedFileHoldsEntriesItCannotRead() {
        val key = "haapi-dpop-rt-1111111111111111111111111111111111111111111111111111111111111111"
        StorageBuilder.encrypted(context).set("haapi-dpop-haapi_token_bound_key-s-aaaaaaaaaaaaaaaa", key)
        val plaintext = context.getSharedPreferences(PLAINTEXT_STORE, Context.MODE_PRIVATE)
        val openWhileDown = {
            runCatching {
                openDefaultStorage(
                    plaintext,
                    { throw java.security.KeyStoreException("unavailable") },
                    { encryptedStoreEntryNames(context) },
                    {},
                    {},
                )
            }
        }

        repeat(MAX_UNAVAILABLE_OPENS) { assertTrue("open fails within the budget", openWhileDown().isFailure) }
        val whileDown = openWhileDown().getOrThrow()

        assertTrue("listing refused", runCatching { whileDown.getAll() }.isFailure)
        assertEquals("entry kept", setOf(key), encryptedStoreEntryNames(context))
    }

    @Test
    fun aFallbackRunListsNormallyWhenTheEncryptedFileIsEmpty() {
        val plaintext = context.getSharedPreferences(PLAINTEXT_STORE, Context.MODE_PRIVATE)
        val whileDown =
            openDefaultStorage(
                plaintext,
                { throw java.security.KeyStoreException("unavailable") },
                { encryptedStoreEntryNames(context) },
                {},
                {},
            )

        whileDown.set("value", "haapi-dpop-session-haapi-dpop-haapi_token_bound_key")

        assertEquals(
            mapOf("haapi-dpop-session-haapi-dpop-haapi_token_bound_key" to "value"),
            whileDown.getAll(),
        )
    }

    // endregion

    // region Helpers

    /** Writes [entries] exactly where and how SDK versions before the encrypted default did. */
    private fun writeAsPreviousVersion(entries: Map<String, String>) {
        val editor = context.getSharedPreferences(PLAINTEXT_STORE, Context.MODE_PRIVATE).edit()
        entries.forEach { (key, value) -> editor.putString(key, value) }
        assertTrue("seeded", editor.commit())
    }

    /** The default storage exactly as SDK init builds it: a fresh resolver, then the default option. */
    private fun defaultStorage(): RNStorage =
        StorageResolver(context, warn = {}, info = {}).resolve(StorageOption.DEFAULT.value)!!

    /** No file in the app's `shared_prefs/` holds [value], nor any 16-character run of it. */
    private fun assertNoPrefsFileContains(value: String) {
        val compact = value.replace("\n", "")
        val fragments = (0..compact.length - 16 step 16).map { compact.substring(it, it + 16) }
        listOf(PLAINTEXT_STORE, ENCRYPTED_STORE).forEach(::flushPendingWrites)
        File(context.dataDir, "shared_prefs").listFiles().orEmpty().forEach { file ->
            val raw = file.readText()
            fragments.forEach { fragment ->
                assertFalse("${file.name} contains plaintext value data", raw.contains(fragment))
            }
        }
    }

    private fun wipeStores() {
        listOf(PLAINTEXT_STORE, ENCRYPTED_STORE).forEach { name ->
            // Clear through the cached instance first: `deleteSharedPreferences` removes the
            // file but the process keeps serving the cached contents.
            context
                .getSharedPreferences(name, Context.MODE_PRIVATE)
                .edit()
                .clear()
                .commit()
            context.deleteSharedPreferences(name)
        }
        KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(ENCRYPTED_STORE_KEK)
    }

    /** The raw XML of a preferences file, as it sits in the app's private directory. */
    private fun rawPrefsFile(name: String): String {
        flushPendingWrites(name)
        return File(context.dataDir, "shared_prefs/$name.xml").takeIf { it.exists() }?.readText().orEmpty()
    }

    /**
     * Waits for `apply()` writes still in flight: they reach the file asynchronously, and a
     * `commit()` is queued behind them.
     */
    private fun flushPendingWrites(name: String) {
        context.getSharedPreferences(name, Context.MODE_PRIVATE).edit().commit()
    }

    // endregion

    private companion object {
        const val PLAINTEXT_STORE = "haapi_token_bound_storage"
        const val ENCRYPTED_STORE = "haapi-dpop-encrypted-store"
        const val ENCRYPTED_STORE_KEK = "haapi-dpop-store-kek"
        const val SOFTWARE_KEY_PREFIX = "HAAPI_KP_FALLBACK"

        fun softwareKeyName(alias: String) = "$SOFTWARE_KEY_PREFIX$alias"

        /** Whether [stored] still decodes to a key pair whose private key signs for its public key. */
        fun isUsableKeyPair(stored: String): Boolean {
            val keyPair =
                ObjectInputStream(ByteArrayInputStream(Base64.decode(stored, Base64.DEFAULT))).use {
                    it.readObject() as KeyPair
                }
            val message = "dpop-proof".toByteArray()
            val signature =
                Signature.getInstance("SHA256withECDSA").run {
                    initSign(keyPair.private)
                    update(message)
                    sign()
                }
            return Signature.getInstance("SHA256withECDSA").run {
                initVerify(keyPair.public)
                update(message)
                verify(signature)
            }
        }

        /** A P-256 key pair, serialised and encoded exactly as native `KeyPairGeneratorStorage` does. */
        fun storedSoftwareKeyPair(): String {
            val keyPair =
                KeyPairGenerator
                    .getInstance("EC")
                    .apply { initialize(ECGenParameterSpec("secp256r1")) }
                    .generateKeyPair()
            val bytes = ByteArrayOutputStream().also { ObjectOutputStream(it).use { out -> out.writeObject(keyPair) } }
            return Base64.encodeToString(bytes.toByteArray(), Base64.DEFAULT)
        }
    }
}
