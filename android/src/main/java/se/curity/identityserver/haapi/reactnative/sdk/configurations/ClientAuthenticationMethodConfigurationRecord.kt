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

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.json.JSONArray
import org.json.JSONObject
import se.curity.identityserver.haapi.android.driver.ClientAuthenticationMethodConfiguration
import se.curity.identityserver.haapi.reactnative.sdk.NativeRegistry
import se.curity.identityserver.haapi.reactnative.sdk.internal.InvalidConfigurationException

/**
 * Defines how the OAuth client authenticates when calling the token endpoint.
 *
 * This is a "flat" Record that captures every Android-relevant field from the TypeScript
 * discriminated union `ClientAuthenticationMethodConfiguration`. The [kind] field determines
 * which variant was sent; all other fields are optional and only populated for the relevant
 * variant.
 *
 * MTLS and JWT asymmetric variants resolve `KeyStore` instances via
 * [NativeRegistry][se.curity.identityserver.haapi.reactnative.sdk.NativeRegistry] using
 * [clientKeyStoreOption] and [serverKeyStoreOption].
 *
 * | `kind`             | Relevant fields                                                                     |
 * |--------------------|-------------------------------------------------------------------------------------|
 * | `"none"`           | *(none)*                                                                     |
 * | `"secret"`         | [secret]                                                                     |
 * | `"mtls"`           | [clientKeyStoreOption], [serverKeyStoreOption]                                |
 * | `"mtlsKeyPinning"` | [clientKeyStoreOption], [isValidatingHostname], [serverKeyPinnings]           |
 * | `"jwtAsymmetric"`  | [asymmetricAlgorithm], [clientKeyStoreOption], [alias]                       |
 * | `"jwtSymmetric"`   | [symmetricAlgorithm], [secretKey]                                            |
 */
class ClientAuthenticationMethodConfigurationRecord : Record {
    /** Discriminator identifying which authentication method variant was sent from TypeScript. */
    @Field var kind: ClientAuthenticationKind = ClientAuthenticationKind.NONE

    // -- Secret --

    /** The shared client secret (when `kind == "secret"`). */
    @Field var secret: String? = null

    // -- MTLS / MTLS Key Pinning (shared) --

    /** PKCS#12 filename (without extension) containing the client certificate and key. */
    @Field var pkcs12Filename: String? = null

    /** Passphrase for the PKCS#12 file. */
    @Field var pkcs12Passphrase: String? = null

    // -- MTLS only --

    /** Server PEM filename (without extension) for trust evaluation (when `kind == "mtls"`). */
    @Field var serverPEMFilename: String? = null

    /** Whether the server certificate should be validated against the hostname (when `kind == "mtls"`). */
    @Field var isValidatingHostname: Boolean? = null

    // -- MTLS Key Pinning only --

    /** Key pinnings for the server public key (when `kind == "mtlsKeyPinning"`). */
    @Field var serverKeyPinnings: List<KeyPinningRecord>? = null

    // -- JWT Asymmetric only --

    /** Asymmetric signing algorithm, e.g. [JwtAsymmetricAlgorithm.ES256] (when `kind == "jwtAsymmetric"`). */
    @Field var asymmetricAlgorithm: JwtAsymmetricAlgorithm? = null

    /** Alias to use in the KeyStore (when `kind == "jwtAsymmetric"`). */
    @Field var alias: String? = null

    // -- JWT Symmetric only --

    /** Symmetric signing algorithm, e.g. [JwtSymmetricAlgorithm.HS256] (when `kind == "jwtSymmetric"`). */
    @Field var symmetricAlgorithm: JwtSymmetricAlgorithm? = null

    /** The shared secret key used for signing (when `kind == "jwtSymmetric"`). */
    @Field var secretKey: String? = null

    // -- KeyStore options (Android) --

    /** Identifies the client KeyStore resolver in NativeRegistry (when `kind` is MTLS or JWT). */
    @Field var clientKeyStoreOption: KeyStoreOption? = null

    /** Identifies the server trust store resolver in NativeRegistry (when `kind == "mtls"`). */
    @Field var serverKeyStoreOption: KeyStoreOption? = null

    // Logged at init, so the credentials appear only as whether they are set, never as their values.
    override fun toString(): String =
        JSONObject()
            .put("kind", kind.value)
            .put("secret", redacted(secret))
            .put("pkcs12Filename", pkcs12Filename)
            .put("pkcs12Passphrase", redacted(pkcs12Passphrase))
            .put("serverPEMFilename", serverPEMFilename)
            .put("isValidatingHostname", isValidatingHostname)
            .put(
                "serverKeyPinnings",
                serverKeyPinnings?.let { list ->
                    JSONArray(list.map { JSONObject(it.toString()) })
                },
            ).put("asymmetricAlgorithm", asymmetricAlgorithm?.value)
            .put("alias", alias)
            .put("symmetricAlgorithm", symmetricAlgorithm?.value)
            .put("secretKey", redacted(secretKey))
            .put("clientKeyStoreOption", clientKeyStoreOption?.value)
            .put("serverKeyStoreOption", serverKeyStoreOption?.value)
            .toString()

    /**
     * Converts the [serverKeyPinnings] list into a set of native [KeyPinning][ClientAuthenticationMethodConfiguration.MtlsKeyHash.KeyPinning] entries.
     *
     * Returns an empty set if no key pinnings are configured.
     */
    fun resolveServerKeyPinnings(): Set<ClientAuthenticationMethodConfiguration.MtlsKeyHash.KeyPinning> =
        serverKeyPinnings
            ?.map {
                ClientAuthenticationMethodConfiguration.MtlsKeyHash.KeyPinning(
                    hostname = it.hostname,
                    publicKeyHash = it.publicKeyHash,
                )
            }?.toSet() ?: emptySet()

    /**
     * Converts this record to a native [ClientAuthenticationMethodConfiguration] by dispatching on [kind].
     *
     * MTLS and JWT asymmetric variants resolve `KeyStore` instances via [NativeRegistry].
     *
     * @throws InvalidConfigurationException if a required field is missing or a `KeyStore` cannot be resolved.
     */
    fun toClientAuthenticationMethod(): ClientAuthenticationMethodConfiguration =
        when (kind) {
            ClientAuthenticationKind.NONE -> {
                ClientAuthenticationMethodConfiguration.None
            }

            ClientAuthenticationKind.SECRET -> {
                ClientAuthenticationMethodConfiguration.Secret(
                    secret = secret ?: throw InvalidConfigurationException("secret: secret is required."),
                )
            }

            ClientAuthenticationKind.MTLS -> {
                val clientKey =
                    clientKeyStoreOption?.value
                        ?: throw InvalidConfigurationException(
                            "mtls: clientKeyStoreOption is required.",
                        )
                val serverKey =
                    serverKeyStoreOption?.value
                        ?: throw InvalidConfigurationException(
                            "mtls: serverKeyStoreOption is required.",
                        )
                val clientKeyStore =
                    NativeRegistry.shared.keyStore(clientKey)
                        ?: throw InvalidConfigurationException(
                            "mtls: no client KeyStore registered for key '$clientKey'.",
                        )
                val serverTrustStore =
                    NativeRegistry.shared.keyStore(serverKey)
                        ?: throw InvalidConfigurationException(
                            "mtls: no server trust store registered for key '$serverKey'.",
                        )
                ClientAuthenticationMethodConfiguration.Mtls(
                    clientKeyStore = clientKeyStore,
                    clientKeyStorePassword = charArrayOf(),
                    serverTrustStore = serverTrustStore,
                )
            }

            ClientAuthenticationKind.MTLS_KEY_PINNING -> {
                val clientKey =
                    clientKeyStoreOption?.value
                        ?: throw InvalidConfigurationException(
                            "mtlsKeyPinning: clientKeyStoreOption is required.",
                        )
                val clientKeyStore =
                    NativeRegistry.shared.keyStore(clientKey)
                        ?: throw InvalidConfigurationException(
                            "mtlsKeyPinning: no client KeyStore registered for key '$clientKey'.",
                        )
                ClientAuthenticationMethodConfiguration.MtlsKeyHash(
                    clientKeyStore = clientKeyStore,
                    clientKeyStorePassword = charArrayOf(),
                    serverKeyPinnings = resolveServerKeyPinnings(),
                )
            }

            ClientAuthenticationKind.JWT_ASYMMETRIC -> {
                val alias =
                    alias
                        ?: throw InvalidConfigurationException("jwtAsymmetric: alias cannot be null.")
                val algorithm =
                    asymmetricAlgorithm
                        ?: throw InvalidConfigurationException("jwtAsymmetric: asymmetricAlgorithm cannot be null.")
                val clientKey = clientKeyStoreOption?.value ?: KeyStoreOption.CLIENT.value
                val clientKeyStore =
                    NativeRegistry.shared.keyStore(clientKey)
                        ?: throw InvalidConfigurationException(
                            "jwtAsymmetric: no client KeyStore registered for key '$clientKey'.",
                        )
                ClientAuthenticationMethodConfiguration.SignedJwt.Asymmetric(
                    clientKeyStore = clientKeyStore,
                    clientKeyStorePassword = charArrayOf(),
                    alias = alias,
                    algorithmIdentifier =
                        ClientAuthenticationMethodConfiguration
                            .SignedJwt
                            .Asymmetric
                            .AlgorithmIdentifier
                            .valueOf(algorithm.value),
                )
            }

            ClientAuthenticationKind.JWT_SYMMETRIC -> {
                val secretKey =
                    secretKey
                        ?: throw InvalidConfigurationException("jwtSymmetric: secretKey cannot be null.")
                val algorithm =
                    symmetricAlgorithm
                        ?: throw InvalidConfigurationException("jwtSymmetric: symmetricAlgorithm cannot be null.")
                ClientAuthenticationMethodConfiguration.SignedJwt.Symmetric(
                    secretKey = secretKey,
                    signatureAlgorithm =
                        ClientAuthenticationMethodConfiguration
                            .SignedJwt
                            .Symmetric
                            .SignatureAlgorithm
                            .valueOf(algorithm.value),
                )
            }
        }
}

/**
 * A single server key pinning entry for MTLS key pinning authentication.
 *
 * Maps to the TypeScript `KeyPinning` interface.
 */
class KeyPinningRecord : Record {
    /** The hostname to pin. */
    @Field var hostname: String = ""

    /** The Base64-encoded SHA-256 hash of the server's public key. */
    @Field var publicKeyHash: String = ""

    override fun toString(): String =
        JSONObject()
            .put("hostname", hostname)
            .put("publicKeyHash", publicKeyHash)
            .toString()
}

/** A credential for a log line: `<redacted>` when set, absent otherwise. */
private fun redacted(credential: String?): String? = credential?.let { "<redacted>" }
