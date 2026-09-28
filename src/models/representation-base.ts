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

import type { RepresentationType } from "./representation-type";
import type { Metadata } from "./metadata";
import type { Action } from "./action";
import type { Link } from "./link";
import type { UserMessage } from "./message";

/**
 * Fields shared by all HAAPI representation step types.
 */
export interface RepresentationBase {
    readonly metadata?: Metadata;
    readonly type: RepresentationType;
    readonly actions: Action[];
    readonly links: Link[];
    readonly messages: UserMessage[];
}
