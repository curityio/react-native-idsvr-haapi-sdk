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

import se.curity.identityserver.haapi.android.driver.internal.DpopHelper
import se.curity.identityserver.haapi.android.sdk.models.oauth.ErrorTokenResponse
import se.curity.identityserver.haapi.android.sdk.models.oauth.SuccessfulTokenResponse
import se.curity.identityserver.haapi.android.sdk.models.oauth.TokenResponse
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNTokenResponseRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNTokenResponseType
import java.net.URI
import java.net.URISyntaxException
import java.util.concurrent.CancellationException

/**
 * Bridge facade for OAuth token operations on Android.
 *
 * Owns the response-mapping contract from § 11.12: native
 * [SuccessfulTokenResponse] / [ErrorTokenResponse] become an
 * [RNTokenResponseRecord] (with `responseType` discriminator); any
 * exception thrown by the underlying SDK rethrows so the JS Promise
 * rejects. This differs from [RNHaapiManagerBridge], which converts
 * flow-level errors into error records — the OAuth bridge keeps
 * transport errors as Promise rejections per § 11.12.
 *
 * Android's native API does not take a `Dpop` parameter (the SDK manages
 * DPoP state internally), so this bridge has no `dpopProvider`. The iOS
 * counterpart does, per § 8 of the plan.
 */
internal class RNOAuthTokenManagerBridge(
    private val invoker: OAuthTokenInvoker,
) {
    /**
     * Fetches an access token for an authorization code obtained from a
     * completed HAAPI flow.
     *
     * @throws Exception any [se.curity.identityserver.haapi.android.driver.IdsvrHaapiException]
     *   or other transport error from the underlying SDK is rethrown so
     *   the JS Promise rejects.
     */
    suspend fun fetchAccessToken(
        authorizationCode: String,
        additionalParameters: Map<String, String>?,
    ): RNTokenResponseRecord = mapTokenResponse(invoker.fetchAccessToken(authorizationCode, additionalParameters))

    /**
     * Refreshes an access token using a refresh token.
     *
     * @throws Exception transport errors rethrow per § 11.12.
     */
    suspend fun refreshAccessToken(
        refreshToken: String,
        additionalParameters: Map<String, String>?,
    ): RNTokenResponseRecord = mapTokenResponse(invoker.refreshAccessToken(refreshToken, additionalParameters))

    /**
     * Revokes an access token.
     *
     * @throws Exception transport errors rethrow per § 11.12.
     */
    suspend fun revokeAccessToken(token: String) {
        invoker.revokeAccessToken(token)
    }

    /**
     * Revokes a refresh token.
     *
     * @throws Exception transport errors rethrow per § 11.12.
     */
    suspend fun revokeRefreshToken(token: String) {
        invoker.revokeRefreshToken(token)
    }

    /**
     * Signs a DPoP proof for the request [httpMethod] [url] with the key [accessToken] is bound to,
     * binding [accessToken] (`ath`) and [nonce] when given; `null` when no key is bound to the token. The
     * native SDK builds and signs the proof; the key never leaves it.
     */
    suspend fun createDpopProof(
        accessToken: String,
        httpMethod: String,
        url: String,
        nonce: String?,
    ): String? {
        val target = usableUri(url) ?: throw InvalidArgumentException(INVALID_URL)
        if (target.rawUserInfo != null) {
            throw InvalidArgumentException(CREDENTIALS)
        }
        val helper = boundDpopHelper(accessToken) ?: return null
        return try {
            helper.generateProofToken(httpMethod, target, nonce, accessToken)
        } catch (e: Exception) {
            throw DpopProofCreationException(e)
        }
    }

    /**
     * The access token's [DpopHelper]: the single lookup every DPoP read goes through. A failure to read the
     * key becomes a [DpopProofLookupException], so it is reported like iOS; cancellation passes through.
     */
    private suspend fun boundDpopHelper(accessToken: String): DpopHelper? =
        try {
            invoker.dpopHelper(accessToken)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            throw DpopProofLookupException(e)
        }

    /**
     * [url] as a [URI] the native proof can be made for — an http or https scheme and an authority that names a
     * host — or `null`. The raw authority is read, not [URI.getHost]: Java leaves the host `null` for a name with
     * an underscore, which TypeScript accepts, and parses a port-only authority (`https://:8443`) without
     * complaint. TypeScript refuses such URLs first; this keeps any other caller from reaching signing, and the
     * parse error, which quotes the URL, from reaching an error.
     */
    private fun usableUri(url: String): URI? =
        try {
            URI(url).takeIf { it.scheme?.lowercase() in HTTP_SCHEMES && it.namesAHost() }
        } catch (e: URISyntaxException) {
            null
        }

    /** The authority has a host ahead of any port; user credentials, if any, are refused by the caller. */
    private fun URI.namesAHost(): Boolean {
        val hostAndPort = rawAuthority?.substringAfterLast('@') ?: return false
        return hostAndPort.isNotEmpty() && !hostAndPort.startsWith(':')
    }

    private companion object {
        const val INVALID_URL = "url must be an absolute http or https URL."
        const val CREDENTIALS = "url must not carry user credentials."
        val HTTP_SCHEMES = setOf("http", "https")
    }

    private fun mapTokenResponse(response: TokenResponse): RNTokenResponseRecord =
        when (response) {
            is SuccessfulTokenResponse -> {
                RNTokenResponseRecord().apply {
                    responseType = RNTokenResponseType.SUCCESS
                    accessToken = response.accessToken
                    tokenType = response.tokenType
                    scope = response.scope
                    // OAuth `expires_in` is whole seconds per RFC 6749 § 5.1.
                    // `Duration.seconds` returns the whole-second component
                    // (truncating any sub-second remainder), matching the spec.
                    // The previous formula `toMillis() / 1000.0` leaked
                    // sub-second precision (e.g. 900 ms → 0.9) which neither
                    // the server emits nor the JS consumer expects.
                    expiresIn = response.expiresIn.seconds.toDouble()
                    refreshToken = response.refreshToken
                    idToken = response.idToken
                }
            }

            is ErrorTokenResponse -> {
                RNTokenResponseRecord().apply {
                    responseType = RNTokenResponseType.ERROR
                    error = response.error
                    errorDescription = response.errorDescription
                    errorUri = response.errorUri
                }
            }
        }
}
