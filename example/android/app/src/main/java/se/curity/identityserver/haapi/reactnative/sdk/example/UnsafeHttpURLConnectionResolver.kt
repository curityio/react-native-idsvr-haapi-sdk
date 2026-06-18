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
package se.curity.identityserver.haapi.reactnative.sdk.example

import se.curity.identityserver.haapi.reactnative.sdk.Resolver
import se.curity.identityserver.haapi.reactnative.sdk.configurations.HttpUrlConnectionProviderOption
import se.curity.identityserver.haapi.reactnative.sdk.internal.RNHttpURLConnectionProvider
import java.net.HttpURLConnection
import java.net.URLConnection
import java.security.cert.X509Certificate
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager

class UnsafeHttpURLConnectionResolver : Resolver<RNHttpURLConnectionProvider> {
    override fun resolve(key: String): RNHttpURLConnectionProvider? {
        return if (key == HttpUrlConnectionProviderOption.CUSTOM.value) {
            RNHttpURLConnectionProvider(provider = {
                it.openConnection().disableSslTrustVerification() as HttpURLConnection
            })
        } else {
            null
        }
    }
}

private val trustManager =
    object : X509TrustManager {
        override fun checkClientTrusted(
            p0: Array<out X509Certificate>,
            p1: String
        ) {
        }

        override fun checkServerTrusted(
            p0: Array<out X509Certificate>,
            p1: String
        ) {
        }

        override fun getAcceptedIssuers() = arrayOf<X509Certificate>()
    }

private fun URLConnection.disableSslTrustVerification(): URLConnection {
    when (this) {
        is HttpsURLConnection -> {
            val sslContext = SSLContext.getInstance("SSL")
            sslContext.init(null, arrayOf(trustManager), null)
            this.setSSLSocketFactory(sslContext.socketFactory)
            this.setHostnameVerifier { _, _ -> true }
        }
    }
    return this
}