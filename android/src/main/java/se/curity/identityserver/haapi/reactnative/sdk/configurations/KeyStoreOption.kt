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

import expo.modules.kotlin.types.Enumerable

/**
 * Identifies a KeyStore resolver registered in [NativeRegistry][se.curity.identityserver.haapi.reactnative.sdk.NativeRegistry].
 *
 * Host apps register custom resolvers via `NativeRegistry.shared.addResolver()`
 * using these keys to provide their own `KeyStore` instances.
 *
 * Maps to the TypeScript `KeyStoreOption` enum.
 */
enum class KeyStoreOption(
    val value: String,
) : Enumerable {
    /** Client certificate KeyStore. */
    CLIENT("client"),

    /** Server trust store. */
    SERVER("server"),

    /** Alternate client certificate KeyStore. */
    ALTERNATE_CLIENT("alternateClient"),

    /** Alternate server trust store. */
    ALTERNATE_SERVER("alternateServer"),
}
