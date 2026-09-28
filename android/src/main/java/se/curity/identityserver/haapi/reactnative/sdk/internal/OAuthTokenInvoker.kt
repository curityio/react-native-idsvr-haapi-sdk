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

import se.curity.identityserver.haapi.android.sdk.OAuthTokenManager
import se.curity.identityserver.haapi.android.sdk.models.oauth.TokenResponse
import kotlin.coroutines.CoroutineContext

/**
 * Test seam over [OAuthTokenManager]'s OAuth methods.
 *
 * The native [OAuthTokenManager] is `final` with an `internal` constructor, so it
 * can't be subclassed or constructed from this module's tests. The bridge
 * depends on this interface instead, and production wiring uses
 * [DefaultOAuthTokenInvoker]. Tests provide hand-rolled stubs (mirrors
 * the Step 3 [HaapiFlowInvoker] pattern).
 *
 * Unlike iOS, Android's native `OAuthTokenManager` does not take a `Dpop`
 * parameter — DPoP state is managed internally by the SDK. § 8 of the
 * plan documents the platform asymmetry.
 */
internal interface OAuthTokenInvoker {
    suspend fun fetchAccessToken(
        authorizationCode: String,
        additionalParameters: Map<String, String>?,
    ): TokenResponse

    suspend fun refreshAccessToken(
        refreshToken: String,
        additionalParameters: Map<String, String>?,
    ): TokenResponse

    suspend fun revokeAccessToken(token: String)

    suspend fun revokeRefreshToken(token: String)
}

/** Production [OAuthTokenInvoker] that delegates straight to the native [OAuthTokenManager]. */
internal class DefaultOAuthTokenInvoker(
    private val oAuthTokenManager: OAuthTokenManager,
    private val coroutineContext: CoroutineContext,
) : OAuthTokenInvoker {
    override suspend fun fetchAccessToken(
        authorizationCode: String,
        additionalParameters: Map<String, String>?,
    ): TokenResponse =
        oAuthTokenManager.fetchAccessToken(
            authorizationCode = authorizationCode,
            onCoroutineContext = coroutineContext,
            additionalParameters = additionalParameters,
        )

    override suspend fun refreshAccessToken(
        refreshToken: String,
        additionalParameters: Map<String, String>?,
    ): TokenResponse =
        oAuthTokenManager.refreshAccessToken(
            refreshToken = refreshToken,
            onCoroutineContext = coroutineContext,
            additionalParameters = additionalParameters,
        )

    override suspend fun revokeAccessToken(token: String) {
        oAuthTokenManager.revokeAccessToken(
            accessToken = token,
            onCoroutineContext = coroutineContext,
        )
    }

    override suspend fun revokeRefreshToken(token: String) {
        oAuthTokenManager.revokeRefreshToken(
            refreshToken = token,
            onCoroutineContext = coroutineContext,
        )
    }
}
