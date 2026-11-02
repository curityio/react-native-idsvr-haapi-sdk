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

import se.curity.identityserver.haapi.android.sdk.models.HaapiResponse
import se.curity.identityserver.haapi.android.sdk.models.Link
import se.curity.identityserver.haapi.android.sdk.models.actions.FormActionModel
import se.curity.identityserver.haapi.reactnative.sdk.representations.HaapiResponseMapper
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNHaapiResponseRecord

/**
 * Test seam over [HaapiResponseMapper].
 *
 * The bridge depends on this interface so tests can provide a stub mapper
 * that returns canned records and exposes settable
 * `collectedFormActionModels` / `collectedLinks` for cache-lookup tests.
 * Production wiring uses [DefaultHaapiResponseMapping], which delegates to
 * the real [HaapiResponseMapper] (untouched per HSRN-8 § 3).
 */
internal interface HaapiResponseMapping {
    val collectedFormActionModels: List<FormActionModel>
    val collectedLinks: List<Link>

    fun convert(response: HaapiResponse): RNHaapiResponseRecord
}

/** Production [HaapiResponseMapping] backed by the unmodified [HaapiResponseMapper]. */
internal class DefaultHaapiResponseMapping(
    private val mapper: HaapiResponseMapper = HaapiResponseMapper(),
) : HaapiResponseMapping {
    override val collectedFormActionModels: List<FormActionModel>
        get() = mapper.collectedFormActionModels
    override val collectedLinks: List<Link>
        get() = mapper.collectedLinks

    override fun convert(response: HaapiResponse): RNHaapiResponseRecord = mapper.convert(response)
}
