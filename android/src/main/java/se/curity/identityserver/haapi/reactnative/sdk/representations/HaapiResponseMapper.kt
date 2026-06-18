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

import se.curity.identityserver.haapi.android.sdk.models.HaapiRepresentation
import se.curity.identityserver.haapi.android.sdk.models.HaapiResponse
import se.curity.identityserver.haapi.android.sdk.models.Link
import se.curity.identityserver.haapi.android.sdk.models.ProblemRepresentation
import se.curity.identityserver.haapi.android.sdk.models.actions.FormActionModel

/**
 * Maps native HAAPI SDK model types into Expo Record classes for the JS bridge.
 *
 * Tracks form action models and links during mapping so that the module can
 * cache them for `submitForm` and `followLink` calls.
 *
 * Mapping logic is split across extension functions in this package:
 * - [convertRepresentation] — representation step mapping
 * - [convertAction] — action, form field, and authenticator mapping
 * - [convertClientOperationActionModel] — client operation model mapping
 * - [convertProblem] — problem mapping
 * - [convertLink], [convertMessage], etc. — common helpers
 */
internal class HaapiResponseMapper {
    /** Form action models collected during mapping for native lookup. */
    var collectedFormActionModels: List<FormActionModel> = emptyList()
        internal set

    /** Links collected during mapping for native lookup. */
    var collectedLinks: List<Link> = emptyList()
        internal set

    /**
     * Maps a [HaapiResponse] into the top-level [RNHaapiResponseRecord].
     *
     * Throws on unknown response variants so the module-level normalizer
     * can surface the failure to JS as `HAAPI_UNEXPECTED`.
     *
     * @throws IllegalStateException if [response] is neither a
     *   [HaapiRepresentation] nor a [ProblemRepresentation].
     */
    fun convert(response: HaapiResponse): RNHaapiResponseRecord {
        collectedFormActionModels = emptyList()
        collectedLinks = emptyList()

        return when (response) {
            is HaapiRepresentation -> {
                val record = convertRepresentation(response)
                RNHaapiResponseRecord().apply {
                    responseCategory = RNResponseCategory.REPRESENTATION
                    representation = record
                }
            }

            is ProblemRepresentation -> {
                val record = convertProblem(response)
                RNHaapiResponseRecord().apply {
                    responseCategory = RNResponseCategory.PROBLEM
                    problem = record
                }
            }

            else -> {
                throw IllegalStateException(
                    "Unknown HaapiResponse variant: ${response::class.simpleName}",
                )
            }
        }
    }
}
