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

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class HaapiAccessorBridgeExceptionTest {
    @Test
    fun codeAndEnvelopeMessageConstructorRoundTrips() {
        val message = "HAAPI_ERROR_V1::{\"code\":\"HAAPI_UNEXPECTED\"}"

        val exception = HaapiAccessorBridgeException("HAAPI_UNEXPECTED", message)

        assertEquals("HAAPI_UNEXPECTED", exception.code)
        assertEquals(message, exception.message)
    }

    @Test
    fun storeExceptionConstructorPreservesCodeAndCause() {
        val storeError =
            HaapiAccessorStore.StoreException(
                HaapiAccessorStore.ERROR_NOT_INITIALIZED,
                "not initialized",
            )

        val exception = HaapiAccessorBridgeException(storeError)

        assertEquals(HaapiAccessorStore.ERROR_NOT_INITIALIZED, exception.code)
        assertEquals("not initialized", exception.message)
        assertSame(storeError, exception.cause)
    }
}
