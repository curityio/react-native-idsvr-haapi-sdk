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
internal import ExpoModulesCore

/// An OAuth 2.0 token response.
///
/// Maps to the TypeScript `TokenResponse` discriminated union.
/// The `responseType` field is the discriminator: "success" or "error".
struct RNTokenResponseRecord: Record {
    /// Discriminator: ``RNTokenResponseType/success`` or
    /// ``RNTokenResponseType/error``. Serialised to the wire as the raw
    /// string ("success" / "error") that host TS code switches on.
    @Field var responseType: RNTokenResponseType = .success

    // SuccessfulTokenResponse fields
    /// The access token string.
    @Field var accessToken: String?
    /// The token type (e.g., "bearer").
    @Field var tokenType: String?
    /// The granted scope.
    @Field var scope: String?
    /// Token lifetime in seconds. Optional — populated only on the
    /// success branch (the error branch has no spec field for it).
    @Field var expiresIn: Double?
    /// The refresh token, if issued.
    @Field var refreshToken: String?
    /// The OpenID Connect ID token, if issued.
    @Field var idToken: String?

    // ErrorTokenResponse fields
    /// The error code.
    @Field var error: String?
    /// Optional human-readable error description.
    @Field var errorDescription: String?
    /// Optional URI for additional error information.
    @Field var errorUri: String?

    init() {}

    /// Builds a success-branch record. Only the success-side fields are
    /// populated; the error-side fields stay nil so the resulting JS
    /// object cleanly narrows on `responseType === 'success'` per the
    /// public TS discriminated union.
    static func success(
        accessToken: String,
        tokenType: String?,
        scope: String?,
        expiresIn: Double,
        refreshToken: String?,
        idToken: String?
    ) -> RNTokenResponseRecord {
        // `let` works here because Expo's `@Field` property wrapper is
        // class-backed: writes go through the wrapper's reference, not
        // through the surrounding struct's storage, so the struct itself
        // is never mutated.
        let record = RNTokenResponseRecord()
        record.responseType = .success
        record.accessToken = accessToken
        record.tokenType = tokenType
        record.scope = scope
        record.expiresIn = expiresIn
        record.refreshToken = refreshToken
        record.idToken = idToken
        return record
    }

    /// Builds an error-branch record. Only the error-side fields are
    /// populated; the success-side fields stay nil so the resulting JS
    /// object cleanly narrows on `responseType === 'error'`.
    static func error(
        _ error: String,
        errorDescription: String?,
        errorUri: String?
    ) -> RNTokenResponseRecord {
        let record = RNTokenResponseRecord()
        record.responseType = .error
        record.error = error
        record.errorDescription = errorDescription
        record.errorUri = errorUri
        return record
    }
}

extension RNTokenResponseRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNTokenResponseRecord",
            "responseType": responseType,
            "accessToken": accessToken as Any,
            "tokenType": tokenType as Any,
            "scope": scope as Any,
            "expiresIn": expiresIn as Any,
            "refreshToken": refreshToken as Any,
            "idToken": idToken as Any,
            "error": error as Any,
            "errorDescription": errorDescription as Any,
            "errorUri": errorUri as Any
        ].debugDescription
    }
}
