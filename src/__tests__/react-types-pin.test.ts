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

// CI guard for the React / @types/react version pins.
//
// The public mirror-smoke stage runs `npm install` against the public npm
// registry (and `--prefer-offline` against a cache/mirror that can lag the
// very latest published patch). A floating or bleeding-edge `@types/react`
// range — e.g. "~19.2.17", which means ">=19.2.17" and chases the newest
// patch — demands a version the mirror may not have synced yet, so the smoke
// install dies with `ETARGET No matching version found for @types/react@...`.
//
// Rule: `react` and `@types/react` must both be EXACT pins (no ^ ~ * x range
// operators) and `@types/react` must equal `react`. The types must never
// drift ahead of the concretely-pinned React (Expo 56's react, 19.2.3); an
// exact pin to a long-published version is present in every registry mirror.
// Enforced in BOTH the SDK package.json and example/package.json.
//
// Fix on failure: set `@types/react` to the exact same version string as
// `react` in the offending package.json, then refresh the lockfile with
// `npm install --package-lock-only`.

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..", "..");

function pkg(rel) {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

// Exact, range-free semver (rejects ^, ~, *, x, ranges, and pre-release tags).
const EXACT_SEMVER = /^\d+\.\d+\.\d+$/;

const MANIFESTS = [
    { label: "SDK package.json", rel: "package.json" },
    { label: "example/package.json", rel: "example/package.json" },
];

describe("React / @types/react pins are exact and aligned (mirror-smoke ETARGET guard)", () => {
    MANIFESTS.forEach(({ label, rel }) => {
        const manifest = pkg(rel);
        const deps = manifest.dependencies || {};
        const devDeps = manifest.devDependencies || {};
        const react = deps.react;
        const typesReact = devDeps["@types/react"] || deps["@types/react"];

        test(`${label}: react is an exact version pin`, () => {
            expect(react).toMatch(EXACT_SEMVER);
        });

        test(`${label}: @types/react is an exact version pin (no range — ranges chase the registry tip and break mirror-smoke)`, () => {
            expect(typesReact).toMatch(EXACT_SEMVER);
        });

        test(`${label}: @types/react equals react (types must not drift ahead of the pinned React)`, () => {
            expect(typesReact).toBe(react);
        });
    });

    test("react is pinned identically across the SDK and example manifests", () => {
        expect(pkg("example/package.json").dependencies.react).toBe(
            pkg("package.json").dependencies.react
        );
    });
});
