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
import IdsvrHaapiSdk

/// Log severity levels matching the TypeScript `RNLogLevel` enum.
enum RNLogLevel: String, Enumerable {
    case debug = "debug"
    case info = "info"
    case warning = "warning"
    case error = "error"

    /// Converts this level to the native `IdsvrHaapiSdk.LogType`.
    func toLogType() -> IdsvrHaapiSdk.LogType {
        switch self {
        case .debug: return .debug
        case .info: return .info
        case .warning: return .warning
        case .error: return .error
        }
    }
}
