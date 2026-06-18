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

/// Converts native iOS errors into envelope-backed bridge exceptions.
/// SOURCE OF TRUTH: ai/plans/HSRN-22-implement-normalized-haapierror.md § 7
internal enum HaapiErrorNormalizer {
    private static let envelopePrefix = "HAAPI_ERROR_V1::"

    /// Normalizes any thrown native error into a bridge exception carrying an envelope.
    internal static func normalize(_ error: Error) -> HaapiAccessorBridgeException {
        if let storeError = error as? HaapiAccessorStore.StoreError {
            return normalizeStoreError(storeError)
        }
        if let haapiError = error as? HaapiError {
            return normalizeHaapiError(haapiError)
        }
        if let idsvrError = error as? IdsvrError {
            return normalizeIdsvrError(idsvrError)
        }
        return makeException(
            code: HaapiErrorCode.unexpected,
            category: HaapiErrorCategory.unexpected,
            errorDescription: error.localizedDescription,
            failureReason: nil,
            recovery: nil,
            serverError: nil,
            cause: nil,
            nativeCause: String(describing: type(of: error))
        )
    }

    /// Maps bridge-store errors to normalized bridge codes and recovery hints.
    private static func normalizeStoreError(_ error: HaapiAccessorStore.StoreError) -> HaapiAccessorBridgeException {
        makeException(
            code: error.code,
            category: HaapiErrorCategory.bridge,
            errorDescription: error.bridgeReason,
            failureReason: nil,
            recovery: storeRecovery(for: error),
            serverError: nil,
            cause: nil,
            nativeCause: String(describing: type(of: error))
        )
    }

    /// Maps discriminable `HaapiError` cases to stable code/category pairs.
    private static func normalizeHaapiError(_ error: HaapiError) -> HaapiAccessorBridgeException {
        let mapped = mapHaapiErrorCodeAndCategory(error)
        let base = error as IdsvrError
        let serverError = mapServerError(error)
        return makeException(
            code: mapped.code,
            category: mapped.category,
            errorDescription: base.errorDescription,
            failureReason: base.failureReason,
            recovery: mapRecovery(base.recoverySuggestion),
            serverError: serverError,
            cause: stringify(base.cause),
            nativeCause: String(describing: type(of: error))
        )
    }

    /// Q1.B fallback for `IdsvrError` conformers that are not discriminable `HaapiError` cases.
    ///
    /// Preserves category/recovery semantics and uses heuristic code upgrades where safe.
    private static func normalizeIdsvrError(_ error: IdsvrError) -> HaapiAccessorBridgeException {
        let fallbackCategory = mapCategory(raw: error.error)
        let heuristicCode = classifyFallbackCode(
            category: fallbackCategory,
            errorDescription: error.errorDescription,
            failureReason: error.failureReason
        )
        return makeException(
            code: heuristicCode,
            category: fallbackCategory,
            errorDescription: error.errorDescription,
            failureReason: error.failureReason,
            recovery: mapRecovery(error.recoverySuggestion),
            serverError: nil,
            cause: stringify(error.cause),
            nativeCause: String(describing: type(of: error))
        )
    }

    /// Applies high-confidence fallback code classification for iOS internal
    /// `HaapiSdkError` text.
    ///
    /// Matching is exact-equality against the `errorDescription` literals
    /// emitted by the `IdsvrHaapiSdk` 5.5.0 binary. Anything that does not
    /// match exactly falls back to `HAAPI_UNEXPECTED` while preserving
    /// `category` and `recovery` from the underlying `IdsvrError` protocol.
    ///
    /// Source: literals captured from
    /// `IdsvrHaapiSdk.xcframework/.../IdsvrHaapiSdk` binary on 2026-05-13
    /// (5.4.0), re-confirmed unchanged for 5.5.0 (HSRN-0) via the iOS
    /// normalizer test suite. Update on SDK bumps; the iOS normalizer tests
    /// reference the same literals so a drift causes test failure rather
    /// than silent regression.
    private static let knownInvalidModelDescriptions: Set<String> = [
        "Cannot recover due to invalid model representation.",
        "The response is invalid because the data cannot be parsed.",
    ]

    private static let knownUnsupportedContentTypeDescriptions: Set<String> = [
        "Unsupported content type, the raw representation cannot be mapped.",
        "The response is invalid and has an invalid content type.",
    ]

    // `HaapiSdkError.noResponseData` does not surface a distinctive literal
    // through `errorDescription` that can be safely matched without false
    // positives. The heuristic never claims this code from text — it falls
    // through to the Q1.B baseline (`HAAPI_UNEXPECTED`). Host apps that
    // need to distinguish this case on iOS can branch on `category` +
    // `errorDescription` themselves.

    private static func classifyFallbackCode(
        category: HaapiErrorCategory,
        errorDescription: String?,
        failureReason: String?
    ) -> String {
        _ = failureReason // Reserved for future literal pairs; intentionally unused.
        guard let description = errorDescription else {
            return HaapiErrorCode.unexpected
        }
        if knownInvalidModelDescriptions.contains(description) {
            return HaapiErrorCode.invalidModel
        }
        if category == .networking, knownUnsupportedContentTypeDescriptions.contains(description) {
            return HaapiErrorCode.unsupportedContentType
        }
        return HaapiErrorCode.unexpected
    }

    /// Converts native `HaapiError` cases to normalized code + category.
    private static func mapHaapiErrorCodeAndCategory(_ error: HaapiError) -> (code: String, category: HaapiErrorCategory) {
        switch error {
        case .communication:
            return (HaapiErrorCode.communication, .networking)
        case .serverError:
            return (HaapiErrorCode.serverError, .networking)
        case .invalidStatusCode:
            return (HaapiErrorCode.invalidStatusCode, .networking)
        case .invalidURLResponse:
            return (HaapiErrorCode.invalidUrlResponse, .networking)
        case .attestationNotSupported:
            return (HaapiErrorCode.attestationNotSupported, .attestation)
        case .attestationFailure:
            return (HaapiErrorCode.attestationFailure, .attestation)
        case .attestationKeyGenFailure:
            return (HaapiErrorCode.attestationKeyGenFailure, .attestation)
        case .attestationRefusedByServer:
            return (HaapiErrorCode.attestationRefusedByServer, .attestation)
        case .assertionFailure:
            return (HaapiErrorCode.assertionFailure, .attestation)
        case .dpopKeyCreationFailure:
            return (HaapiErrorCode.dpopKeyCreationFailure, .dpop)
        case .dpopProofCreationFailure:
            return (HaapiErrorCode.dpopProofCreationFailure, .dpop)
        case .dpopProofFailure:
            return (HaapiErrorCode.dpopProofFailure, .dpop)
        case .haapiTokenManagerIsClosed:
            return (HaapiErrorCode.tokenManagerClosed, .haapi)
        case .haapiTokenManagerIsExpired:
            return (HaapiErrorCode.tokenManagerExpired, .haapi)
        case .haapiTokenManagerAlreadyExists:
            return (HaapiErrorCode.tokenManagerAlreadyExists, .haapi)
        case .illegalState:
            return (HaapiErrorCode.illegalState, .unexpected)
        case .invalidConfiguration:
            return (HaapiErrorCode.invalidConfiguration, .configuration)
        @unknown default:
            return (HaapiErrorCode.unexpected, mapCategory(raw: (error as IdsvrError).error))
        }
    }

    /// Extracts server-error payload fields for `HAAPI_SERVER_ERROR` envelopes.
    private static func mapServerError(_ error: HaapiError) -> [String: Any]? {
        if case let .serverError(serverError, errorDescription, statusCode) = error {
            return [
                "error": serverError,
                "errorDescription": errorDescription,
                "statusCode": statusCode,
            ]
        }
        return nil
    }

    /// Maps native category discriminator strings to normalized category values.
    private static func mapCategory(raw: String) -> HaapiErrorCategory {
        switch raw {
        case "networking": return .networking
        case "attestation": return .attestation
        case "dpop": return .dpop
        case "haapi": return .haapi
        case "configuration": return .configuration
        case "bridge": return .bridge
        default: return .unexpected
        }
    }

    /// Converts native recovery semantics to normalized envelope shape.
    private static func mapRecovery(_ recovery: IdsvrErrorHandling?) -> [String: Any]? {
        guard let recovery else { return nil }
        switch recovery {
        case let .retryable(condition):
            return [
                "kind": "retryable",
                "condition": mapRetryCondition(condition),
            ]
        case .newHaapiFlow:
            return ["kind": "newHaapiFlow"]
        case let .unrecoverable(action):
            return [
                "kind": "unrecoverable",
                "action": mapUnrecoverableAction(action),
            ]
        @unknown default:
            return nil
        }
    }

    /// Maps native retry-condition values to JS wire literals.
    private static func mapRetryCondition(_ condition: RetryCondition) -> String {
        switch condition {
        case .now: return "now"
        case .whenAppInForeground: return "whenAppInForeground"
        @unknown default: return "now"
        }
    }

    /// Maps native unrecoverable actions to normalized action payload.
    private static func mapUnrecoverableAction(_ action: UnrecoverableAction) -> [String: Any] {
        switch action {
        case .introspectCause:
            return ["kind": "introspectCause"]
        case .invalidPlatform:
            return ["kind": "invalidPlatform"]
        case let .modifyConfiguration(reason):
            return [
                "kind": "modifyConfiguration",
                "reason": reason,
            ]
        @unknown default:
            return ["kind": "introspectCause"]
        }
    }

    /// Maps bridge-store error codes to stable recovery recommendations.
    private static func storeRecovery(for error: HaapiAccessorStore.StoreError) -> [String: Any] {
        switch error {
        case .alreadyInitialized:
            return unrecoverableModifyConfiguration("Call accessor.close() before re-initializing.")
        case .notInitialized:
            return unrecoverableModifyConfiguration("Call initializeForHaapi() or initializeForOAuth() first.")
        case .wrongKind:
            return unrecoverableModifyConfiguration("Close current accessor and re-initialize in the required mode.")
        case .flowCacheMiss:
            return ["kind": "newHaapiFlow"]
        }
    }

    /// Convenience helper for unrecoverable-modify-configuration payloads.
    private static func unrecoverableModifyConfiguration(_ reason: String) -> [String: Any] {
        [
            "kind": "unrecoverable",
            "action": [
                "kind": "modifyConfiguration",
                "reason": reason,
            ],
        ]
    }

    /// Converts optional native causes into transport-safe string payloads.
    private static func stringify(_ value: Error?) -> String? {
        guard let value else { return nil }
        return value.localizedDescription
    }

    /// Builds the envelope and wraps it in a `HaapiAccessorBridgeException`.
    private static func makeException(
        code: String,
        category: HaapiErrorCategory,
        errorDescription: String?,
        failureReason: String?,
        recovery: [String: Any]?,
        serverError: [String: Any]?,
        cause: String?,
        nativeCause: String
    ) -> HaapiAccessorBridgeException {
        var envelope: [String: Any] = [
            "code": code,
            "category": category.rawValue,
            "nativeCause": nativeCause,
        ]
        if let errorDescription { envelope["errorDescription"] = errorDescription }
        if let failureReason { envelope["failureReason"] = failureReason }
        if let recovery { envelope["recovery"] = recovery }
        if let serverError { envelope["serverError"] = serverError }
        if let cause { envelope["cause"] = cause }

        let reason: String
        if
            let data = try? JSONSerialization.data(withJSONObject: envelope, options: []),
            let json = String(data: data, encoding: .utf8)
        {
            reason = envelopePrefix + json
        } else {
            // Defensive fallback: `JSONSerialization` should never fail on
            // our `[String: Any]` of strings + nested dicts of strings,
            // but if it does we still emit the three load-bearing fields
            // (`code`, `category`, `nativeCause`) so support tooling can
            // correlate the failure to the originating type. JSON-escape
            // them defensively in case they ever contain `"` or `\`.
            reason = envelopePrefix + "{\"code\":\"\(escapeForJsonString(code))\","
                + "\"category\":\"\(escapeForJsonString(category.rawValue))\","
                + "\"nativeCause\":\"\(escapeForJsonString(nativeCause))\"}"
        }
        return HaapiAccessorBridgeException(code: code, reason: reason)
    }

    /// Minimal JSON string-escape used only by the defensive fallback in
    /// `makeException`. Mirrors the subset of escapes JSON requires
    /// (backslash + double quote) — newlines and control characters are
    /// unlikely in a Swift class name but escape just in case.
    private static func escapeForJsonString(_ value: String) -> String {
        var result = ""
        result.reserveCapacity(value.count)
        for scalar in value.unicodeScalars {
            switch scalar {
            case "\\": result.append("\\\\")
            case "\"": result.append("\\\"")
            case "\n": result.append("\\n")
            case "\r": result.append("\\r")
            case "\t": result.append("\\t")
            default: result.append(Character(scalar))
            }
        }
        return result
    }
}

/// Normalized error categories. `CaseIterable` is exposed so the iOS
/// normalizer tests can assert lockstep with the TS `HaapiErrorCategory`
/// union — when one side adds a new bucket, the test fails until the
/// other side catches up.
internal enum HaapiErrorCategory: String, CaseIterable {
    case networking
    case attestation
    case dpop
    case haapi
    case configuration
    case bridge
    case unexpected
}

private enum HaapiErrorCode {
    static let accessorAlreadyInitialized = "HAAPI_ACCESSOR_ALREADY_INITIALIZED"
    static let accessorNotInitialized = "HAAPI_ACCESSOR_NOT_INITIALIZED"
    static let accessorWrongKind = "HAAPI_ACCESSOR_WRONG_KIND"
    static let flowCacheMiss = "HAAPI_FLOW_CACHE_MISS"
    static let communication = "HAAPI_COMMUNICATION"
    static let serverError = "HAAPI_SERVER_ERROR"
    static let invalidUrlResponse = "HAAPI_INVALID_URL_RESPONSE"
    static let invalidStatusCode = "HAAPI_INVALID_STATUS_CODE"
    static let unsupportedContentType = "HAAPI_UNSUPPORTED_CONTENT_TYPE"
    static let noResponseData = "HAAPI_NO_RESPONSE_DATA"
    static let attestationNotSupported = "HAAPI_ATTESTATION_NOT_SUPPORTED"
    static let attestationFailure = "HAAPI_ATTESTATION_FAILURE"
    static let attestationKeyGenFailure = "HAAPI_ATTESTATION_KEY_GEN_FAILURE"
    static let attestationRefusedByServer = "HAAPI_ATTESTATION_REFUSED_BY_SERVER"
    static let assertionFailure = "HAAPI_ASSERTION_FAILURE"
    static let dpopKeyCreationFailure = "HAAPI_DPOP_KEY_CREATION_FAILURE"
    static let dpopProofCreationFailure = "HAAPI_DPOP_PROOF_CREATION_FAILURE"
    static let dpopProofFailure = "HAAPI_DPOP_PROOF_FAILURE"
    static let tokenManagerClosed = "HAAPI_TOKEN_MANAGER_CLOSED"
    static let tokenManagerExpired = "HAAPI_TOKEN_MANAGER_EXPIRED"
    static let tokenManagerAlreadyExists = "HAAPI_TOKEN_MANAGER_ALREADY_EXISTS"
    static let illegalState = "HAAPI_ILLEGAL_STATE"
    static let invalidModel = "HAAPI_INVALID_MODEL"
    static let invalidConfiguration = "HAAPI_INVALID_CONFIGURATION"
    static let unexpected = "HAAPI_UNEXPECTED"
}
