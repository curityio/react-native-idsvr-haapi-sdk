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

import android.content.Context
import se.curity.identityserver.haapi.android.sdk.HaapiAccessor
import se.curity.identityserver.haapi.android.sdk.HaapiAccessorFactory
import se.curity.identityserver.haapi.android.sdk.OAuthAccessor
import se.curity.identityserver.haapi.reactnative.sdk.NativeRegistry
import se.curity.identityserver.haapi.reactnative.sdk.configurations.RNHaapiConfigurationRecord
import se.curity.identityserver.haapi.reactnative.sdk.toDcrConfiguration
import se.curity.identityserver.haapi.reactnative.sdk.toHaapiConfiguration
import kotlin.coroutines.CoroutineContext

/**
 * Test seam over [HaapiAccessorFactory]'s create entry points.
 *
 * The native [HaapiAccessorFactory] is `final` and constructs real crypto
 * material when its `createFor*` methods are invoked, which makes it
 * unsuitable for module-level integration tests. The Expo module depends
 * on this interface instead, and production wiring uses
 * [DefaultHaapiAccessorFactoryProvider]. Tests provide a stub returning a
 * prepared fake accessor (typically a MockK [HaapiAccessor] / [OAuthAccessor]).
 *
 * The provider receives the [Context] and (for HAAPI mode) the
 * [CoroutineContext] from the module rather than touching `appContext`
 * itself, so unit tests can run without a live Expo runtime.
 */
internal interface HaapiAccessorFactoryProvider {
    suspend fun createForHaapi(
        configuration: RNHaapiConfigurationRecord,
        applicationContext: Context,
        coroutineContext: CoroutineContext,
    ): HaapiAccessor

    fun createForOAuth(
        configuration: RNHaapiConfigurationRecord,
        applicationContext: Context,
    ): OAuthAccessor
}

/**
 * Production [HaapiAccessorFactoryProvider] that translates the bridge
 * [RNHaapiConfigurationRecord] into a native [HaapiConfiguration],
 * applies the Android-specific configuration steps (client-auth +
 * DCR — both live on the factory, not the configuration object,
 * per Appendix B), and delegates to
 * [HaapiAccessorFactory.createForHaapi] / [HaapiAccessorFactory.createForOAuth].
 *
 * Both factory paths run the same configuration wiring (HSRN-8 § 11.5
 * decision A) so OAuth-only sessions inherit client-auth / DCR settings
 * the host app already declared.
 */
internal class DefaultHaapiAccessorFactoryProvider : HaapiAccessorFactoryProvider {
    override suspend fun createForHaapi(
        configuration: RNHaapiConfigurationRecord,
        applicationContext: Context,
        coroutineContext: CoroutineContext,
    ): HaapiAccessor =
        makeFactory(configuration, applicationContext)
            .createForHaapi(onCoroutineContext = coroutineContext)

    override fun createForOAuth(
        configuration: RNHaapiConfigurationRecord,
        applicationContext: Context,
    ): OAuthAccessor = makeFactory(configuration, applicationContext).createForOAuth()

    private fun makeFactory(
        configuration: RNHaapiConfigurationRecord,
        applicationContext: Context,
    ): HaapiAccessorFactory {
        val haapiConfiguration = configuration.toHaapiConfiguration(applicationContext)
        val androidConfig = configuration.androidConfig
        val factory = HaapiAccessorFactory(haapiConfiguration = haapiConfiguration)
        factory.setClientAuthenticationMethodConfiguration(
            androidConfig.resolvedClientAuthenticationMethodConfiguration,
        )
        androidConfig.dcrConfiguration?.let {
            val dcrConfiguration = it.toDcrConfiguration(NativeRegistry.shared)
            factory.setDcrConfiguration(dcrConfiguration)
        }
        return factory
    }
}
