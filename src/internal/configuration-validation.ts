//
// Copyright (C) 2026 Curity AB. All rights reserved.
//
// The contents of this file are the property of Curity AB.
// You may not copy or use this file, in either source code
// or executable form, except in compliance with terms
// set by Curity AB.
//
// For further information, please contact Curity AB.
//

import { HaapiErrorCode } from '../errors';
import type { HaapiError } from '../errors';
import type { RNHaapiConfiguration } from '../haapi-configuration';
import type { RNLoggerConfiguration } from '../logging/rn-logger-configuration';
import { RNLogLevel } from '../logging/rn-log-level';
import {
    ClientAuthenticationKind,
    JwtAsymmetricAlgorithm,
    JwtSymmetricAlgorithm,
    KeyStoreOption,
} from '../clientAuthenticationMethods';
import { BundleOption, CryptoKeyType, KeychainAccessibility, URLSessionOption } from '../ios-configuration';
import {
    ApplicationContextOption,
    CurrentTimeMillisProviderOption,
    DpopKeyPolicy,
    HttpUrlConnectionProviderOption,
    KeyPairAlgorithmConfig,
    StorageOption,
    TokenEndpointResponseListenerOption,
} from '../android-configuration';
import { TokenBindingKind } from '../token-binding';
import { makeBridgeError } from './bridge-errors';

/**
 * @internal
 *
 * An enumerated field of a configuration object: its dotted path, the TS enum it takes and
 * that enum's values.
 */
export interface EnumeratedField {
    readonly path: string;
    readonly enumName: string;
    readonly values: readonly string[];
}

function field(path: string, enumName: string, enumObject: { [member: string]: string }): EnumeratedField {
    return { path, enumName, values: Object.values(enumObject) };
}

// `KeyPairAlgorithmConfig` is a set of entries rather than an enum; Android maps an entry by its
// `jwtAlgorithm` (`KeyPairAlgorithmConfig.valueOf`), which is therefore the enumerated value.
function keyPairAlgorithmField(path: string): EnumeratedField {
    return {
        path,
        enumName: 'KeyPairAlgorithmConfig',
        values: Object.values(KeyPairAlgorithmConfig).map(entry => entry.jwtAlgorithm),
    };
}

function clientAuthenticationFields(platform: string): EnumeratedField[] {
    const prefix = `${platform}.clientAuthenticationMethodConfiguration.`;
    return [
        field(prefix + 'kind', 'ClientAuthenticationKind', ClientAuthenticationKind),
        field(prefix + 'symmetricAlgorithm', 'JwtSymmetricAlgorithm', JwtSymmetricAlgorithm),
        field(prefix + 'asymmetricAlgorithm', 'JwtAsymmetricAlgorithm', JwtAsymmetricAlgorithm),
        field(prefix + 'bundleOption', 'BundleOption', BundleOption),
        field(prefix + 'clientKeyStoreOption', 'KeyStoreOption', KeyStoreOption),
        field(prefix + 'serverKeyStoreOption', 'KeyStoreOption', KeyStoreOption),
    ];
}

/**
 * @internal
 *
 * Every enumerated field of {@link RNHaapiConfiguration}. Both platforms' configurations are
 * checked whichever platform runs, so a configuration is accepted or rejected the same way
 * everywhere. `bridge-enum-parity.test.ts` locks this table against the native records.
 */
export const ENUMERATED_CONFIGURATION_FIELDS: readonly EnumeratedField[] = [
    field('iosConfig.urlSessionOption', 'URLSessionOption', URLSessionOption),
    field('iosConfig.tokenBindingConfiguration.kind', 'TokenBindingKind', TokenBindingKind),
    field('iosConfig.tokenBindingConfiguration.keyPairType', 'CryptoKeyType', CryptoKeyType),
    field('iosConfig.tokenBoundConfiguration.keyPairType', 'CryptoKeyType', CryptoKeyType),
    field('iosConfig.keychainConfiguration.accessibility', 'KeychainAccessibility', KeychainAccessibility),
    ...clientAuthenticationFields('iosConfig'),
    field('androidConfig.httpUrlConnectionProviderOption', 'HttpUrlConnectionProviderOption', HttpUrlConnectionProviderOption),
    field('androidConfig.currentTimeMillisProviderOption', 'CurrentTimeMillisProviderOption', CurrentTimeMillisProviderOption),
    field(
        'androidConfig.tokenEndpointResponseListenerOption',
        'TokenEndpointResponseListenerOption',
        TokenEndpointResponseListenerOption,
    ),
    field('androidConfig.applicationContextOption', 'ApplicationContextOption', ApplicationContextOption),
    field('androidConfig.tokenBindingConfiguration.kind', 'TokenBindingKind', TokenBindingKind),
    field('androidConfig.tokenBindingConfiguration.keyType', 'DpopKeyPolicy', DpopKeyPolicy),
    field('androidConfig.tokenBindingConfiguration.storageOption', 'StorageOption', StorageOption),
    field('androidConfig.tokenBoundConfiguration.storageOption', 'StorageOption', StorageOption),
    keyPairAlgorithmField('androidConfig.tokenBindingConfiguration.keyPairAlgorithmConfiguration.jwtAlgorithm'),
    keyPairAlgorithmField('androidConfig.tokenBoundConfiguration.keyPairAlgorithmConfiguration.jwtAlgorithm'),
    ...clientAuthenticationFields('androidConfig'),
    field('androidConfig.dcrConfiguration.contextOption', 'ApplicationContextOption', ApplicationContextOption),
];

/** @internal Every enumerated field of {@link RNLoggerConfiguration}. */
export const ENUMERATED_LOGGER_FIELDS: readonly EnumeratedField[] = [field('logLevel', 'RNLogLevel', RNLogLevel)];

// Only a supported value in the wrong letter case is echoed — the mistake this check exists for
// (`"hs256"`). Any other string may be a value pasted into the wrong field (a secret, a key, a
// passphrase), so it is described by its type.
function describeValue(value: unknown, entry: EnumeratedField): string {
    if (typeof value === 'string') {
        const lowerCase = value.toLowerCase();
        const isCaseVariant = entry.values.some(allowed => allowed.toLowerCase() === lowerCase);
        return isCaseVariant ? JSON.stringify(value) : 'a string';
    }
    return describeType(value);
}

function describeType(value: unknown): string {
    if (Array.isArray(value)) {
        return 'an array';
    }
    const type = typeof value;
    return (/^[aeiou]/.test(type) ? 'an ' : 'a ') + type;
}

function valueAt(source: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>(
        (current, key) =>
            current !== null && typeof current === 'object'
                ? (current as { [key: string]: unknown })[key]
                : undefined,
        source,
    );
}

function invalidConfiguration(description: string): HaapiError {
    return makeBridgeError({
        code: HaapiErrorCode.InvalidConfiguration,
        message: description,
        category: 'configuration',
        recovery: { kind: 'unrecoverable', action: { kind: 'modifyConfiguration', reason: description } },
    });
}

// Absent (`undefined` / `null`) fields are left to the native side, which owns required-field
// checks; only a present value outside its enum is rejected here.
function rejectUnsupportedValues(source: unknown, fields: readonly EnumeratedField[]): void {
    for (const entry of fields) {
        const value = valueAt(source, entry.path);
        if (value === undefined || value === null) {
            continue;
        }
        if (typeof value === 'string' && entry.values.indexOf(value) !== -1) {
            continue;
        }
        throw invalidConfiguration(`${entry.path}: ${describeValue(value, entry)} is not one of ${entry.values.join(', ')}.`);
    }
}

const ACCESS_GROUP_PATH = 'iosConfig.keychainConfiguration.accessGroup';

// The native SDK takes any string as the access group, so a blank one would reach the keychain and
// fail later with a storage error, or be mistaken for "no access group". An absent one keeps the
// app's default access group.
function rejectBlankAccessGroup(source: unknown): void {
    const value = valueAt(source, ACCESS_GROUP_PATH);
    if (value === undefined || value === null) {
        return;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        return;
    }
    const description = typeof value === 'string' ? 'a blank string' : describeType(value);
    throw invalidConfiguration(`${ACCESS_GROUP_PATH}: ${description} is not an access group.`);
}

/**
 * @internal
 *
 * Rejects a configuration holding an unsupported value in an enumerated field, or a blank or
 * non-string iOS keychain access group, before it reaches the bridge. Left to the bridge, such a
 * value fails native argument conversion with an untyped error whose code differs per platform, or
 * reaches the keychain; this throws the typed `HAAPI_INVALID_CONFIGURATION` instead, identically on
 * both.
 *
 * @throws HaapiError with code `HAAPI_INVALID_CONFIGURATION` and category `configuration`.
 */
export function validateConfiguration(configuration: RNHaapiConfiguration): void {
    rejectUnsupportedValues(configuration, ENUMERATED_CONFIGURATION_FIELDS);
    rejectBlankAccessGroup(configuration);
}

/**
 * @internal
 *
 * {@link validateConfiguration} for {@link RNLoggerConfiguration}.
 *
 * @throws HaapiError with code `HAAPI_INVALID_CONFIGURATION` and category `configuration`.
 */
export function validateLoggerConfiguration(configuration: RNLoggerConfiguration): void {
    rejectUnsupportedValues(configuration, ENUMERATED_LOGGER_FIELDS);
}
