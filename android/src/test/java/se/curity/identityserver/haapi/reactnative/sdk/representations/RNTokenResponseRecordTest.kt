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
package se.curity.identityserver.haapi.reactnative.sdk.representations

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Fixture values are pulled from HSRN-8 plan § 11.11 so this test, the
// future bridge tests (Step 4), and the TS-side tests (Step 6) all assert
// against the same canonical TokenResponse shapes.

class RNTokenResponseRecordTest {
    // region Defaults

    @Test
    fun defaultResponseTypeIsSuccess() {
        val record = RNTokenResponseRecord()
        assertEquals(RNTokenResponseType.SUCCESS, record.responseType)
    }

    @Test
    fun defaultSuccessFieldsAreNull() {
        val record = RNTokenResponseRecord()
        assertNull(record.accessToken)
        assertNull(record.tokenType)
        assertNull(record.scope)
        // `expiresIn` is an optional `Double?` so the error branch can
        // omit it (RFC 6749 has no spec field for it on errors). The
        // default is `null`, not `0.0`, so the absence cleanly survives
        // the JS-side serialisation round-trip.
        assertNull(record.expiresIn)
        assertNull(record.refreshToken)
        assertNull(record.idToken)
    }

    @Test
    fun defaultErrorFieldsAreNull() {
        val record = RNTokenResponseRecord()
        assertNull(record.error)
        assertNull(record.errorDescription)
        assertNull(record.errorUri)
    }

    // endregion

    // region Field population

    @Test
    fun successShapePopulatesAllFields() {
        // Fixture B (OIDC success).
        val record =
            RNTokenResponseRecord().apply {
                responseType = RNTokenResponseType.SUCCESS
                accessToken = "24605f8a-b558-4527-adcc-99f7d401d4c5"
                tokenType = "bearer"
                scope = "address openid"
                expiresIn = 299.0
                refreshToken = "f33c1f4c-ee98-4ad7-8583-c53772225f78"
                idToken = "eyJraWQiOiItMzgwNzQ4MTIi"
            }

        assertEquals(RNTokenResponseType.SUCCESS, record.responseType)
        assertEquals("24605f8a-b558-4527-adcc-99f7d401d4c5", record.accessToken)
        assertEquals("bearer", record.tokenType)
        assertEquals("address openid", record.scope)
        assertEquals(299.0, record.expiresIn!!, 0.0)
        assertEquals("f33c1f4c-ee98-4ad7-8583-c53772225f78", record.refreshToken)
        assertEquals("eyJraWQiOiItMzgwNzQ4MTIi", record.idToken)
    }

    @Test
    fun errorShapePopulatesAllErrorFields() {
        // Fixture E (invalid_grant) plus a synthetic errorUri to exercise the field.
        val record =
            RNTokenResponseRecord().apply {
                responseType = RNTokenResponseType.ERROR
                error = "invalid_grant"
                errorDescription = "Invalid or unknown refresh token provided."
                errorUri = "https://docs.example.com/errors/invalid_grant"
            }

        assertEquals(RNTokenResponseType.ERROR, record.responseType)
        assertEquals("invalid_grant", record.error)
        assertEquals("Invalid or unknown refresh token provided.", record.errorDescription)
        assertEquals("https://docs.example.com/errors/invalid_grant", record.errorUri)
    }

    // endregion

    // region toString

    @Test
    fun toStringContainsClassNameAndDiscriminator() {
        val output = RNTokenResponseRecord().toString()
        assertTrue("toString should contain the class name", output.contains("RNTokenResponseRecord"))
        assertTrue("toString should contain the responseType key", output.contains("responseType"))
        // Default discriminator: `RNTokenResponseType.SUCCESS`. The
        // Record's `buildRecordString` helper formats enum values via
        // `.toString()`, which yields the enum entry name (`SUCCESS`)
        // rather than the wire `value` (`success`). Wire format is
        // preserved separately by Expo's `Enumerable` serialiser at the
        // JS-bridge boundary; that's what host TS code switches on.
        assertTrue(
            "toString should contain the default discriminator entry name",
            output.contains("SUCCESS"),
        )
    }

    @Test
    fun toStringContainsPopulatedSuccessFields() {
        val record =
            RNTokenResponseRecord().apply {
                accessToken = "c2f1bd4c-a1bf-49b8-aa64-1535fa5161a6"
                tokenType = "bearer"
                expiresIn = 600.0
            }

        val output = record.toString()
        assertTrue(output.contains("c2f1bd4c-a1bf-49b8-aa64-1535fa5161a6"))
        assertTrue(output.contains("bearer"))
        assertTrue(output.contains("600"))
    }

    @Test
    fun toStringContainsPopulatedErrorFields() {
        val record =
            RNTokenResponseRecord().apply {
                responseType = RNTokenResponseType.ERROR
                error = "invalid_grant"
                errorDescription = "Invalid or unknown refresh token provided."
            }

        val output = record.toString()
        assertTrue(output.contains("error"))
        assertTrue(output.contains("invalid_grant"))
        assertTrue(output.contains("Invalid or unknown refresh token provided."))
    }

    // endregion
}
