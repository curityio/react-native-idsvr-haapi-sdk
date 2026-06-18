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

/**
 * A localizable message from the HAAPI response.
 *
 * @remarks
 * Contains both a machine-readable key (for client-side localization) and
 * a human-readable literal string provided by the server.
 */
export interface Message {
    /** Optional message key for client-side localization. */
    readonly key?: string;
    /** Human-readable text suitable for display. */
    readonly literal: string;
}

/**
 * A user-facing message with optional styling hints.
 *
 * @remarks
 * The `classList` array contains CSS-like class names that hint at how the
 * message should be rendered (e.g., `["error"]`, `["info"]`).
 */
export interface UserMessage {
    /** The message content. */
    readonly text: Message;
    /** CSS-like class names for styling hints. */
    readonly classList: string[];
}
