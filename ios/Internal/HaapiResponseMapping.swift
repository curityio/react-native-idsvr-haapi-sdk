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

/// Test seam over ``HaapiResponseMapper``.
///
/// The bridge depends on this protocol so tests can provide a stub mapper
/// that returns canned records and exposes settable
/// `collectedFormActionModels` / `collectedLinks` for cache-lookup tests.
/// Production wiring uses ``DefaultHaapiResponseMapping``, which delegates
/// to the real ``HaapiResponseMapper``.
///
/// `AnyObject` constraint is intentional — a stub mapper needs to be a
/// reference type so the bridge's `processResult` can mutate
/// `collectedFormActionModels` / `collectedLinks` in place and the test
/// can observe those mutations through the same instance reference. A
/// future contributor "consistifying" this to a `struct`-friendly
/// constraint would silently break that observation pattern.
internal protocol HaapiResponseMapping: AnyObject {
    var collectedFormActionModels: [FormActionModel] { get }
    var collectedLinks: [Link] { get }
    /// - Throws: rethrows any `Error` wrapped in `HaapiResult.error` so the
    ///   bridge can surface it to JS as a typed `HaapiError` via the
    ///   module-level normalizer.
    func convert(_ result: HaapiResult) throws -> RNHaapiResponseRecord
}

/// Production ``HaapiResponseMapping`` backed by the unmodified
/// ``HaapiResponseMapper``. Lives in `Internal/` next to the bridge so the
/// Expo module can construct one without reaching into ``HaapiResponseMapper``
/// directly.
internal final class DefaultHaapiResponseMapping: HaapiResponseMapping {
    private let mapper: HaapiResponseMapper

    init(mapper: HaapiResponseMapper = HaapiResponseMapper()) {
        self.mapper = mapper
    }

    var collectedFormActionModels: [FormActionModel] { mapper.collectedFormActionModels }
    var collectedLinks: [Link] { mapper.collectedLinks }

    func convert(_ result: HaapiResult) throws -> RNHaapiResponseRecord {
        try mapper.convert(result)
    }
}
