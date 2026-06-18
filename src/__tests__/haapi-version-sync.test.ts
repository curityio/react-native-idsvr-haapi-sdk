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

// CI guard for the HAAPI native SDK version pin.
//
// package.json -> haapi.version is the source of truth. Two iOS test-
// workspace files (project.yml + Package.swift) and one Android default-
// fallback (packageJsonUtils.gradle) hold the same version literal but
// don't read package.json at parse time. If any drifts, this test fails
// loudly so the iOS xcodebuild stage doesn't break later.
//
// Fix on failure: `npm run sync:haapi-version`.

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..", "..");
const PKG = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
);
const HAAPI_VERSION = PKG.haapi.version;

function read(rel) {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("HAAPI SDK version is in sync across all pin sites", () => {
    test("package.json haapi.version is a semver string", () => {
        expect(HAAPI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test("ios/project.yml exactVersion matches package.json", () => {
        const escaped = HAAPI_VERSION.replace(/\./g, "\\.");
        expect(read("ios/project.yml")).toMatch(
            new RegExp(`\\bexactVersion:\\s*${escaped}\\b`)
        );
    });

    test("ios/Package.swift exact: matches package.json", () => {
        expect(read("ios/Package.swift")).toContain(
            `exact: "${HAAPI_VERSION}"`
        );
    });

    test("android/packageJsonUtils.gradle default fallback matches package.json", () => {
        expect(read("android/packageJsonUtils.gradle")).toContain(
            `packageJsonValue("haapi.version", "${HAAPI_VERSION}")`
        );
    });
});
