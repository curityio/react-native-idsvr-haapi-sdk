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
 * Discriminator for the type of action within a HAAPI step.
 *
 * Maps to the TypeScript `ActionType` enum.
 */
enum class RNActionType(
    val value: String,
) : Enumerable {
    FORM("form"),
    CLIENT_OPERATION("clientOperation"),
    SELECTOR("selector"),
}
