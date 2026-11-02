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

import { RNLogLevel } from "./rn-log-level";
import type { RNLogEvent } from "./rn-log-event";
import type { RNLogSinkHandler } from "./rn-log-handler";
import type { Logger } from "./logger";
import type { RNLoggerConfiguration } from "./rn-logger-configuration";
import { requireNativeModule } from "expo-modules-core";
import { validateLoggerConfiguration } from "../internal/configuration-validation";

/**
 * Default log sink that forwards log events to the appropriate `console` method.
 */
function consoleSink(event: RNLogEvent): void {
    const prefix = event.tag ? `[${event.tag}]` : "";
    const msg = prefix ? `${prefix} ${event.message}` : event.message;
    switch (event.level) {
        case RNLogLevel.Debug:
            console.debug(msg);
            break;
        case RNLogLevel.Info:
            console.info(msg);
            break;
        case RNLogLevel.Warning:
            console.warn(msg);
            break;
        case RNLogLevel.Error:
            console.error(msg);
            break;
    }
}

/**
 * Unified logger for the HAAPI React Native SDK.
 *
 * @remarks
 * Receives log events from native iOS/Android HAAPI SDK `LogSink`
 * implementations via Expo module events, and provides log methods for
 * TypeScript-level logging. Ships with a default console log sink that maps
 * levels to `console.debug/info/warn/error`.
 *
 * Construction is private — host apps obtain the process-wide singleton via
 * ``getRNLogger()``. The singleton enforces a single native log-event
 * subscription per JS context, avoiding the duplicate-event delivery that
 * occurred when host code constructed multiple ``RNLogger`` instances or
 * recreated one per Fast-Refresh reload.
 *
 * The {@link RNLoggerConfiguration} is applied to the native HAAPI logger
 * at construction time only; there is no runtime API to change it afterwards.
 *
 * @example
 * ```typescript
 * const logger = new RNLogger({
 *     logLevel: RNLogLevel.Info,
 *     isSensitiveValueMasked: true,
 * });
 * logger.info("Flow started", "HaapiManager");
 *
 * // Add a custom log sink for analytics
 * const unsubscribe = logger.addLogSink((event) => {
 *     analytics.track("haapi_log", event);
 * });
 *
 * // Clean up when done — also clears the cached singleton, so the next
 * // getRNLogger() call returns a fresh instance with a fresh subscription.
 * logger.dispose();
 * ```
 */
export class RNLogger implements Logger {
    private sinks: RNLogSinkHandler[] = [];
    private nativeSubscription: { remove(): void } | null = null;

    constructor(configuration: RNLoggerConfiguration) {
        validateLoggerConfiguration(configuration);
        this.sinks.push(consoleSink);
        this.startListening(configuration);
    }

    /**
     * Logs a debug-level message.
     */
    debug(message: string, tag?: string): void {
        this.dispatch(RNLogLevel.Debug, message, tag);
    }

    /**
     * Logs an info-level message.
     */
    info(message: string, tag?: string): void {
        this.dispatch(RNLogLevel.Info, message, tag);
    }

    /**
     * Logs a warning-level message.
     */
    warning(message: string, tag?: string): void {
        this.dispatch(RNLogLevel.Warning, message, tag);
    }

    /**
     * Logs an error-level message.
     */
    error(message: string, tag?: string): void {
        this.dispatch(RNLogLevel.Error, message, tag);
    }

    /**
     * Registers a custom log sink.
     *
     * @returns A function that removes the sink when called.
     */
    addLogSink(sink: RNLogSinkHandler): () => void {
        this.sinks.push(sink);
        return () => {
            const index = this.sinks.indexOf(sink);
            if (index >= 0) {
                this.sinks.splice(index, 1);
            }
        };
    }

    /**
     * Unsubscribes from native events and removes all sinks.
     *
     * @remarks
     * Also evicts the cached singleton — the next ``getRNLogger()`` call
     * returns a freshly-constructed instance with a fresh native
     * subscription. This makes ``dispose()`` symmetric with
     * ``getRNLogger()`` and keeps the test reset path simple.
     */
    dispose(): void {
        if (this.nativeSubscription) {
            this.nativeSubscription.remove();
            this.nativeSubscription = null;
        }
        this.sinks = [];
        if (sharedInstance === this) {
            sharedInstance = null;
        }
    }

    private startListening(configuration: RNLoggerConfiguration): void {
        try {
            const nativeModule = requireNativeModule("IdsvrHaapiReactNativeSdk");
            nativeModule.configureLogger(configuration);
            this.nativeSubscription = nativeModule.addListener(
                "onLog",
                (event: RNLogEvent) => {
                    for (const sink of this.sinks) {
                        sink(event);
                    }
                },
            );
        } catch (e) {
            console.warn("RNLogger: Failed to subscribe to native log events:", e);
        }
    }

    private dispatch(level: RNLogLevel, message: string, tag?: string): void {
        const event: RNLogEvent = {
            level,
            message,
            tag,
        };
        for (const sink of this.sinks) {
            sink(event);
        }
    }
}

// Module-level singleton handle. Lazy-init by `getRNLogger()`; cleared by
// `RNLogger.dispose()` (so the next `getRNLogger()` call returns a fresh
// instance) and by `__resetRNLoggerForTests()`.
//
// Surviving Fast-Refresh reloads is intentionally out of scope: the host
// module is re-evaluated, this binding resets to `null`, and the previous
// singleton's native subscription is GC'd alongside its closure. The
// singleton's job is only to coalesce subscriptions within a single JS
// context — not to span re-evaluations.
let sharedInstance: RNLogger | null = null;

/**
 * Returns the process-wide ``RNLogger`` singleton, constructing it (and
 * its native log-event subscription) on first call.
 *
 * @param configuration - Applied to the native HAAPI logger when the
 *   singleton is constructed (first call only). Subsequent calls
 *   **return the cached instance regardless** of the value passed —
 *   call ``dispose()`` first to apply a different configuration.
 * @throws If the call constructs the logger and ``configuration.logLevel``
 *   is not an ``RNLogLevel`` value —
 *   ``error.code === "HAAPI_INVALID_CONFIGURATION"`` (category
 *   ``configuration``); nothing is configured or cached.
 *
 * @remarks
 * Replaces the previous ``new RNLogger(...)`` pattern, which let host
 * apps accidentally accumulate native subscriptions every time they
 * re-rendered or hot-reloaded. The singleton coalesces every observer
 * onto a single subscription per JS context.
 *
 * @example
 * ```typescript
 * import { getRNLogger, RNLogLevel, initializeForHaapi } from
 *     "@curity/identityserver-haapi-react-native-sdk";
 *
 * const logger = getRNLogger({
 *     logLevel: RNLogLevel.Info,
 *     isSensitiveValueMasked: true,
 * });
 * const accessor = await initializeForHaapi(config, logger);
 * ```
 */
export function getRNLogger(configuration: RNLoggerConfiguration): RNLogger {
    if (sharedInstance === null) {
        sharedInstance = new RNLogger(configuration);
    }
    return sharedInstance;
}

/**
 * Test-only helper that disposes the cached singleton (if any) and clears
 * the module-level handle so the next ``getRNLogger()`` constructs a fresh
 * instance with a fresh native subscription. Not exported from the
 * package entry — tests import it directly from this module.
 *
 * @internal
 */
export function __resetRNLoggerForTests(): void {
    if (sharedInstance) {
        sharedInstance.dispose();
    }
    sharedInstance = null;
}
