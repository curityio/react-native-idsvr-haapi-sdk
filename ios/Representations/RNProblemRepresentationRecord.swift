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

/// An invalid field reported by an invalid input problem.
///
/// Maps to the TypeScript `InvalidField` interface.
struct RNInvalidFieldRecord: Record {
    /// The name of the invalid field.
    @Field var name: String = ""
    /// Machine-readable reason for invalidity.
    @Field var reason: String?
    /// Human-readable error detail message.
    @Field var detail: RNMessageRecord = RNMessageRecord()

    init() {}
    init(name: String, reason: String?, detail: RNMessageRecord) {
        self.name = name
        self.reason = reason
        self.detail = detail
    }
}

extension RNInvalidFieldRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNInvalidFieldRecord",
            "name": name,
            "reason": reason as Any,
            "detail": detail
        ].debugDescription
    }
}

/// A HAAPI problem representation (RFC 7807).
///
/// Maps to the TypeScript `ProblemRepresentation` discriminated union.
/// The `problemKind` field is the discriminator.
struct RNProblemRepresentationRecord: Record {
    /// Discriminator: "problem", "invalidInput", or "authorization".
    @Field var problemKind: String = "problem"
    /// The problem type URI.
    @Field var type: RNProblemType = .unexpected
    /// Optional metadata.
    @Field var metadata: RNMetadataRecord?
    /// Optional title message.
    @Field var title: RNMessageRecord?
    /// User-facing messages.
    @Field var messages: [RNUserMessageRecord] = []
    /// Available links.
    @Field var links: [RNLinkRecord] = []

    // InvalidInputProblem
    /// The fields that failed validation.
    @Field var invalidFields: [RNInvalidFieldRecord]?
    /// Optional error description.
    @Field var errorDescription: String?

    // AuthorizationProblem
    /// The OAuth error code.
    @Field var error: String?
    /// The issuer identifier of the authorization server.
    @Field var iss: String?

    init() {}
}

extension RNProblemRepresentationRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNProblemRepresentationRecord",
            "problemKind": problemKind,
            "type": type,
            "metadata": metadata as Any,
            "title": title as Any,
            "messages": messages.count,
            "links": links.count,
            "invalidFields": invalidFields as Any,
            "errorDescription": errorDescription as Any,
            "error": error as Any,
            "iss": iss as Any
        ].debugDescription
    }
}
