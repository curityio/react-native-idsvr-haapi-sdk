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
package se.curity.identityserver.haapi.reactnative.sdk.configurations

import expo.modules.kotlin.types.EnumTypeConverter
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import se.curity.identityserver.haapi.android.driver.ClientAuthenticationMethodConfiguration
import se.curity.identityserver.haapi.android.driver.ClientAuthenticationMethodConfiguration.SignedJwt.Asymmetric.AlgorithmIdentifier
import se.curity.identityserver.haapi.android.driver.ClientAuthenticationMethodConfiguration.SignedJwt.Symmetric.SignatureAlgorithm
import se.curity.identityserver.haapi.reactnative.sdk.NativeRegistry
import se.curity.identityserver.haapi.reactnative.sdk.Resolver
import se.curity.identityserver.haapi.reactnative.sdk.internal.HaapiErrorNormalizer
import java.security.KeyStore
import javax.crypto.spec.SecretKeySpec

/**
 * Serves key stores for the client and server options only; `alternateClient` stays unregistered.
 * The stores are empty unless [clientEntry] puts one entry in the client store — the native
 * asymmetric JWT configuration refuses an empty store.
 */
private class ClientAndServerKeyStores(
    private val clientEntry: Boolean = false,
) : Resolver<KeyStore> {
    override fun resolve(key: String): KeyStore? =
        when (key) {
            KeyStoreOption.CLIENT.value -> keyStore(withEntry = clientEntry)
            KeyStoreOption.SERVER.value -> keyStore(withEntry = false)
            else -> null
        }

    private fun keyStore(withEntry: Boolean) =
        KeyStore.getInstance("PKCS12").apply {
            load(null, null)
            if (withEntry) {
                setEntry(
                    "client-key",
                    KeyStore.SecretKeyEntry(SecretKeySpec(ByteArray(32), "HmacSHA256")),
                    KeyStore.PasswordProtection("password".toCharArray()),
                )
            }
        }
}

/** Converts [value] the way Expo converts a JS string into a record's enum field. */
private inline fun <reified T : Enum<T>> fromJs(value: String): T = EnumTypeConverter(T::class.java).convert(value) as T

/**
 * Every incomplete client-authentication configuration must report the same invalid-configuration
 * error as iOS (code, category and recovery), not `HAAPI_UNEXPECTED`.
 *
 * The configuration is also logged as `toString()` at init (debug level), so its string form must
 * never carry the client's credentials: a shared secret, a PKCS#12 passphrase or a JWT signing key.
 */
class ClientAuthenticationMethodConfigurationRecordTest {
    private val credentials = listOf(SECRET, PASSPHRASE, SIGNING_KEY)

    @Before
    fun setUp() {
        NativeRegistry.shared.replaceResolver(ClientAndServerKeyStores())
    }

    private fun record(
        kind: ClientAuthenticationKind,
        configure: ClientAuthenticationMethodConfigurationRecord.() -> Unit = {},
    ) = ClientAuthenticationMethodConfigurationRecord().apply {
        this.kind = kind
        configure()
    }

    private fun assertInvalidConfiguration(record: ClientAuthenticationMethodConfigurationRecord) {
        val thrown =
            try {
                record.toClientAuthenticationMethod()
                fail("Expected an invalid configuration for $record")
                return
            } catch (e: Exception) {
                e
            }
        val normalized = HaapiErrorNormalizer.normalize(thrown)
        val envelope = JSONObject(normalized.message!!.removePrefix("HAAPI_ERROR_V1::"))
        assertEquals("$record", "HAAPI_INVALID_CONFIGURATION", normalized.code)
        assertEquals("configuration", envelope.getString("category"))
        val recovery = envelope.getJSONObject("recovery")
        assertEquals("unrecoverable", recovery.getString("kind"))
        assertEquals("modifyConfiguration", recovery.getJSONObject("action").getString("kind"))
    }

    @Test
    fun secretWithoutASecretIsAnInvalidConfiguration() {
        assertInvalidConfiguration(record(ClientAuthenticationKind.SECRET))
    }

    @Test
    fun mtlsWithAMissingOptionOrUnregisteredKeyStoreIsAnInvalidConfiguration() {
        val complete: ClientAuthenticationMethodConfigurationRecord.() -> Unit = {
            clientKeyStoreOption = KeyStoreOption.CLIENT
            serverKeyStoreOption = KeyStoreOption.SERVER
        }
        assertInvalidConfiguration(
            record(ClientAuthenticationKind.MTLS) {
                complete()
                clientKeyStoreOption = null
            },
        )
        assertInvalidConfiguration(
            record(ClientAuthenticationKind.MTLS) {
                complete()
                serverKeyStoreOption = null
            },
        )
        assertInvalidConfiguration(
            record(ClientAuthenticationKind.MTLS) {
                complete()
                clientKeyStoreOption = KeyStoreOption.ALTERNATE_CLIENT
            },
        )
        assertInvalidConfiguration(
            record(ClientAuthenticationKind.MTLS) {
                complete()
                serverKeyStoreOption = KeyStoreOption.ALTERNATE_CLIENT
            },
        )
    }

    @Test
    fun mtlsKeyPinningWithAMissingOptionOrUnregisteredKeyStoreIsAnInvalidConfiguration() {
        assertInvalidConfiguration(record(ClientAuthenticationKind.MTLS_KEY_PINNING))
        assertInvalidConfiguration(
            record(
                ClientAuthenticationKind.MTLS_KEY_PINNING,
            ) { clientKeyStoreOption = KeyStoreOption.ALTERNATE_CLIENT },
        )
    }

    @Test
    fun jwtAsymmetricWithAMissingFieldOrUnregisteredKeyStoreIsAnInvalidConfiguration() {
        val complete: ClientAuthenticationMethodConfigurationRecord.() -> Unit = {
            alias = "client-key"
            asymmetricAlgorithm = JwtAsymmetricAlgorithm.entries.first()
        }
        assertInvalidConfiguration(
            record(ClientAuthenticationKind.JWT_ASYMMETRIC) {
                complete()
                alias = null
            },
        )
        assertInvalidConfiguration(
            record(ClientAuthenticationKind.JWT_ASYMMETRIC) {
                complete()
                asymmetricAlgorithm = null
            },
        )
        assertInvalidConfiguration(
            record(ClientAuthenticationKind.JWT_ASYMMETRIC) {
                complete()
                clientKeyStoreOption = KeyStoreOption.ALTERNATE_CLIENT
            },
        )
    }

    @Test
    fun jwtSymmetricWithAMissingFieldIsAnInvalidConfiguration() {
        val complete: ClientAuthenticationMethodConfigurationRecord.() -> Unit = {
            secretKey = "secret-key"
            symmetricAlgorithm = JwtSymmetricAlgorithm.entries.first()
        }
        assertInvalidConfiguration(
            record(ClientAuthenticationKind.JWT_SYMMETRIC) {
                complete()
                secretKey = null
            },
        )
        assertInvalidConfiguration(
            record(ClientAuthenticationKind.JWT_SYMMETRIC) {
                complete()
                symmetricAlgorithm = null
            },
        )
    }

    // Regression pins: complete configurations still convert (same set as iOS; MTLS needs a populated
    // key store the native type validates, so it isn't pinned here).
    @Test
    fun completeConfigurationsStillConvert() {
        assertTrue(
            record(ClientAuthenticationKind.NONE).toClientAuthenticationMethod()
                is ClientAuthenticationMethodConfiguration.None,
        )
        assertTrue(
            record(ClientAuthenticationKind.SECRET) { secret = "s" }.toClientAuthenticationMethod()
                is ClientAuthenticationMethodConfiguration.Secret,
        )
        assertTrue(
            record(ClientAuthenticationKind.JWT_SYMMETRIC) {
                secretKey = "k"
                symmetricAlgorithm = JwtSymmetricAlgorithm.entries.first()
            }.toClientAuthenticationMethod() is ClientAuthenticationMethodConfiguration.SignedJwt.Symmetric,
        )
    }

    // The TS layer sends the uppercase JOSE names; each must convert and reach the native SDK as
    // that same algorithm (iOS is held to the same values by its decoding tests).
    @Test
    fun everySymmetricAlgorithmTheTsLayerSendsSignsWithThatAlgorithm() {
        val expected =
            listOf(
                "HS256" to SignatureAlgorithm.HS256,
                "HS384" to SignatureAlgorithm.HS384,
                "HS512" to SignatureAlgorithm.HS512,
            )
        expected.forEach { (tsValue, native) ->
            val method =
                record(ClientAuthenticationKind.JWT_SYMMETRIC) {
                    secretKey = "a-shared-secret"
                    symmetricAlgorithm = fromJs<JwtSymmetricAlgorithm>(tsValue)
                }.toClientAuthenticationMethod() as ClientAuthenticationMethodConfiguration.SignedJwt.Symmetric
            assertEquals(tsValue, native, method.signatureAlgorithm)
            assertEquals(tsValue, tsValue, method.signatureAlgorithm.identifier)
        }
    }

    @Test
    fun everyAsymmetricAlgorithmTheTsLayerSendsReachesTheNativeSdkUnchanged() {
        NativeRegistry.shared.replaceResolver(ClientAndServerKeyStores(clientEntry = true))
        val expected =
            listOf(
                "RS256" to AlgorithmIdentifier.RS256,
                "RS384" to AlgorithmIdentifier.RS384,
                "RS512" to AlgorithmIdentifier.RS512,
                "PS256" to AlgorithmIdentifier.PS256,
                "PS384" to AlgorithmIdentifier.PS384,
                "PS512" to AlgorithmIdentifier.PS512,
                "ES256" to AlgorithmIdentifier.ES256,
                "ES384" to AlgorithmIdentifier.ES384,
                "ES512" to AlgorithmIdentifier.ES512,
            )
        expected.forEach { (tsValue, native) ->
            val method =
                record(ClientAuthenticationKind.JWT_ASYMMETRIC) {
                    alias = "client-key"
                    asymmetricAlgorithm = fromJs<JwtAsymmetricAlgorithm>(tsValue)
                }.toClientAuthenticationMethod() as ClientAuthenticationMethodConfiguration.SignedJwt.Asymmetric
            assertEquals(tsValue, native, method.algorithmIdentifier)
            assertEquals(tsValue, tsValue, method.algorithmIdentifier.identifier)
        }
    }

    @Test
    fun aLowercaseAlgorithmIsRejectedByTheBridgeConversion() {
        listOf(
            "hs256" to JwtSymmetricAlgorithm::class.java,
            "es256" to JwtAsymmetricAlgorithm::class.java,
        ).forEach { (value, type) ->
            try {
                EnumTypeConverter(type).convert(value)
                fail("'$value' was accepted as ${type.simpleName}")
            } catch (expected: IllegalArgumentException) {
                // Expo found no entry whose value is exactly the string sent.
            }
        }
    }

    @Test
    fun stringFormNamesNoCredential() {
        val record = recordWithEveryCredential()

        val text = record.toString()

        credentials.forEach { assertFalse("leaks a credential: $text", text.contains(it)) }
    }

    @Test
    fun stringFormStillShowsWhichCredentialsAreSet() {
        val json = JSONObject(recordWithEveryCredential().toString())

        assertEquals("<redacted>", json.getString("secret"))
        assertEquals("<redacted>", json.getString("pkcs12Passphrase"))
        assertEquals("<redacted>", json.getString("secretKey"))
        assertTrue(
            "an absent credential stays absent",
            JSONObject(ClientAuthenticationMethodConfigurationRecord().toString()).isNull("secret"),
        )
    }

    @Test
    fun stringFormKeepsTheNonSecretFields() {
        val json = JSONObject(recordWithEveryCredential().toString())

        assertEquals("jwtSymmetric", json.getString("kind"))
        assertEquals("HS256", json.getString("symmetricAlgorithm"))
        assertEquals("client.p12", json.getString("pkcs12Filename"))
    }

    @Test
    fun theLoggedConfigurationNamesNoCredential() {
        // What `initializeForHaapi` / `initializeForOAuth` log: the whole configuration, which nests
        // the client authentication record.
        val configuration =
            RNHaapiConfigurationRecord().apply {
                androidConfig =
                    AndroidConfigurationRecord().apply {
                        clientAuthenticationMethodConfiguration = recordWithEveryCredential()
                    }
            }

        val text = configuration.toString()

        credentials.forEach { assertFalse("leaks a credential: $text", text.contains(it)) }
    }

    private fun recordWithEveryCredential() =
        ClientAuthenticationMethodConfigurationRecord().apply {
            kind = ClientAuthenticationKind.JWT_SYMMETRIC
            secret = SECRET
            pkcs12Filename = "client.p12"
            pkcs12Passphrase = PASSPHRASE
            symmetricAlgorithm = JwtSymmetricAlgorithm.HS256
            secretKey = SIGNING_KEY
        }

    private companion object {
        const val SECRET = "client-secret-value"
        const val PASSPHRASE = "pkcs12-passphrase-value"
        const val SIGNING_KEY = "jwt-signing-key-value"
    }
}
