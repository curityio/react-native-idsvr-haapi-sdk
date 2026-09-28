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

/// Bridges HAAPI SDK logs to the Expo event system so TypeScript can receive them.
///
/// Process-wide singleton because `IdsvrHaapiSdk.HaapiLogger` only exposes
/// `appendLogSink` (no `remove` or `replace`). If we appended a fresh sink
/// per `OnCreate`, every Fast-Refresh / JS-context reload would leak
/// another sink onto the global logger, and old sinks would only no-op
/// because their weak module ref is nil. By keeping a single sink whose
/// active module is rebound via ``attach(module:)`` each time the JS
/// context is created, we install on `HaapiLogger` exactly once and avoid
/// the unbounded sink list.
final class RNLogSink: LogSink, @unchecked Sendable {
    static let shared = RNLogSink()

    private let lock = NSLock()
    private weak var module: IdsvrHaapiReactNativeSdkModule?

    private init() {}

    /// Rebinds the sink's target module. Called from the module's
    /// `OnCreate` so each fresh JS context routes log events through the
    /// new module instance; the previous (now-dead) instance's weak ref
    /// is overwritten without any explicit teardown.
    func attach(module: IdsvrHaapiReactNativeSdkModule) {
        lock.lock()
        defer { lock.unlock() }
        self.module = module
    }

    /// Clears the sink's target module. Called from the module's
    /// `OnDestroy`. After this, log events go to a nil weak ref (no-op)
    /// until the next `attach(module:)` call.
    func detach() {
        lock.lock()
        defer { lock.unlock() }
        self.module = nil
    }

    func writeLog(
        logType: IdsvrHaapiSdk.LogType,
        followUpTag: any FollowUpTag,
        message: String,
        file: String,
        line: Int
    ) {
        let level = Self.mapLogType(logType)
        let target: IdsvrHaapiReactNativeSdkModule? = {
            lock.lock()
            defer { lock.unlock() }
            return self.module
        }()
        target?.sendEvent("onLog", [
            "level": level,
            "message": message,
            "tag": String(describing: followUpTag)
        ])
    }

    static func mapLogType(_ logType: IdsvrHaapiSdk.LogType) -> String {
        switch logType {
        case .debug: return "debug"
        case .info: return "info"
        case .warning: return "warning"
        case .error: return "error"
        default: return "debug"
        }
    }
}
