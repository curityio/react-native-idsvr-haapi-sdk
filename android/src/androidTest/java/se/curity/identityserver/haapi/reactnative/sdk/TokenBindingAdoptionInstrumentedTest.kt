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
package se.curity.identityserver.haapi.reactnative.sdk

import android.content.Context
import android.util.Base64
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import se.curity.identityserver.haapi.android.driver.Storage
import se.curity.identityserver.haapi.android.driver.StorageBuilder
import se.curity.identityserver.haapi.android.driver.internal.DpopKeyAliases
import se.curity.identityserver.haapi.android.driver.internal.DpopKeyTracker
import se.curity.identityserver.haapi.android.driver.internal.InternalHaapiApi
import se.curity.identityserver.haapi.reactnative.sdk.configurations.AndroidTokenBindingConfigurationRecord
import se.curity.identityserver.haapi.reactnative.sdk.configurations.KeyPairAlgorithmConfigurationRecord
import se.curity.identityserver.haapi.reactnative.sdk.configurations.RNDpopKeyPolicy
import se.curity.identityserver.haapi.reactnative.sdk.configurations.RNHaapiConfigurationRecord
import se.curity.identityserver.haapi.reactnative.sdk.configurations.StorageOption
import se.curity.identityserver.haapi.reactnative.sdk.configurations.TokenBindingKind
import se.curity.identityserver.haapi.reactnative.sdk.internal.DefaultHaapiAccessorFactoryProvider
import se.curity.identityserver.haapi.reactnative.sdk.internal.StorageResolver
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.ObjectOutputStream
import java.math.BigInteger
import java.net.URI
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec

/**
 * A sign-in made with the released SDK keeps its key after the upgrade: on a real device, with the SDK's
 * own default storage and the native SDK, a software key the released SDK left in its unencrypted store is
 * found and used for a token the new version has never seen — when the configuration names the alias the
 * released SDK bound to, and only then.
 *
 * A native app's sign-in carries over the same way: one built with a `prefix`, which React Native can't set,
 * is found through its tracking entry once the app hands the SDK the prefixed store.
 *
 * The native SDK hands out the key for a token through `OAuthTokenManager.dpopHelper`: through the token's
 * tracking entry when there is one, otherwise through the adoption the binding configures. The proof it
 * signs carries the key's public half, which identifies the key.
 */
@RunWith(AndroidJUnit4::class)
class TokenBindingAdoptionInstrumentedTest {
    private val context: Context = InstrumentationRegistry.getInstrumentation().targetContext

    @Before
    fun wipeBefore() = wipeState()

    @After
    fun wipeAfter() = wipeState()

    @Test
    fun aReleasedVersionsSoftwareKeyIsAdoptedWhenItsAliasIsNamed() {
        val released = writeReleasedVersionSoftwareKey()

        val proofKey =
            runBlocking { keyForAccessToken(UNTRACKED_ACCESS_TOKEN, migrateFromLegacyAlias = RELEASED_ALIAS) }

        assertNotNull("the released version's key was found", proofKey)
        assertEquals(publicPoint(released), proofKey)
        // It was read through the SDK's default storage, which moved it out of the unencrypted store.
        assertFalse("the unencrypted store holds no entries", rawPrefsFile(PLAINTEXT_STORE).contains("<string"))
        assertTrue("the encrypted store holds the key", rawPrefsFile(ENCRYPTED_STORE).contains(RELEASED_KEY_ENTRY))
    }

    // Adoption is opt-in: without the alias the earlier key is not found, so it can't sign for anything.
    @Test
    fun aReleasedVersionsKeyIsNotAdoptedWithoutItsAlias() {
        writeReleasedVersionSoftwareKey()

        val proofKey = runBlocking { keyForAccessToken(UNTRACKED_ACCESS_TOKEN, migrateFromLegacyAlias = null) }

        assertNull("no key resolves for a token the SDK has no record of", proofKey)
    }

    // The migration how-to's mapping for a native app built with a `prefix`: no prefix in React Native, and
    // the app's prefixed store through `StorageOption.Custom`. No alias to adopt: the tracking entry names it.
    @Test
    fun aPrefixedNativeSignInIsFoundThroughItsTrackingEntry() {
        val signedIn = writePrefixedNativeSignIn(tracked = true)

        val proofKey =
            runBlocking {
                keyForAccessToken(
                    ACCESS_TOKEN,
                    migrateFromLegacyAlias = null,
                    storageOption = StorageOption.CUSTOM,
                )
            }

        assertNotNull("the native sign-in's key was found", proofKey)
        assertEquals(publicPoint(signedIn), proofKey)
    }

    // The control: the same key without its tracking entry is not found, so the test above found it through
    // that entry and through nothing else.
    @Test
    fun aPrefixedNativeKeyIsNotFoundWithoutItsTrackingEntry() {
        writePrefixedNativeSignIn(tracked = false)

        val proofKey =
            runBlocking {
                keyForAccessToken(
                    ACCESS_TOKEN,
                    migrateFromLegacyAlias = null,
                    storageOption = StorageOption.CUSTOM,
                )
            }

        assertNull("no key resolves without the tracking entry", proofKey)
    }

    /**
     * Builds the binding through the bridge and the native SDK, exactly as `initializeForOAuth` does, and
     * returns the public point of the key the native SDK would sign proofs with for [accessToken] — or `null`
     * when it resolves none.
     */
    private suspend fun keyForAccessToken(
        accessToken: String,
        migrateFromLegacyAlias: String?,
        storageOption: StorageOption = StorageOption.DEFAULT,
    ): Pair<String, String>? {
        NativeRegistry.shared.replaceResolver(StorageResolver(context, warn = {}, info = {}))
        val configuration =
            RNHaapiConfigurationRecord().apply {
                baseUrl = "https://idsvr.example"
                tokenEndpointUrl = "https://idsvr.example/oauth/token"
                authorizationEndpointUrl = "https://idsvr.example/oauth/authorize"
                androidConfig.clientId = "adoption-test-client"
                androidConfig.keyStoreAlias = KEY_STORE_ALIAS
                androidConfig.appRedirect = "app://callback"
                androidConfig.attestationConfiguration.useAttestation = false
                androidConfig.tokenBindingConfiguration =
                    AndroidTokenBindingConfigurationRecord().apply {
                        kind = TokenBindingKind.BOUND
                        keyType = RNDpopKeyPolicy.AUTO
                        keyPairAlgorithmConfiguration = KeyPairAlgorithmConfigurationRecord()
                        this.migrateFromLegacyAlias = migrateFromLegacyAlias
                        this.storageOption = storageOption
                    }
            }
        val accessor = DefaultHaapiAccessorFactoryProvider().createForOAuth(configuration, context)
        val helper = accessor.oAuthTokenManager.dpopHelper(accessToken) ?: return null
        val proof = helper.generateProofToken("POST", URI("https://idsvr.example/api"), null, null)
        val header = JSONObject(String(Base64.decode(proof.substringBefore('.'), Base64.URL_SAFE)))
        val jwk = header.getJSONObject("jwk")
        return jwk.getString("x") to jwk.getString("y")
    }

    /** Writes a P-256 software key where, and as, the released SDK did; returns it. */
    private fun writeReleasedVersionSoftwareKey(): KeyPair {
        val keyPair = softwareKey()
        assertTrue(
            "seeded",
            context
                .getSharedPreferences(PLAINTEXT_STORE, Context.MODE_PRIVATE)
                .edit()
                .putString(RELEASED_KEY_ENTRY, serialized(keyPair))
                .commit(),
        )
        return keyPair
    }

    /**
     * Writes what a native app built with `prefix = PREFIX` holds for one sign-in on a software key: the key
     * under its prefixed session alias, in the prefixed encrypted store, and — when [tracked] — the sign-in's
     * tracking entries, written by the native SDK's own tracker. Registers that store as the app's
     * `StorageOption.Custom` store; returns the key.
     */
    @OptIn(InternalHaapiApi::class)
    private fun writePrefixedNativeSignIn(tracked: Boolean): KeyPair {
        val store = StorageBuilder.encrypted(context, PREFIX)
        val stem = DpopKeyAliases.perManager(KEY_STORE_ALIAS, PREFIX)
        val alias = DpopKeyAliases.session(stem)
        val keyPair = softwareKey()
        store.set(serialized(keyPair), "HAAPI_KP_FALLBACK$alias")
        if (tracked) {
            DpopKeyTracker.create(store, stem).recordIssuance(alias, ACCESS_TOKEN, REFRESH_TOKEN)
        }
        NativeRegistry.shared.replaceResolver(CustomStore(store))
        return keyPair
    }

    private fun softwareKey(): KeyPair =
        KeyPairGenerator
            .getInstance("EC")
            .apply { initialize(ECGenParameterSpec("secp256r1")) }
            .generateKeyPair()

    /** [keyPair] as the native SDK stores a software key. */
    private fun serialized(keyPair: KeyPair): String {
        val bytes = ByteArrayOutputStream().also { ObjectOutputStream(it).use { out -> out.writeObject(keyPair) } }
        return Base64.encodeToString(bytes.toByteArray(), Base64.DEFAULT)
    }

    /** The JWK `x`/`y` members (base64url, unpadded, 32 bytes each) of [keyPair]'s public key. */
    private fun publicPoint(keyPair: KeyPair): Pair<String, String> {
        val point = (keyPair.public as ECPublicKey).w
        return coordinate(point.affineX) to coordinate(point.affineY)
    }

    private fun coordinate(value: BigInteger): String {
        val raw =
            value.toByteArray().let {
                if (it.size >
                    COORDINATE_BYTES
                ) {
                    it.takeLast(COORDINATE_BYTES).toByteArray()
                } else {
                    it
                }
            }
        val padded = ByteArray(COORDINATE_BYTES - raw.size) + raw
        return Base64.encodeToString(padded, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }

    private fun rawPrefsFile(name: String): String {
        context.getSharedPreferences(name, Context.MODE_PRIVATE).edit().commit()
        return File(context.dataDir, "shared_prefs/$name.xml").takeIf { it.exists() }?.readText().orEmpty()
    }

    private fun wipeState() {
        NativeRegistry.shared.replaceResolver(CustomStore(null))
        listOf(PLAINTEXT_STORE, ENCRYPTED_STORE, PREFIXED_STORE).forEach { name ->
            context
                .getSharedPreferences(name, Context.MODE_PRIVATE)
                .edit()
                .clear()
                .commit()
            context.deleteSharedPreferences(name)
        }
        KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.run {
            aliases().toList().forEach { alias ->
                if (alias in listOf(ENCRYPTED_STORE_KEK, PREFIXED_STORE_KEK, RELEASED_ALIAS) ||
                    alias.contains(KEY_STORE_ALIAS)
                ) {
                    deleteEntry(alias)
                }
            }
        }
    }

    /** The app's `StorageOption.Custom` store, as an app registers it; none when [storage] is `null`. */
    private class CustomStore(
        private val storage: Storage?,
    ) : Resolver<RNStorage> {
        override fun resolve(key: String): RNStorage? =
            storage?.takeIf { key == StorageOption.CUSTOM.value }?.let { store ->
                object : RNStorage {
                    override fun delete(key: String) = store.delete(key)

                    override fun get(key: String): String? = store.get(key)

                    override fun getAll(): Map<String, String> = store.getAll()

                    override fun set(
                        value: String,
                        key: String,
                    ) = store.set(value, key)
                }
            }
    }

    private companion object {
        const val PLAINTEXT_STORE = "haapi_token_bound_storage"
        const val ENCRYPTED_STORE = "haapi-dpop-encrypted-store"
        const val ENCRYPTED_STORE_KEK = "haapi-dpop-store-kek"
        const val PREFIX = "acme"
        const val PREFIXED_STORE = "$PREFIX-$ENCRYPTED_STORE"
        const val PREFIXED_STORE_KEK = "$PREFIX-$ENCRYPTED_STORE_KEK"
        const val RELEASED_ALIAS = "haapi_token_bound_key"
        const val RELEASED_KEY_ENTRY = "HAAPI_KP_FALLBACK$RELEASED_ALIAS"
        const val KEY_STORE_ALIAS = "adoption-test"
        const val UNTRACKED_ACCESS_TOKEN = "an-access-token-this-install-never-saw"
        const val ACCESS_TOKEN = "a-native-sign-in-access-token"
        const val REFRESH_TOKEN = "a-native-sign-in-refresh-token"
        const val COORDINATE_BYTES = 32
    }
}
