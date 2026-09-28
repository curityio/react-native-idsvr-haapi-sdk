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
 * The category of a HAAPI response.
 *
 * Maps to the TypeScript `HaapiResponse` discriminator field `responseCategory`.
 * Flow failures are surfaced as thrown `HaapiError` values, not as
 * additional entries in this enum.
 */
enum class RNResponseCategory(
    val value: String,
) : Enumerable {
    REPRESENTATION("representation"),
    PROBLEM("problem"),
}
