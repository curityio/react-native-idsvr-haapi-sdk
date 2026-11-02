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
import Foundation
import IdsvrHaapiSdk

/// Test seam over ``OAuthTokenManager``'s OAuth methods.
///
/// The native ``OAuthTokenManager`` is `final`, so it can't be subclassed
/// for tests. The bridge depends on this protocol instead, and production
/// wiring uses ``DefaultOAuthTokenInvoker``. Tests provide hand-rolled
/// stubs (mirrors the Step 3 ``HaapiFlowInvoker`` pattern).
internal protocol OAuthTokenInvoker: Sendable {
    func fetchAccessToken(
        authorizationCode: String,
        dpop: Dpop?,
        additionalParameters: [String: String]?
    ) async -> TokenResponse

    func refreshAccessToken(
        refreshToken: String,
        additionalParameters: [String: String]?
    ) async -> TokenResponse

    func revokeAccessToken(token: String) async -> TokenRevocationResponse
    func revokeRefreshToken(token: String) async -> TokenRevocationResponse

    /// The `Dpop` the access token is bound to, or `nil` when none is.
    func dpop(forAccessToken accessToken: String) throws -> Dpop?

    /// Signs a proof with `dpop`. A seam because a real `Dpop` can't be made to fail signing in tests.
    func createProof(dpop: Dpop, httpMethod: String, url: URL, nonce: String?, accessToken: String) throws -> String
}

/// Production ``OAuthTokenInvoker`` that delegates straight to the native
/// ``OAuthTokenManager``.
internal struct DefaultOAuthTokenInvoker: OAuthTokenInvoker {
    let oAuthTokenManager: OAuthTokenManager

    func fetchAccessToken(
        authorizationCode: String,
        dpop: Dpop?,
        additionalParameters: [String: String]?
    ) async -> TokenResponse {
        await oAuthTokenManager.fetchAccessToken(
            with: authorizationCode,
            dpop: dpop,
            additionalParameters: additionalParameters
        )
    }

    func refreshAccessToken(
        refreshToken: String,
        additionalParameters: [String: String]?
    ) async -> TokenResponse {
        await oAuthTokenManager.refreshAccessToken(
            with: refreshToken,
            additionalParameters: additionalParameters
        )
    }

    func revokeAccessToken(token: String) async -> TokenRevocationResponse {
        await oAuthTokenManager.revokeAccessToken(with: token)
    }

    func revokeRefreshToken(token: String) async -> TokenRevocationResponse {
        await oAuthTokenManager.revokeRefreshToken(with: token)
    }

    func dpop(forAccessToken accessToken: String) throws -> Dpop? {
        try oAuthTokenManager.dpop(forAccessToken: accessToken)
    }

    func createProof(dpop: Dpop, httpMethod: String, url: URL, nonce: String?, accessToken: String) throws -> String {
        try dpop.createProof(httpMethod: httpMethod, url: url, nonce: nonce, accessToken: accessToken)
    }
}
