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
import IdsvrHaapiSdk

/// Maps native HAAPI SDK model types into Expo Record structs for the JS bridge.
///
/// Tracks form action models and links during mapping so that the module can
/// cache them for `submitForm` and `followLink` calls.
///
/// Mapping logic is split across extensions in this directory:
/// - `MappingRepresentation.swift` — representation step mapping
/// - `MappingAction.swift` — action, form field, and authenticator mapping
/// - `MappingClientOperation.swift` — client operation model mapping
/// - `MappingCommon.swift` — links, messages, metadata, properties, problems, enums
class HaapiResponseMapper {

    /// Form action models collected during mapping for native lookup.
    var collectedFormActionModels: [FormActionModel] = []
    /// Links collected during mapping for native lookup.
    var collectedLinks: [Link] = []

    /// Maps a `HaapiResult` into the top-level `RNHaapiResponseRecord`.
    ///
    /// `HaapiResult.error(Error)` is rethrown so the bridge surfaces it to
    /// JS as a typed `HaapiError` (matching the OAuth path).
    ///
    /// - Throws: rethrows any `Error` wrapped in `HaapiResult.error`.
    func convert(_ result: HaapiResult) throws -> RNHaapiResponseRecord {
        collectedFormActionModels = []
        collectedLinks = []

        switch result {
        case .representation(let representation):
            let record = convertRepresentation(representation)
            return RNHaapiResponseRecord(representation: record)
        case .problem(let problem):
            let record = convertProblem(problem)
            return RNHaapiResponseRecord(problem: record)
        case .error(let error):
            throw error
        }
    }
}
