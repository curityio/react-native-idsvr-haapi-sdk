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
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNFormActionModelRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNHaapiResponseRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNLinkRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNResponseCategory
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNStepType

/**
 * Bridge facade for HAAPI flow operations on Android.
 *
 * Owns the flow-lifetime cache of [FormActionModel] / [Link] instances
 * accumulated across the flow's responses. The Expo module delegates
 * `start` / `submitForm` / `followLink` to this bridge instead of touching
 * `HaapiManager` directly, so flow logic, cache ownership, and response
 * mapping all live behind one testable seam.
 *
 * Cache mutation rules (HSRN-33 — multi-model flow cache):
 *  - `start()` → anything: reset, then add the response's actions+links.
 *    `start()` is the "begin fresh" entry-point — prior state is abandoned
 *    regardless of result.
 *  - `submitForm()` → anything: append (dedup on key). Never resets —
 *    same step session; the host may need to re-dispatch prior actions
 *    (e.g. a problem mid-flow → fix the input and retry). This already
 *    covers a `submitForm` that lands on a `continueSame` / `polling`
 *    continuation — the step type is immaterial here because this branch
 *    never resets.
 *  - `followLink()` → new-step representation: reset, then add. The user
 *    navigated to an alternative path; the prior step's surface is no
 *    longer relevant.
 *  - `followLink()` → continuation representation (`continueSame` /
 *    `polling`) or problem: append (dedup on key) — do NOT reset. These
 *    are continuations of the *same* logical step, so the prior step's
 *    actions/links must stay addressable (merge, not replace). This is
 *    what lets a polling/continue UI keep prior chrome (e.g. a `cancel`
 *    link) live after a `followLink`. The step type is consulted *only*
 *    on this branch — it's the sole call kind that conditionally resets,
 *    so `start()` (always resets) and `submitForm()` (never resets) need
 *    not distinguish continuation steps.
 *  - [clearCaches] (driven by `close()`): wipes everything.
 *
 * Lookup is newest-first via `findLast { … }`: a later-added entry
 * shadows an earlier one with the same key, so `back`/`cancel` rels
 * reused across steps resolve to the current step. Dedup-on-append
 * removes any existing entry with the same key before appending,
 * keeping cache size bounded by the unique action/link set
 * (polling does NOT grow the cache).
 *
 * The plan's spec for the constructor was `init(haapiManager: HaapiManager)`;
 * Android needs a [CoroutineContext] alongside the manager (the SDK's flow
 * methods take one), so production code instead constructs
 * [DefaultHaapiFlowInvoker] explicitly and passes it in. The default
 * `mapper = DefaultHaapiResponseMapping()` matches "owns its own
 * `HaapiResponseMapper` instance" from § 11.3.
 */
internal class RNHaapiManagerBridge(
    private val invoker: HaapiFlowInvoker,
    private val mapper: HaapiResponseMapping = DefaultHaapiResponseMapping(),
) {
    /**
     * Identifies which flow entry-point produced a response, so
     * [processResponse] can apply the right cache mutation rule (see the
     * class-level KDoc).
     */
    private enum class CallKind {
        START,
        SUBMIT_FORM,
        FOLLOW_LINK,
    }

    private val lastFormActionModelsStorage = mutableListOf<FormActionModel>()
    private val lastLinksStorage = mutableListOf<Link>()

    /** Snapshot of the form-action models accumulated for the current flow. */
    val lastFormActionModels: List<FormActionModel>
        get() = lastFormActionModelsStorage.toList()

    /** Snapshot of the links accumulated for the current flow. */
    val lastLinks: List<Link>
        get() = lastLinksStorage.toList()

    /**
     * Calls native `start` and processes the response.
     *
     * Any exception thrown by the SDK propagates unchanged so the module's
     * [HaapiErrorNormalizer.normalizeThrown] wrapper converts it into a
     * typed `HaapiError` envelope for JS callers — same contract as the
     * OAuth bridge.
     */
    suspend fun start(): RNHaapiResponseRecord = processResponse(invoker.start(), CallKind.START)

    /**
     * Looks up the cached [FormActionModel] matching `record.href + record.method`,
     * forwards it to native `submitForm`, and processes the response.
     *
     * @throws HaapiAccessorStore.StoreException with code
     *   [HaapiAccessorStore.ERROR_FLOW_CACHE_MISS] if no cached model
     *   matches — surfaces to JS as
     *   `error.code === "HAAPI_FLOW_CACHE_MISS"`. Typically fires when
     *   host code keeps a `FormAction` from a previous accessor lifecycle
     *   (after `close()` or before re-init), or after a
     *   `start()` / `followLink`-to-a-new-step reset evicted it.
     *
     * @throws Throwable any SDK exception propagates unchanged so the
     *   module-level normalizer can produce a typed `HaapiError`.
     */
    suspend fun submitForm(
        record: RNFormActionModelRecord,
        parameters: Map<String, Any>,
    ): RNHaapiResponseRecord {
        val nativeModel =
            lastFormActionModelsStorage.findLast {
                it.href == record.href && it.method == record.method
            } ?: throw HaapiAccessorStore.StoreException(
                HaapiAccessorStore.ERROR_FLOW_CACHE_MISS,
                "No matching form action found for href=${record.href} method=${record.method}",
            )
        return processResponse(invoker.submitForm(nativeModel, parameters), CallKind.SUBMIT_FORM)
    }

    /**
     * Looks up the cached [Link] matching `record.href + record.rel`, forwards
     * it to native `followLink`, and processes the response.
     *
     * @throws HaapiAccessorStore.StoreException with code
     *   [HaapiAccessorStore.ERROR_FLOW_CACHE_MISS] if no cached link
     *   matches — surfaces to JS as
     *   `error.code === "HAAPI_FLOW_CACHE_MISS"`.
     * @throws Throwable any SDK exception propagates unchanged.
     */
    suspend fun followLink(record: RNLinkRecord): RNHaapiResponseRecord {
        val nativeLink =
            lastLinksStorage.findLast {
                it.href == record.href && it.rel == record.rel
            } ?: throw HaapiAccessorStore.StoreException(
                HaapiAccessorStore.ERROR_FLOW_CACHE_MISS,
                "No matching link found for href=${record.href} rel=${record.rel}",
            )
        return processResponse(invoker.followLink(nativeLink), CallKind.FOLLOW_LINK)
    }

    /** Empties the cached form-action / link snapshots. Called by the module's `close`. */
    fun clearCaches() {
        lastFormActionModelsStorage.clear()
        lastLinksStorage.clear()
    }

    /**
     * Converts [response] through the mapper, then mutates the cache per the
     * reset / append rules summarised in the class-level KDoc.
     *
     * The `isRepresentation` branch reads from the mapper's converted record
     * (`responseCategory`) rather than `is`-checking [response]. Mirrors the
     * iOS bridge and stays correct if the SDK ever introduces a new
     * [HaapiResponse] subtype — anything that converts to a non-error record
     * without `REPRESENTATION` is treated as additive.
     */
    private fun processResponse(
        response: HaapiResponse,
        callKind: CallKind,
    ): RNHaapiResponseRecord {
        val record = mapper.convert(response)
        val isRepresentation = record.responseCategory == RNResponseCategory.REPRESENTATION

        // A "continuation" representation (`continueSame` / `polling`) is, by
        // definition, the *same* logical step continuing — not navigation to a
        // new one. A `followLink` that lands on such a step must merge, not
        // reset, so prior chrome (a `cancel` link, a poll action) stays
        // addressable. Reached only when isRepresentation is true (problem
        // records carry no representation/stepType).
        val isContinuationStep = isContinuation(record.representation?.stepType)

        // Reset semantics:
        //   - `start()`:      always — fresh flow, prior state is abandoned
        //                     regardless of whether the server returned a
        //                     representation or a problem.
        //   - `followLink()`: only when the server landed us on a *new-step*
        //                     representation (alternative path taken).
        //                     followLink → problem or → a continuation step
        //                     preserves the prior cache — the navigation
        //                     didn't change the logical step's surface.
        //   - `submitForm()`: never — same step session; the host may need
        //                     to re-dispatch prior actions (e.g. a problem
        //                     mid-flow → fix and retry).
        val shouldReset =
            when (callKind) {
                CallKind.START -> true
                CallKind.FOLLOW_LINK -> isRepresentation && !isContinuationStep
                CallKind.SUBMIT_FORM -> false
            }
        if (shouldReset) {
            lastFormActionModelsStorage.clear()
            lastLinksStorage.clear()
        }

        appendActionsWithDedup(mapper.collectedFormActionModels)
        appendLinksWithDedup(mapper.collectedLinks)
        return record
    }

    /**
     * Whether [stepType] denotes a step that *continues* the current logical
     * step rather than navigating to a new one. Such steps merge into the
     * cache on `followLink` instead of resetting it.
     */
    private fun isContinuation(stepType: RNStepType?): Boolean =
        stepType == RNStepType.CONTINUE_SAME || stepType == RNStepType.POLLING

    /**
     * Appends each model to [lastFormActionModelsStorage] after removing any
     * existing entry with the same `(href, method)` key. Newest-wins
     * semantics combined with bounded growth under polling.
     */
    private fun appendActionsWithDedup(models: List<FormActionModel>) {
        for (model in models) {
            lastFormActionModelsStorage.removeAll {
                it.href == model.href && it.method == model.method
            }
            lastFormActionModelsStorage.add(model)
        }
    }

    /**
     * Appends each link to [lastLinksStorage] after removing any existing
     * entry with the same `(href, rel)` key. Newest-wins semantics combined
     * with bounded growth under polling.
     */
    private fun appendLinksWithDedup(links: List<Link>) {
        for (link in links) {
            lastLinksStorage.removeAll {
                it.href == link.href && it.rel == link.rel
            }
            lastLinksStorage.add(link)
        }
    }
}
