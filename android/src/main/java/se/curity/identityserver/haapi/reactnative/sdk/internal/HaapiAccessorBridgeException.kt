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
package se.curity.identityserver.haapi.reactnative.sdk.internal

import expo.modules.kotlin.exception.CodedException

/**
 * Expo [CodedException] subclass that carries the stable HAAPI bridge
 * error codes (`HAAPI_ACCESSOR_*`) through to JavaScript via `error.code`.
 *
 * Wraps the bridge-originated [HaapiAccessorStore.StoreException] at the
 * AsyncFunction boundary so the store stays Expo-agnostic while JS callers
 * can still branch on `error.code`. Canonical normalized code values and
 * envelope shape are documented in HSRN-22 plan § 8.1 (code constants)
 * and § 9 (wire format).
 *
 * Plain [HaapiAccessorStore.StoreException] inherits from `Exception`,
 * which Expo's bridge converts to a generic `ERR_UNEXPECTED` when thrown
 * from an `AsyncFunction`. Re-wrapping as [CodedException] preserves the
 * `code` we care about.
 */
internal class HaapiAccessorBridgeException : CodedException {
    constructor(code: String, message: String) : super(code, message, null)

    constructor(error: HaapiAccessorStore.StoreException) : super(
        code = error.code,
        message = error.message,
        cause = error,
    )
}
