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

// Guards the string values every enumerated type sends across the bridge.
//
// Expo converts a JS string into a native enum by exact match: Swift looks the
// string up with `init(rawValue:)`, Kotlin compares it with the enum's `value`.
// A native value that differs from the TS value — even only in case — makes the
// bridge reject the whole call, so TS, Swift and Kotlin must agree exactly. A
// Swift case declared without `= "…"` has its case name as its raw value, which
// is how the JWT algorithms drifted (`case hs256` vs TS `'HS256'`).
//
// TS values come from the real enums; native values are read from the sources,
// so the check runs in the cheapest CI stage without a native build.
//
// Fix on failure: make the native raw value equal the TS value (TS is the public
// contract), or map a new native enum in BRIDGED_ENUMS below.

import * as fs from "fs";
import * as path from "path";

import {
    ClientAuthenticationKind,
    JwtAsymmetricAlgorithm,
    JwtSymmetricAlgorithm,
    KeyStoreOption,
} from "../clientAuthenticationMethods";
import { BundleOption, CryptoKeyType, KeychainAccessibility, URLSessionOption } from "../ios-configuration";
import {
    ApplicationContextOption,
    CurrentTimeMillisProviderOption,
    DpopKeyPolicy,
    HttpUrlConnectionProviderOption,
    StorageOption,
    TokenEndpointResponseListenerOption,
} from "../android-configuration";
import { TokenBindingKind } from "../token-binding";
import { RNLogLevel } from "../logging/rn-log-level";
import { ActionKind } from "../models/action-kind";
import { ActionType } from "../models/action-type";
import { ClientOperationName } from "../models/client-operation-name";
import { FormFieldType } from "../models/form-field-type";
import { PollingStatus } from "../models/polling-status";
import { ProblemType } from "../models/problem-type";
import { RepresentationType } from "../models/representation-type";
import { StepType } from "../models/step-type";
import {
    ENUMERATED_CONFIGURATION_FIELDS,
    ENUMERATED_LOGGER_FIELDS,
} from "../internal/configuration-validation";

const ROOT = path.resolve(__dirname, "..", "..");
const IOS_ROOT = path.join(ROOT, "ios");
const ANDROID_ROOT = path.join(ROOT, "android", "src", "main");
const SKIPPED_DIRECTORIES = ["Tests", "Pods", "build", ".build"];

// ---------------------------------------------------------------------------
// Source readers (test utilities)
// ---------------------------------------------------------------------------

function sourceFiles(dir, extension) {
    const found = [];
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const skipped =
                SKIPPED_DIRECTORIES.indexOf(entry.name) !== -1 ||
                entry.name.endsWith(".xcodeproj") ||
                entry.name.endsWith(".xcworkspace");
            if (!skipped) {
                sourceFiles(full, extension).forEach(file => found.push(file));
            }
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
            found.push(full);
        }
    });
    return found;
}

// Returns the text between the brace at `openIndex` and its matching close.
function braceBody(source, openIndex) {
    let depth = 0;
    for (let i = openIndex; i < source.length; i++) {
        if (source[i] === "{") {
            depth++;
        } else if (source[i] === "}") {
            depth--;
            if (depth === 0) {
                return source.slice(openIndex + 1, i);
            }
        }
    }
    throw new Error("Unbalanced braces after index " + openIndex);
}

// Lines of a body that sit at its top level (not inside a nested method or switch).
function topLevelLines(body) {
    const lines = [];
    let depth = 0;
    let current = "";
    let currentDepth = 0;
    for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (ch === "\n") {
            if (currentDepth === 0) {
                lines.push(current);
            }
            current = "";
            currentDepth = depth;
            continue;
        }
        if (ch === "{") {
            depth++;
        } else if (ch === "}") {
            depth--;
        }
        current += ch;
    }
    if (currentDepth === 0) {
        lines.push(current);
    }
    return lines;
}

// `Enumerable` anywhere in the conformance list: an enum this misses escapes every check below.
const SWIFT_ENUM = /\benum\s+(\w+)\s*:\s*String\b[^{]*\bEnumerable\b[^{]*\{/g;
const SWIFT_CASE = /^\s*case\s+(.*?)\s*$/;
const SWIFT_CASE_BODY = /^`?(\w+)`?(?:\s*=\s*"([^"]*)")?$/;

// `{ EnumName: [rawValue, …] }` for every `String`-backed `Enumerable` enum in `source`.
function parseSwiftEnums(source) {
    const enums = {};
    let match;
    SWIFT_ENUM.lastIndex = 0;
    while ((match = SWIFT_ENUM.exec(source)) !== null) {
        const name = match[1];
        const body = braceBody(source, match.index + match[0].length - 1);
        const values = [];
        topLevelLines(body).forEach(line => {
            const caseLine = SWIFT_CASE.exec(line);
            if (!caseLine) {
                return;
            }
            const declaration = caseLine[1];
            if (declaration.replace(/"[^"]*"/g, "").indexOf(",") !== -1) {
                throw new Error(name + ": multi-case declarations are not supported: '" + line.trim() + "'");
            }
            const parsed = SWIFT_CASE_BODY.exec(declaration);
            if (!parsed) {
                throw new Error(name + ": unrecognised case declaration: '" + line.trim() + "'");
            }
            // An explicit raw value wins; otherwise Swift uses the case name.
            values.push(parsed[2] !== undefined ? parsed[2] : parsed[1]);
        });
        enums[name] = values;
    }
    return enums;
}

// Any other constructor properties or supertypes allowed, as for Swift.
const KOTLIN_ENUM = /\benum\s+class\s+(\w+)\s*\([^)]*\bval\s+value\s*:\s*String\b[^)]*\)\s*:[^{]*\bEnumerable\b[^{]*\{/g;
// The first argument is read as `value`; a misread fails the value comparison, never passes it.
const KOTLIN_ENTRY = /\b([A-Z][A-Z0-9_]*)\s*\(\s*"([^"]*)"\s*[,)]/g;

// `{ EnumName: [value, …] }` for every `enum class X(val value: String, …) : …, Enumerable` in `source`.
function parseKotlinEnums(source) {
    const enums = {};
    let match;
    KOTLIN_ENUM.lastIndex = 0;
    while ((match = KOTLIN_ENUM.exec(source)) !== null) {
        const name = match[1];
        const body = braceBody(source, match.index + match[0].length - 1)
            .replace(/\/\*[\s\S]*?\*\//g, "")
            // Whole-line comments only: raw values such as problem-type URLs contain `//`.
            .replace(/^\s*\/\/.*$/gm, "");
        const semicolon = body.indexOf(";");
        const entries = semicolon === -1 ? body : body.slice(0, semicolon);
        const values = [];
        let entry;
        KOTLIN_ENTRY.lastIndex = 0;
        while ((entry = KOTLIN_ENTRY.exec(entries)) !== null) {
            values.push(entry[2]);
        }
        enums[name] = values;
    }
    return enums;
}

function parseAll(files, parser) {
    const all = {};
    files.forEach(file => {
        const parsed = parser(fs.readFileSync(file, "utf8"));
        Object.keys(parsed).forEach(name => {
            if (all[name]) {
                throw new Error("Enum " + name + " is declared twice (" + all[name].file + ", " + file + ")");
            }
            all[name] = { values: parsed[name], file: path.relative(ROOT, file) };
        });
    });
    return all;
}

// Values of a TS string-literal union field, read from its `readonly <field>: "…";` lines.
function unionValues(relativeFile, field) {
    const source = fs.readFileSync(path.join(ROOT, relativeFile), "utf8");
    const pattern = new RegExp("readonly\\s+" + field + "\\s*:\\s*\"([^\"]+)\"", "g");
    const values = [];
    let match;
    while ((match = pattern.exec(source)) !== null) {
        values.push(match[1]);
    }
    return values;
}

// ---------------------------------------------------------------------------
// The bridged enums: TS name ↔ Swift type ↔ Kotlin type (null = not on that platform)
// ---------------------------------------------------------------------------

// Configuration and logger configuration (TS → native)
const CONFIGURATION_ENUMS = [
    { ts: "JwtSymmetricAlgorithm", values: Object.values(JwtSymmetricAlgorithm), swift: "RNJWTSymmetricAlgorithm", kotlin: "JwtSymmetricAlgorithm" },
    { ts: "JwtAsymmetricAlgorithm", values: Object.values(JwtAsymmetricAlgorithm), swift: "RNJWTAsymmetricAlgorithm", kotlin: "JwtAsymmetricAlgorithm" },
    { ts: "ClientAuthenticationKind", values: Object.values(ClientAuthenticationKind), swift: "ClientAuthenticationKind", kotlin: "ClientAuthenticationKind" },
    { ts: "TokenBindingKind", values: Object.values(TokenBindingKind), swift: "RNTokenBindingKind", kotlin: "TokenBindingKind" },
    { ts: "RNLogLevel", values: Object.values(RNLogLevel), swift: "RNLogLevel", kotlin: "RNLogLevel" },
    { ts: "KeyStoreOption", values: Object.values(KeyStoreOption), swift: null, kotlin: "KeyStoreOption" },
    { ts: "URLSessionOption", values: Object.values(URLSessionOption), swift: "URLSessionOption", kotlin: null },
    { ts: "BundleOption", values: Object.values(BundleOption), swift: "BundleOption", kotlin: null },
    { ts: "CryptoKeyType", values: Object.values(CryptoKeyType), swift: "RNCryptoKeyType", kotlin: null },
    { ts: "KeychainAccessibility", values: Object.values(KeychainAccessibility), swift: "RNKeychainAccessibility", kotlin: null },
    { ts: "HttpUrlConnectionProviderOption", values: Object.values(HttpUrlConnectionProviderOption), swift: null, kotlin: "HttpUrlConnectionProviderOption" },
    { ts: "CurrentTimeMillisProviderOption", values: Object.values(CurrentTimeMillisProviderOption), swift: null, kotlin: "CurrentTimeMillisProviderOption" },
    { ts: "StorageOption", values: Object.values(StorageOption), swift: null, kotlin: "StorageOption" },
    { ts: "DpopKeyPolicy", values: Object.values(DpopKeyPolicy), swift: null, kotlin: "RNDpopKeyPolicy" },
    { ts: "TokenEndpointResponseListenerOption", values: Object.values(TokenEndpointResponseListenerOption), swift: null, kotlin: "TokenEndpointResponseListenerOption" },
    { ts: "ApplicationContextOption", values: Object.values(ApplicationContextOption), swift: null, kotlin: "ApplicationContextOption" },
];

// Responses and log events (native → TS)
const RESPONSE_ENUMS = [
    { ts: "RepresentationType", values: Object.values(RepresentationType), swift: "RNRepresentationType", kotlin: "RNRepresentationType" },
    { ts: "StepType", values: Object.values(StepType), swift: "RNStepType", kotlin: "RNStepType" },
    { ts: "ActionKind", values: Object.values(ActionKind), swift: "RNActionKind", kotlin: "RNActionKind" },
    { ts: "ActionType", values: Object.values(ActionType), swift: "RNActionType", kotlin: "RNActionType" },
    { ts: "FormFieldType", values: Object.values(FormFieldType), swift: "RNFormFieldType", kotlin: "RNFormFieldType" },
    { ts: "PollingStatus", values: Object.values(PollingStatus), swift: "RNPollingStatus", kotlin: "RNPollingStatus" },
    { ts: "ProblemType", values: Object.values(ProblemType), swift: "RNProblemType", kotlin: "RNProblemType" },
    { ts: "ClientOperationName", values: Object.values(ClientOperationName), swift: "RNClientOperationType", kotlin: "RNClientOperationType" },
    { ts: "HaapiResponse.responseCategory", values: unionValues("src/models/haapi-response.ts", "responseCategory"), swift: "RNResponseCategory", kotlin: "RNResponseCategory" },
    { ts: "TokenResponse.responseType", values: unionValues("src/models/token-response.ts", "responseType"), swift: "RNTokenResponseType", kotlin: "RNTokenResponseType" },
];

const BRIDGED_ENUMS = CONFIGURATION_ENUMS.concat(RESPONSE_ENUMS);

function difference(expected, actual) {
    return {
        missing: expected.filter(value => actual.indexOf(value) === -1).sort(),
        extra: actual.filter(value => expected.indexOf(value) === -1).sort(),
    };
}

// ---------------------------------------------------------------------------
// The guard
// ---------------------------------------------------------------------------

describe("bridged enum values are identical in TS, Swift and Kotlin", () => {
    const swiftEnums = parseAll(sourceFiles(IOS_ROOT, ".swift"), parseSwiftEnums);
    const kotlinEnums = parseAll(sourceFiles(ANDROID_ROOT, ".kt"), parseKotlinEnums);

    const platforms = [
        { platform: "iOS", key: "swift", enums: swiftEnums },
        { platform: "Android", key: "kotlin", enums: kotlinEnums },
    ];

    platforms.forEach(({ platform, key, enums }) => {
        BRIDGED_ENUMS.filter(row => row[key] !== null).forEach(row => {
            test(`${row.ts} on ${platform} (${row[key]}) accepts exactly the TS values`, () => {
                const native = enums[row[key]];
                expect(native).toBeDefined();
                expect(row.values.length).toBeGreaterThan(0);
                // On failure: `missing` = TS values the native enum rejects; `extra` = native
                // values TS never sends or never expects.
                expect({ type: row.ts, platform, native: native.file, ...difference(row.values, native.values) })
                    .toEqual({ type: row.ts, platform, native: native.file, missing: [], extra: [] });
            });
        });

        test(`every ${platform} Enumerable enum is mapped to a TS type`, () => {
            const mapped = BRIDGED_ENUMS.map(row => row[key]).filter(name => name !== null);
            const unmapped = Object.keys(enums).filter(name => mapped.indexOf(name) === -1).sort();
            expect(unmapped).toEqual([]);
        });
    });
});

// ---------------------------------------------------------------------------
// The TS validation table covers every enumerated field the native records read
// ---------------------------------------------------------------------------

// `@Field var name: Type` (Swift) or `@Field\n var name: Type` (Kotlin), with or without an access
// modifier; the type is read without its `?`.
const FIELD_DECLARATION = /@Field(?:\([^)]*\))?\s+(?:(?:public|internal|private|fileprivate)\s+)?var\s+(\w+)\s*:\s*(\w+)/g;

function fieldDeclarations(source) {
    const fields = [];
    let match;
    FIELD_DECLARATION.lastIndex = 0;
    while ((match = FIELD_DECLARATION.exec(source)) !== null) {
        fields.push({ field: match[1], type: match[2] });
    }
    return fields;
}

// TS fields with no native record field on either platform — validated anyway, because the
// TS type is an enum and a configuration is accepted or rejected the same way everywhere.
const TS_ONLY_FIELDS = {
    "androidConfig.applicationContextOption": "declared on AndroidConfiguration but read by no Android record",
};

// Validated fields a native record reads as a plain `String` and converts itself, which the scan
// of enum-typed fields cannot see: `[record field, why]`.
const NATIVE_STRING_FIELDS = {
    "androidConfig.tokenBindingConfiguration.keyPairAlgorithmConfiguration.jwtAlgorithm": [
        "jwtAlgorithm",
        "KeyPairAlgorithmConfigurationRecord converts it with KeyPairAlgorithmConfig.valueOf",
    ],
    "androidConfig.tokenBoundConfiguration.keyPairAlgorithmConfiguration.jwtAlgorithm": [
        "jwtAlgorithm",
        "the same record, for the deprecated setting",
    ],
};

// The native record fields typed with a configuration enum (response records are out of scope:
// their values come from the native SDK, not from the app's configuration).
function enumFields(files, key) {
    const nativeToTs = {};
    CONFIGURATION_ENUMS.filter(row => row[key] !== null).forEach(row => {
        nativeToTs[row[key]] = row.ts;
    });
    const fields = [];
    files.forEach(file => {
        fieldDeclarations(fs.readFileSync(file, "utf8")).forEach(declaration => {
            if (nativeToTs[declaration.type]) {
                fields.push({ field: declaration.field, ts: nativeToTs[declaration.type], file: path.relative(ROOT, file) });
            }
        });
    });
    return fields;
}

describe("the configuration validation table matches the native records", () => {
    const table = ENUMERATED_CONFIGURATION_FIELDS.concat(ENUMERATED_LOGGER_FIELDS).map(entry => ({
        path: entry.path,
        field: entry.path.split(".").pop(),
        ts: entry.enumName,
    }));
    const nativeFields = enumFields(sourceFiles(IOS_ROOT, ".swift"), "swift").concat(
        enumFields(sourceFiles(ANDROID_ROOT, ".kt"), "kotlin"),
    );

    test("finds the native enumerated fields it checks", () => {
        // A regex that silently matched nothing would make the next test vacuous.
        expect(nativeFields.map(f => f.field + ":" + f.ts)).toEqual(
            expect.arrayContaining(["symmetricAlgorithm:JwtSymmetricAlgorithm", "logLevel:RNLogLevel"]),
        );
    });

    test("every enumerated field a native record reads is validated in TS", () => {
        const unvalidated = nativeFields
            .filter(native => !table.some(entry => entry.field === native.field && entry.ts === native.ts))
            .map(native => native.file + ": " + native.field + " (" + native.ts + ")");
        expect(unvalidated).toEqual([]);
    });

    test("the fields exempted as natively string-typed are declared as String on Android", () => {
        const androidStrings = sourceFiles(ANDROID_ROOT, ".kt")
            .flatMap(file => fieldDeclarations(fs.readFileSync(file, "utf8")))
            .filter(declaration => declaration.type === "String")
            .map(declaration => declaration.field);
        Object.keys(NATIVE_STRING_FIELDS).forEach(entryPath => {
            expect(androidStrings).toContain(NATIVE_STRING_FIELDS[entryPath][0]);
        });
    });

    test("every validated field is read by a native record, or is listed as TS-only", () => {
        const unknown = table
            .filter(entry => TS_ONLY_FIELDS[entry.path] === undefined && NATIVE_STRING_FIELDS[entry.path] === undefined)
            .filter(entry => !nativeFields.some(native => native.field === entry.field && native.ts === entry.ts))
            .map(entry => entry.path + " (" + entry.ts + ")");
        expect(unknown).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// The parsers themselves — a guard that misreads the sources guards nothing
// ---------------------------------------------------------------------------

describe("Swift enum parser", () => {
    test("uses the case name as the raw value when none is declared", () => {
        const source = [
            "enum RNJWTSymmetricAlgorithm: String, Enumerable {",
            "    /// HMAC using SHA-256",
            "    case hs256",
            "    case hs384 = \"HS384\"",
            "}",
        ].join("\n");
        expect(parseSwiftEnums(source)).toEqual({ RNJWTSymmetricAlgorithm: ["hs256", "HS384"] });
    });

    test("reads backtick-escaped cases and raw values with URL characters", () => {
        const source = [
            "enum RNActionKind: String, Enumerable {",
            "    case `continue` = \"continue\"",
            "    case authenticationFailed = \"https://curity.se/problems/authentication-failed\"",
            "}",
        ].join("\n");
        expect(parseSwiftEnums(source)).toEqual({
            RNActionKind: ["continue", "https://curity.se/problems/authentication-failed"],
        });
    });

    test("ignores `case` labels inside the enum's methods", () => {
        const source = [
            "enum RNLogLevel: String, Enumerable {",
            "    case debug = \"debug\"",
            "    case error = \"error\"",
            "    func toLogType() -> LogType {",
            "        switch self {",
            "        case .debug: return .debug",
            "        case .error: return .error",
            "        }",
            "    }",
            "}",
        ].join("\n");
        expect(parseSwiftEnums(source)).toEqual({ RNLogLevel: ["debug", "error"] });
    });

    test("reads every Enumerable enum in a file and skips other enums", () => {
        const source = [
            "struct RNTokenBindingConfigurationRecord: Record {",
            "    @Field var kind: RNTokenBindingKind?",
            "}",
            "enum RNTokenBindingKind: String, Enumerable {",
            "    case unbound = \"unbound\"",
            "}",
            "internal enum HaapiErrorCategory: String, CaseIterable {",
            "    case networking",
            "}",
            "enum RNCryptoKeyType: String, Enumerable {",
            "    case p256 = \"p256\"",
            "}",
        ].join("\n");
        expect(parseSwiftEnums(source)).toEqual({ RNTokenBindingKind: ["unbound"], RNCryptoKeyType: ["p256"] });
    });

    test("reads an Enumerable enum whatever else it conforms to", () => {
        const source = [
            "enum RNFirst: String, Sendable, Enumerable {",
            "    case a = \"a\"",
            "}",
            "internal enum RNSecond: String, Enumerable, CaseIterable {",
            "    case b = \"b\"",
            "}",
        ].join("\n");
        expect(parseSwiftEnums(source)).toEqual({ RNFirst: ["a"], RNSecond: ["b"] });
    });

    test("refuses multi-case declarations instead of misreading them", () => {
        const source = "enum Pair: String, Enumerable {\n    case a, b\n}";
        expect(() => parseSwiftEnums(source)).toThrow("multi-case declarations are not supported");
    });

    test("refuses a case line it cannot read instead of skipping it", () => {
        const source = "enum Odd: String, Enumerable {\n    case a = \"a\" // trailing comment\n}";
        expect(() => parseSwiftEnums(source)).toThrow("unrecognised case declaration");
    });
});

describe("record field parser", () => {
    test("reads @Field declarations with or without an access modifier, on one line or two", () => {
        const source = [
            "@Field var kind: ClientAuthenticationKind = .none",
            "@Field public var storageOption: StorageOption? = null",
            "@Field",
            "    internal var logLevel: RNLogLevel?",
        ].join("\n");
        expect(fieldDeclarations(source)).toEqual([
            { field: "kind", type: "ClientAuthenticationKind" },
            { field: "storageOption", type: "StorageOption" },
            { field: "logLevel", type: "RNLogLevel" },
        ]);
    });
});

describe("Kotlin enum parser", () => {
    test("reads entries across a multi-line signature and KDoc between entries", () => {
        const source = [
            "enum class StorageOption(",
            "    val value: String,",
            ") : Enumerable {",
            "    /**",
            "     * The default storage, e.g. EXAMPLE(\"not-a-value\").",
            "     */",
            "    DEFAULT(\"default\"),",
            "",
            "    /** Custom storage. */",
            "    CUSTOM(\"custom\"),",
            "}",
        ].join("\n");
        expect(parseKotlinEnums(source)).toEqual({ StorageOption: ["default", "custom"] });
    });

    test("keeps raw values that contain `//` (problem-type URLs)", () => {
        const source = [
            "enum class RNProblemType(",
            "    val value: String,",
            ") : Enumerable {",
            "    // Problem types the server can return.",
            "    AUTHENTICATION_FAILED(\"https://curity.se/problems/authentication-failed\"),",
            "    OTHER(\"other\"),",
            "}",
        ].join("\n");
        expect(parseKotlinEnums(source)).toEqual({
            RNProblemType: ["https://curity.se/problems/authentication-failed", "other"],
        });
    });

    test("stops at the entry list's semicolon, before methods", () => {
        const source = [
            "enum class RNLogLevel(",
            "    val value: String,",
            ") : Enumerable {",
            "    DEBUG(\"debug\"),",
            "    ERROR(\"error\"),",
            "    ;",
            "    fun toHaapiLogLevel(): LogLevel =",
            "        when (this) {",
            "            DEBUG -> LogLevel.valueOf(\"DEBUG\")",
            "            ERROR -> LogLevel.valueOf(\"ERROR\")",
            "        }",
            "}",
        ].join("\n");
        expect(parseKotlinEnums(source)).toEqual({ RNLogLevel: ["debug", "error"] });
    });

    test("reads an Enumerable enum with more constructor properties or supertypes", () => {
        const source = [
            "enum class First(val value: String, val label: String) : Enumerable {",
            "    A(\"a\", \"A\"),",
            "}",
            "enum class Second(",
            "    val value: String,",
            ") : java.io.Serializable, Enumerable {",
            "    B(\"b\"),",
            "}",
        ].join("\n");
        expect(parseKotlinEnums(source)).toEqual({ First: ["a"], Second: ["b"] });
    });

    test("reads every Enumerable enum in a file and skips other enums", () => {
        const source = [
            "enum class TokenBindingKind(",
            "    val value: String,",
            ") : Enumerable {",
            "    UNBOUND(\"unbound\"),",
            "}",
            "private enum class CallKind { START, SUBMIT }",
            "enum class StorageOption(",
            "    val value: String,",
            ") : Enumerable {",
            "    DEFAULT(\"default\"),",
            "}",
        ].join("\n");
        expect(parseKotlinEnums(source)).toEqual({ TokenBindingKind: ["unbound"], StorageOption: ["default"] });
    });
});
