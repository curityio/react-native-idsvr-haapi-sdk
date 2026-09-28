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

// CI guard (HSRN-000): the package's Expo config-plugin entry must load.
//
// `app.plugin.js` is what Expo resolves when the SDK is listed by package name
// in a consumer's `expo.plugins`. If it is missing, or its
// `require('./plugin/withHaapiSpmEmbed.js')` chain breaks, Expo silently falls
// back to the package `main` and `expo prebuild` crashes. This asserts the
// entry resolves to a config-plugin function and the require chain stays
// intact. Pairs with pack-contents.test.ts, which guards that the entry is
// actually shipped.

const withXcodeProjectMock = jest.fn(
    (config: unknown, action: (c: unknown) => unknown) => action(config)
);

// Mock the config-plugins surface so the real plugin require chain runs
// without pulling Expo's full plugin runtime (mirrors withHaapiSpmEmbed.test.ts).
jest.mock("expo/config-plugins", () => ({
    createRunOncePlugin: (plugin: unknown) => plugin,
    withXcodeProject: (config: unknown, action: unknown) =>
        withXcodeProjectMock(config, action),
}));

describe("app.plugin.js entry (HSRN-000 guard)", () => {
    test("loads and exports a config-plugin function", () => {
        // The documented entry Expo loads for `@curity/...` in expo.plugins,
        // exercising the ./plugin/withHaapiSpmEmbed.js require chain.
        const plugin = require("../../../app.plugin.js");
        expect(typeof plugin).toBe("function");
        expect(typeof plugin.withHaapiSpmEmbed).toBe("function");
    });
});
