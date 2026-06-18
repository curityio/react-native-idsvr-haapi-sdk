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

import expo.modules.kotlin.exception.CodedException
import org.json.JSONObject
import se.curity.identityserver.haapi.android.driver.IdsvrHaapiException
import se.curity.identityserver.haapi.android.driver.RetryCondition
import se.curity.identityserver.haapi.android.driver.UnrecoverableAction
import se.curity.identityserver.haapi.android.driver.internal.HaapiRetryableException
import se.curity.identityserver.haapi.android.driver.internal.HaapiUnrecoverableException
import se.curity.identityserver.haapi.android.driver.internal.HttpClientRetryableException
import se.curity.identityserver.haapi.android.driver.internal.HttpClientUnrecoverableException
import se.curity.identityserver.haapi.android.sdk.OAuthUnrecoverableException

/**
 * Converts Android native throwables into envelope-backed Expo [CodedException] values.
 */
internal object HaapiErrorNormalizer {
    private const val ENVELOPE_PREFIX = "HAAPI_ERROR_V1::"
    private const val PARSING_EXCEPTION = "parsing_exception"

    /** Executes [block] and rethrows any failure via [normalize]. */
    suspend inline fun <T> normalizeThrown(crossinline block: suspend () -> T): T =
        try {
            block()
        } catch (throwable: Throwable) {
            throw normalize(throwable)
        }

    /** Normalizes any throwable into a transport-safe envelope exception. */
    fun normalize(throwable: Throwable): CodedException {
        if (throwable is CodedException && throwable.message?.startsWith(ENVELOPE_PREFIX) == true) {
            return throwable
        }

        val normalized =
            when (throwable) {
                is HaapiAccessorStore.StoreException -> {
                    normalizeStoreError(throwable)
                }

                is HaapiAccessorBridgeException -> {
                    normalizeBridgeError(throwable)
                }

                is IdsvrHaapiException -> {
                    normalizeIdsvrError(throwable)
                }

                is CodedException -> {
                    normalizeCodedError(throwable)
                }

                // Catch-all branch for non-HAAPI throwables. We preserve diagnostics
                // and use HAAPI_UNEXPECTED as the stable fallback contract.
                else -> {
                    NormalizedError(
                        code = HaapiErrorCode.UNEXPECTED,
                        category = categoryForCode(HaapiErrorCode.UNEXPECTED),
                        errorDescription = throwable.message,
                        nativeCause = nativeCauseOf(throwable),
                    )
                }
            }

        return CodedException(normalized.code, encodeEnvelope(normalized), throwable)
    }

    /** Maps store exceptions to bridge category/codes and recovery hints. */
    private fun normalizeStoreError(error: HaapiAccessorStore.StoreException): NormalizedError =
        NormalizedError(
            code = error.code,
            category = categoryForCode(error.code),
            errorDescription = error.message,
            recovery = storeRecovery(error.code),
            nativeCause = nativeCauseOf(error),
        )

    /**
     * Normalizes bridge-wrapped exceptions. Both constructors of
     * [HaapiAccessorBridgeException] land here: the nested-cause path
     * (`HaapiAccessorBridgeException(StoreException)`) and the bare-code
     * path (`HaapiAccessorBridgeException(code, message)`). Both feed into
     * the same envelope-builder so the JS-visible shape (`code`,
     * `category`, `recovery`) is identical regardless of which constructor
     * created the exception. `nativeCause` derives from the nested
     * `StoreException` when present so support tooling sees the
     * originating class name; otherwise it falls back to the bridge
     * exception's own class name.
     */
    private fun normalizeBridgeError(error: HaapiAccessorBridgeException): NormalizedError {
        val nestedStoreError = error.cause as? HaapiAccessorStore.StoreException
        val nativeCause = nestedStoreError?.let { nativeCauseOf(it) } ?: nativeCauseOf(error)
        return NormalizedError(
            code = error.code,
            category = categoryForCode(error.code),
            errorDescription = error.message,
            recovery = storeRecovery(error.code),
            nativeCause = nativeCause,
        )
    }

    /**
     * Normalizes generic Expo coded errors into the shared envelope shape.
     *
     * Foreign codes that are not part of the documented `HaapiErrorCode`
     * set get re-normalized to `HAAPI_UNEXPECTED`. The original foreign
     * code is preserved in `cause` for diagnostics. This keeps JS callers
     * from accidentally branching on a stable-looking code that the SDK
     * never claimed to emit.
     */
    private fun normalizeCodedError(error: CodedException): NormalizedError {
        val isKnown = CODE_TO_CATEGORY.containsKey(error.code)
        val effectiveCode = if (isKnown) error.code else HaapiErrorCode.UNEXPECTED
        return NormalizedError(
            code = effectiveCode,
            category = categoryForCode(effectiveCode),
            errorDescription = error.message,
            recovery = storeRecovery(effectiveCode),
            cause = if (isKnown) null else "Foreign code: ${error.code}",
            nativeCause = nativeCauseOf(error),
        )
    }

    /** Normalizes SDK exceptions, including recovery and optional server payload fields. */
    private fun normalizeIdsvrError(error: IdsvrHaapiException): NormalizedError {
        val code = classifyCode(error)

        return NormalizedError(
            code = code,
            category = categoryForCode(code),
            errorDescription = error.errorDescription ?: error.message,
            recovery = mapRecovery(error),
            serverError = mapServerError(error, code),
            cause = error.cause?.message,
            nativeCause = nativeCauseOf(error),
        )
    }

    /** Classifies a native exception into a stable normalized error code. */
    private fun classifyCode(error: IdsvrHaapiException): String =
        when (error) {
            is HaapiRetryableException.UseDpopNonceException -> {
                HaapiErrorCode.DPOP_NONCE_REQUIRED
            }

            is HttpClientRetryableException.HostConnectionException,
            is HttpClientRetryableException.SocketStreamInterruptionException,
            is HttpClientRetryableException.HttpRetryException,
            -> {
                HaapiErrorCode.COMMUNICATION
            }

            is HaapiUnrecoverableException.UnsupportedDeviceException,
            is HaapiUnrecoverableException.UnsupportedHaapiException,
            -> {
                HaapiErrorCode.ATTESTATION_NOT_SUPPORTED
            }

            is HaapiUnrecoverableException.KeyStoreException -> {
                HaapiErrorCode.ATTESTATION_FAILURE
            }

            is HaapiUnrecoverableException.GenericErrorException,
            is OAuthUnrecoverableException,
            -> {
                HaapiErrorCode.SERVER_ERROR
            }

            is HaapiUnrecoverableException.UnexpectedException -> {
                HaapiErrorCode.ILLEGAL_STATE
            }

            is HttpClientUnrecoverableException.UnsupportedContentTypeException -> {
                HaapiErrorCode.UNSUPPORTED_CONTENT_TYPE
            }

            is HttpClientUnrecoverableException.NoStreamDataException -> {
                HaapiErrorCode.NO_RESPONSE_DATA
            }

            is HttpClientUnrecoverableException.UnexpectedException -> {
                HaapiErrorCode.UNEXPECTED
            }

            else -> {
                if (error.error.equals(PARSING_EXCEPTION, ignoreCase = true)) {
                    HaapiErrorCode.INVALID_MODEL
                } else {
                    HaapiErrorCode.UNEXPECTED
                }
            }
        }

    /** Maps native recovery semantics to normalized envelope payload. */
    private fun mapRecovery(error: IdsvrHaapiException): Map<String, Any?>? =
        when (error) {
            is IdsvrHaapiException.Retryable -> {
                mapOf(
                    "kind" to "retryable",
                    "condition" to mapRetryCondition(error.condition),
                )
            }

            is IdsvrHaapiException.Unrecoverable -> {
                mapOf(
                    "kind" to "unrecoverable",
                    "action" to mapUnrecoverableAction(error.action),
                )
            }

            else -> {
                null
            }
        }

    /** Maps native retry condition variants to JS wire literals. */
    private fun mapRetryCondition(condition: RetryCondition): String =
        when (condition) {
            is RetryCondition.Now -> "now"
            is RetryCondition.WhenAppForeground -> "whenAppInForeground"
            else -> "now"
        }

    /** Maps native unrecoverable actions to JS envelope action payload. */
    private fun mapUnrecoverableAction(action: UnrecoverableAction): Map<String, Any?> =
        when (action) {
            is UnrecoverableAction.IntrospectCause -> {
                mapOf("kind" to "introspectCause")
            }

            is UnrecoverableAction.InvalidPlatform -> {
                mapOf("kind" to "invalidPlatform")
            }

            is UnrecoverableAction.ModifyConfiguration -> {
                mapOf(
                    "kind" to "modifyConfiguration",
                    "reason" to action.reason,
                )
            }

            else -> {
                mapOf("kind" to "introspectCause")
            }
        }

    /** Extracts `serverError` payload fields when code is `HAAPI_SERVER_ERROR`. */
    private fun mapServerError(
        error: IdsvrHaapiException,
        code: String,
    ): Map<String, Any?>? {
        if (code != HaapiErrorCode.SERVER_ERROR) {
            return null
        }

        val serverError =
            mutableMapOf<String, Any?>(
                "error" to error.error,
                "errorDescription" to (error.errorDescription ?: error.message ?: ""),
            )
        if (error is OAuthUnrecoverableException) {
            serverError["errorUri"] = error.errorUri
        }
        return serverError
    }

    /** Returns recovery payload for bridge-store error codes. */
    private fun storeRecovery(code: String): Map<String, Any?>? =
        when (code) {
            HaapiAccessorStore.ERROR_ALREADY_INITIALIZED -> {
                unrecoverableModifyConfiguration("Call accessor.close() before re-initializing.")
            }

            HaapiAccessorStore.ERROR_NOT_INITIALIZED -> {
                unrecoverableModifyConfiguration("Call initializeForHaapi() or initializeForOAuth() first.")
            }

            HaapiAccessorStore.ERROR_WRONG_KIND -> {
                unrecoverableModifyConfiguration("Close current accessor and re-initialize in the required mode.")
            }

            HaapiAccessorStore.ERROR_FLOW_CACHE_MISS -> {
                mapOf("kind" to "newHaapiFlow")
            }

            else -> {
                null
            }
        }

    /** Builds a standard unrecoverable/modifyConfiguration payload. */
    private fun unrecoverableModifyConfiguration(reason: String): Map<String, Any?> =
        mapOf(
            "kind" to "unrecoverable",
            "action" to
                mapOf(
                    "kind" to "modifyConfiguration",
                    "reason" to reason,
                ),
        )

    /** Produces a non-empty diagnostic class-name string for envelope `nativeCause`. */
    private fun nativeCauseOf(throwable: Throwable): String {
        val simpleName = throwable.javaClass.simpleName
        return if (simpleName.isNotBlank()) simpleName else throwable.javaClass.name
    }

    /**
     * Single source of truth for code → category mapping. Covers every
     * documented `HaapiErrorCode` (plan § 8.1 / `src/errors.ts`), so any
     * code that comes through `normalizeCodedError`/`normalizeBridgeError`
     * gets the same category JS expects from `src/errors.ts` `isHaapiError`.
     *
     * The `RepresentationEnumTest` (Android) + `errors.test.ts` (TS) +
     * `categoryMapCoversEveryPublicHaapiErrorCode` (this file's test)
     * collectively lock the map against drift between native, TS, and
     * documentation.
     */
    internal val CODE_TO_CATEGORY: Map<String, String> =
        mapOf(
            // bridge
            HaapiAccessorStore.ERROR_ALREADY_INITIALIZED to HaapiErrorCategory.BRIDGE,
            HaapiAccessorStore.ERROR_NOT_INITIALIZED to HaapiErrorCategory.BRIDGE,
            HaapiAccessorStore.ERROR_WRONG_KIND to HaapiErrorCategory.BRIDGE,
            HaapiAccessorStore.ERROR_FLOW_CACHE_MISS to HaapiErrorCategory.BRIDGE,
            // networking
            HaapiErrorCode.COMMUNICATION to HaapiErrorCategory.NETWORKING,
            HaapiErrorCode.SERVER_ERROR to HaapiErrorCategory.NETWORKING,
            HaapiErrorCode.INVALID_URL_RESPONSE to HaapiErrorCategory.NETWORKING,
            HaapiErrorCode.INVALID_STATUS_CODE to HaapiErrorCategory.NETWORKING,
            HaapiErrorCode.UNSUPPORTED_CONTENT_TYPE to HaapiErrorCategory.NETWORKING,
            HaapiErrorCode.NO_RESPONSE_DATA to HaapiErrorCategory.NETWORKING,
            // attestation
            HaapiErrorCode.ATTESTATION_NOT_SUPPORTED to HaapiErrorCategory.ATTESTATION,
            HaapiErrorCode.ATTESTATION_FAILURE to HaapiErrorCategory.ATTESTATION,
            HaapiErrorCode.ATTESTATION_KEY_GEN_FAILURE to HaapiErrorCategory.ATTESTATION,
            HaapiErrorCode.ATTESTATION_REFUSED_BY_SERVER to HaapiErrorCategory.ATTESTATION,
            HaapiErrorCode.ASSERTION_FAILURE to HaapiErrorCategory.ATTESTATION,
            // dpop
            HaapiErrorCode.DPOP_KEY_CREATION_FAILURE to HaapiErrorCategory.DPOP,
            HaapiErrorCode.DPOP_PROOF_CREATION_FAILURE to HaapiErrorCategory.DPOP,
            HaapiErrorCode.DPOP_PROOF_FAILURE to HaapiErrorCategory.DPOP,
            HaapiErrorCode.DPOP_NONCE_REQUIRED to HaapiErrorCategory.DPOP,
            // haapi
            HaapiErrorCode.TOKEN_MANAGER_CLOSED to HaapiErrorCategory.HAAPI,
            HaapiErrorCode.TOKEN_MANAGER_EXPIRED to HaapiErrorCategory.HAAPI,
            HaapiErrorCode.TOKEN_MANAGER_ALREADY_EXISTS to HaapiErrorCategory.HAAPI,
            HaapiErrorCode.INVALID_MODEL to HaapiErrorCategory.HAAPI,
            // configuration
            HaapiErrorCode.INVALID_CONFIGURATION to HaapiErrorCategory.CONFIGURATION,
            // unexpected
            HaapiErrorCode.ILLEGAL_STATE to HaapiErrorCategory.UNEXPECTED,
            HaapiErrorCode.UNEXPECTED to HaapiErrorCategory.UNEXPECTED,
        )

    /**
     * Maps a normalized code to its category.
     *
     * Every code the normalizer produces lives in [CODE_TO_CATEGORY] —
     * `normalizeCodedError` re-routes foreign codes to `HAAPI_UNEXPECTED`
     * before they reach this method, so an unmapped code here would be an
     * internal bug (a new entry added to `HaapiErrorCode` without the
     * matching `CODE_TO_CATEGORY` row). `categoryMapCoversEveryPublicHaapiErrorCode`
     * locks that map against drift, so this path doubles as the loud
     * runtime guard if that test is ever skipped.
     */
    private fun categoryForCode(code: String): String =
        CODE_TO_CATEGORY[code]
            ?: error("CODE_TO_CATEGORY is missing an entry for '$code' — update the map.")

    /**
     * Encodes a normalized payload as `HAAPI_ERROR_V1::` + JSON envelope text.
     *
     * Note: Android does not emit `failureReason` (HSRN-22 § 17 Q5 — Android
     * does not have a distinct slot; the developer-oriented text lives in
     * `message` / `errorDescription`). The field is intentionally absent
     * from [NormalizedError] so dead-branch coverage on `?.let` does not
     * drag down the JaCoCo gate.
     */
    private fun encodeEnvelope(error: NormalizedError): String {
        val envelope = JSONObject()
        envelope.put("code", error.code)
        envelope.put("category", error.category)
        envelope.put("nativeCause", error.nativeCause)
        error.errorDescription?.let { envelope.put("errorDescription", it) }
        error.recovery?.let { envelope.put("recovery", JSONObject(it)) }
        error.serverError?.let { envelope.put("serverError", JSONObject(it)) }
        error.cause?.let { envelope.put("cause", it) }
        return ENVELOPE_PREFIX + envelope.toString()
    }
}

private data class NormalizedError(
    val code: String,
    val category: String,
    val errorDescription: String? = null,
    val recovery: Map<String, Any?>? = null,
    val serverError: Map<String, Any?>? = null,
    val cause: String? = null,
    val nativeCause: String,
)

/**
 * Stable normalized error-category constants. Must stay in lockstep with
 * the TS `HaapiErrorCategory` union in `src/errors.ts`. Tests in this
 * package assert the [HaapiErrorNormalizer.CODE_TO_CATEGORY] map covers
 * every public code, so a new category added on the TS side without a
 * matching constant here causes a test failure.
 */
internal object HaapiErrorCategory {
    const val NETWORKING = "networking"
    const val ATTESTATION = "attestation"
    const val DPOP = "dpop"
    const val HAAPI = "haapi"
    const val CONFIGURATION = "configuration"
    const val BRIDGE = "bridge"
    const val UNEXPECTED = "unexpected"
}

/**
 * Stable normalized error-code constants. Must stay in lockstep with the
 * TS `HaapiErrorCode` map in `src/errors.ts` and the documentation in
 * `docs/error-handling.md`. The Android JaCoCo / unit-test suite locks
 * the production-side mapping via [HaapiErrorNormalizer.CODE_TO_CATEGORY];
 * codes that the Android normalizer never natively emits (iOS-focused
 * codes) are present so foreign `CodedException` passes through with the
 * correct category instead of being demoted to `unexpected`.
 */
internal object HaapiErrorCode {
    // networking
    const val COMMUNICATION = "HAAPI_COMMUNICATION"
    const val SERVER_ERROR = "HAAPI_SERVER_ERROR"
    const val INVALID_URL_RESPONSE = "HAAPI_INVALID_URL_RESPONSE"
    const val INVALID_STATUS_CODE = "HAAPI_INVALID_STATUS_CODE"
    const val UNSUPPORTED_CONTENT_TYPE = "HAAPI_UNSUPPORTED_CONTENT_TYPE"
    const val NO_RESPONSE_DATA = "HAAPI_NO_RESPONSE_DATA"

    // attestation
    const val ATTESTATION_NOT_SUPPORTED = "HAAPI_ATTESTATION_NOT_SUPPORTED"
    const val ATTESTATION_FAILURE = "HAAPI_ATTESTATION_FAILURE"
    const val ATTESTATION_KEY_GEN_FAILURE = "HAAPI_ATTESTATION_KEY_GEN_FAILURE"
    const val ATTESTATION_REFUSED_BY_SERVER = "HAAPI_ATTESTATION_REFUSED_BY_SERVER"
    const val ASSERTION_FAILURE = "HAAPI_ASSERTION_FAILURE"

    // dpop
    const val DPOP_KEY_CREATION_FAILURE = "HAAPI_DPOP_KEY_CREATION_FAILURE"
    const val DPOP_PROOF_CREATION_FAILURE = "HAAPI_DPOP_PROOF_CREATION_FAILURE"
    const val DPOP_PROOF_FAILURE = "HAAPI_DPOP_PROOF_FAILURE"
    const val DPOP_NONCE_REQUIRED = "HAAPI_DPOP_NONCE_REQUIRED"

    // haapi
    const val TOKEN_MANAGER_CLOSED = "HAAPI_TOKEN_MANAGER_CLOSED"
    const val TOKEN_MANAGER_EXPIRED = "HAAPI_TOKEN_MANAGER_EXPIRED"
    const val TOKEN_MANAGER_ALREADY_EXISTS = "HAAPI_TOKEN_MANAGER_ALREADY_EXISTS"
    const val INVALID_MODEL = "HAAPI_INVALID_MODEL"

    // configuration
    const val INVALID_CONFIGURATION = "HAAPI_INVALID_CONFIGURATION"

    // unexpected
    const val ILLEGAL_STATE = "HAAPI_ILLEGAL_STATE"
    const val UNEXPECTED = "HAAPI_UNEXPECTED"
}
