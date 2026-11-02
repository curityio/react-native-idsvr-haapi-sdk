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

import type { Message } from "./message";

/**
 * A navigable link within a HAAPI response.
 *
 * @remarks
 * Pass this object to {@link HaapiManager.followLink} or
 * {@link IdsvrHaapiReactNativeSdkModule.followLink} to navigate to the
 * linked resource.
 */
export interface Link {
    /** Target URI of the link. */
    readonly href: string;
    /** Link relation type (e.g., "cancel", "restart"). */
    readonly rel: string;
    /** Optional display title for the link. */
    readonly title?: Message;
    /** Optional media type hint. */
    readonly type?: string;
}
