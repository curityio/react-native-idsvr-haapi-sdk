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

/// Optional metadata attached to a HAAPI response.
///
/// Maps to the TypeScript `Metadata` interface.
struct RNMetadataRecord: Record {
    /// Custom template area identifier.
    @Field var templateArea: String?
    /// The server-side view name that produced this response.
    @Field var viewName: String?

    init() {}
    init(templateArea: String?, viewName: String?) {
        self.templateArea = templateArea
        self.viewName = viewName
    }
}

extension RNMetadataRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "class": "RNMetadataRecord",
            "templateArea": templateArea as Any,
            "viewName": viewName as Any
        ].debugDescription
    }
}
