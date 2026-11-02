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
 * Optional metadata attached to a HAAPI response.
 */
export interface Metadata {
    /** Custom template area identifier. */
    readonly templateArea?: string;
    /** The server-side view name that produced this response. */
    readonly viewName?: string;
}
