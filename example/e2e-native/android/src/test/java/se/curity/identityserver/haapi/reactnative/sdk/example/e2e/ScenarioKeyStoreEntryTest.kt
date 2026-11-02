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

import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.KeyStore
import javax.crypto.spec.SecretKeySpec

class ScenarioKeyStoreEntryTest {
    @Test
    fun removesTheEntryAScenarioOwns() {
        val keyStore = keyStoreHolding("dpop-proof-no-key")

        assertTrue(deleteScenarioKeyStoreEntry(keyStore, "dpop-proof-no-key"))
        assertFalse(keyStore.containsAlias("dpop-proof-no-key"))
    }

    @Test
    fun answersThatThereWasNoEntryToRemove() {
        assertFalse(deleteScenarioKeyStoreEntry(keyStoreHolding(), "dpop-proof-older-key"))
    }

    // The hook is in every build of the example app, so it must never reach the key a real sign-in uses.
    @Test
    fun refusesAnAliasNoScenarioOwns() {
        val keyStore = keyStoreHolding("haapi_token_bound_key")

        assertThrows(IllegalArgumentException::class.java) {
            deleteScenarioKeyStoreEntry(keyStore, "haapi_token_bound_key")
        }
        assertTrue(keyStore.containsAlias("haapi_token_bound_key"))
    }

    private fun keyStoreHolding(vararg aliases: String): KeyStore =
        KeyStore.getInstance("PKCS12").apply {
            load(null, null)
            aliases.forEach { alias ->
                setEntry(
                    alias,
                    KeyStore.SecretKeyEntry(SecretKeySpec(ByteArray(16), "AES")),
                    KeyStore.PasswordProtection("test".toCharArray()),
                )
            }
        }
}
