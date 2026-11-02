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

import type { RNLogEvent } from "./rn-log-event";

/**
 * A function that receives log events from {@link RNLogger}.
 *
 * @remarks
 * Register custom log sinks via {@link RNLogger.addLogSink} to forward logs
 * to analytics services, crash reporters, or other logging systems.
 */
export type RNLogSinkHandler = (event: RNLogEvent) => void;
