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
import Foundation
import IdsvrHaapiSdk

/// Bridge facade for HAAPI flow operations on iOS.
///
/// Responsibilities (mirrors the structure used by ``RNOAuthTokenManagerBridge``):
///   - Forward `start` / `submitForm` / `followLink` to the native
///     ``HaapiManager`` via the injected ``HaapiFlowInvoker`` test seam.
///   - Convert each native ``HaapiResult`` into an ``RNHaapiResponseRecord``
///     using the injected ``HaapiResponseMapping`` (default:
///     ``DefaultHaapiResponseMapping`` — matches "owns its own
///     ``HaapiResponseMapper`` instance").
///   - Maintain a flow-lifetime cache of ``FormActionModel`` / ``Link``
///     instances accumulated across the flow's responses, so that
///     `submitForm` / `followLink` can resolve the next round-trip's
///     record back to a real native model by `href` + `method` / `rel`.
///   - Surface cache misses as
///     ``HaapiAccessorStore/StoreError/flowCacheMiss(reason:)``
///     (`HAAPI_FLOW_CACHE_MISS` on the JS side) so the host can branch
///     on `error.code` without parsing messages.
///
/// Cache mutation rules (HSRN-33 — multi-model flow cache):
///   - `start()` → anything: reset, then add the response's actions+links.
///     `start()` is the "begin fresh" entry-point — prior state is abandoned
///     regardless of result.
///   - `submitForm()` → anything: append (dedup on key). Never resets —
///     same step session; the host may need to re-dispatch prior actions
///     (e.g. a problem mid-flow → fix the input and retry). This already
///     covers a `submitForm` that lands on a `continueSame` / `polling`
///     continuation — the step type is immaterial here because this branch
///     never resets.
///   - `followLink()` → new-step representation: reset, then add. The user
///     navigated to an alternative path; the prior step's surface is no
///     longer relevant.
///   - `followLink()` → continuation representation (`continueSame` /
///     `polling`) or problem: append (dedup on key) — do NOT reset. These
///     are continuations of the *same* logical step, so the prior step's
///     actions/links must stay addressable (merge, not replace). This is
///     what lets a polling/continue UI keep prior chrome (e.g. a `cancel`
///     link) live after a `followLink`. The step type is consulted *only*
///     on this branch — it's the sole call kind that conditionally resets,
///     so `start()` (always resets) and `submitForm()` (never resets) need
///     not distinguish continuation steps.
///   - `clearCaches()` (driven by `close()`): wipes everything.
///
/// Lookup is newest-first via `last(where:)`: a later-added entry shadows
/// an earlier one with the same key, so `back`/`cancel` rels reused across
/// steps resolve to the current step. Dedup-on-append removes any existing
/// entry with the same key before appending, keeping cache size bounded by
/// the unique action/link set (polling does NOT grow the cache).
///
/// The plan's spec for the constructor was `init(haapiManager: HaapiManager)`;
/// production code instead constructs ``DefaultHaapiFlowInvoker`` explicitly
/// for symmetry with Android (whose `HaapiManager` flow methods take a
/// `CoroutineContext`).
///
/// Concurrency: the bridge is an `actor` so the cache is implicitly
/// serialised against in-flight flow operations. Concurrent calls into
/// ``start()`` / ``submitForm(_:parameters:)`` / ``followLink(_:)`` from
/// the JS thread are queued by Swift's actor runtime instead of producing
/// torn cache reads. ``clearCaches()`` participates in the same isolation,
/// so a `close()` triggered while a flow op is mid-flight is sequenced
/// after that op completes.
actor RNHaapiManagerBridge {
    /// Identifies which flow entry-point produced a response, so
    /// ``processResult(_:callKind:)`` can apply the right cache mutation
    /// rule (see the file-level doc-comment).
    private enum CallKind {
        case start
        case submitForm
        case followLink
    }

    private let invoker: HaapiFlowInvoker
    private let mapper: HaapiResponseMapping
    private var lastFormActionModelsStorage: [FormActionModel] = []
    private var lastLinksStorage: [Link] = []

    /// Snapshot of the form-action models accumulated for the current flow.
    var lastFormActionModels: [FormActionModel] { lastFormActionModelsStorage }
    /// Snapshot of the links accumulated for the current flow.
    var lastLinks: [Link] { lastLinksStorage }

    init(invoker: HaapiFlowInvoker, mapper: HaapiResponseMapping = DefaultHaapiResponseMapping()) {
        self.invoker = invoker
        self.mapper = mapper
    }

    /// Calls native `start`, processes the result via the mapper, and returns the bridge record.
    /// - Throws: rethrows any `Error` wrapped in `HaapiResult.error`. Surfaces to
    ///   JS as a typed `HaapiError` after `HaapiErrorNormalizer.normalize(...)` runs
    ///   in the module's `handleStart` catch.
    func start() async throws -> RNHaapiResponseRecord {
        let result = await invoker.start()
        return try processResult(result, callKind: .start)
    }

    /// Looks up the cached ``FormActionModel`` matching `record.href + record.method`,
    /// forwards it to native `submitForm`, and processes the result.
    /// - Throws:
    ///   - ``HaapiAccessorStore/StoreError/flowCacheMiss(reason:)`` on cache
    ///     miss — surfaces to JS as ``error.code === "HAAPI_FLOW_CACHE_MISS"``.
    ///     Typically fires when host code keeps a `FormAction` from a previous
    ///     accessor lifecycle (after `close()` or before re-init), or after a
    ///     `start()` / `followLink`-to-a-new-step reset evicted it.
    ///   - Rethrows any `Error` wrapped in `HaapiResult.error`.
    func submitForm(
        _ record: RNFormActionModelRecord,
        parameters: [String: any Sendable]
    ) async throws -> RNHaapiResponseRecord {
        guard let nativeModel = lastFormActionModelsStorage.last(where: {
            $0.href == record.href && $0.method == record.method
        }) else {
            throw HaapiAccessorStore.StoreError.flowCacheMiss(
                reason: "No matching form action found for href=\(record.href) method=\(record.method)"
            )
        }
        let result = await invoker.submitForm(nativeModel, parameters: parameters)
        return try processResult(result, callKind: .submitForm)
    }

    /// Looks up the cached ``Link`` matching `record.href + record.rel`,
    /// forwards it to native `followLink`, and processes the result.
    /// - Throws:
    ///   - ``HaapiAccessorStore/StoreError/flowCacheMiss(reason:)`` on cache miss.
    ///   - Rethrows any `Error` wrapped in `HaapiResult.error`.
    func followLink(_ record: RNLinkRecord) async throws -> RNHaapiResponseRecord {
        guard let nativeLink = lastLinksStorage.last(where: {
            $0.href == record.href && $0.rel == record.rel
        }) else {
            throw HaapiAccessorStore.StoreError.flowCacheMiss(
                reason: "No matching link found for href=\(record.href) rel=\(record.rel)"
            )
        }
        let result = await invoker.followLink(nativeLink)
        return try processResult(result, callKind: .followLink)
    }

    /// Empties the cached form-action / link snapshots. Called by the module's `close`
    /// (via a fire-and-forget `Task` from the synchronous `Function("close")` entry).
    func clearCaches() {
        lastFormActionModelsStorage = []
        lastLinksStorage = []
    }

    /// Converts `result` through the mapper, then mutates the cache per the
    /// reset / append rules summarised in the file-level doc-comment.
    ///
    /// The `isRepresentation` branch reads from the mapper's converted
    /// record (`responseCategory`) rather than `switch`ing on `HaapiResult`.
    /// That matches the symmetric Android check (`record.responseCategory ==
    /// REPRESENTATION`) and stays correct even if the SDK ever introduces a
    /// new `HaapiResult` variant — anything that converts to a non-error
    /// record without `.representation` is treated as additive.
    private func processResult(_ result: HaapiResult, callKind: CallKind) throws -> RNHaapiResponseRecord {
        let record = try mapper.convert(result)
        let isRepresentation = record.responseCategory == .representation

        // A "continuation" representation (`continueSame` / `polling`) is, by
        // definition, the *same* logical step continuing — not navigation to a
        // new one. A `followLink` that lands on such a step must merge, not
        // reset, so prior chrome (a `cancel` link, a poll action) stays
        // addressable. Reached only when isRepresentation is true (problem
        // records carry no representation/stepType).
        let isContinuationStep = isContinuation(record.representation?.stepType)

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
        let shouldReset: Bool
        switch callKind {
        case .start:
            shouldReset = true
        case .followLink:
            shouldReset = isRepresentation && !isContinuationStep
        case .submitForm:
            shouldReset = false
        }
        if shouldReset {
            lastFormActionModelsStorage.removeAll()
            lastLinksStorage.removeAll()
        }

        appendActionsWithDedup(mapper.collectedFormActionModels)
        appendLinksWithDedup(mapper.collectedLinks)
        return record
    }

    /// Whether `stepType` denotes a step that *continues* the current logical
    /// step rather than navigating to a new one. Such steps merge into the
    /// cache on `followLink` instead of resetting it.
    private func isContinuation(_ stepType: RNStepType?) -> Bool {
        switch stepType {
        case .continueSame, .polling:
            return true
        default:
            return false
        }
    }

    /// Appends each model to ``lastFormActionModelsStorage`` after removing
    /// any existing entry with the same `(href, method)` key. Newest-wins
    /// semantics combined with bounded growth under polling.
    private func appendActionsWithDedup(_ models: [FormActionModel]) {
        for model in models {
            lastFormActionModelsStorage.removeAll {
                $0.href == model.href && $0.method == model.method
            }
            lastFormActionModelsStorage.append(model)
        }
    }

    /// Appends each link to ``lastLinksStorage`` after removing any existing
    /// entry with the same `(href, rel)` key. Newest-wins semantics combined
    /// with bounded growth under polling.
    private func appendLinksWithDedup(_ links: [Link]) {
        for link in links {
            lastLinksStorage.removeAll {
                $0.href == link.href && $0.rel == link.rel
            }
            lastLinksStorage.append(link)
        }
    }
}
