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

/**
 * Discriminator for a token-binding configuration.
 *
 * Every token-binding value states its mode explicitly, so "no binding" and
 * "binding" can never be confused on either platform.
 */
export enum TokenBindingKind {
    /** No token binding: tokens are not bound to a device key. */
    Unbound = 'unbound',
    /** Token binding (DPoP): the authorization code and refresh token are bound to a device key. */
    Bound = 'bound',
}

/**
 * Token-binding configuration that turns token binding off.
 *
 * This is the default on both platforms. Shared by
 * `IOSTokenBindingConfiguration` and `AndroidTokenBindingConfiguration`.
 */
export interface NoTokenBinding {
    readonly kind: TokenBindingKind.Unbound;
}

/**
 * Creates a token-binding configuration with no token binding — the default when
 * `tokenBindingConfiguration` is omitted, on both platforms.
 *
 * Use `iOSTokenBinding()` / `AndroidTokenBinding()` instead when your
 * client issues token-bound authorization codes (`issue-token-bound-authorization-code`).
 */
export function noTokenBinding(): NoTokenBinding {
    return { kind: TokenBindingKind.Unbound };
}
