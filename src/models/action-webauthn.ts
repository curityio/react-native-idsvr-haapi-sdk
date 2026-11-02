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

// ─── WebAuthn Registration Models ───────────────────────────────────────────

/**
 * A credential parameter for WebAuthn registration.
 */
export interface CredentialParameter {
    /** Credential type (typically "public-key"). */
    readonly type: string;
    /** COSE algorithm identifier (e.g., -7 for ES256). */
    readonly alg: number;
}

/**
 * Authenticator selection criteria for WebAuthn registration.
 */
export interface AuthenticatorSelection {
    readonly authenticatorAttachment?: string;
    readonly residentKey?: string;
    readonly userVerification?: string;
}

/**
 * A credential descriptor for WebAuthn (used in excludedCredentials / allowCredentials).
 */
export interface WebAuthnCredential {
    /** Credential type (typically "public-key"). */
    readonly type: string;
    /** Base64url-encoded credential ID. */
    readonly id: string;
    /** Allowed transports (e.g., "usb", "nfc", "ble", "internal"). */
    readonly transports?: string[];
}

/**
 * Public key options for WebAuthn registration.
 */
export interface WebAuthnRegistrationPublicKey {
    readonly relyingPartyId: string;
    readonly relyingPartyName: string;
    readonly userName: string;
    readonly userDisplayName: string;
    readonly userId: string;
    readonly challenge: string;
    readonly credentialParameters: CredentialParameter[];
    readonly excludedCredentials: WebAuthnCredential[];
    readonly authenticatorSelection?: AuthenticatorSelection;
    readonly attestation?: string;
    readonly attachment?: string;
    readonly contextFieldName: string;
}

/**
 * Public key options for WebAuthn authentication.
 */
export interface WebAuthnAuthenticationPublicKey {
    readonly challenge: string;
    readonly relyingPartyId: string;
    readonly allowCredentials: WebAuthnCredential[];
    readonly userVerification?: string;
    readonly platformCredentials: WebAuthnCredential[];
    readonly crossPlatformCredentials: WebAuthnCredential[];
}
