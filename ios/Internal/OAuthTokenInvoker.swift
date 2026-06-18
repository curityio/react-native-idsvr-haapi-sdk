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
}
