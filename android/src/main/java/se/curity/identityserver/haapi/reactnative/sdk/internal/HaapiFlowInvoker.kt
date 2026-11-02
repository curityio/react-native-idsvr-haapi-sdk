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

import se.curity.identityserver.haapi.android.sdk.HaapiManager
import se.curity.identityserver.haapi.android.sdk.models.HaapiResponse
import se.curity.identityserver.haapi.android.sdk.models.Link
import se.curity.identityserver.haapi.android.sdk.models.actions.FormActionModel
import kotlin.coroutines.CoroutineContext

/**
 * Test seam over [HaapiManager]'s flow methods.
 *
 * The native [HaapiManager] is `final` with an `internal` constructor, so it
 * can't be subclassed or constructed from this module's tests. The bridge
 * depends on this interface instead, and production wiring uses
 * [DefaultHaapiFlowInvoker]. Tests provide hand-rolled stubs.
 */
internal interface HaapiFlowInvoker {
    suspend fun start(): HaapiResponse

    suspend fun submitForm(
        form: FormActionModel,
        parameters: Map<String, Any>,
    ): HaapiResponse

    suspend fun followLink(link: Link): HaapiResponse
}

/**
 * Production [HaapiFlowInvoker] that delegates straight to the native
 * [HaapiManager]. Pulled out of the Expo module so the module file becomes a
 * thin DSL-only shell (HSRN-8 § 6).
 */
internal class DefaultHaapiFlowInvoker(
    private val haapiManager: HaapiManager,
    private val coroutineContext: CoroutineContext,
) : HaapiFlowInvoker {
    override suspend fun start(): HaapiResponse = haapiManager.start(coroutineContext)

    override suspend fun submitForm(
        form: FormActionModel,
        parameters: Map<String, Any>,
    ): HaapiResponse = haapiManager.submitForm(form, parameters, coroutineContext)

    override suspend fun followLink(link: Link): HaapiResponse = haapiManager.followLink(link, coroutineContext)
}
