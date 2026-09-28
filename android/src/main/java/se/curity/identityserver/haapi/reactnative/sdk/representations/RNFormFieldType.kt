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
 * Discriminator for the type of form field.
 *
 * Maps to the TypeScript `FormFieldType` enum.
 */
enum class RNFormFieldType(
    val value: String,
) : Enumerable {
    HIDDEN("hidden"),
    TEXT("text"),
    USERNAME("username"),
    PASSWORD("password"),
    SELECT("select"),
    CHECKBOX("checkbox"),
    CONTEXT("context"),
}
