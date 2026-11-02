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
import io.mockk.mockk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import se.curity.identityserver.haapi.android.driver.DpopKeyPolicy
import se.curity.identityserver.haapi.android.driver.KeyPairAlgorithmConfig
import se.curity.identityserver.haapi.reactnative.sdk.configurations.AndroidTokenBindingConfigurationRecord
import se.curity.identityserver.haapi.reactnative.sdk.configurations.AndroidTokenBoundConfigurationRecord
import se.curity.identityserver.haapi.reactnative.sdk.configurations.HttpUrlConnectionProviderOption
import se.curity.identityserver.haapi.reactnative.sdk.configurations.KeyPairAlgorithmConfigurationRecord
import se.curity.identityserver.haapi.reactnative.sdk.configurations.RNDpopKeyPolicy
import se.curity.identityserver.haapi.reactnative.sdk.configurations.RNHaapiConfigurationRecord
import se.curity.identityserver.haapi.reactnative.sdk.configurations.StorageOption
import se.curity.identityserver.haapi.reactnative.sdk.configurations.TokenBindingKind
import se.curity.identityserver.haapi.reactnative.sdk.internal.InvalidConfigurationException
import se.curity.identityserver.haapi.reactnative.sdk.internal.RNHttpURLConnectionProvider

/**
 * Sees every lookup the registry makes and answers none, so the resolvers behind it are unaffected.
 * Registered with `replaceResolver`, so there is only ever one instance in the shared registry.
 */
private class LookupRecorder : Resolver<Any> {
    val keys = mutableListOf<String>()

    override fun resolve(key: String): Any? {
        keys.add(key)
        return null
    }
}

/** In-memory storage served for each key in [serves], so a bound conversion has storage to resolve. */
private class InMemoryStorageResolver(
    private val serves: Set<String> = setOf(StorageOption.CUSTOM.value),
) : Resolver<RNStorage> {
    val values = mutableMapOf<String, String>()

    private val storage =
        object : RNStorage {
            override fun delete(key: String) {
                values.remove(key)
            }

            override fun get(key: String): String? = values[key]

            override fun getAll(): Map<String, String> = values.toMap()

            override fun set(
                value: String,
                key: String,
            ) {
                values[key] = value
            }
        }

    override fun resolve(key: String): RNStorage? = storage.takeIf { key in serves }
}

/** Serves a custom HTTP connection provider, for the configuration branch that uses one. */
private class CustomHttpConnectionResolver : Resolver<RNHttpURLConnectionProvider> {
    override fun resolve(key: String): RNHttpURLConnectionProvider? =
        RNHttpURLConnectionProvider { url -> url.openConnection() as java.net.HttpURLConnection }
            .takeIf { key == HttpUrlConnectionProviderOption.CUSTOM.value }
}

class TokenBindingConversionTest {
    private val recorder = LookupRecorder()
    private val storage = InMemoryStorageResolver()
    private val clock: () -> Long = { 0L }
    private val context = mockk<Context>(relaxed = true)

    @Before
    fun setUp() {
        NativeRegistry.shared.replaceResolver(storage)
        NativeRegistry.shared.replaceResolver(recorder)
    }

    private fun boundRecord(): AndroidTokenBindingConfigurationRecord =
        AndroidTokenBindingConfigurationRecord().apply {
            kind = TokenBindingKind.BOUND
            keyType = RNDpopKeyPolicy.HARDWARE
            keyPairAlgorithmConfiguration = KeyPairAlgorithmConfigurationRecord().apply { jwtAlgorithm = "ES384" }
            migrateFromLegacyAlias = "legacy_key"
            storageOption = StorageOption.CUSTOM
        }

    @Test
    fun boundRecordConvertsToTheNativeBindingWithTheChosenParameters() {
        val converted = boundRecord().toNativeTokenBinding(context, clock)

        assertNotNull(converted)
        assertEquals(DpopKeyPolicy.Hardware, converted!!.keyType)
        assertEquals(KeyPairAlgorithmConfig.ES384, converted.keyPairAlgorithmConfig)
        assertEquals("legacy_key", converted.migrateFromLegacyAlias)
        assertSame(clock, converted.currentTimeMillisProvider)
        // A prefix would move the binding to another store, outside the SDK's own storage.
        assertNull(converted.prefix)
    }

    @Test
    fun eachKeyTypeMapsToTheNativePolicy() {
        val expected =
            mapOf(
                RNDpopKeyPolicy.AUTO to DpopKeyPolicy.Auto,
                RNDpopKeyPolicy.HARDWARE to DpopKeyPolicy.Hardware,
                RNDpopKeyPolicy.SOFTWARE to DpopKeyPolicy.Software,
            )
        expected.forEach { (keyType, policy) ->
            val converted = boundRecord().apply { this.keyType = keyType }.toNativeTokenBinding(context, clock)

            assertEquals(policy, converted!!.keyType)
        }
    }

    // The binding must use the storage the app (or the SDK's default storage) registered, never the native
    // builder's own default: that would skip the SDK's migration of earlier values and its unavailable-store
    // handling.
    @Test
    fun boundRecordUsesTheRegisteredStorageForItsOption() {
        val converted = boundRecord().toNativeTokenBinding(context, clock)

        converted!!.storage.set("value", "entry")

        assertEquals("value", storage.values["entry"])
    }

    @Test
    fun defaultStorageOptionResolvesTheDefaultStorage() {
        val defaultStorage = InMemoryStorageResolver(serves = setOf(StorageOption.DEFAULT.value))
        NativeRegistry.shared.replaceResolver(defaultStorage)

        val converted =
            boundRecord().apply { storageOption = StorageOption.DEFAULT }.toNativeTokenBinding(context, clock)
        converted!!.storage.set("value", "entry")

        assertEquals("value", defaultStorage.values["entry"])
    }

    // As in the native SDK, a blank alias names no key.
    @Test
    fun blankOrMissingAliasToAdoptMeansNoAdoption() {
        listOf(null, "", "   ").forEach { alias ->
            val converted =
                boundRecord().apply { migrateFromLegacyAlias = alias }.toNativeTokenBinding(context, clock)

            assertNull(converted!!.migrateFromLegacyAlias)
        }
    }

    @Test
    fun boundRecordMissingARequiredFieldIsAnInvalidConfiguration() {
        val incomplete =
            listOf(
                boundRecord().apply { keyType = null },
                boundRecord().apply { keyPairAlgorithmConfiguration = null },
                boundRecord().apply { storageOption = null },
            )
        incomplete.forEach { record ->
            assertThrows(InvalidConfigurationException::class.java) { record.toNativeTokenBinding(context, clock) }
        }
    }

    @Test
    fun boundRecordWhoseStorageHasNoRegisteredResolverIsAnInvalidConfiguration() {
        NativeRegistry.shared.replaceResolver(InMemoryStorageResolver(serves = emptySet()))

        assertThrows(InvalidConfigurationException::class.java) { boundRecord().toNativeTokenBinding(context, clock) }
    }

    // Binding a developer asked for must never silently become "no binding" — a value without a mode is
    // rejected.
    @Test
    fun recordWithoutAKindIsAnInvalidConfiguration() {
        val record = boundRecord().apply { kind = null }

        assertThrows(InvalidConfigurationException::class.java) { record.toNativeTokenBinding(context, clock) }
    }

    // No setting at all is the only way "no binding" is read without a mode.
    @Test
    fun absentRecordConvertsToNoTokenBinding() {
        val record: AndroidTokenBindingConfigurationRecord? = null

        assertNull(record.toNativeTokenBinding(context, clock))
        assertEquals(emptyList<String>(), recorder.keys)
    }

    // Leftover key fields must not turn "no binding" back into binding, and no storage is looked up.
    @Test
    fun unboundRecordConvertsToNoTokenBindingWithoutResolvingStorage() {
        val record: AndroidTokenBindingConfigurationRecord? =
            AndroidTokenBindingConfigurationRecord().apply {
                kind = TokenBindingKind.UNBOUND
                keyType = RNDpopKeyPolicy.AUTO
                storageOption = StorageOption.DEFAULT
            }

        assertNull(record.toNativeTokenBinding(context, clock))
        assertEquals(emptyList<String>(), recorder.keys)
    }

    private fun configWith(
        binding: AndroidTokenBindingConfigurationRecord?,
        deprecated: AndroidTokenBoundConfigurationRecord? = null,
        httpProvider: HttpUrlConnectionProviderOption = HttpUrlConnectionProviderOption.DEFAULT,
    ) = RNHaapiConfigurationRecord().apply {
        baseUrl = "https://idsvr.example"
        tokenEndpointUrl = "https://idsvr.example/token"
        authorizationEndpointUrl = "https://idsvr.example/authorize"
        androidConfig.clientId = "client"
        androidConfig.appRedirect = "app://callback"
        androidConfig.httpUrlConnectionProviderOption = httpProvider
        androidConfig.tokenBindingConfiguration = binding
        @Suppress("DEPRECATION")
        androidConfig.tokenBoundConfiguration = deprecated
    }

    // The deprecated native setting is never used: every bound configuration goes through the builder.
    @Suppress("DEPRECATION")
    @Test
    fun boundConfigurationSetsOnlyTheBuilderBindingWithEitherConnectionProvider() {
        NativeRegistry.shared.replaceResolver(CustomHttpConnectionResolver())
        HttpUrlConnectionProviderOption.entries.forEach { provider ->
            val configuration = configWith(boundRecord(), httpProvider = provider).toHaapiConfiguration(context)

            assertNotNull(configuration.dpopTokenBinding)
            assertNull(configuration.tokenBoundConfiguration)
        }
    }

    @Suppress("DEPRECATION")
    @Test
    fun unboundConfigurationBuildsANativeConfigurationWithoutTokenBinding() {
        val unbound = AndroidTokenBindingConfigurationRecord().apply { kind = TokenBindingKind.UNBOUND }

        val configuration = configWith(unbound).toHaapiConfiguration(context)

        assertNull(configuration.dpopTokenBinding)
        assertNull(configuration.tokenBoundConfiguration)
    }

    // The native SDK ignores the key policy under attestation; the bridge passes it on rather than rejecting.
    @Test
    fun keyTypeIsAcceptedWhileAttestationIsOn() {
        val record = configWith(boundRecord()).apply { androidConfig.attestationConfiguration.useAttestation = true }

        val configuration = record.toHaapiConfiguration(context)

        assertEquals(DpopKeyPolicy.Hardware, configuration.dpopTokenBinding!!.keyType)
    }

    // A configuration built without the factories may still carry the deprecated setting. It stays bound,
    // adopting the key at its alias with the same algorithm and storage, so its sign-ins keep refreshing.
    @Test
    fun deprecatedSettingStaysBoundAdoptingTheKeyAtItsAlias() {
        val deprecated =
            AndroidTokenBoundConfigurationRecord().apply {
                keyAlias = "app_key"
                keyPairAlgorithmConfiguration = KeyPairAlgorithmConfigurationRecord().apply { jwtAlgorithm = "ES384" }
                storageOption = StorageOption.CUSTOM
            }

        val binding = configWith(null, deprecated).toHaapiConfiguration(context).dpopTokenBinding

        assertNotNull(binding)
        assertEquals("app_key", binding!!.migrateFromLegacyAlias)
        assertEquals(KeyPairAlgorithmConfig.ES384, binding.keyPairAlgorithmConfig)
        assertEquals(DpopKeyPolicy.Auto, binding.keyType)
        binding.storage.set("value", "entry")
        assertEquals("value", storage.values["entry"])
    }

    // Missing fields take the defaults the deprecated shape always had.
    @Test
    fun deprecatedSettingWithoutParametersTakesTheReleasedDefaults() {
        val defaultStorage = InMemoryStorageResolver(serves = setOf(StorageOption.DEFAULT.value))
        NativeRegistry.shared.replaceResolver(defaultStorage)

        val binding =
            configWith(null, AndroidTokenBoundConfigurationRecord()).toHaapiConfiguration(context).dpopTokenBinding

        assertEquals("haapi_token_bound_key", binding!!.migrateFromLegacyAlias)
        assertEquals(KeyPairAlgorithmConfig.ES256, binding.keyPairAlgorithmConfig)
        binding.storage.set("value", "entry")
        assertEquals("value", defaultStorage.values["entry"])
    }

    @Test
    fun bothSettingsAtOnceAreAnInvalidConfiguration() {
        val record =
            configWith(
                AndroidTokenBindingConfigurationRecord().apply { kind = TokenBindingKind.UNBOUND },
                AndroidTokenBoundConfigurationRecord().apply { keyAlias = "app_key" },
            )

        assertThrows(InvalidConfigurationException::class.java) { record.toHaapiConfiguration(context) }
    }
}
