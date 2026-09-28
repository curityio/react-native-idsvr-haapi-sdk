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

/// Bridge facade for OAuth token operations on iOS.
///
/// Owns the response-mapping contract from § 11.12: the native
/// `TokenResponse.successfulToken` / `.errorToken` cases become an
/// ``RNTokenResponseRecord`` (with `responseType` discriminator); the
/// `TokenResponse.error(Error)` case rethrows so the JS Promise rejects.
/// Same shape for `TokenRevocationResponse` (`success` resolves; `error`
/// rethrows). This differs from ``RNHaapiManagerBridge``, which converts
/// flow-level errors into error records — the OAuth bridge keeps
/// transport errors as Promise rejections per § 11.12.
///
/// The plan's spec was `init(oAuthTokenManager: OAuthTokenManager,
/// dpopProvider: () -> Dpop?)`. Production wires `DefaultOAuthTokenInvoker`
/// explicitly via the convenience initializer (mirrors the Step 3
/// ``RNHaapiManagerBridge`` shape on both platforms).
final class RNOAuthTokenManagerBridge: @unchecked Sendable {
    private let invoker: OAuthTokenInvoker
    private let dpopProvider: @Sendable () -> Dpop?

    init(
        invoker: OAuthTokenInvoker,
        dpopProvider: @escaping @Sendable () -> Dpop? = { nil }
    ) {
        self.invoker = invoker
        self.dpopProvider = dpopProvider
    }

    /// Fetches an access token for an authorization code obtained from a
    /// completed HAAPI flow.
    ///
    /// On iOS the native API takes a `Dpop?`; the bridge pulls it from
    /// `dpopProvider` (typically `{ haapiManager.dpop }` for `HaapiAccessor`,
    /// `{ nil }` for OAuth-only). DPoP is hidden from JS per § 8.
    ///
    /// - Throws: rethrows any `Error` carried in `TokenResponse.error`.
    func fetchAccessToken(
        authorizationCode: String,
        additionalParameters: [String: String]?
    ) async throws -> RNTokenResponseRecord {
        let response = await invoker.fetchAccessToken(
            authorizationCode: authorizationCode,
            dpop: dpopProvider(),
            additionalParameters: additionalParameters
        )
        return try mapTokenResponse(response)
    }

    /// Refreshes an access token using a refresh token.
    /// - Throws: rethrows any `Error` carried in `TokenResponse.error`.
    func refreshAccessToken(
        refreshToken: String,
        additionalParameters: [String: String]?
    ) async throws -> RNTokenResponseRecord {
        let response = await invoker.refreshAccessToken(
            refreshToken: refreshToken,
            additionalParameters: additionalParameters
        )
        return try mapTokenResponse(response)
    }

    /// Revokes an access token. Resolves on success; rethrows on error.
    func revokeAccessToken(token: String) async throws {
        try mapRevocationResponse(await invoker.revokeAccessToken(token: token))
    }

    /// Revokes a refresh token. Resolves on success; rethrows on error.
    func revokeRefreshToken(token: String) async throws {
        try mapRevocationResponse(await invoker.revokeRefreshToken(token: token))
    }

    private func mapTokenResponse(_ response: TokenResponse) throws -> RNTokenResponseRecord {
        switch response {
        case let .successfulToken(success):
            return RNTokenResponseRecord.success(
                accessToken: success.accessToken,
                tokenType: success.tokenType,
                scope: success.scope,
                expiresIn: Double(success.expiresIn),
                refreshToken: success.refreshToken,
                idToken: success.idToken
            )
        case let .errorToken(errorToken):
            return RNTokenResponseRecord.error(
                errorToken.error,
                errorDescription: errorToken.errorDescription,
                errorUri: errorToken.errorUri
            )
        case let .error(error):
            throw error
        }
    }

    private func mapRevocationResponse(_ response: TokenRevocationResponse) throws {
        switch response {
        case .success:
            return
        case let .error(error):
            throw error
        }
    }
}
