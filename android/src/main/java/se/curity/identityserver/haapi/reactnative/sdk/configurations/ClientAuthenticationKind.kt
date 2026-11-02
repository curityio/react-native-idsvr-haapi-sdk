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
 * Discriminator for [ClientAuthenticationMethodConfigurationRecord].
 *
 * Maps to the TypeScript `ClientAuthenticationKind` enum.
 */
enum class ClientAuthenticationKind(
    val value: String,
) : Enumerable {
    /** No client authentication. */
    NONE("none"),

    /** Shared secret (client_secret_post). */
    SECRET("secret"),

    /** Mutual TLS with a server trust store or PEM certificate. */
    MTLS("mtls"),

    /** Mutual TLS with server public key pinning. */
    MTLS_KEY_PINNING("mtlsKeyPinning"),

    /** Signed JWT using an asymmetric key pair (private_key_jwt). */
    JWT_ASYMMETRIC("jwtAsymmetric"),

    /** Signed JWT using a symmetric secret (client_secret_jwt). */
    JWT_SYMMETRIC("jwtSymmetric"),
}
