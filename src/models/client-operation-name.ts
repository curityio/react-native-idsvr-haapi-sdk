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
 * Identifies the type of a client operation action.
 *
 * @remarks
 * Each value corresponds to a specific external operation the client must
 * perform (e.g., launching a browser, activating BankID, performing WebAuthn).
 */
export enum ClientOperationName {
    ExternalBrowser = "external-browser-flow",
    BankId = "bankid",
    EncapAutoActivation = "encap-auto-activation",
    WebAuthnRegistration = "webauthn-registration",
    WebAuthnAuthentication = "webauthn-authentication",
    Generic = "generic",
}
