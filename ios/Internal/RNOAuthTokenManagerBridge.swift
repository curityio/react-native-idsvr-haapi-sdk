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
    /// Whether the accessor binds tokens. Without binding no token has a key to prove, whatever the native
    /// SDK still stores from an earlier bound sign-in — Android answers nothing then either. Unbound unless the
    /// construction site says otherwise, so a site that doesn't say signs nothing.
    let isTokenBound: Bool

    init(
        invoker: OAuthTokenInvoker,
        dpopProvider: @escaping @Sendable () -> Dpop? = { nil },
        isTokenBound: Bool = false
    ) {
        self.invoker = invoker
        self.dpopProvider = dpopProvider
        self.isTokenBound = isTokenBound
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

    /// Signs a DPoP proof for the request `httpMethod` `url` with the key `accessToken` is bound to,
    /// binding `accessToken` (`ath`) and `nonce` when given; `nil` when no key is bound to the token. The
    /// native SDK builds and signs the proof; the key never leaves it.
    ///
    /// - Throws: `InvalidArgumentError` for a URL without an http or https scheme and a host, or with user
    ///   credentials; the native lookup's `HaapiError.dpopProofFailure`; a signing failure as
    ///   `HaapiError.dpopProofCreationFailure`, which the SDK's own signing doesn't wrap it in.
    func createDpopProof(accessToken: String, httpMethod: String, url: String, nonce: String?) async throws -> String? {
        // TypeScript refuses such a URL first; re-checked so no other caller reaches signing without an http or
        // https scheme and a host, or with credentials, which would be signed into the proof. Same descriptions
        // as the Android bridge. `host(percentEncoded:)` is "" rather than nil for a port-only authority.
        guard let target = URL(string: url),
              let scheme = target.scheme?.lowercased(), scheme == "http" || scheme == "https",
              let host = target.host(percentEncoded: true), !host.isEmpty
        else {
            throw InvalidArgumentError(message: "url must be an absolute http or https URL.")
        }
        guard target.user == nil, target.password == nil else {
            throw InvalidArgumentError(message: "url must not carry user credentials.")
        }
        guard let dpop = try boundDpop(forAccessToken: accessToken) else {
            return nil
        }
        do {
            return try invoker.createProof(dpop: dpop, httpMethod: httpMethod, url: target, nonce: nonce, accessToken: accessToken)
        } catch {
            throw HaapiError.dpopProofCreationFailure(cause: error)
        }
    }

    /// The access token's `Dpop`, or `nil` when the accessor doesn't bind tokens: the single lookup every
    /// DPoP read goes through.
    private func boundDpop(forAccessToken accessToken: String) throws -> Dpop? {
        guard isTokenBound else {
            return nil
        }
        return try invoker.dpop(forAccessToken: accessToken)
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
