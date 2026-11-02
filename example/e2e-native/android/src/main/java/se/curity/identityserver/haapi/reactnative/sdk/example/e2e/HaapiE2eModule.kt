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
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import se.curity.identityserver.haapi.android.driver.StorageBuilder
import se.curity.identityserver.haapi.reactnative.sdk.RNStorage
import java.io.ByteArrayOutputStream
import java.io.ObjectOutputStream
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.spec.ECGenParameterSpec

/**
 * What the E2E harness needs from native code for the storage-migration scenario, and nothing
 * else: report the state of both stores and of the DPoP key by name and fingerprint (never a
 * value), replace the key for the negative control, and keep the harness's own state across app
 * restarts.
 *
 * The key is always the one a refresh token is bound to: native 5.7.0 gives each HAAPI session its
 * own key alias and records, under the digest of each refresh token, which alias that sign-in uses.
 * The token itself is never stored or returned; the alias is a name.
 */
class HaapiE2eModule : Module() {
    private val context: Context
        get() = requireNotNull(appContext.reactContext) { "No React context" }.applicationContext

    override fun definition() =
        ModuleDefinition {
            Name("HaapiE2e")

            // The E2E negative control: a key the tokens are not bound to, in the old key's place, so
            // the SDK signs with a genuinely different key. Not a deletion: without a key the SDK
            // sends no proof at all, which the server refuses for a different reason. Destructive;
            // the scenario runs it last.
            Function("replaceDpopKey") { refreshToken: String ->
                val alias = boundAlias(storeInUse(), refreshToken) ?: return@Function false
                val keyStore = androidKeyStore()
                val hadHardware = keyStore.containsAlias(alias)
                if (hadHardware) {
                    keyStore.deleteEntry(alias)
                    newHardwareKey(alias)
                }
                val stores = listOfNotNull(E2eExistingStore(context), encryptedStore())
                val replacedSoftware =
                    stores.count { store ->
                        (store.get(softwareKeyName(alias)) != null).also { held ->
                            if (held) store.set(serializedSoftwareKeyPair(), softwareKeyName(alias))
                        }
                    } > 0
                hadHardware || replacedSoftware
            }

            Function("deleteKeyStoreEntry") { alias: String ->
                deleteScenarioKeyStoreEntry(androidKeyStore(), alias)
            }

            Function("migrationState") { refreshToken: String? ->
                val existing = E2eExistingStore(context)
                val encrypted = encryptedStore()
                val existingAlias = refreshToken?.let { boundAlias(existing, it) }
                val encryptedAlias = refreshToken?.let { token -> encrypted?.let { boundAlias(it, token) } }
                val aliasInUse = if (moved()) encryptedAlias else existingAlias
                mapOf(
                    "moved" to moved(),
                    "existingStoreKeys" to existing.getAll().keys.sorted(),
                    "encryptedStoreKeys" to (encrypted?.getAll()?.keys?.sorted() ?: emptyList()),
                    "encryptedStoreOpened" to (encrypted != null),
                    "existingBoundAlias" to existingAlias,
                    "encryptedBoundAlias" to encryptedAlias,
                    "existingKeyFingerprint" to existingAlias?.let { existing.read(softwareKeyName(it)) }?.let(::fingerprint),
                    "encryptedKeyFingerprint" to
                        encryptedAlias?.let { encrypted?.read(softwareKeyName(it)) }?.let(::fingerprint),
                    "existingLocation" to existingAlias?.let { existing.read(locationKeyName(it)) },
                    "encryptedLocation" to encryptedAlias?.let { encrypted?.read(locationKeyName(it)) },
                    "hardwareKeyFingerprint" to
                        aliasInUse?.let { androidKeyStore().getCertificate(it) }?.publicKey?.encoded?.let(::fingerprint),
                )
            }

            Function("loadHarnessState") {
                E2eHarnessState.load(context)
            }

            Function("saveHarnessState") { json: String ->
                E2eHarnessState.save(context, json)
            }

            Function("clearHarnessState") {
                E2eHarnessState.clear(context)
            }

            // The DPoP scenarios' call to the server's userinfo endpoint, over a connection that accepts a
            // development server's certificate. Network I/O, so asynchronous.
            AsyncFunction("dpopRequest") { url: String, method: String, authorization: String, dpop: String ->
                DpopRequest.send(url, method, authorization, dpop)
            }
        }

    private fun moved(): Boolean = TokenBindingStorageMigration.useDefaultStorage(context)

    /** The store the SDK uses: the default storage once the move switched, the existing one before. */
    private fun storeInUse(): RNStorage? = if (moved()) encryptedStore() else E2eExistingStore(context)

    /** The key alias [store] records for the sign-in that holds [refreshToken], or `null`. */
    private fun boundAlias(
        store: RNStorage?,
        refreshToken: String,
    ): String? = store?.read(refreshEntryName(refreshToken))

    private fun encryptedStore(): RNStorage? =
        runCatching { StorageBuilder.encrypted(context) }.getOrNull()?.let(::NativeStorageAdapter)

    private fun androidKeyStore(): KeyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }

    /** A P-256 signing key in the Keystore under [alias], the shape the SDK's hardware key has. */
    private fun newHardwareKey(alias: String) {
        KeyPairGenerator
            .getInstance(KeyProperties.KEY_ALGORITHM_EC, ANDROID_KEY_STORE)
            .apply {
                initialize(
                    KeyGenParameterSpec
                        .Builder(alias, KeyProperties.PURPOSE_SIGN)
                        .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                        .setDigests(KeyProperties.DIGEST_SHA256)
                        .build(),
                )
            }.generateKeyPair()
    }

    private companion object {
        // The native SDK's own entry names and location value (identityserver.haapi.android.driver
        // 5.7.0, which keys them by session alias and tracks each sign-in under its refresh token).
        const val SOFTWARE_KEY_PREFIX = "HAAPI_KP_FALLBACK"
        const val LOCATION_KEY_PREFIX = "HAAPI_KP_LOCATION_"
        const val REFRESH_TOKEN_PREFIX = "haapi-dpop-rt-"

        const val ANDROID_KEY_STORE = "AndroidKeyStore"

        fun softwareKeyName(alias: String) = "$SOFTWARE_KEY_PREFIX$alias"

        fun locationKeyName(alias: String) = "$LOCATION_KEY_PREFIX$alias"

        /** Where the native SDK records a sign-in's key: the lowercase hex SHA-256 of its refresh token. */
        fun refreshEntryName(refreshToken: String) =
            REFRESH_TOKEN_PREFIX +
                MessageDigest
                    .getInstance("SHA-256")
                    .digest(refreshToken.toByteArray(Charsets.UTF_8))
                    .joinToString("") { "%02x".format(it) }

        /** A read that reports an unreadable entry as absent, as a probe should. */
        fun RNStorage.read(key: String): String? = runCatching { get(key) }.getOrNull()

        /** A P-256 key pair, serialised and encoded as the native SDK stores a software key. */
        fun serializedSoftwareKeyPair(): String {
            val keyPair =
                KeyPairGenerator
                    .getInstance("EC")
                    .apply { initialize(ECGenParameterSpec("secp256r1")) }
                    .generateKeyPair()
            val bytes = ByteArrayOutputStream().also { ObjectOutputStream(it).use { out -> out.writeObject(keyPair) } }
            return Base64.encodeToString(bytes.toByteArray(), Base64.DEFAULT)
        }

        fun fingerprint(value: String): String = fingerprint(value.toByteArray())

        /** Enough of a SHA-256 to tell two keys apart, and nothing that reveals one. */
        fun fingerprint(bytes: ByteArray): String =
            MessageDigest
                .getInstance("SHA-256")
                .digest(bytes)
                .take(8)
                .joinToString("") { "%02x".format(it) }
    }
}
