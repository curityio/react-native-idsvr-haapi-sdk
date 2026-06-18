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

import type { StepType } from "./step-type";
import type { FormAction } from "./action-form";
import type { PollingProperties } from "./properties";
import type { RepresentationBase } from "./representation-base";

// ─── Flow Control Steps ──────────────────────────────────────────────────────

/**
 * Step indicating a client-side redirection via a single non-interactive form action.
 */
export interface RedirectionStep extends RepresentationBase {
    readonly stepType: StepType.Redirection;
    /** The form action to follow for redirection. */
    readonly redirectAction: FormAction;
}

/**
 * Step that polls for completion of an out-of-band operation.
 */
export interface PollingStep extends RepresentationBase {
    readonly stepType: StepType.Polling;
    /** The main polling action to re-submit periodically. */
    readonly mainAction: FormAction;
    /** Optional cancel action to abort the polling flow. */
    readonly cancelAction?: FormAction;
    /** Polling-specific properties (status, timing). */
    readonly pollingProperties: PollingProperties;
}

/**
 * Step indicating the user should retry with an alternative action.
 */
export interface ContinueSameStep extends RepresentationBase {
    readonly stepType: StepType.ContinueSame;
}
