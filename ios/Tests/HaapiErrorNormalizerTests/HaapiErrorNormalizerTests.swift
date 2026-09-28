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
import XCTest
import IdsvrHaapiSdk
@testable import RNIdsvrHaapiSdk

final class HaapiErrorNormalizerTests: XCTestCase {
	func testStoreErrorIsNormalizedAsBridgeEnvelope() throws {
		let normalized = HaapiErrorNormalizer.normalize(HaapiAccessorStore.StoreError.alreadyInitialized)
		let envelope = try decodeEnvelope(normalized)

		XCTAssertEqual(normalized.code, "HAAPI_ACCESSOR_ALREADY_INITIALIZED")
		XCTAssertEqual(envelope["code"] as? String, "HAAPI_ACCESSOR_ALREADY_INITIALIZED")
		XCTAssertEqual(envelope["category"] as? String, "bridge")
	}

	func testHaapiServerErrorIncludesServerPayload() throws {
		let native = HaapiError.serverError("invalid_grant", errorDescription: "invalid token", statusCode: 400)
		let normalized = HaapiErrorNormalizer.normalize(native)
		let envelope = try decodeEnvelope(normalized)

		XCTAssertEqual(normalized.code, "HAAPI_SERVER_ERROR")
		XCTAssertEqual(envelope["category"] as? String, "networking")
		let server = envelope["serverError"] as? [String: Any]
		XCTAssertEqual(server?["error"] as? String, "invalid_grant")
		XCTAssertEqual(server?["errorDescription"] as? String, "invalid token")
		XCTAssertEqual(server?["statusCode"] as? Int, 400)
	}

	func testIdsvrFallbackHeuristicMapsInvalidModel() throws {
		// Exact-match on the `HaapiSdkError` literal. The literal is
		// captured from the IdsvrHaapiSdk 5.6.0 binary; if the SDK changes
		// the wording, this test fails and the heuristic in
		// `HaapiErrorNormalizer.swift` must be updated in lockstep.
		let fake = FakeIdsvrError(
			error: "haapi",
			errorDescription: "Cannot recover due to invalid model representation.",
			failureReason: "",
			recoverySuggestion: .unrecoverable(action: .introspectCause),
			cause: nil
		)
		let normalized = HaapiErrorNormalizer.normalize(fake)
		let envelope = try decodeEnvelope(normalized)

		XCTAssertEqual(normalized.code, "HAAPI_INVALID_MODEL")
		XCTAssertEqual(envelope["category"] as? String, "haapi")
	}

	func testIdsvrFallbackHeuristicRejectsSubstringFalsePositives() throws {
		// Previously the substring heuristic matched on words like "decode"
		// and "parsing" — false positives on unrelated networking errors.
		// Exact-match must reject these and fall back to HAAPI_UNEXPECTED.
		let cases: [String] = [
			"Failed to decode response body",
			"Parsing took too long",
			"Could not decode UTF-8",
			"Server returned content type negotiation error",
		]
		for description in cases {
			let fake = FakeIdsvrError(
				error: "networking",
				errorDescription: description,
				failureReason: "",
				recoverySuggestion: .unrecoverable(action: .introspectCause),
				cause: nil
			)
			let normalized = HaapiErrorNormalizer.normalize(fake)
			XCTAssertEqual(
				normalized.code,
				"HAAPI_UNEXPECTED",
				"Substring-like text '\(description)' must not trip the heuristic"
			)
		}
	}

	func testIdsvrFallbackAmbiguousMapsToUnexpected() throws {
		let fake = FakeIdsvrError(
			error: "networking",
			errorDescription: "Something happened",
			failureReason: "unknown",
			recoverySuggestion: .retryable(condition: .now),
			cause: nil
		)
		let normalized = HaapiErrorNormalizer.normalize(fake)
		let envelope = try decodeEnvelope(normalized)

		XCTAssertEqual(normalized.code, "HAAPI_UNEXPECTED")
		XCTAssertEqual(envelope["category"] as? String, "networking")
	}

	func testStoreErrorNotInitializedIncludesBridgeRecovery() throws {
		try assertStoreEnvelope(
			error: .notInitialized,
			expectedCode: "HAAPI_ACCESSOR_NOT_INITIALIZED",
			expectedReason: "Bridge not initialized. Call initializeForHaapi() or initializeForOAuth() first.",
			expectedRecoveryKind: "unrecoverable",
			expectedActionKind: "modifyConfiguration",
			expectedActionReason: "Call initializeForHaapi() or initializeForOAuth() first."
		)
	}

	func testStoreErrorWrongKindIncludesBridgeRecovery() throws {
		try assertStoreEnvelope(
			error: .wrongKind,
			expectedCode: "HAAPI_ACCESSOR_WRONG_KIND",
			expectedReason: "Stored accessor does not support this operation. Call close() and re-initialize in the required mode.",
			expectedRecoveryKind: "unrecoverable",
			expectedActionKind: "modifyConfiguration",
			expectedActionReason: "Close current accessor and re-initialize in the required mode."
		)
	}

	func testStoreErrorFlowCacheMissMapsToNewFlowRecoveryAndPreservesReason() throws {
		let reason = "Flow cache miss\nwith \"quotes\" and unicode: \\u263A"
		try assertStoreEnvelope(
			error: .flowCacheMiss(reason: reason),
			expectedCode: "HAAPI_FLOW_CACHE_MISS",
			expectedReason: reason,
			expectedRecoveryKind: "newHaapiFlow",
			expectedActionKind: nil,
			expectedActionReason: nil
		)
	}

	func testHaapiErrorRepresentativeCasesMapCodeCategoryAndRecovery() throws {
		let unsupported = HaapiErrorNormalizer.normalize(HaapiError.attestationNotSupported)
		let unsupportedEnvelope = try decodeEnvelope(unsupported)
		XCTAssertEqual(unsupported.code, "HAAPI_ATTESTATION_NOT_SUPPORTED")
		XCTAssertEqual(unsupportedEnvelope["category"] as? String, "attestation")
		try assertRecovery(
			unsupportedEnvelope,
			expectedKind: "unrecoverable",
			expectedActionKind: "invalidPlatform",
			expectedActionReason: nil
		)

		let invalidConfig = HaapiErrorNormalizer.normalize(HaapiError.invalidConfiguration(reason: "bad config"))
		let invalidConfigEnvelope = try decodeEnvelope(invalidConfig)
		XCTAssertEqual(invalidConfig.code, "HAAPI_INVALID_CONFIGURATION")
		XCTAssertEqual(invalidConfigEnvelope["category"] as? String, "configuration")
		let invalidConfigRecovery = try XCTUnwrap(invalidConfigEnvelope["recovery"] as? [String: Any])
		XCTAssertEqual(invalidConfigRecovery["kind"] as? String, "unrecoverable")
		let invalidConfigAction = try XCTUnwrap(invalidConfigRecovery["action"] as? [String: Any])
		XCTAssertEqual(invalidConfigAction["kind"] as? String, "modifyConfiguration")
		// Pinned to the IdsvrHaapiSdk 5.6.0 literal emitted by
		// `HaapiError.invalidConfiguration(reason:).recoverySuggestion`.
		// If the SDK changes the wording this assertion fails — better
		// than letting a partially-correct recovery message ship.
		XCTAssertEqual(
			invalidConfigAction["reason"] as? String,
			"Modify the configuration as mentioned in the `reason`."
		)

		let tokenClosed = HaapiErrorNormalizer.normalize(HaapiError.haapiTokenManagerIsClosed)
		let tokenClosedEnvelope = try decodeEnvelope(tokenClosed)
		XCTAssertEqual(tokenClosed.code, "HAAPI_TOKEN_MANAGER_CLOSED")
		XCTAssertEqual(tokenClosedEnvelope["category"] as? String, "haapi")
		try assertRecovery(tokenClosedEnvelope, expectedKind: "newHaapiFlow", expectedActionKind: nil, expectedActionReason: nil)

		let attestationFailure = HaapiErrorNormalizer.normalize(
			HaapiError.attestationFailure(cause: NSError(domain: "test", code: 1))
		)
		let attestationFailureEnvelope = try decodeEnvelope(attestationFailure)
		XCTAssertEqual(attestationFailure.code, "HAAPI_ATTESTATION_FAILURE")
		XCTAssertEqual(attestationFailureEnvelope["category"] as? String, "attestation")
		let recovery = try XCTUnwrap(attestationFailureEnvelope["recovery"] as? [String: Any])
		XCTAssertEqual(recovery["kind"] as? String, "retryable")
		XCTAssertEqual(recovery["condition"] as? String, "whenAppInForeground")
	}

	func testEnvelopeHasDeterministicKeysAndEscapesRoundTrip() throws {
		// "Required keys present + disallowed keys absent" — what the
		// wire contract actually pins. Adding a new optional envelope
		// field does not churn this test for unrelated reasons.
		let reason = "line1\nline2 with \"quotes\" and unicode: \\u00E5"
		let normalized = HaapiErrorNormalizer.normalize(HaapiAccessorStore.StoreError.flowCacheMiss(reason: reason))

		let prefix = "HAAPI_ERROR_V1::"
		let text = normalized.description
		XCTAssertTrue(text.hasPrefix(prefix))
		let payload = String(text.dropFirst(prefix.count))
		XCTAssertTrue(payload.contains("\\n"))
		XCTAssertTrue(payload.contains("\\\"quotes\\\""))

		let data = try XCTUnwrap(payload.data(using: .utf8))
		let envelope = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
		let keys = Set(envelope.keys)

		// Required keys: every envelope (regardless of code) must surface
		// these so JS can build a typed `HaapiError` even on minimal inputs.
		let required: Set<String> = ["code", "category", "nativeCause"]
		XCTAssertTrue(
			required.isSubset(of: keys),
			"Envelope missing required keys: \(required.subtracting(keys))"
		)

		// Disallowed for the `flowCacheMiss` shape: no server payload, no
		// developer-oriented failure reason, no native cause-chain string.
		// Future code paths that surface them must explicitly opt-in via
		// dedicated tests.
		let disallowed: Set<String> = ["serverError", "failureReason", "cause"]
		XCTAssertTrue(
			disallowed.isDisjoint(with: keys),
			"Envelope contains disallowed keys for flowCacheMiss: \(disallowed.intersection(keys))"
		)

		let decoded = try JSONDecoder().decode(NormalizedEnvelope.self, from: data)
		XCTAssertEqual(decoded.code, "HAAPI_FLOW_CACHE_MISS")
		XCTAssertEqual(decoded.category, "bridge")
		XCTAssertEqual(decoded.nativeCause, "StoreError")
		XCTAssertEqual(decoded.errorDescription, reason)
		XCTAssertEqual(decoded.recovery?.kind, "newHaapiFlow")
		XCTAssertNil(decoded.recovery?.action)
	}

	func testEnvelopeSurvivesEveryRenderingExpoMayRouteToJavaScript() throws {
		// ExpoModulesCore chooses which rendering of an `Exception` becomes the
		// JavaScript `error.message`, and that choice is not stable across SDK
		// versions: Expo 56 surfaced `description`, while Expo 57 rejects async
		// functions through `JavaScriptThrowable.message`, whose default is
		// `String(reflecting:)` — that is `debugDescription`, built from `reason`.
		//
		// The envelope is the whole typed-error contract. When a rendering drops
		// it, `decodeEnvelope` returns null, `rethrowAsHaapiError` re-throws the
		// raw `Error`, and `isHaapiError(e)` is false for every thrown error on
		// iOS with only `error.code` left intact — a consumer-visible regression
		// that still compiles and that no other tier can see: the TypeScript
		// suites mock `expo-modules-core`, and every other test in this file
		// reads `description`, the one rendering Expo 57 stopped using.
		//
		// Pinning both renderings is the point. Asserting whichever one the
		// current ExpoModulesCore happens to read would re-break on the next
		// flip. Regression: HSRN-45 (Expo 56 -> 57).
		let normalized = HaapiErrorNormalizer.normalize(
			HaapiAccessorStore.StoreError.notInitialized
		)
		let prefix = "HAAPI_ERROR_V1::"

		XCTAssertTrue(
			normalized.description.contains(prefix),
			"`description` carries no \(prefix) envelope, so JS would receive an untyped Error. "
				+ "Got: \(normalized.description)"
		)
		XCTAssertTrue(
			normalized.debugDescription.contains(prefix),
			"`debugDescription` carries no \(prefix) envelope. ExpoModulesCore 57+ renders this one "
				+ "(via `reason`) into `error.message`, so JS would receive an untyped Error. "
				+ "Got: \(normalized.debugDescription)"
		)
	}

	func testHaapiErrorMappingMatrixCoversRemainingRepresentativeCases() throws {
		let cases: [(error: HaapiError, code: String, category: String)] = [
			(.communication(message: "offline", cause: nil), "HAAPI_COMMUNICATION", "networking"),
			(.invalidStatusCode(418), "HAAPI_INVALID_STATUS_CODE", "networking"),
			(.invalidURLResponse(nil, reason: "bad response", cause: nil), "HAAPI_INVALID_URL_RESPONSE", "networking"),
			(.attestationKeyGenFailure(cause: nil), "HAAPI_ATTESTATION_KEY_GEN_FAILURE", "attestation"),
			(.attestationRefusedByServer(cause: nil), "HAAPI_ATTESTATION_REFUSED_BY_SERVER", "attestation"),
			(.assertionFailure(cause: nil), "HAAPI_ASSERTION_FAILURE", "attestation"),
			(.dpopKeyCreationFailure(cause: NSError(domain: "test", code: 11)), "HAAPI_DPOP_KEY_CREATION_FAILURE", "dpop"),
			(.dpopProofCreationFailure(cause: NSError(domain: "test", code: 12)), "HAAPI_DPOP_PROOF_CREATION_FAILURE", "dpop"),
			(.dpopProofFailure(message: "proof", cause: NSError(domain: "test", code: 13)), "HAAPI_DPOP_PROOF_FAILURE", "dpop"),
			(.haapiTokenManagerIsExpired, "HAAPI_TOKEN_MANAGER_EXPIRED", "haapi"),
			(.haapiTokenManagerAlreadyExists(name: "existing"), "HAAPI_TOKEN_MANAGER_ALREADY_EXISTS", "haapi"),
			(.illegalState(message: "illegal"), "HAAPI_ILLEGAL_STATE", "unexpected"),
		]

		for testCase in cases {
			let normalized = HaapiErrorNormalizer.normalize(testCase.error)
			let envelope = try decodeEnvelope(normalized)
			XCTAssertEqual(normalized.code, testCase.code)
			XCTAssertEqual(envelope["code"] as? String, testCase.code)
			XCTAssertEqual(envelope["category"] as? String, testCase.category)
			XCTAssertEqual(envelope["nativeCause"] as? String, "HaapiError")
		}
	}

	func testIdsvrFallbackCategoryMappingCoversKnownRawValues() throws {
		let cases: [(raw: String, expectedCategory: String)] = [
			("attestation", "attestation"),
			("dpop", "dpop"),
			("configuration", "configuration"),
			("bridge", "bridge"),
			("something-else", "unexpected"),
		]

		for testCase in cases {
			let fake = FakeIdsvrError(
				error: testCase.raw,
				errorDescription: "opaque description",
				failureReason: "opaque reason",
				recoverySuggestion: .unrecoverable(action: .introspectCause),
				cause: nil
			)
			let normalized = HaapiErrorNormalizer.normalize(fake)
			let envelope = try decodeEnvelope(normalized)

			XCTAssertEqual(normalized.code, "HAAPI_UNEXPECTED")
			XCTAssertEqual(envelope["category"] as? String, testCase.expectedCategory)
		}
	}

	func testIdsvrFallbackHeuristicMapsUnsupportedContentTypeFromExactLiteral() throws {
		// Exact-match against the IdsvrHaapiSdk 5.6.0
		// `HaapiSdkError.unsupportedContentType` errorDescription literal.
		let unsupportedContentType = FakeIdsvrError(
			error: "networking",
			errorDescription: "Unsupported content type, the raw representation cannot be mapped.",
			failureReason: "",
			recoverySuggestion: .unrecoverable(action: .introspectCause),
			cause: nil
		)
		let unsupportedEnvelope = try decodeEnvelope(HaapiErrorNormalizer.normalize(unsupportedContentType))
		XCTAssertEqual(unsupportedEnvelope["code"] as? String, "HAAPI_UNSUPPORTED_CONTENT_TYPE")
		XCTAssertEqual(unsupportedEnvelope["category"] as? String, "networking")
	}

	func testIdsvrFallbackNoResponseDataAlwaysFallsBackToUnexpected() throws {
		// `HaapiSdkError.noResponseData` does not have a distinctive literal
		// in the iOS SDK binary that can be safely matched without false
		// positives. The heuristic intentionally falls through to the Q1.B
		// baseline; host apps relying on `HAAPI_NO_RESPONSE_DATA` on iOS
		// must branch on `category` + `errorDescription` themselves.
		let fake = FakeIdsvrError(
			error: "networking",
			errorDescription: "The raw response cannot be mapped.",
			failureReason: "",
			recoverySuggestion: .unrecoverable(action: .introspectCause),
			cause: nil
		)
		let envelope = try decodeEnvelope(HaapiErrorNormalizer.normalize(fake))
		XCTAssertEqual(envelope["code"] as? String, "HAAPI_UNEXPECTED")
		XCTAssertEqual(envelope["category"] as? String, "networking")
	}

	func testNonIdsvrErrorFallsBackToUnexpectedWithNativeCause() throws {
		let native = NSError(domain: "bridge-test", code: 9001, userInfo: [NSLocalizedDescriptionKey: "opaque native error"])
		let normalized = HaapiErrorNormalizer.normalize(native)
		let envelope = try decodeEnvelope(normalized)

		XCTAssertEqual(normalized.code, "HAAPI_UNEXPECTED")
		XCTAssertEqual(envelope["code"] as? String, "HAAPI_UNEXPECTED")
		XCTAssertEqual(envelope["category"] as? String, "unexpected")
		XCTAssertEqual(envelope["errorDescription"] as? String, "opaque native error")
		XCTAssertEqual(envelope["nativeCause"] as? String, "NSError")
		XCTAssertNil(envelope["recovery"])
		XCTAssertNil(envelope["failureReason"])
	}

	func testHaapiErrorCategoryRawValuesMatchTsUnionVerbatim() {
		// Lock the iOS `HaapiErrorCategory` enum against the TS
		// `HaapiErrorCategory` string-union. When one side adds a new
		// bucket, this test fails until the other side catches up.
		// Source: `src/errors.ts` `HaapiErrorCategory`.
		let expected: Set<String> = [
			"networking",
			"attestation",
			"dpop",
			"haapi",
			"configuration",
			"bridge",
			"unexpected",
		]
		let actual = Set(HaapiErrorCategory.allCases.map(\.rawValue))
		XCTAssertEqual(
			actual,
			expected,
			"iOS HaapiErrorCategory drifted from src/errors.ts HaapiErrorCategory union"
		)
	}

	func testIdsvrFallbackUnexpectedCategoryPreservesRecoveryAndCause() throws {
		let fakeCause = NSError(domain: "fallback", code: 77, userInfo: [NSLocalizedDescriptionKey: "root cause text"])
		let fake = FakeIdsvrError(
			error: "unexpected",
			errorDescription: "unexpected crash path",
			failureReason: "opaque fallback reason",
			recoverySuggestion: .unrecoverable(action: .introspectCause),
			cause: fakeCause
		)

		let normalized = HaapiErrorNormalizer.normalize(fake)
		let envelope = try decodeEnvelope(normalized)

		XCTAssertEqual(normalized.code, "HAAPI_UNEXPECTED")
		XCTAssertEqual(envelope["category"] as? String, "unexpected")
		XCTAssertEqual(envelope["cause"] as? String, "root cause text")
		try assertRecovery(
			envelope,
			expectedKind: "unrecoverable",
			expectedActionKind: "introspectCause",
			expectedActionReason: nil
		)
	}

	private func decodeEnvelope(_ exception: HaapiAccessorBridgeException) throws -> [String: Any] {
		let prefix = "HAAPI_ERROR_V1::"
		let text = exception.description
		XCTAssertTrue(text.hasPrefix(prefix))
		let payload = String(text.dropFirst(prefix.count))
		let data = try XCTUnwrap(payload.data(using: .utf8))
		return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
	}

	private func assertStoreEnvelope(
		error: HaapiAccessorStore.StoreError,
		expectedCode: String,
		expectedReason: String,
		expectedRecoveryKind: String,
		expectedActionKind: String?,
		expectedActionReason: String?
	) throws {
		let normalized = HaapiErrorNormalizer.normalize(error)
		let envelope = try decodeEnvelope(normalized)

		XCTAssertEqual(normalized.code, expectedCode)
		XCTAssertEqual(envelope["code"] as? String, expectedCode)
		XCTAssertEqual(envelope["category"] as? String, "bridge")
		XCTAssertEqual(envelope["errorDescription"] as? String, expectedReason)
		XCTAssertEqual(envelope["nativeCause"] as? String, "StoreError")

		try assertRecovery(
			envelope,
			expectedKind: expectedRecoveryKind,
			expectedActionKind: expectedActionKind,
			expectedActionReason: expectedActionReason
		)
	}

	private func assertRecovery(
		_ envelope: [String: Any],
		expectedKind: String,
		expectedActionKind: String?,
		expectedActionReason: String?
	) throws {
		let recovery = try XCTUnwrap(envelope["recovery"] as? [String: Any])
		XCTAssertEqual(recovery["kind"] as? String, expectedKind)

		if let expectedActionKind {
			let action = try XCTUnwrap(recovery["action"] as? [String: Any])
			XCTAssertEqual(action["kind"] as? String, expectedActionKind)
			XCTAssertEqual(action["reason"] as? String, expectedActionReason)
		} else {
			XCTAssertNil(recovery["action"])
		}
	}
}

private struct FakeIdsvrError: IdsvrError, Error {
	let error: String
	let errorDescription: String?
	let failureReason: String
	let recoverySuggestion: IdsvrErrorHandling
	let cause: Error?
}

private struct NormalizedEnvelope: Decodable {
	let code: String
	let category: String
	let nativeCause: String
	let errorDescription: String?
	let recovery: Recovery?

	struct Recovery: Decodable {
		let kind: String
		let action: Action?

		struct Action: Decodable {
			let kind: String
			let reason: String?
		}
	}
}

