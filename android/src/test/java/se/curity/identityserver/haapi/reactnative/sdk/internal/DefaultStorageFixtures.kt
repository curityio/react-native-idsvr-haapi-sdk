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

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.ObjectInputStream
import java.io.ObjectOutputStream
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.Base64

// Values shaped exactly like the ones the native SDK stores: `KeyPairGeneratorStorage` writes a
// Java-serialised EC `KeyPair`, Base64-encoded with `android.util.Base64.DEFAULT` (line-wrapped),
// under `HAAPI_KP_FALLBACK<alias>`. The MIME encoder reproduces the line wrapping on the JVM.

internal const val SOFTWARE_KEY_PREFIX = "HAAPI_KP_FALLBACK"

internal fun softwareKeyName(alias: String) = "$SOFTWARE_KEY_PREFIX$alias"

/** A freshly generated P-256 key pair, serialised and encoded as the native SDK stores it. */
internal fun storedSoftwareKeyPair(): String {
    val keyPair =
        KeyPairGenerator
            .getInstance("EC")
            .apply { initialize(ECGenParameterSpec("secp256r1")) }
            .generateKeyPair()
    val bytes = ByteArrayOutputStream().also { ObjectOutputStream(it).use { out -> out.writeObject(keyPair) } }
    return Base64.getMimeEncoder().encodeToString(bytes.toByteArray())
}

/** Whether [stored] still decodes to a key pair whose private key signs for its public key. */
internal fun isUsableKeyPair(stored: String): Boolean {
    val keyPair =
        ObjectInputStream(ByteArrayInputStream(Base64.getMimeDecoder().decode(stored))).use {
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
