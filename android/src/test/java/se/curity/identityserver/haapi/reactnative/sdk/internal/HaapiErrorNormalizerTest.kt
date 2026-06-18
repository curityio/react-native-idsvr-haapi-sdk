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
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import se.curity.identityserver.haapi.android.driver.IdsvrHaapiException
import se.curity.identityserver.haapi.android.driver.RetryCondition
import se.curity.identityserver.haapi.android.driver.UnrecoverableAction
import se.curity.identityserver.haapi.android.driver.internal.HaapiRetryableException
import se.curity.identityserver.haapi.android.driver.internal.HaapiUnrecoverableException
import se.curity.identityserver.haapi.android.driver.internal.HttpClientRetryableException
import se.curity.identityserver.haapi.android.driver.internal.HttpClientUnrecoverableException
import se.curity.identityserver.haapi.android.sdk.OAuthUnrecoverableException
import java.io.IOException
import java.net.HttpRetryException
import java.util.concurrent.CancellationException

class HaapiErrorNormalizerTest {
    @Test
    fun normalizeThrownWrapsThrownErrorsAsCodedExceptionEnvelope() {
        val thrown =
            runBlocking {
                runCatching {
                    HaapiErrorNormalizer.normalizeThrown<Unit> {
                        throw IllegalStateException("boom")
                    }
                }.exceptionOrNull()
            }

        val coded = thrown as? CodedException
        requireNotNull(coded)
        val envelope = decodeEnvelope(coded.message)
        assertEquals("HAAPI_UNEXPECTED", envelope.getString("code"))
        assertEquals("unexpected", envelope.getString("category"))
    }

    @Test
    fun useDpopNonceExceptionMapsToDpopNonceRequired() {
        val native =
            HaapiRetryableException.UseDpopNonceException(
                "nonce-1",
                "dpop",
                "retry with nonce",
            )

        val envelope = assertNormalized(native, "HAAPI_DPOP_NONCE_REQUIRED", "dpop")
        val recovery = envelope.getJSONObject("recovery")
        assertEquals("retryable", recovery.getString("kind"))
        assertEquals("now", recovery.getString("condition"))
    }

    @Test
    fun httpClientRetryableExceptionsMapToCommunication() {
        val socket =
            HttpClientRetryableException.SocketStreamInterruptionException(
                RuntimeException("timeout"),
            )
        val host = HttpClientRetryableException.HostConnectionException(RuntimeException("connect"))
        val httpRetry =
            HttpClientRetryableException.HttpRetryException(
                429,
                emptyMap(),
                HttpRetryException("retry", 429),
            )

        assertNormalized(socket, "HAAPI_COMMUNICATION", "networking")
        assertNormalized(host, "HAAPI_COMMUNICATION", "networking")
        assertNormalized(httpRetry, "HAAPI_COMMUNICATION", "networking")
    }

    @Test
    fun unsupportedDeviceAndUnsupportedHaapiMapToAttestationNotSupported() {
        val unsupportedDevice =
            HaapiUnrecoverableException.UnsupportedDeviceException(
                "attestation",
                "unsupported",
            )
        val unsupportedHaapi = HaapiUnrecoverableException.UnsupportedHaapiException(Exception("unsupported"))

        val unsupportedDeviceEnvelope =
            assertNormalized(unsupportedDevice, "HAAPI_ATTESTATION_NOT_SUPPORTED", "attestation")
        val unsupportedHaapiEnvelope =
            assertNormalized(unsupportedHaapi, "HAAPI_ATTESTATION_NOT_SUPPORTED", "attestation")

        assertEquals(
            "invalidPlatform",
            unsupportedDeviceEnvelope.getJSONObject("recovery").getJSONObject("action").getString("kind"),
        )
        assertEquals(
            "invalidPlatform",
            unsupportedHaapiEnvelope.getJSONObject("recovery").getJSONObject("action").getString("kind"),
        )
    }

    @Test
    fun keyStoreExceptionMapsToAttestationFailure() {
        val native = HaapiUnrecoverableException.KeyStoreException(Exception("keystore"))

        val envelope = assertNormalized(native, "HAAPI_ATTESTATION_FAILURE", "attestation")
        assertEquals(
            "invalidPlatform",
            envelope.getJSONObject("recovery").getJSONObject("action").getString("kind"),
        )
    }

    @Test
    fun genericErrorAndOAuthUnrecoverableMapToServerErrorWithPayload() {
        val generic = HaapiUnrecoverableException.GenericErrorException("networking", "bad request")
        val oauth =
            OAuthUnrecoverableException(
                "https://server/error",
                "networking",
                "invalid_grant",
            )

        val genericEnvelope = assertNormalized(generic, "HAAPI_SERVER_ERROR", "networking")
        val genericServerError = genericEnvelope.getJSONObject("serverError")
        assertEquals("networking", genericServerError.getString("error"))
        assertEquals("bad request", genericServerError.getString("errorDescription"))
        assertFalse(genericServerError.has("errorUri"))

        val oauthEnvelope = assertNormalized(oauth, "HAAPI_SERVER_ERROR", "networking")
        val oauthServerError = oauthEnvelope.getJSONObject("serverError")
        assertEquals("networking", oauthServerError.getString("error"))
        assertEquals("invalid_grant", oauthServerError.getString("errorDescription"))
        assertEquals("https://server/error", oauthServerError.getString("errorUri"))

        val oauthNullDescription =
            OAuthUnrecoverableException(
                "https://server/error-2",
                "networking",
                null,
            )
        val oauthNullEnvelope = assertNormalized(oauthNullDescription, "HAAPI_SERVER_ERROR", "networking")
        val oauthNullServerError = oauthNullEnvelope.getJSONObject("serverError")
        assertEquals("networking", oauthNullServerError.getString("error"))
        assertTrue(oauthNullServerError.has("errorDescription"))
        assertEquals("https://server/error-2", oauthNullServerError.getString("errorUri"))
    }

    @Test
    fun unrecoverableUnexpectedMapsToIllegalState() {
        val native = HaapiUnrecoverableException.UnexpectedException(Exception("boom"), "illegal", "unexpected")

        assertNormalized(native, "HAAPI_ILLEGAL_STATE", "unexpected")
    }

    @Test
    fun httpClientUnrecoverableSubclassesMapToExpectedCodes() {
        val unsupportedContentType = HttpClientUnrecoverableException.UnsupportedContentTypeException("ct")
        val noStreamData = HttpClientUnrecoverableException.NoStreamDataException("empty")
        val unexpected =
            HttpClientUnrecoverableException.UnexpectedException(
                "failure",
                RuntimeException("boom"),
            )

        assertNormalized(unsupportedContentType, "HAAPI_UNSUPPORTED_CONTENT_TYPE", "networking")
        assertNormalized(noStreamData, "HAAPI_NO_RESPONSE_DATA", "networking")
        assertNormalized(unexpected, "HAAPI_UNEXPECTED", "unexpected")
    }

    @Test
    fun parsingUnrecoverableFallsBackToInvalidModelCode() {
        val native =
            IdsvrHaapiException.Unrecoverable(
                UnrecoverableAction.IntrospectCause,
                "parsing_exception",
                "cannot decode form",
                "cannot decode form",
                null,
            )

        val envelope = assertNormalized(native, "HAAPI_INVALID_MODEL", "haapi")
        assertEquals("cannot decode form", envelope.getString("errorDescription"))
    }

    @Test
    fun storeErrorAlreadyInitializedIsNormalizedAsBridgeEnvelope() {
        val native =
            HaapiAccessorStore.StoreException(
                HaapiAccessorStore.ERROR_ALREADY_INITIALIZED,
                "already initialized",
            )

        val envelope = assertNormalized(native, HaapiAccessorStore.ERROR_ALREADY_INITIALIZED, "bridge")
        assertTrue(envelope.has("recovery"))
        assertEquals("unrecoverable", envelope.getJSONObject("recovery").getString("kind"))
    }

    @Test
    fun storeErrorNotInitializedIsNormalizedAsBridgeEnvelope() {
        val native =
            HaapiAccessorStore.StoreException(
                HaapiAccessorStore.ERROR_NOT_INITIALIZED,
                "not initialized",
            )

        val envelope = assertNormalized(native, HaapiAccessorStore.ERROR_NOT_INITIALIZED, "bridge")
        assertEquals("unrecoverable", envelope.getJSONObject("recovery").getString("kind"))
    }

    @Test
    fun storeErrorWrongKindIsNormalizedAsBridgeEnvelope() {
        val native =
            HaapiAccessorStore.StoreException(
                HaapiAccessorStore.ERROR_WRONG_KIND,
                "wrong kind",
            )

        val envelope = assertNormalized(native, HaapiAccessorStore.ERROR_WRONG_KIND, "bridge")
        assertEquals("unrecoverable", envelope.getJSONObject("recovery").getString("kind"))
    }

    @Test
    fun storeErrorFlowCacheMissIsNormalizedAsBridgeEnvelope() {
        val native =
            HaapiAccessorStore.StoreException(
                HaapiAccessorStore.ERROR_FLOW_CACHE_MISS,
                "cache miss",
            )

        val envelope = assertNormalized(native, HaapiAccessorStore.ERROR_FLOW_CACHE_MISS, "bridge")
        assertEquals("newHaapiFlow", envelope.getJSONObject("recovery").getString("kind"))
    }

    @Test
    fun illegalArgumentExceptionMapsToUnexpectedEnvelope() {
        val native = IllegalArgumentException("bad argument")

        val envelope = assertNormalized(native, "HAAPI_UNEXPECTED", "unexpected")
        assertTrue(envelope.getString("errorDescription").contains("bad argument"))
    }

    @Test
    fun ioExceptionMapsToUnexpectedEnvelope() {
        val native = IOException("io broke")

        val envelope = assertNormalized(native, "HAAPI_UNEXPECTED", "unexpected")
        assertTrue(envelope.getString("errorDescription").contains("io broke"))
    }

    @Test
    fun cancellationExceptionMapsToUnexpectedEnvelope() {
        val native = CancellationException("cancelled")

        val envelope = assertNormalized(native, "HAAPI_UNEXPECTED", "unexpected")
        assertTrue(envelope.getString("errorDescription").contains("cancelled"))
    }

    @Test
    fun envelopeEncodingIsDeterministicAndRoundTripsSpecialCharacters() {
        val native = IllegalArgumentException("line1\n\"quoted\"\\backslash")

        val first = HaapiErrorNormalizer.normalize(native)
        val second = HaapiErrorNormalizer.normalize(native)

        assertEquals(first.code, second.code)
        assertEquals(first.message, second.message)

        val firstEnvelope = decodeEnvelope(first.message)
        val secondEnvelope = decodeEnvelope(second.message)

        assertEquals(firstEnvelope.toString(), secondEnvelope.toString())
        assertEquals("line1\n\"quoted\"\\backslash", firstEnvelope.getString("errorDescription"))
        val roundTrip = JSONObject(firstEnvelope.toString())
        assertEquals(firstEnvelope.getString("code"), roundTrip.getString("code"))
        assertEquals(firstEnvelope.getString("category"), roundTrip.getString("category"))
    }

    @Test
    fun preNormalizedCodedExceptionPassesThroughUntouched() {
        val coded =
            CodedException(
                "HAAPI_UNEXPECTED",
                "HAAPI_ERROR_V1::{\"code\":\"HAAPI_UNEXPECTED\"}",
                null,
            )

        val normalized = HaapiErrorNormalizer.normalize(coded)

        assertEquals(coded, normalized)
    }

    @Test
    fun codedExceptionWithoutEnvelopeIsNormalizedUsingItsCode() {
        val coded = CodedException("HAAPI_INVALID_CONFIGURATION", "bad cfg", null)

        val envelope = assertNormalized(coded, "HAAPI_INVALID_CONFIGURATION", "configuration")
        assertEquals("bad cfg", envelope.getString("errorDescription"))
        assertFalse(envelope.has("recovery"))
    }

    @Test
    fun codedExceptionWithUnknownForeignCodeNormalizesToHaapiUnexpectedWithCausePreserved() {
        // Foreign `CodedException` codes that are not part of the documented
        // `HaapiErrorCode` set get re-normalized to `HAAPI_UNEXPECTED`; the
        // original code is preserved in `cause` for diagnostics. This keeps
        // JS callers from branching on a code the SDK never claimed to emit.
        val coded = CodedException("SOME_UNKNOWN_CODE", "opaque", null)

        val envelope = assertNormalized(coded, "HAAPI_UNEXPECTED", "unexpected")
        assertFalse(envelope.has("recovery"))
        assertEquals("Foreign code: SOME_UNKNOWN_CODE", envelope.getString("cause"))
    }

    @Test
    fun codedExceptionWithNullMessageIsNormalizedWithoutErrorDescriptionField() {
        // Same foreign-code contract as above, but a null message means no
        // `errorDescription` field appears on the envelope.
        val coded = CodedException("SOME_UNKNOWN_CODE", null, null)

        val envelope = assertNormalized(coded, "HAAPI_UNEXPECTED", "unexpected")
        assertFalse(envelope.has("errorDescription"))
        assertEquals("Foreign code: SOME_UNKNOWN_CODE", envelope.getString("cause"))
    }

    @Test
    fun codedExceptionDpopKeyCreationMapsToDpopCategory() {
        val coded = CodedException("HAAPI_DPOP_KEY_CREATION_FAILURE", "dpop key", null)

        val envelope = assertNormalized(coded, "HAAPI_DPOP_KEY_CREATION_FAILURE", "dpop")
        assertEquals("dpop key", envelope.getString("errorDescription"))
    }

    @Test
    fun bridgeExceptionWithoutNestedStoreCauseKeepsBridgeCodeAndHasNoStoreRecovery() {
        val bridge = HaapiAccessorBridgeException("HAAPI_INVALID_CONFIGURATION", "bridge cfg")

        val envelope = assertNormalized(bridge, "HAAPI_INVALID_CONFIGURATION", "configuration")
        assertEquals("bridge cfg", envelope.getString("errorDescription"))
        assertFalse(envelope.has("recovery"))
    }

    @Test
    fun retryableWhenAppForegroundMapsExpectedCondition() {
        val native =
            IdsvrHaapiException.Retryable(
                RetryCondition.WhenAppForeground,
                "networking",
                "foreground retry",
                "wait foreground",
                null,
            )

        val envelope = assertNormalized(native, "HAAPI_UNEXPECTED", "unexpected")
        val recovery = envelope.getJSONObject("recovery")
        assertEquals("retryable", recovery.getString("kind"))
        assertEquals("whenAppInForeground", recovery.getString("condition"))
    }

    @Test
    fun unrecoverableModifyConfigurationActionIsPreserved() {
        val native =
            IdsvrHaapiException.Unrecoverable(
                UnrecoverableAction.ModifyConfiguration("fix configuration"),
                "configuration",
                "bad cfg",
                "bad cfg",
                null,
            )

        val envelope = assertNormalized(native, "HAAPI_UNEXPECTED", "unexpected")
        val action = envelope.getJSONObject("recovery").getJSONObject("action")
        assertEquals("modifyConfiguration", action.getString("kind"))
        assertEquals("fix configuration", action.getString("reason"))
    }

    @Test
    fun anonymousThrowableUsesFqcnForNativeCauseFallback() {
        val native = object : RuntimeException("anon") {}

        val envelope = assertNormalized(native, "HAAPI_UNEXPECTED", "unexpected")
        val nativeCause = envelope.getString("nativeCause")
        assertTrue(nativeCause.contains("HaapiErrorNormalizerTest"))
    }

    @Test
    fun bridgeExceptionWithNestedStoreAndWithoutProduceMatchingEnvelopes() {
        // Both `HaapiAccessorBridgeException` constructors
        // (`(StoreException)` and `(code, message)`) feed into the same
        // envelope-builder so JS callers see identical `code`, `category`,
        // `errorDescription`, and `recovery` regardless of which path was
        // used. Only `nativeCause` differs — when a `StoreException` is
        // nested the originating class name is preserved for support
        // tooling; without a nested cause the bridge exception's own class
        // name is reported.
        val store =
            HaapiAccessorStore.StoreException(
                HaapiAccessorStore.ERROR_ALREADY_INITIALIZED,
                "already initialized",
            )
        val bridgeWithNested = HaapiAccessorBridgeException(store)
        val bridgeBare =
            HaapiAccessorBridgeException(
                HaapiAccessorStore.ERROR_ALREADY_INITIALIZED,
                "already initialized",
            )

        val nestedEnvelope = decodeEnvelope(HaapiErrorNormalizer.normalize(bridgeWithNested).message)
        val bareEnvelope = decodeEnvelope(HaapiErrorNormalizer.normalize(bridgeBare).message)

        // Same logical fields regardless of constructor.
        assertEquals(nestedEnvelope.getString("code"), bareEnvelope.getString("code"))
        assertEquals(nestedEnvelope.getString("category"), bareEnvelope.getString("category"))
        assertEquals(nestedEnvelope.getString("errorDescription"), bareEnvelope.getString("errorDescription"))
        assertEquals(
            nestedEnvelope.getJSONObject("recovery").toString(),
            bareEnvelope.getJSONObject("recovery").toString(),
        )

        // nativeCause divergence is the *intended* asymmetry — it preserves
        // diagnostic precision for tooling without changing the JS contract.
        assertEquals("StoreException", nestedEnvelope.getString("nativeCause"))
        assertEquals("HaapiAccessorBridgeException", bareEnvelope.getString("nativeCause"))
    }

    @Test
    fun categoryMapCoversEveryPublicHaapiErrorCode() {
        // Lock the production `CODE_TO_CATEGORY` map against the documented
        // stable codes. If a new code is added to `src/errors.ts`
        // `HaapiErrorCode` without a matching Android entry, this test
        // fails — preventing silent drift between TS, the Android
        // normalizer, and the public docs.
        val expected: Map<String, String> =
            mapOf(
                // bridge
                HaapiAccessorStore.ERROR_ALREADY_INITIALIZED to "bridge",
                HaapiAccessorStore.ERROR_NOT_INITIALIZED to "bridge",
                HaapiAccessorStore.ERROR_WRONG_KIND to "bridge",
                HaapiAccessorStore.ERROR_FLOW_CACHE_MISS to "bridge",
                // networking
                "HAAPI_COMMUNICATION" to "networking",
                "HAAPI_SERVER_ERROR" to "networking",
                "HAAPI_INVALID_URL_RESPONSE" to "networking",
                "HAAPI_INVALID_STATUS_CODE" to "networking",
                "HAAPI_UNSUPPORTED_CONTENT_TYPE" to "networking",
                "HAAPI_NO_RESPONSE_DATA" to "networking",
                // attestation
                "HAAPI_ATTESTATION_NOT_SUPPORTED" to "attestation",
                "HAAPI_ATTESTATION_FAILURE" to "attestation",
                "HAAPI_ATTESTATION_KEY_GEN_FAILURE" to "attestation",
                "HAAPI_ATTESTATION_REFUSED_BY_SERVER" to "attestation",
                "HAAPI_ASSERTION_FAILURE" to "attestation",
                // dpop
                "HAAPI_DPOP_KEY_CREATION_FAILURE" to "dpop",
                "HAAPI_DPOP_PROOF_CREATION_FAILURE" to "dpop",
                "HAAPI_DPOP_PROOF_FAILURE" to "dpop",
                "HAAPI_DPOP_NONCE_REQUIRED" to "dpop",
                // haapi
                "HAAPI_TOKEN_MANAGER_CLOSED" to "haapi",
                "HAAPI_TOKEN_MANAGER_EXPIRED" to "haapi",
                "HAAPI_TOKEN_MANAGER_ALREADY_EXISTS" to "haapi",
                "HAAPI_INVALID_MODEL" to "haapi",
                // configuration
                "HAAPI_INVALID_CONFIGURATION" to "configuration",
                // unexpected (note: HAAPI_ILLEGAL_STATE is `unexpected`, not `haapi`)
                "HAAPI_ILLEGAL_STATE" to "unexpected",
                "HAAPI_UNEXPECTED" to "unexpected",
            )

        assertEquals(expected, HaapiErrorNormalizer.CODE_TO_CATEGORY)
    }

    @Test
    fun retryableBaseTypeStillIncludesRetryRecovery() {
        val native =
            IdsvrHaapiException.Retryable(
                RetryCondition.Now,
                "networking",
                "temporary issue",
                "retry later",
                null,
            )

        val envelope = assertNormalized(native, "HAAPI_UNEXPECTED", "unexpected")
        val recovery = envelope.getJSONObject("recovery")
        assertEquals("retryable", recovery.getString("kind"))
        assertEquals("now", recovery.getString("condition"))
    }

    private fun assertNormalized(
        native: Throwable,
        expectedCode: String,
        expectedCategory: String,
    ): JSONObject {
        val normalized = HaapiErrorNormalizer.normalize(native)
        val envelope = decodeEnvelope(normalized.message)
        assertEquals(expectedCode, normalized.code)
        assertEquals(expectedCode, envelope.getString("code"))
        assertEquals(expectedCategory, envelope.getString("category"))
        val nativeCause = envelope.getString("nativeCause")
        assertNotNull(nativeCause)
        assertTrue(nativeCause.isNotBlank())
        assertEquals(native.javaClass.simpleName.ifBlank { native.javaClass.name }, nativeCause)

        // Deterministic contract: nativeCause remains stable for the same Throwable instance.
        val secondEnvelope = decodeEnvelope(HaapiErrorNormalizer.normalize(native).message)
        assertEquals(nativeCause, secondEnvelope.getString("nativeCause"))
        return envelope
    }

    @Test
    fun androidNormalizerNeverEmitsFailureReason() {
        // Android does not have a distinct `failureReason` slot — the
        // developer-oriented text lives in `message` / `errorDescription`.
        // This dedicated test pins the invariant across one representative
        // input per branch of the normalizer dispatch.
        val nativeErrors: List<Throwable> =
            listOf(
                HaapiRetryableException.UseDpopNonceException("nonce", "dpop", "retry"),
                HttpClientUnrecoverableException.UnsupportedContentTypeException("ct"),
                HaapiUnrecoverableException.GenericErrorException("err", "desc"),
                HaapiAccessorStore.StoreException(HaapiAccessorStore.ERROR_ALREADY_INITIALIZED, "already"),
                CodedException("HAAPI_INVALID_CONFIGURATION", "bad cfg", null),
                IllegalArgumentException("argh"),
            )
        for (native in nativeErrors) {
            val envelope = decodeEnvelope(HaapiErrorNormalizer.normalize(native).message)
            assertFalse(
                "Android normalizer must never emit `failureReason` (input: ${native.javaClass.simpleName})",
                envelope.has("failureReason"),
            )
        }
    }

    private fun decodeEnvelope(message: String?): JSONObject {
        val prefix = "HAAPI_ERROR_V1::"
        require(message != null) { "Expected normalized message." }
        assertTrue("Missing HAAPI envelope prefix.", message.startsWith(prefix))
        return JSONObject(message.removePrefix(prefix))
    }
}
