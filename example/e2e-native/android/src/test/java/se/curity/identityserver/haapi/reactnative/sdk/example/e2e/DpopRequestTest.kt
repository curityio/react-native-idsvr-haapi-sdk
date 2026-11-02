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
package se.curity.identityserver.haapi.reactnative.sdk.example.e2e

import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.IOException
import java.net.HttpURLConnection

/**
 * The DPoP scenarios read a resource server's answer through this hook — above all its nonce challenge,
 * which arrives as a `401`.
 */
class DpopRequestTest {
    @Test
    fun sendsTheMethodWithTheAccessTokenAndTheProof() {
        val connection = mockk<HttpURLConnection>(relaxed = true)

        DpopRequest.prepare(connection, "GET", "DPoP a-bound-access-token", "a-proof")

        verify { connection.requestMethod = "GET" }
        verify { connection.setRequestProperty("Authorization", "DPoP a-bound-access-token") }
        verify { connection.setRequestProperty("DPoP", "a-proof") }
    }

    @Test
    fun aChallengeStillReportsItsStatusHeadersAndBody() {
        // HttpURLConnection throws from getInputStream() on any 4xx, so a challenge read like a success
        // would lose the very nonce the scenario needs.
        val connection =
            mockk<HttpURLConnection>(relaxed = true) {
                every { responseCode } returns 401
                every { getHeaderField("WWW-Authenticate") } returns "DPoP error=\"use_dpop_nonce\""
                every { getHeaderField("DPoP-Nonce") } returns "rs-nonce-1"
                every { inputStream } throws IOException("Server returned HTTP response code: 401")
                every { errorStream } returns ByteArrayInputStream("""{"error":"use_dpop_nonce"}""".toByteArray())
            }

        assertEquals(
            mapOf(
                "status" to 401,
                "wwwAuthenticate" to "DPoP error=\"use_dpop_nonce\"",
                "dpopNonce" to "rs-nonce-1",
                "body" to """{"error":"use_dpop_nonce"}""",
            ),
            DpopRequest.readResponse(connection),
        )
    }

    @Test
    fun anAcceptedRequestReportsItsBodyAndNoChallenge() {
        val connection =
            mockk<HttpURLConnection>(relaxed = true) {
                every { responseCode } returns 200
                every { getHeaderField("WWW-Authenticate") } returns null
                every { getHeaderField("DPoP-Nonce") } returns null
                every { inputStream } returns ByteArrayInputStream("""{"sub":"alice"}""".toByteArray())
            }

        assertEquals(
            mapOf("status" to 200, "wwwAuthenticate" to null, "dpopNonce" to null, "body" to """{"sub":"alice"}"""),
            DpopRequest.readResponse(connection),
        )
    }

    @Test
    fun aRefusalWithoutABodyReportsAnEmptyOne() {
        val connection =
            mockk<HttpURLConnection>(relaxed = true) {
                every { responseCode } returns 403
                every { getHeaderField(any<String>()) } returns null
                every { errorStream } returns null
            }

        assertEquals("", DpopRequest.readResponse(connection)["body"])
    }
}
