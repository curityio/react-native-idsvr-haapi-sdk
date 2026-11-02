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

// Not a test suite (Jest matches `*.test.ts` only): shared by the per-platform matrix tests.

var fs = require('fs');
var path = require('path');

var CONFIGS_DIR = path.join(__dirname, '..', '..', '..', 'configs');
var SERVER_CONFIGS = ['dev-config.xml', 'docker-config.xml'];

/**
 * The client ids whose server config issues token-bound authorization codes
 * (`<issue-token-bound-authorization-code>true`), per server config file, for ids starting with
 * `prefix`. Read from the configs themselves so the example's binding map can't drift from them.
 */
export function tokenBoundClientIdsByConfig(prefix: string): Record<string, string[]> {
    var result: Record<string, string[]> = {};
    SERVER_CONFIGS.forEach(function (file) {
        var xml = fs.readFileSync(path.join(CONFIGS_DIR, file), 'utf8');
        var ids: string[] = [];
        var client = /<client>\s*<id>([^<]+)<\/id>([\s\S]*?)<\/client>/g;
        var match;
        while ((match = client.exec(xml)) !== null) {
            if (match[1].indexOf(prefix) === 0 &&
                /<issue-token-bound-authorization-code>\s*true\s*</.test(match[2])) {
                ids.push(match[1]);
            }
        }
        result[file] = ids.sort();
    });
    return result;
}
