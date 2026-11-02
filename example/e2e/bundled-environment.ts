/*
 * Copyright (C) 2026 Curity AB. All rights reserved.
 *
 * The contents of this file are the property of Curity AB.
 * You may not copy or use this file, in either source code
 * or executable form, except in compliance with terms
 * set by Curity AB.
 *
 * For further information, please contact Curity AB.
 */
import type {EnvironmentSource} from './environment';

/**
 * The lane's environment, captured in a form the bundler can actually see.
 *
 * `babel-preset-expo` substitutes `EXPO_PUBLIC_*` variables by rewriting the literal expression
 * `process.env.SOME_KEY` into the string value at bundle time. It does **not** populate
 * `process.env` itself, so reading a key any other way — `process.env[key]`, or passing
 * `process.env` along as an object and indexing it later — yields `undefined` in a built app,
 * with no error. Every variable therefore has to be named literally, right here.
 *
 * Consumers take an {@link EnvironmentSource} so tests can pass a plain object; only this module
 * is allowed to mention `process.env`, and `bundled-environment.test.ts` enforces that.
 */
export const BUNDLED_ENVIRONMENT: EnvironmentSource = {
    EXPO_PUBLIC_E2E: process.env.EXPO_PUBLIC_E2E,
    EXPO_PUBLIC_BASE_URL: process.env.EXPO_PUBLIC_BASE_URL,
    EXPO_PUBLIC_CLIENT_ID: process.env.EXPO_PUBLIC_CLIENT_ID,
    EXPO_PUBLIC_IDSVR_VERSION: process.env.EXPO_PUBLIC_IDSVR_VERSION,
    EXPO_PUBLIC_E2E_LANE: process.env.EXPO_PUBLIC_E2E_LANE,
    EXPO_PUBLIC_E2E_AUTORUN: process.env.EXPO_PUBLIC_E2E_AUTORUN,
    EXPO_PUBLIC_E2E_SYMMETRIC_JWT_SECRET: process.env.EXPO_PUBLIC_E2E_SYMMETRIC_JWT_SECRET,
    EXPO_PUBLIC_E2E_TRUSTED_TLS: process.env.EXPO_PUBLIC_E2E_TRUSTED_TLS,
};

/** Keys this module forwards — the guard test compares this against what the harness reads. */
export const BUNDLED_KEYS: readonly string[] = Object.keys(BUNDLED_ENVIRONMENT);
