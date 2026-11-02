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
internal import ExpoModulesCore

/// The top-level response from a HAAPI operation.
///
/// Maps to the TypeScript `HaapiResponse` discriminated union.
/// The `responseCategory` field is the discriminator: "representation" or "problem".
/// Flow failures are surfaced as thrown `HaapiError` values, not as
/// response variants.
///
/// `@unchecked Sendable`: this Record is the return type from every
/// `RNHaapiManagerBridge` actor method (`start` / `submitForm` /
/// `followLink`), so it must cross the actor boundary. Built by
/// `HaapiResponseMapper`, returned to the module's nonisolated handler,
/// then handed to Expo's serializer — never mutated by the bridge after
/// construction. Same opt-out as `RNFormActionModelRecord` and
/// `RNLinkRecord`. Nested Records (`RNHaapiRepresentationRecord`,
/// `RNProblemRepresentationRecord`, …) inherit Sendability via the
/// `@unchecked` opt-out at this top level.
struct RNHaapiResponseRecord: Record, @unchecked Sendable {
    /// Discriminator: "representation" or "problem".
    @Field var responseCategory: RNResponseCategory = .representation
    /// The typed representation step (present when `responseCategory` is "representation").
    @Field var representation: RNHaapiRepresentationRecord?
    /// The typed problem representation (present when `responseCategory` is "problem").
    @Field var problem: RNProblemRepresentationRecord?

    init() {}
    init(representation: RNHaapiRepresentationRecord) {
        self.responseCategory = .representation
        self.representation = representation
    }
    init(problem: RNProblemRepresentationRecord) {
        self.responseCategory = .problem
        self.problem = problem
    }
}

extension RNHaapiResponseRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNHaapiResponseRecord",
            "responseCategory": responseCategory,
            "representation": representation as Any,
            "problem": problem as Any
        ].debugDescription
    }
}
