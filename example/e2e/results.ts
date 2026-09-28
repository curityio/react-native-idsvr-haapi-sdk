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

/**
 * Scenario outcomes, and the two channels they are published on.
 *
 * The on-screen surface (read by Maestro on the simulator/emulator lanes) and the
 * `HAAPI_E2E_RESULT_V1::` log lines (the device lanes' only channel, since Maestro cannot
 * build its iOS driver on Xcode 26.x) are both produced from the values here — one source,
 * so the two can never disagree.
 */

export enum ScenarioStatus {
    Idle = 'IDLE',
    Running = 'RUNNING',
    Pass = 'PASS',
    Fail = 'FAIL',
    Skipped = 'SKIPPED',
}

export interface AssertionResult {
    readonly name: string;
    readonly ok: boolean;
    readonly detail?: string;
}

export interface ScenarioResult {
    readonly id: string;
    readonly status: ScenarioStatus;
    readonly assertions: readonly AssertionResult[];
    /** Present only for {@link ScenarioStatus.Skipped}; always explains why. */
    readonly skipReason?: string;
    /** Normalised, human-readable failure text. Never a raw thrown value. */
    readonly error?: string;
}

/**
 * Error codes that mean "this device's attestation was not accepted" — as opposed to a
 * scenario failing on its own terms. For every scenario except the one that deliberately
 * exercises refusal, these mean the device cannot run the case, which is a **skip**: a
 * failure here would be indistinguishable from a real regression (FR-010).
 */
const ATTESTATION_REJECTION_CODES = [
    'HAAPI_ATTESTATION_REFUSED_BY_SERVER',
    'HAAPI_ATTESTATION_NOT_SUPPORTED',
];

export const RESULT_LINE_PREFIX = 'HAAPI_E2E_RESULT_V1::';
/**
 * Prefix of the **second** copy of every result, emitted in one pass at the end of a run.
 *
 * The device lanes read results from iOS's unified log, and that log is a lossy stream: PR-37's
 * ios-device lane lost `refresh-happy`'s result line — along with the SDK log lines either side of
 * it, inside a 10ms window — while 11,700 other lines from the same process arrived intact and
 * nothing failed. A single dropped line cost a whole 13-scenario lane, and no amount of care on
 * this side stops the platform dropping a message.
 *
 * So each result is logged twice, far apart: once as it settles, once in a replay pass just before
 * the suite line. The runner keys results by id, so the copies collapse to one and the pass costs
 * nothing when nothing was lost. Deliberately a distinct prefix rather than a repeat of
 * {@link RESULT_LINE_PREFIX}: the runner can then say which results it had to recover, which is
 * what keeps the channel's lossiness visible instead of quietly compensated for.
 *
 * Same length as {@link RESULT_LINE_PREFIX} so the size budget below applies to both unchanged.
 */
export const REPLAY_LINE_PREFIX = 'HAAPI_E2E_REPLAY_V1::';
export const SUITE_LINE_PREFIX = 'HAAPI_E2E_SUITE_V1::';

export function idle(id: string): ScenarioResult {
    return {id, status: ScenarioStatus.Idle, assertions: []};
}

export function running(previous: ScenarioResult): ScenarioResult {
    return {id: previous.id, status: ScenarioStatus.Running, assertions: []};
}

/**
 * Settles a scenario from the assertions it actually executed.
 *
 * A scenario that asserted **nothing** is a failure, not a pass: the usual cause is a flow
 * that returned early, and reporting it green would hide the very thing the tier exists to
 * catch.
 */
export function settle(id: string, assertions: readonly AssertionResult[]): ScenarioResult {
    if (assertions.length === 0) {
        return {
            id,
            status: ScenarioStatus.Fail,
            assertions: [],
            error: 'Scenario finished without executing any assertion',
        };
    }

    const failed = assertions.filter(assertion => !assertion.ok);
    if (failed.length > 0) {
        return {
            id,
            status: ScenarioStatus.Fail,
            assertions,
            error: describeFailures(failed),
        };
    }

    return {id, status: ScenarioStatus.Pass, assertions};
}

export function skipped(id: string, reason: string): ScenarioResult {
    return {id, status: ScenarioStatus.Skipped, assertions: [], skipReason: reason};
}

export interface FromThrownOptions {
    /**
     * Set for the scenario whose expected outcome *is* an attestation refusal. It stops the
     * skip matcher from swallowing that scenario's subject: there, an unasserted throw is a
     * real failure.
     */
    readonly attestationRejectionIsExpected?: boolean;
}

export function fromThrown(
    id: string,
    error: unknown,
    options: FromThrownOptions = {}
): ScenarioResult {
    if (!options.attestationRejectionIsExpected && isAttestationRejection(error)) {
        return skipped(
            id,
            `Attestation was not accepted for this device (${describeError(error)}) — ` +
                'scenario cannot run here'
        );
    }

    return {id, status: ScenarioStatus.Fail, assertions: [], error: describeError(error)};
}

/**
 * True when `error`, or anything in its `cause` chain, reports an attestation rejection.
 * Guards against a self-referencing chain so a malformed error cannot hang the harness.
 */
export function isAttestationRejection(error: unknown): boolean {
    const seen = new Set<unknown>();
    let current = error;

    while (current !== null && current !== undefined && typeof current === 'object') {
        if (seen.has(current)) {
            return false;
        }
        seen.add(current);

        const code = (current as {code?: unknown}).code;
        if (typeof code === 'string' && ATTESTATION_REJECTION_CODES.indexOf(code) !== -1) {
            return true;
        }

        current = (current as {cause?: unknown}).cause;
    }

    return false;
}

/**
 * Longest a single string field may be in a logged payload.
 *
 * os_log truncates messages at roughly a kilobyte, and it does so mid-string — verified on a
 * simulator, where a real `NSURLErrorDomain` description produced a ~1 KB payload that arrived
 * chopped and unparseable. The device lanes read results only from the log, so an oversized
 * payload means a *lost result*, precisely when the error is most worth reading. Truncating
 * here keeps the line parseable; the on-screen surface still shows the untruncated value.
 */
const MAX_LOGGED_FIELD_LENGTH = 180;
const MAX_LOGGED_LINE_LENGTH = 880;

/**
 * Removes every character `JSON.stringify` would escape with a backslash.
 *
 * os_log rewrites a backslash into its octal form — a payload containing `\"` arrives as
 * `\134"`, which is not valid JSON, so the result is lost. Server error messages quote things
 * constantly, so this is the common case. Quotes become apostrophes and backslashes become
 * slashes: the text stays readable and the payload stays parseable.
 */
function sanitizeForLog(value: string): string {
    return value
        .replace(/\\/g, '/')
        .replace(/"/g, "'")
        .replace(/[\u0000-\u001f]+/g, ' ');
}

function truncate(value: string): string {
    const safe = sanitizeForLog(value);
    return safe.length <= MAX_LOGGED_FIELD_LENGTH
        ? safe
        : `${safe.slice(0, MAX_LOGGED_FIELD_LENGTH)}…`;
}

/** A log-safe projection: same shape, bounded strings. */
function toLoggable(result: ScenarioResult): ScenarioResult {
    return {
        ...result,
        assertions: result.assertions.map(assertion => ({
            ...assertion,
            name: truncate(assertion.name),
            ...(assertion.detail === undefined ? {} : {detail: truncate(assertion.detail)}),
        })),
        skipReason: result.skipReason === undefined ? undefined : truncate(result.skipReason),
        error: result.error === undefined ? undefined : truncate(result.error),
    };
}

export function formatResultLine(result: ScenarioResult): string {
    let loggable = toLoggable(result);
    let line = RESULT_LINE_PREFIX + toSingleLineJson(loggable);

    if (line.length > MAX_LOGGED_LINE_LENGTH) {
        // Still too long: many assertions rather than one long one. Keep the failures — they
        // carry the diagnosis — and record how many passing ones were dropped.
        const failed = loggable.assertions.filter(assertion => !assertion.ok);
        const droppedCount = loggable.assertions.length - failed.length;
        loggable = {
            ...loggable,
            assertions: failed.slice(0, 3),
            error: truncate(
                `${loggable.error ?? ''}${droppedCount > 0 ? ` (+${droppedCount} passing assertions omitted from log)` : ''}`
            ),
        };
        line = RESULT_LINE_PREFIX + toSingleLineJson(loggable);
    }

    return line;
}

/**
 * The same payload as {@link formatResultLine}, under the replay prefix.
 *
 * Built *from* the result line rather than re-serialised, so the two copies cannot drift and the
 * replay inherits the same truncation: a recovered result is the identical result, not a thinner
 * one.
 */
export function formatReplayLine(result: ScenarioResult): string {
    return REPLAY_LINE_PREFIX + formatResultLine(result).slice(RESULT_LINE_PREFIX.length);
}

export function formatSuiteLine(total: number): string {
    return SUITE_LINE_PREFIX + toSingleLineJson({status: 'COMPLETE', total});
}

export function formatConfigErrorLine(detail: string): string {
    return SUITE_LINE_PREFIX + toSingleLineJson({status: 'CONFIG_ERROR', detail});
}

/**
 * `JSON.stringify` already escapes newlines inside strings, so the result is single-line by
 * construction; the explicit strip is a belt-and-braces guard because the log channel is
 * line-oriented and a split payload is unparseable.
 */
function toSingleLineJson(value: unknown): string {
    return JSON.stringify(value).replace(/[\r\n]+/g, ' ');
}

function describeFailures(failed: readonly AssertionResult[]): string {
    return failed
        .map(assertion =>
            assertion.detail === undefined
                ? assertion.name
                : `${assertion.name}: ${assertion.detail}`
        )
        .join('; ');
}

function describeError(error: unknown): string {
    if (typeof error === 'string') {
        return error;
    }
    if (error === null || error === undefined) {
        return 'Unknown error';
    }
    if (typeof error === 'object') {
        const code = (error as {code?: unknown}).code;
        const message = (error as {message?: unknown}).message;
        const parts = [
            typeof code === 'string' ? code : null,
            typeof message === 'string' ? message : null,
        ].filter(part => part !== null);

        if (parts.length > 0) {
            return parts.join(': ');
        }
        try {
            return JSON.stringify(error);
        } catch {
            return String(error);
        }
    }
    return String(error);
}
