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
import * as fs from 'fs';
import * as path from 'path';

/**
 * Guards the example app's backup exclusions (`res/xml/backup_rules.xml` for Android 11 and lower,
 * `data_extraction_rules.xml` for 12 and higher). Android reads each `<exclude>`'s `path` as one
 * literal file name — `FullBackup.BackupScheme` builds a single `File(domain, path)` from it — so a
 * rule that lists several names in one attribute matches no file and excludes nothing. The
 * harness state file holds a refresh token, so that mistake ships a token in every backup.
 */

var RES_XML = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'xml');

/**
 * The SharedPreferences files the example process writes, as their constants name them:
 * `StorageResolver.PLAINTEXT_STORE_NAME`, `ENCRYPTED_STORE_NAME` (SDK), and the E2E module's
 * `TokenBindingStorageMigration.STATE_FILE`, `E2eExistingStore.NAME`, `HaapiE2eModule.HARNESS_STATE_FILE`.
 */
var EXCLUDED_FILES = [
    'haapi_token_bound_storage.xml',
    'haapi-dpop-encrypted-store.xml',
    'token_binding_migration.xml',
    'e2e_existing_token_binding_store.xml',
    'e2e_harness_state.xml',
].sort();

function read(name) {
    return fs.readFileSync(path.join(RES_XML, name), 'utf8');
}

/** The `<exclude>` elements of an XML fragment, as attribute maps. */
function excludes(xml) {
    var elements = xml.match(/<exclude\b[^>]*\/>/g) || [];
    return elements.map(function (element) {
        var attributes = {};
        var match;
        var attribute = /(\w[\w-]*)="([^"]*)"/g;
        while ((match = attribute.exec(element)) !== null) {
            attributes[match[1]] = match[2];
        }
        return attributes;
    });
}

/** The content between `<tag>` and `</tag>`; fails the test when the section is missing. */
function section(xml, tag) {
    var match = new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>').exec(xml);
    expect(match).not.toBeNull();
    return match[1];
}

function expectOneLiteralSharedprefFilePerRule(rules) {
    expect(rules.length).toBeGreaterThan(0);
    rules.forEach(function (rule) {
        expect(rule.domain).toBe('sharedpref');
        expect(rule.path).toMatch(/^[\w.-]+\.xml$/);
    });
}

function excludedFiles(rules) {
    return rules
        .map(function (rule) {
            return rule.path;
        })
        .sort();
}

describe('Android backup exclusions', function () {
    var backupRules = read('backup_rules.xml');
    var extractionRules = read('data_extraction_rules.xml');
    var sections = {
        'backup_rules.xml': excludes(backupRules),
        'data_extraction_rules.xml <cloud-backup>': excludes(section(extractionRules, 'cloud-backup')),
        'data_extraction_rules.xml <device-transfer>': excludes(section(extractionRules, 'device-transfer')),
    };

    Object.keys(sections).forEach(function (name) {
        describe(name, function () {
            it('names one sharedpref file per <exclude>, the way Android matches them', function () {
                expectOneLiteralSharedprefFilePerRule(sections[name]);
            });

            it("excludes every SharedPreferences file the example's process writes", function () {
                expect(excludedFiles(sections[name])).toEqual(EXCLUDED_FILES);
            });
        });
    });
});
