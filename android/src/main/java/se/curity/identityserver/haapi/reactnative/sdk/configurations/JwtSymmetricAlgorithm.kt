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
 * Supported symmetric signing algorithms for JWT-based client authentication.
 *
 * Values are uppercase (e.g. `"HS256"`) and match the TypeScript `JwtSymmetricAlgorithm` enum.
 * On the native side, these are resolved via `SignatureAlgorithm.valueOf()`.
 *
 * Maps to the TypeScript `JwtSymmetricAlgorithm` enum.
 */
enum class JwtSymmetricAlgorithm(
    val value: String,
) : Enumerable {
    /** HMAC using SHA-256. */
    HS256("HS256"),

    /** HMAC using SHA-384. */
    HS384("HS384"),

    /** HMAC using SHA-512. */
    HS512("HS512"),
}
