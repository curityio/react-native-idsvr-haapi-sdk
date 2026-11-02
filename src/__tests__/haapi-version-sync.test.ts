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

// CI guard for the HAAPI native SDK version pins.
//
// package.json holds one HAAPI SDK version per platform (haapi.ios.version /
// haapi.android.version). The iOS test-workspace files (project.yml +
// Package.swift) and the Android default-fallback (packageJsonUtils.gradle)
// hold those versions as literals but don't read package.json at parse time.
//
// Rather than re-encode the match patterns here, this guard runs the sync
// script in --check mode. The script owns the patterns, so the matching logic
// has a single source of truth; if any pin drifts the script exits non-zero
// and this test fails loudly.
//
// Fix on failure: `npm run sync:haapi-version`.

import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "sync-haapi-version.js");
const PKG = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
);

describe("HAAPI SDK version pins are in sync across all sites", () => {
    test("package.json haapi.ios.version is a semver string", () => {
        expect(PKG.haapi.ios.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test("package.json haapi.android.version is a semver string", () => {
        expect(PKG.haapi.android.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test("all literal pin sites match package.json (sync script --check)", () => {
        // execFileSync throws on a non-zero exit, and the thrown error carries
        // the script's stderr (its drift report) for Jest to surface. That
        // throw IS the assertion — no need to re-encode the match patterns here.
        execFileSync(process.execPath, [SCRIPT, "--check"], {
            cwd: ROOT,
            encoding: "utf8",
        });
    });
});
