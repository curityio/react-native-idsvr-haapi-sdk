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
package se.curity.identityserver.haapi.reactnative.sdk.internal

/**
 * The native SDK couldn't read the key an access token is bound to ([cause]). Raised by the OAuth bridge so
 * the normalizer reports the DPoP proof failure iOS reports for the same case, instead of the generic code
 * the native exception maps to. The message names no token, URL or nonce.
 */
internal class DpopProofLookupException(
    cause: Throwable,
) : IllegalStateException("The key the access token is bound to could not be read.", cause)

/**
 * The native SDK couldn't sign a DPoP proof with the access token's key ([cause]). Raised by the OAuth bridge
 * so the normalizer reports the proof-creation failure iOS reports. The message names no token, URL or nonce.
 */
internal class DpopProofCreationException(
    cause: Throwable,
) : IllegalStateException("The DPoP proof could not be signed.", cause)
