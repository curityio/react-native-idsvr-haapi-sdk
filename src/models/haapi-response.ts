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

import type { HaapiRepresentation } from "./representation";
import type { ProblemRepresentation } from "./problem";

/**
 * A successful HAAPI representation response.
 */
export interface HaapiRepresentationResponse {
    readonly responseCategory: "representation";
    /** The typed representation step. */
    readonly representation: HaapiRepresentation;
}

/**
 * A HAAPI problem response.
 */
export interface HaapiProblemResponse {
    readonly responseCategory: "problem";
    /** The typed problem representation. */
    readonly problem: ProblemRepresentation;
}

/**
 * The top-level response from a HAAPI operation.
 *
 * @remarks
 * Discriminated union on `responseCategory`. Returned by all {@link HaapiManager}
 * methods that advance the authentication flow.
 *
 * Flow errors (network failures, SDK exceptions) reject the Promise with a
 * typed `HaapiError` — they do **not** appear here. Catch them with
 * `try`/`catch` and inspect `isHaapiError(e)`.
 *
 * @example
 * ```typescript
 * try {
 *     const response = await manager.start();
 *     switch (response.responseCategory) {
 *         case "representation":
 *             // response.representation is a HaapiRepresentation
 *             break;
 *         case "problem":
 *             // response.problem is a ProblemRepresentation
 *             break;
 *     }
 * } catch (e) {
 *     if (isHaapiError(e)) {
 *         // handle by e.code / e.recovery
 *     }
 * }
 * ```
 */
export type HaapiResponse =
    | HaapiRepresentationResponse
    | HaapiProblemResponse;
