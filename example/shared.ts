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

import {
    AndroidConfiguration, createHaapiConfiguration,
    IOSConfiguration,
    OAuthAuthorizationParameters,
    RNHaapiConfiguration
} from "@curity/identityserver-haapi-react-native-sdk";

export const BASE_URL = "https://localhost:8443";

export const config = {
    baseUrl: BASE_URL,
    authorizationEndpointUrl: `${BASE_URL}/dev/oauth/authorize`,
    tokenEndpointUrl: `${BASE_URL}/dev/oauth/token`,
    revocationEndpointUrl: `${BASE_URL}/revoke`,
    dcrEndpointUrl: `${BASE_URL}/oauth-dev/oauth-registration`,
};

export function createAppHaapiConfiguration(
    iosConfig?: IOSConfiguration,
    androidConfig?: AndroidConfiguration,
    isAutoRedirect = true,
    minTokenTtl = 60,
    authorizationParameters?: OAuthAuthorizationParameters,
    httpHeaders?: Record<string, string>
): RNHaapiConfiguration {
    return createHaapiConfiguration({
        baseUrl: config.baseUrl,
        authorizationEndpointUrl: config.authorizationEndpointUrl,
        tokenEndpointUrl: config.tokenEndpointUrl,
        revocationEndpointUrl: config.revocationEndpointUrl,
        androidConfig: androidConfig,
        iosConfig: iosConfig,
        isAutoRedirect: isAutoRedirect,
        minTokenTtl: minTokenTtl,
        authorizationParameters: authorizationParameters,
        httpHeaders: httpHeaders
    })
}