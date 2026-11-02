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

import java.net.HttpURLConnection
import java.net.URI
import java.security.cert.X509Certificate
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager

/**
 * The DPoP scenarios' own request to a protected endpoint of the server (its userinfo). A development
 * server presents a self-signed certificate that the app's `fetch` refuses, so the request goes through a
 * connection that accepts any certificate — the affordance the example's `UnsafeHttpURLConnectionResolver`
 * gives the SDK. Example only; never part of the SDK.
 */
internal object DpopRequest {
    fun send(
        url: String,
        method: String,
        authorization: String,
        dpop: String,
    ): Map<String, Any?> {
        val connection = URI(url).toURL().openConnection() as HttpURLConnection
        if (connection is HttpsURLConnection) {
            connection.sslSocketFactory = ACCEPT_ANY_CERTIFICATE.socketFactory
            connection.hostnameVerifier = HostnameVerifier { _, _ -> true }
        }
        return try {
            prepare(connection, method, authorization, dpop)
            readResponse(connection)
        } finally {
            connection.disconnect()
        }
    }

    fun prepare(
        connection: HttpURLConnection,
        method: String,
        authorization: String,
        dpop: String,
    ) {
        connection.requestMethod = method
        connection.setRequestProperty("Authorization", authorization)
        connection.setRequestProperty("DPoP", dpop)
    }

    /** A `4xx`/`5xx` body comes from the error stream: `inputStream` throws for those. */
    fun readResponse(connection: HttpURLConnection): Map<String, Any?> {
        val status = connection.responseCode
        val stream = if (status >= HttpURLConnection.HTTP_BAD_REQUEST) connection.errorStream else connection.inputStream
        return mapOf(
            "status" to status,
            "wwwAuthenticate" to connection.getHeaderField("WWW-Authenticate"),
            "dpopNonce" to connection.getHeaderField("DPoP-Nonce"),
            "body" to (stream?.bufferedReader()?.use { it.readText() } ?: ""),
        )
    }

    private val ACCEPT_ANY_CERTIFICATE: SSLContext =
        SSLContext.getInstance("TLS").apply {
            init(
                null,
                arrayOf(
                    object : X509TrustManager {
                        override fun checkClientTrusted(
                            chain: Array<out X509Certificate>?,
                            authType: String?,
                        ) = Unit

                        override fun checkServerTrusted(
                            chain: Array<out X509Certificate>?,
                            authType: String?,
                        ) = Unit

                        override fun getAcceptedIssuers() = arrayOf<X509Certificate>()
                    },
                ),
                null,
            )
        }
}
