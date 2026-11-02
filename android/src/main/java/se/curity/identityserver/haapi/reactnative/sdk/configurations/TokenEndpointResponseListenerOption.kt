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
 * Selects the token endpoint response listener on Android.
 *
 * Maps to the TypeScript `TokenEndpointResponseListenerOption` enum.
 */
enum class TokenEndpointResponseListenerOption(
    val value: String,
) : Enumerable {
    /** No token endpoint response listener is registered. */
    NONE("none"),

    /** Allows injecting a custom listener via `NativeRegistry`. */
    CUSTOM("custom"),
}
