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
 * Supported asymmetric signing algorithms for JWT-based client authentication.
 *
 * Values are uppercase (e.g. `"ES256"`) and match the TypeScript `JwtAsymmetricAlgorithm` enum.
 * On the native side, these are resolved via `AlgorithmIdentifier.valueOf()`.
 *
 * Maps to the TypeScript `JwtAsymmetricAlgorithm` enum.
 */
enum class JwtAsymmetricAlgorithm(
    val value: String,
) : Enumerable {
    /** RSASSA-PKCS1-v1_5 using SHA-256. */
    RS256("RS256"),

    /** RSASSA-PKCS1-v1_5 using SHA-384. */
    RS384("RS384"),

    /** RSASSA-PKCS1-v1_5 using SHA-512. */
    RS512("RS512"),

    /** RSASSA-PSS using SHA-256 and MGF1 with SHA-256. */
    PS256("PS256"),

    /** RSASSA-PSS using SHA-384 and MGF1 with SHA-384. */
    PS384("PS384"),

    /** RSASSA-PSS using SHA-512 and MGF1 with SHA-512. */
    PS512("PS512"),

    /** ECDSA P-256 using SHA-256. */
    ES256("ES256"),

    /** ECDSA P-384 using SHA-384. */
    ES384("ES384"),

    /** ECDSA P-521 using SHA-512. */
    ES512("ES512"),
}
