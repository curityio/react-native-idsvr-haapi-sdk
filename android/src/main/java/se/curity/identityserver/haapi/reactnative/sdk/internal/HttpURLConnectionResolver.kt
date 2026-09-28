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

import se.curity.identityserver.haapi.reactnative.sdk.Resolver
import java.net.HttpURLConnection
import java.net.URL

/** Wraps a `(URL) -> HttpURLConnection` function so it can be resolved without type erasure issues. */
class RNHttpURLConnectionProvider(
    val provider: (URL) -> HttpURLConnection,
)

internal class HttpURLConnectionResolver : Resolver<RNHttpURLConnectionProvider> {
    override fun resolve(key: String): RNHttpURLConnectionProvider? {
        // null is returned because the default HttpURLConnectionProvider will be used.
        return null
    }
}
