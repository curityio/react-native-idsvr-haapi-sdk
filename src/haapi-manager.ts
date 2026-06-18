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

import type { HaapiResponse } from "./models/haapi-response";
import type { FormAction } from "./models/action-form";
import type { FormActionModel } from "./models/form-action-model";
import type { Link } from "./models/link";
import type { Logger } from "./logging";
import { rethrowAsHaapiError } from "./internal/envelope";

/**
 * Manager for HAAPI authentication-flow operations.
 *
 * @remarks
 * Returned from the ``HaapiAccessor.haapiManager`` getter on accessors
 * produced by ``initializeForHaapi``.
 */
export interface HaapiManager {
    /**
     * Starts the HAAPI authentication flow.
     */
    start(): Promise<HaapiResponse>;

    /**
     * Submits a form action with the given parameters.
     *
     * @param parameters - A record whose values are JSON-serialisable
     *   (`string`, `number`, `boolean`, `null`, nested objects, arrays).
     *   Matches the `[String: Any]` / `Map<String, Any>` signature of the
     *   iOS and Android HAAPI SDKs. **For form actions whose `method` is
     *   `GET`, all parameter values must be strings** — the native side
     *   rejects non-string values for GET submissions.
     */
    submitForm(action: FormAction, parameters: Record<string, unknown>): Promise<HaapiResponse>;

    /**
     * Follows a link from the current HAAPI step.
     */
    followLink(link: Link): Promise<HaapiResponse>;
}

// Internal slice of the native module surface that `HaapiManagerImpl`
// depends on. Kept narrow so tests can stub only what the class uses.
interface NativeFlowSurface {
    start(): Promise<HaapiResponse>;
    submitForm(model: FormActionModel, parameters: Record<string, unknown>): Promise<HaapiResponse>;
    followLink(link: Link): Promise<HaapiResponse>;
}

// Concrete `HaapiManager` implementation. Internal — host apps obtain an
// instance from the `HaapiAccessor` returned by `initializeForHaapi`;
// lifecycle (`initialize` / `close`) lives on the accessor.
export class HaapiManagerImpl implements HaapiManager {
    constructor(
        private readonly nativeModule: NativeFlowSurface,
        private readonly logger: Logger,
    ) {}

    async start(): Promise<HaapiResponse> {
        this.logger.info("start", TAG);
        try {
            return await this.nativeModule.start();
        } catch (e: unknown) {
            rethrowAsHaapiError(e);
        }
    }

    // Adapts the user-facing `FormAction` to the bare `FormActionModel`
    // the native bridge consumes. Native uses the model to look up the
    // matching `FormActionModel` in the flow's accumulated representation
    // cache (newest-first; problem + continuation responses do not evict
    // prior entries, only `followLink` to a new-step representation resets
    // the cache before appending the new step — see HSRN-33).
    async submitForm(
        action: FormAction,
        parameters: Record<string, unknown>,
    ): Promise<HaapiResponse> {
        this.logger.info(`submitForm (kind=${action.kind})`, TAG);
        try {
            return await this.nativeModule.submitForm(action.model, parameters);
        } catch (e: unknown) {
            rethrowAsHaapiError(e);
        }
    }

    async followLink(link: Link): Promise<HaapiResponse> {
        this.logger.info(`followLink (rel=${link.rel})`, TAG);
        try {
            return await this.nativeModule.followLink(link);
        } catch (e: unknown) {
            rethrowAsHaapiError(e);
        }
    }
}

const TAG = "HaapiManager";
