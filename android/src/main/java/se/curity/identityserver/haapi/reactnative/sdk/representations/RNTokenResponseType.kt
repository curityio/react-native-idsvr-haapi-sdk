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
package se.curity.identityserver.haapi.reactnative.sdk.representations

import expo.modules.kotlin.types.Enumerable

/**
 * Discriminator for [RNTokenResponseRecord].
 *
 * Maps to the TypeScript `'success' | 'error'` literal union on
 * `TokenResponse` (`SuccessfulTokenResponse` vs `ErrorTokenResponse`).
 * The [value] is the wire format that host TS code switches on.
 */
enum class RNTokenResponseType(
    val value: String,
) : Enumerable {
    SUCCESS("success"),
    ERROR("error"),
}
