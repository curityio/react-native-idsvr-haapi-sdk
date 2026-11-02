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

/// Structured logger for the native module that sends log events to the JS layer.
///
/// Usage: `log.info("HaapiAccessor created")` or `log.error("Failed", tag: "init")`
class RNModuleLogger {
    private weak var module: Module?
    private let defaultTag: String

    init(module: Module, defaultTag: String = "IdsvrHaapiRN") {
        self.module = module
        self.defaultTag = defaultTag
    }

    func debug(_ message: String, tag: String? = nil) {
        send(.debug, message, tag: tag)
    }

    func info(_ message: String, tag: String? = nil) {
        send(.info, message, tag: tag)
    }

    func warning(_ message: String, tag: String? = nil) {
        send(.warning, message, tag: tag)
    }

    func error(_ message: String, tag: String? = nil) {
        send(.error, message, tag: tag)
    }

    private func send(_ level: RNLogLevel, _ message: String, tag: String?) {
        module?.sendEvent("onLog", [
            "level": level.rawValue,
            "message": message,
            "tag": tag ?? defaultTag
        ])
    }
}
