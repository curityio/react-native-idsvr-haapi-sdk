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
 * Selects the HttpURLConnection provider implementation on Android.
 *
 * Maps to the TypeScript `HttpUrlConnectionProviderOption` enum.
 */
enum class HttpUrlConnectionProviderOption(
    val value: String,
) : Enumerable {
    /** Uses the SDK's built-in HttpURLConnection provider. */
    DEFAULT("default"),

    /** Allows injecting a custom provider on the native side. */
    CUSTOM("custom"),
}
