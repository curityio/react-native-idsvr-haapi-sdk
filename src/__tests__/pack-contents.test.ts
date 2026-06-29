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

// CI guard (HSRN-000): the published npm tarball must ship every
// consumer-critical file.
//
// An early `1.0.0` was published WITHOUT `app.plugin.js` / `plugin/` /
// `tsconfig.json`. Consumers that list the SDK by package name in
// `expo.plugins` then hit `ERR_MODULE_NOT_FOUND` at `expo prebuild`: with no
// `app.plugin.js`, Expo falls back to loading the package `main`
// (`build/index.js`), whose ESM/extensionless imports Node's loader rejects.
//
// This test packs the tarball exactly as `npm publish` would and asserts the
// files are present, so such an artifact can never be published green again.
// It runs in the `Lint & Tests` CI stage (`npm run test`), which gates the
// artifact + publish stages.

import { execFileSync } from "node:child_process";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..", "..");

// Files a consumer needs at install time:
//   app.plugin.js + plugin/   — the SPM-embed Expo config plugin (HSRN-28)
//   tsconfig.json             — the prepare-time `tsc` build needs it on
//                               git-dep installs (fe6b633)
//   build/index.js            — package `main`
//   expo-module.config.json   — autolinking discovery
//   ios podspec / android gradle — native bridge build inputs
const REQUIRED_FILES = [
    "app.plugin.js",
    "plugin/withHaapiSpmEmbed.js",
    "tsconfig.json",
    "build/index.js",
    "expo-module.config.json",
    "ios/IdsvrHaapiReactNativeSdk.podspec",
    "android/build.gradle",
];

function packedFilePaths(): string[] {
    // --dry-run: list only, write no tarball.
    // --ignore-scripts: don't re-run `prepare` (build/ already exists after
    //   install); keeps the guard fast and side-effect free.
    const raw = execFileSync(
        "npm",
        ["pack", "--dry-run", "--json", "--ignore-scripts"],
        { encoding: "utf8", cwd: ROOT }
    );
    const report = JSON.parse(raw);
    const entry = Array.isArray(report) ? report[0] : report;
    return entry.files.map((f: { path: string }) => f.path);
}

describe("npm tarball ships every consumer-critical file (HSRN-000 guard)", () => {
    // Pack inside beforeAll, not at describe scope: running the blocking
    // `npm pack` subprocess during Jest's collection phase would surface a
    // failure as an opaque suite-level collection error (no Jest timeout
    // applies). In beforeAll it becomes a proper failing test.
    let paths: string[];
    beforeAll(() => {
        paths = packedFilePaths();
    });

    test.each(REQUIRED_FILES)("tarball includes %s", (file) => {
        expect(paths).toContain(file);
    });
});
