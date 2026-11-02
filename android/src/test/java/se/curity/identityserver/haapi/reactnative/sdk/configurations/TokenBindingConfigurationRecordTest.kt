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

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import kotlin.reflect.KClass

class TokenBindingConfigurationRecordTest {
    // A record whose `kind` was never set is the "present but no mode" case the bridge must reject,
    // so the default must stay null rather than silently meaning "no binding".
    @Test
    fun recordDefaultsToNoKind() {
        assertNull(AndroidTokenBindingConfigurationRecord().kind)
    }

    // Wire contract with the TypeScript `TokenBindingKind` enum: Expo decodes these raw values by name.
    @Test
    fun tokenBindingKindValuesMatchTheTypeScriptContract() {
        assertEquals(listOf("bound", "unbound"), TokenBindingKind.entries.map { it.value }.sorted())
    }

    @Test
    fun recordDescriptionIncludesTheKind() {
        val record = AndroidTokenBindingConfigurationRecord().apply { kind = TokenBindingKind.UNBOUND }

        assertEquals("unbound", JSONObject(record.toString()).getString("kind"))
    }

    // An absent setting (no record at all) is the only way the bridge reads "no binding" without a `kind`.
    @Test
    fun androidConfigurationHasNoTokenBindingRecordByDefault() {
        assertNull(AndroidConfigurationRecord().tokenBindingConfiguration)
    }

    // Wire contract with the TypeScript `DpopKeyPolicy` enum: Expo decodes these raw values by name.
    @Test
    fun dpopKeyPolicyValuesMatchTheTypeScriptContract() {
        assertEquals(listOf("auto", "hardware", "software"), RNDpopKeyPolicy.entries.map { it.value })
    }

    // Expo deserializes records by field name, so the record must carry exactly the fields the
    // TypeScript `AndroidTokenBinding` object has — a stale `keyAlias` would silently read as absent.
    @Test
    fun bindingRecordFieldsMatchTheTypeScriptBindingObject() {
        assertEquals(
            setOf("kind", "keyType", "keyPairAlgorithmConfiguration", "migrateFromLegacyAlias", "storageOption"),
            fieldNames(AndroidTokenBindingConfigurationRecord::class),
        )
    }

    // The deprecated setting keeps its own released shape.
    @Test
    fun deprecatedRecordFieldsMatchTheReleasedObject() {
        assertEquals(
            setOf("keyAlias", "keyPairAlgorithmConfiguration", "storageOption"),
            fieldNames(AndroidTokenBoundConfigurationRecord::class),
        )
    }

    @Test
    fun bindingRecordDefaultsToNoKeyTypeAndNoAliasToAdopt() {
        val record = AndroidTokenBindingConfigurationRecord()

        assertNull(record.keyType)
        assertNull(record.migrateFromLegacyAlias)
    }

    @Test
    fun recordDescriptionIncludesTheKeyTypeAndTheAliasToAdopt() {
        val record =
            AndroidTokenBindingConfigurationRecord().apply {
                keyType = RNDpopKeyPolicy.HARDWARE
                migrateFromLegacyAlias = "haapi_token_bound_key"
            }

        val description = JSONObject(record.toString())
        assertEquals("hardware", description.getString("keyType"))
        assertEquals("haapi_token_bound_key", description.getString("migrateFromLegacyAlias"))
    }

    // Every property of these records is an Expo `@Field var`, and Expo decodes by property name, so the
    // records' own (non-synthetic) backing fields are exactly the keys they read from JavaScript.
    private fun fieldNames(type: KClass<*>): Set<String> =
        type.java.declaredFields
            .filterNot {
                it.isSynthetic ||
                    java.lang.reflect.Modifier
                        .isStatic(it.modifiers)
            }.map { it.name }
            .toSet()
}
