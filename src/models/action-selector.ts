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

import type { ActionType } from "./action-type";
import type { ActionKind } from "./action-kind";
import type { Message } from "./message";
import type { Action } from "./action";

/**
 * A selector action presenting a list of options to choose from.
 */
export interface SelectorAction {
    readonly actionType: ActionType.Selector;
    readonly kind: ActionKind;
    readonly title?: Message;
    /** The available actions to select from. */
    readonly options: Action[];
}
