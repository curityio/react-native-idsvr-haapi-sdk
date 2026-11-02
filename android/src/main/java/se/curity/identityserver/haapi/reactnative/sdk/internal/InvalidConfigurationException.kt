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

/**
 * A configuration value passed from JavaScript can't be used as given — a required value is missing,
 * a mode isn't stated, or a named dependency isn't registered.
 *
 * Normalized to `HAAPI_INVALID_CONFIGURATION` with an unrecoverable `modifyConfiguration` recovery, the
 * same error iOS reports for `HaapiError.invalidConfiguration`. [message] names the offending field;
 * it never carries configuration values.
 */
internal class InvalidConfigurationException(
    message: String,
) : IllegalArgumentException(message)
