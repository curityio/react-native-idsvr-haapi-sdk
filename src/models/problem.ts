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

import type { ProblemType } from "./problem-type";
import type { Metadata } from "./metadata";
import type { Message, UserMessage } from "./message";
import type { Link } from "./link";

/**
 * An invalid field reported by an {@link InvalidInputProblem}.
 */
export interface InvalidField {
    /** The name of the invalid field. */
    readonly name: string;
    /** Machine-readable reason for invalidity. */
    readonly reason?: string;
    /** Human-readable error detail message. */
    readonly detail: Message;
}

/**
 * A generic HAAPI problem response.
 */
export interface Problem {
    readonly problemKind: "problem";
    readonly type: ProblemType;
    readonly metadata?: Metadata;
    readonly title?: Message;
    readonly messages: UserMessage[];
    readonly links: Link[];
}

/**
 * A problem response indicating invalid input fields.
 *
 * @remarks
 * Contains details about which specific fields were invalid and why,
 * enabling targeted error display in the UI.
 */
export interface InvalidInputProblem {
    readonly problemKind: "invalidInput";
    readonly type: ProblemType;
    readonly metadata?: Metadata;
    readonly title?: Message;
    readonly messages: UserMessage[];
    readonly links: Link[];
    /** The fields that failed validation. */
    readonly invalidFields: InvalidField[];
    /** Optional error description. */
    readonly errorDescription?: string;
}

/**
 * A problem response from an OAuth authorization error.
 */
export interface AuthorizationProblem {
    readonly problemKind: "authorization";
    readonly type: ProblemType;
    readonly metadata?: Metadata;
    readonly title?: Message;
    readonly messages: UserMessage[];
    readonly links: Link[];
    /** The OAuth error code (e.g., "invalid_request"). */
    readonly error: string;
    /** Optional human-readable error description. */
    readonly errorDescription?: string;
    /** The issuer identifier of the authorization server. */
    readonly iss?: string;
}

/**
 * A HAAPI problem representation (RFC 7807).
 *
 * @remarks
 * Discriminated union on `problemKind`. Use a `switch` statement on
 * `problemKind` to narrow to the specific problem type.
 */
export type ProblemRepresentation =
    | Problem
    | InvalidInputProblem
    | AuthorizationProblem;
