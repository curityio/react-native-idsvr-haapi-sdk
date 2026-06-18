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

/// A navigable link within a HAAPI response.
///
/// Maps to the TypeScript `Link` interface.
///
/// `@unchecked Sendable`: see `RNFormActionModelRecord` for the rationale.
/// Crosses the `RNHaapiManagerBridge` actor boundary as the `followLink`
/// parameter; constructed by the Expo deserializer, never mutated by the
/// bridge.
struct RNLinkRecord: Record, @unchecked Sendable {
    /// Target URI of the link.
    @Field var href: String = ""
    /// Link relation type (e.g., "cancel", "restart").
    @Field var rel: String = ""
    /// Optional display title for the link.
    @Field var title: RNMessageRecord?
    /// Optional media type hint.
    @Field var type: String?

    init() {}
    init(href: String, rel: String, title: RNMessageRecord?, type: String?) {
        self.href = href
        self.rel = rel
        self.title = title
        self.type = type
    }
}

extension RNLinkRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNLinkRecord",
            "href": href,
            "rel": rel,
            "title": title as Any,
            "type": type as Any
        ].debugDescription
    }
}
