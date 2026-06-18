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
import type { Properties } from "./properties";
import type { RepresentationBase } from "./representation-base";

// ─── Fallback ────────────────────────────────────────────────────────────────

/**
 * Fallback step for unknown or unmapped representation types.
 */
export interface GenericRepresentationStep extends RepresentationBase {
    readonly stepType: StepType.GenericRepresentation;
    readonly properties?: Properties;
}
