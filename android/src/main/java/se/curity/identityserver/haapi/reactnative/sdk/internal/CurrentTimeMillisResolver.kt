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

import se.curity.identityserver.haapi.reactnative.sdk.CurrentTimeMillisProvider
import se.curity.identityserver.haapi.reactnative.sdk.Resolver
import se.curity.identityserver.haapi.reactnative.sdk.configurations.CurrentTimeMillisProviderOption

internal class CurrentTimeMillisResolver : Resolver<CurrentTimeMillisProvider> {
    override fun resolve(key: String): CurrentTimeMillisProvider? =
        if (key == CurrentTimeMillisProviderOption.DEFAULT.value) {
            CurrentTimeMillisProvider { System.currentTimeMillis() }
        } else {
            null
        }
}
