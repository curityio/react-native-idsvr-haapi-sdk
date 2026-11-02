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

import java.security.KeyStore

/**
 * The DPoP proof scenarios own what [keyStore] holds under their alias: an unbound HAAPI start leaves a key
 * there that native 5.7.0 still signs with for a token it doesn't track. Removes the entry under [alias], if
 * any, and answers whether there was one. Only under a scenario's alias, so the hook never reaches the key a
 * real sign-in uses.
 */
internal fun deleteScenarioKeyStoreEntry(
    keyStore: KeyStore,
    alias: String,
): Boolean {
    require(alias.startsWith(SCENARIO_ALIAS_PREFIX)) { "Only a DPoP proof scenario's Keystore alias can be removed." }
    return keyStore.containsAlias(alias).also { held -> if (held) keyStore.deleteEntry(alias) }
}

/** What every DPoP proof scenario's Keystore alias starts with (`example/e2e/dpop-scenarios.ts`). */
private const val SCENARIO_ALIAS_PREFIX = "dpop-proof-"
