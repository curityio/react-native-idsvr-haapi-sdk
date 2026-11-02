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

import {requireOptionalNativeModule} from 'expo';

/**
 * Both stores, by key name and fingerprint only — the probe never returns a stored value. The key
 * fields describe the key a refresh token is bound to in each store: native 5.7.0 records the
 * sign-in's key alias under the token's digest, and each store answers for the tokens it tracks.
 */
export interface MigrationState {
    /** The move switched the SDK to its default storage. */
    readonly moved: boolean;
    readonly existingStoreKeys: string[];
    readonly encryptedStoreKeys: string[];
    readonly encryptedStoreOpened: boolean;
    /** The session key alias the token is bound to, per store, or `null` where it isn't tracked. */
    readonly existingBoundAlias: string | null;
    readonly encryptedBoundAlias: string | null;
    readonly existingKeyFingerprint: string | null;
    readonly encryptedKeyFingerprint: string | null;
    readonly existingLocation: string | null;
    readonly encryptedLocation: string | null;
    /** The Keystore key the store in use binds the token to, by its public key — for a hardware DPoP key. */
    readonly hardwareKeyFingerprint: string | null;
}

/** What a resource server answered, reduced to what the DPoP scenarios assert on. */
export interface DpopResponse {
    readonly status: number;
    readonly wwwAuthenticate: string | null;
    readonly dpopNonce: string | null;
    readonly body: string;
}

/** The hooks every build of the example app has (Android and iOS). */
export interface HaapiE2eNative {
    /**
     * Sends one request with the DPoP headers over a connection that accepts a development server's
     * self-signed certificate — the DPoP scenarios' call to the server's userinfo endpoint.
     */
    dpopRequest(url: string, method: string, authorization: string, dpop: string): Promise<DpopResponse>;
}

/** The Android build's further hooks: the storage-migration probes and harness state across launches. */
export interface HaapiE2eAndroidNative extends HaapiE2eNative {
    /**
     * Replaces the DPoP key the refresh token is bound to, in the store in use, with a different
     * one, wherever it lives. Destructive.
     */
    replaceDpopKey(refreshToken: string): boolean;
    /**
     * Removes the Keystore entry under `alias`, if any, and answers whether there was one — so a DPoP proof
     * scenario starts from, and leaves, a known Keystore under its alias. Throws for an alias that doesn't
     * start with `dpop-proof-`: no scenario owns it.
     */
    deleteKeyStoreEntry(alias: string): boolean;
    /** Reports both stores; the key fields resolve through `refreshToken`, none without one. */
    migrationState(refreshToken: string | null): MigrationState;
    loadHarnessState(): string | null;
    saveHarnessState(json: string): void;
    clearHarnessState(): void;
}

/** The native hooks, or `null` where the module isn't built (node tests). */
export const haapiE2eNative: HaapiE2eNative | null = requireOptionalNativeModule<HaapiE2eNative>('HaapiE2e');
