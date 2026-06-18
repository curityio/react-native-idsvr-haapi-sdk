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

/**
 * Dynamic Client Registration configuration.
 *
 * Base interface shared by iOS ({@link IOSDcrConfiguration}) and
 * Android ({@link AndroidDcrConfiguration}). DCR is handled outside the
 * core `HaapiConfiguration` on both native SDKs.
 */
export interface DcrConfiguration {
    /**
     * A template client ID used as a base when registering a new dynamic client.
     */
    readonly templateClientId: string;
    /**
     * DCR endpoint URL.
     *
     * @example "https://login.example.com/oauth/oauth-client-registration"
     */
    readonly clientRegistrationEndpointUrl: string;
}

/**
 * iOS attestation configuration (DeviceCheck / App Attest).
 *
 * Maps to `AttestationConfiguration` in the native iOS HAAPI SDK.
 * For Android, use {@link AndroidAttestationConfiguration} (only `useAttestation`).
 */
export interface IOSAttestationConfiguration {
    /** Whether attestation is enabled. */
    readonly useAttestation: boolean;
    /**
     * Maximum number of retries for attestation operations.
     *
     * @remarks
     * Must be >= 0. Maps to `AttestationConfiguration.attestationMaxRetries` on iOS.
     */
    readonly attestationMaxRetries: number;
}