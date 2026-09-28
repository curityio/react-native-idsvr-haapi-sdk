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
package se.curity.identityserver.haapi.reactnative.sdk

import android.content.Context
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import se.curity.identityserver.haapi.android.driver.HaapiLogger
import se.curity.identityserver.haapi.android.driver.IdsvrHaapiException
import se.curity.identityserver.haapi.android.driver.KeyPairAlgorithmConfig
import se.curity.identityserver.haapi.android.driver.TokenBoundConfiguration
import se.curity.identityserver.haapi.android.driver.internal.HttpClient
import se.curity.identityserver.haapi.android.sdk.DcrConfiguration
import se.curity.identityserver.haapi.android.sdk.HaapiAccessor
import se.curity.identityserver.haapi.android.sdk.HaapiConfiguration
import se.curity.identityserver.haapi.android.sdk.OAuthAccessor
import se.curity.identityserver.haapi.reactnative.sdk.configurations.AndroidDcrConfigurationRecord
import se.curity.identityserver.haapi.reactnative.sdk.configurations.AndroidTokenBoundConfigurationRecord
import se.curity.identityserver.haapi.reactnative.sdk.configurations.HttpUrlConnectionProviderOption
import se.curity.identityserver.haapi.reactnative.sdk.configurations.RNHaapiConfigurationRecord
import se.curity.identityserver.haapi.reactnative.sdk.internal.ApplicationContextResolver
import se.curity.identityserver.haapi.reactnative.sdk.internal.DefaultHaapiAccessorFactoryProvider
import se.curity.identityserver.haapi.reactnative.sdk.internal.DefaultHaapiFlowInvoker
import se.curity.identityserver.haapi.reactnative.sdk.internal.DefaultOAuthTokenInvoker
import se.curity.identityserver.haapi.reactnative.sdk.internal.HaapiAccessorBridgeException
import se.curity.identityserver.haapi.reactnative.sdk.internal.HaapiAccessorFactoryProvider
import se.curity.identityserver.haapi.reactnative.sdk.internal.HaapiAccessorStore
import se.curity.identityserver.haapi.reactnative.sdk.internal.HaapiErrorNormalizer
import se.curity.identityserver.haapi.reactnative.sdk.internal.RNHaapiManagerBridge
import se.curity.identityserver.haapi.reactnative.sdk.internal.RNOAuthTokenManagerBridge
import se.curity.identityserver.haapi.reactnative.sdk.internal.StorageResolver
import se.curity.identityserver.haapi.reactnative.sdk.logging.RNLogSink
import se.curity.identityserver.haapi.reactnative.sdk.logging.RNLoggerConfigurationRecord
import se.curity.identityserver.haapi.reactnative.sdk.logging.RNModuleLogger
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNFormActionModelRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNHaapiResponseRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNLinkRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNTokenResponseRecord
import java.net.URI
import java.time.Duration
import kotlin.coroutines.CoroutineContext
import se.curity.identityserver.haapi.android.sdk.OAuthAuthorizationParameters as NativeOAuthAuthorizationParameters

/**
 * Expo Module that bridges the Curity HAAPI SDK to React Native on Android.
 *
 * Exposes `initializeForHaapi(config)` and `initializeForOAuth(config)`
 * async functions that build the matching native accessor and stash it on
 * [HaapiAccessorStore.shared]. After initialization, JS dispatches flow
 * operations through [RNHaapiManagerBridge] and OAuth token operations
 * through [RNOAuthTokenManagerBridge]. `close()` clears the store and
 * drops both bridges, preserving the strict re-init semantics from § 7
 * of HSRN-8.
 */
class IdsvrHaapiReactNativeSdkModule : Module() {
    /** Builder seam — production wires [DefaultHaapiAccessorFactoryProvider]; tests override with a stub. */
    internal var factoryProvider: HaapiAccessorFactoryProvider = DefaultHaapiAccessorFactoryProvider()

    /** Accessor store seam — defaults to the process-wide singleton. Tests override for isolation. */
    internal var accessorStore: HaapiAccessorStore = HaapiAccessorStore.shared

    /** Application context source — defaults to `appContext.reactContext.applicationContext`. Tests override. */
    internal var applicationContextProvider: () -> Context = {
        requireNotNull(appContext.reactContext?.applicationContext) {
            "Application context is not available"
        }
    }

    /** Coroutine context source — defaults to `appContext.backgroundCoroutineScope.coroutineContext`. Tests override. */
    internal var coroutineContextProvider: () -> CoroutineContext = {
        appContext.backgroundCoroutineScope.coroutineContext
    }

    /**
     * Per-mode bridges. `haapiManagerBridge` is non-null only after
     * `initializeForHaapi`; `oauthTokenManagerBridge` is non-null after
     * either factory entry point. Both nulled in `close`.
     */
    internal var haapiManagerBridge: RNHaapiManagerBridge? = null
    internal var oauthTokenManagerBridge: RNOAuthTokenManagerBridge? = null

    /**
     * Structured logger that sends events to JavaScript via `onLog`.
     * Internal `var` so module-level integration tests can substitute a
     * mock — the production logger reaches into `appContext`, which is
     * uninitialized when tests construct the module without a live
     * Expo runtime.
     */
    internal var log: RNModuleLogger = RNModuleLogger(this)

    override fun definition() =
        ModuleDefinition {
            Name("IdsvrHaapiReactNativeSdk")

            Events("onLog")

            OnCreate {
                installNativeLogBridge()
                log.info("The JS context is created/reloaded.")
            }

            OnDestroy {
                log.info("The JS context is torn down.")
                // Unbind the active module from the shared sink before tearing
                // down, so a stray native log emitted between OnDestroy and the
                // next OnCreate isn't routed at a dead module. The sink itself
                // stays installed on the process-wide HaapiLogger.
                RNLogSink.shared.detach()
                handleClose()
            }

            AsyncFunction("initializeForHaapi") Coroutine { config: RNHaapiConfigurationRecord ->
                handleInitializeForHaapi(config)
            }

            AsyncFunction("initializeForOAuth") Coroutine { config: RNHaapiConfigurationRecord ->
                handleInitializeForOAuth(config)
            }

            AsyncFunction("start") Coroutine (::handleStart)

            AsyncFunction("submitForm") Coroutine
                { formModel: RNFormActionModelRecord, parameters: Map<String, Any> ->
                    handleSubmitForm(formModel, parameters)
                }

            AsyncFunction("followLink") Coroutine { linkRecord: RNLinkRecord ->
                handleFollowLink(linkRecord)
            }

            AsyncFunction("oauthFetchAccessToken") Coroutine
                { authorizationCode: String, additionalParameters: Map<String, String>? ->
                    handleOAuthFetchAccessToken(authorizationCode, additionalParameters)
                }

            AsyncFunction("oauthRefreshAccessToken") Coroutine
                { refreshToken: String, additionalParameters: Map<String, String>? ->
                    handleOAuthRefreshAccessToken(refreshToken, additionalParameters)
                }

            AsyncFunction("oauthRevokeAccessToken") Coroutine { token: String ->
                handleOAuthRevokeAccessToken(token)
            }

            AsyncFunction("oauthRevokeRefreshToken") Coroutine { token: String ->
                handleOAuthRevokeRefreshToken(token)
            }

            Function("close") {
                log.info("close")
                handleClose()
            }

            AsyncFunction("configureLogger") { configuration: RNLoggerConfigurationRecord ->
                handleConfigureLogger(configuration)
            }
        }

    // region Handlers (internal for testing)

    /**
     * Builds a [HaapiAccessor] and wires both bridges. Throws
     * [HaapiAccessorBridgeException] with code
     * `HAAPI_ACCESSOR_ALREADY_INITIALIZED` if the store is non-empty.
     *
     * Resolver registration on [NativeRegistry.shared] is preserved from
     * the pre-HSRN-8 behavior — the registry is a process-wide singleton,
     * so subsequent inits add resolvers in front of the previous ones.
     *
     * Reserve before building (HSRN-42): the reverse order let the native SDK's
     * duplicate detection answer first whenever the re-init reused the client
     * id, making the documented code unreachable and performing a full accessor
     * build (DCR registration, attestation) only to tear it down.
     */
    internal suspend fun handleInitializeForHaapi(config: RNHaapiConfigurationRecord) {
        HaapiErrorNormalizer.normalizeThrown {
            log.debug("initializeForHaapi called with config: $config")
            val applicationContext = applicationContextProvider()
            val coroutineCtx = coroutineContextProvider()
            try {
                accessorStore.reserve()
            } catch (e: Exception) {
                logInitializeForHaapiFailure(e)
                throw e
            }
            val accessor =
                try {
                    registerDefaultResolvers(applicationContext)
                    factoryProvider.createForHaapi(config, applicationContext, coroutineCtx)
                } catch (e: Exception) {
                    accessorStore.cancelReservation()
                    logInitializeForHaapiFailure(e)
                    throw e
                }
            try {
                storeSetHaapi(accessor)
            } catch (e: Exception) {
                // Reachable only via an interleaved close(): reserve() excludes
                // a rival, but clear() frees the reservation, so `init`
                // (building) -> close() -> `init` lets a newcomer commit first.
                // The accessor exists by now, so close it rather than leak it.
                // runCatching: the originating error is what matters.
                runCatching { accessor.haapiManager.close() }
                logInitializeForHaapiFailure(e)
                throw e
            }
            haapiManagerBridge =
                RNHaapiManagerBridge(
                    invoker = DefaultHaapiFlowInvoker(accessor.haapiManager, coroutineCtx),
                )
            oauthTokenManagerBridge =
                RNOAuthTokenManagerBridge(
                    invoker = DefaultOAuthTokenInvoker(accessor.oAuthTokenManager, coroutineCtx),
                )
            log.info("HaapiAccessor created (HAAPI mode)")
        }
    }

    /**
     * Builds an [OAuthAccessor] and wires only the OAuth bridge. Throws
     * [HaapiAccessorBridgeException] with code
     * `HAAPI_ACCESSOR_ALREADY_INITIALIZED` if the store is non-empty.
     *
     * Reserve before building — see [handleInitializeForHaapi] (HSRN-42).
     *
     * On store rejection there is no native [se.curity.identityserver.haapi.android.sdk.HaapiManager]
     * to tear down (the OAuth-only path doesn't construct one) — the
     * just-built [OAuthAccessor] is simply dropped so it can be collected.
     */
    internal suspend fun handleInitializeForOAuth(config: RNHaapiConfigurationRecord) {
        HaapiErrorNormalizer.normalizeThrown {
            log.debug("initializeForOAuth called with config: $config")
            val applicationContext = applicationContextProvider()
            val coroutineCtx = coroutineContextProvider()
            try {
                accessorStore.reserve()
            } catch (e: Exception) {
                log.error("Failed to initializeForOAuth: $e")
                throw e
            }
            val accessor =
                try {
                    registerDefaultResolvers(applicationContext)
                    factoryProvider.createForOAuth(config, applicationContext)
                } catch (e: Exception) {
                    accessorStore.cancelReservation()
                    log.error("Failed to initializeForOAuth: $e")
                    throw e
                }
            try {
                storeSetOAuth(accessor)
            } catch (e: Exception) {
                log.error("Failed to initializeForOAuth: $e")
                throw e
            }
            oauthTokenManagerBridge =
                RNOAuthTokenManagerBridge(
                    invoker = DefaultOAuthTokenInvoker(accessor.oAuthTokenManager, coroutineCtx),
                )
            log.info("OAuthAccessor created (OAuth-only mode)")
        }
    }

    /**
     * Formats and logs an `initializeForHaapi` failure, surfacing the
     * structured fields of an [IdsvrHaapiException] when present.
     * Used by both the build-side and the store-side catch paths so the
     * log line shape stays consistent regardless of where the error came
     * from.
     */
    private fun logInitializeForHaapiFailure(e: Exception) {
        val maybeIdsvr = e as? IdsvrHaapiException
        if (maybeIdsvr != null) {
            log.error(
                "Failed to initializeForHaapi: {message: ${maybeIdsvr.message}, " +
                    "error: ${maybeIdsvr.error}, errorDescription: ${maybeIdsvr.errorDescription}}",
            )
        } else {
            log.error("Failed to initializeForHaapi: $e")
        }
    }

    internal suspend fun handleStart(): RNHaapiResponseRecord =
        HaapiErrorNormalizer.normalizeThrown {
            val bridge = requireHaapiManagerBridge()
            log.info("start")
            bridge.start()
        }

    internal suspend fun handleSubmitForm(
        formModel: RNFormActionModelRecord,
        parameters: Map<String, Any>,
    ): RNHaapiResponseRecord =
        HaapiErrorNormalizer.normalizeThrown {
            val bridge = requireHaapiManagerBridge()
            log.info("submitForm")
            bridge.submitForm(formModel, parameters)
        }

    internal suspend fun handleFollowLink(linkRecord: RNLinkRecord): RNHaapiResponseRecord =
        HaapiErrorNormalizer.normalizeThrown {
            val bridge = requireHaapiManagerBridge()
            log.info("followLink")
            bridge.followLink(linkRecord)
        }

    internal suspend fun handleOAuthFetchAccessToken(
        authorizationCode: String,
        additionalParameters: Map<String, String>?,
    ): RNTokenResponseRecord =
        HaapiErrorNormalizer.normalizeThrown {
            val bridge = requireOAuthBridge()
            log.info("oauthFetchAccessToken")
            bridge.fetchAccessToken(authorizationCode, additionalParameters)
        }

    internal suspend fun handleOAuthRefreshAccessToken(
        refreshToken: String,
        additionalParameters: Map<String, String>?,
    ): RNTokenResponseRecord =
        HaapiErrorNormalizer.normalizeThrown {
            val bridge = requireOAuthBridge()
            log.info("oauthRefreshAccessToken")
            bridge.refreshAccessToken(refreshToken, additionalParameters)
        }

    internal suspend fun handleOAuthRevokeAccessToken(token: String) {
        HaapiErrorNormalizer.normalizeThrown {
            val bridge = requireOAuthBridge()
            log.info("oauthRevokeAccessToken")
            bridge.revokeAccessToken(token)
        }
    }

    internal suspend fun handleOAuthRevokeRefreshToken(token: String) {
        HaapiErrorNormalizer.normalizeThrown {
            val bridge = requireOAuthBridge()
            log.info("oauthRevokeRefreshToken")
            bridge.revokeRefreshToken(token)
        }
    }

    /**
     * Applies the host's logger configuration to the native [HaapiLogger].
     *
     * Re-asserts [HaapiLogger.enabled] for the same reason
     * [installNativeLogBridge] sets it: the flag is a process-wide global
     * shared with everything using the HAAPI driver, and `RNLogLevel` has no
     * "off" value — so whenever the host (re)configures logging the intended
     * state is "logs flow at the chosen level". Opening the valve here keeps
     * `configureLogger` self-sufficient: if anything else in the process had
     * flipped `enabled` off, the host's only logging-control entry point still
     * restores native log delivery instead of silently doing nothing. (HSRN-34)
     */
    internal fun handleConfigureLogger(configuration: RNLoggerConfigurationRecord) {
        HaapiLogger.enabled = true
        HaapiLogger.setLevel(configuration.logLevel.toHaapiLogLevel())
        HaapiLogger.isSensitiveValueMasked = configuration.isSensitiveValueMasked
    }

    internal fun handleClose() {
        // Drop the flow-lifetime cache (form-action models + links) before
        // releasing the bridge reference. The bridge is unreachable after
        // we null the field, so the cache would be GC'd anyway — but the
        // explicit teardown keeps memory pressure off the next flow init
        // (which can land before the GC has visited the prior bridge).
        haapiManagerBridge?.clearCaches()
        accessorStore.clear()
        haapiManagerBridge = null
        oauthTokenManagerBridge = null
    }

    // endregion

    // region Private helpers

    /**
     * Wires the native [HaapiLogger] into the JS log bridge so native SDK
     * log statements reach the `onLog` event.
     *
     * The valve must be opened explicitly: the HAAPI driver ships as a
     * release AAR, so [HaapiLogger.enabled] defaults to `false` (it tracks
     * `BuildConfig.DEBUG`). While it stays closed, `HaapiLogger.shouldLog(...)`
     * returns `false` for every level and the [RNLogSink] appended here
     * never receives an event — the bridge would wire up the whole JS log
     * path and then silently drop every native SDK log. Setting
     * [HaapiLogger.enabled] makes the configured level (default
     * [HaapiLogger.LogLevel.ERROR], adjustable via `configureLogger`) the
     * single gate on what flows to JS. (HSRN-34)
     *
     * The module's own [log] messages bypass [HaapiLogger] entirely (they
     * call `sendEvent` directly), so they are unaffected by this flag.
     *
     * `OnCreate` runs on every JS-context reload, so this binds the current
     * module to the process-wide [RNLogSink.shared] via [RNLogSink.attach]
     * and installs that single sink on [HaapiLogger] exactly once (see
     * [installSharedLogSinkIfNeeded]). Appending a fresh sink per reload would
     * grow the global logger's sink list unbounded — [HaapiLogger] exposes no
     * public `removeLogSink` — and pin every dead module instance.
     */
    internal fun installNativeLogBridge() {
        HaapiLogger.enabled = true
        HaapiLogger.setLevel(HaapiLogger.LogLevel.ERROR)
        HaapiLogger.isSensitiveValueMasked = true
        RNLogSink.shared.attach(this@IdsvrHaapiReactNativeSdkModule)
        installSharedLogSinkIfNeeded()
    }

    /**
     * Appends [RNLogSink.shared] to the process-wide [HaapiLogger] exactly
     * once. Guarded because `OnCreate` fires on every JS-context reload but
     * the sink must be installed a single time; later reloads only rebind the
     * active module through [RNLogSink.attach]. (HSRN-34)
     */
    private fun installSharedLogSinkIfNeeded() {
        synchronized(sharedLogSinkLock) {
            if (!sharedLogSinkInstalled) {
                HaapiLogger.appendLogSink(RNLogSink.shared)
                sharedLogSinkInstalled = true
            }
        }
    }

    /**
     * Registers the SDK's default `ApplicationContextResolver` and
     * `StorageResolver` on the process-wide [NativeRegistry], replacing any
     * previously-added instance of the same class so re-init doesn't grow
     * the list with duplicates.
     *
     * Host-app resolvers added via `NativeRegistry.shared.addResolver(...)`
     * before the first init are a different concrete class and continue to
     * take priority (the registry walks resolvers front-to-back, and
     * `replaceResolver` only replaces same-class entries).
     */
    private fun registerDefaultResolvers(context: Context) {
        NativeRegistry.shared.replaceResolver(ApplicationContextResolver(context))
        NativeRegistry.shared.replaceResolver(StorageResolver(context))
    }

    private fun storeSetHaapi(accessor: HaapiAccessor) {
        try {
            accessorStore.setHaapi(accessor)
        } catch (e: HaapiAccessorStore.StoreException) {
            throw HaapiAccessorBridgeException(e)
        }
    }

    private fun storeSetOAuth(accessor: OAuthAccessor) {
        try {
            accessorStore.setOAuth(accessor)
        } catch (e: HaapiAccessorStore.StoreException) {
            throw HaapiAccessorBridgeException(e)
        }
    }

    private fun requireHaapiManagerBridge(): RNHaapiManagerBridge {
        try {
            accessorStore.requireHaapi()
        } catch (e: HaapiAccessorStore.StoreException) {
            throw HaapiAccessorBridgeException(e)
        }
        return haapiManagerBridge ?: throw HaapiAccessorBridgeException(
            HaapiAccessorStore.ERROR_NOT_INITIALIZED,
            "Bridge invariant: store has HaapiAccessor but haapiManagerBridge is null.",
        )
    }

    private fun requireOAuthBridge(): RNOAuthTokenManagerBridge {
        try {
            accessorStore.requireOAuth()
        } catch (e: HaapiAccessorStore.StoreException) {
            throw HaapiAccessorBridgeException(e)
        }
        return oauthTokenManagerBridge ?: throw HaapiAccessorBridgeException(
            HaapiAccessorStore.ERROR_NOT_INITIALIZED,
            "Bridge invariant: store has accessor but oauthTokenManagerBridge is null.",
        )
    }

    // endregion

    private companion object {
        /**
         * Process-wide guard ensuring [RNLogSink.shared] is appended to
         * [HaapiLogger] only once across JS-context reloads. A `companion`
         * (not an instance field) because each reload constructs a fresh
         * module instance but the global logger persists for the process.
         */
        private var sharedLogSinkInstalled = false
        private val sharedLogSinkLock = Any()
    }
}

/**
 * Creates a native [HaapiConfiguration] from the JavaScript configuration record.
 *
 * This mirrors the iOS `HaapiConfiguration(record:)` convenience init.
 * Called from [DefaultHaapiAccessorFactoryProvider.makeFactory] when the
 * production builder builds the accessor.
 */
internal fun RNHaapiConfigurationRecord.toHaapiConfiguration(context: Context): HaapiConfiguration {
    val androidConfig = this.androidConfig
    val httpHeaders = this.httpHeaders ?: emptyMap()
    val authParams = this.authorizationParameters
    val oauthParams =
        NativeOAuthAuthorizationParameters(
            scope = authParams?.scope ?: emptyList(),
            nonce = authParams?.nonce,
            acrValues = authParams?.acrValues ?: emptyList(),
            extraRequestParameters = authParams?.extraRequestParameters ?: emptyMap(),
        )
    val baseUri = URI(this.baseUrl)
    val tokenEndpointUri = URI(this.tokenEndpointUrl)
    val authorizationEndpointUri = URI(this.authorizationEndpointUrl)
    val revocationEndpointUri = this.revocationEndpointUrl?.let { URI(it) }
    val minTokenTtl = Duration.ofSeconds(this.minTokenTtl.toLong())
    val currentTimeMillisProvider =
        requireNotNull(
            NativeRegistry.shared.currentTimeMillisProvider(androidConfig.currentTimeMillisProviderOption.value),
        ) {
            "No CurrentTimeMillisProvider resolver registered for " +
                "'${androidConfig.currentTimeMillisProviderOption.value}'"
        }.provider
    val tokenBoundConfiguration =
        androidConfig
            .tokenBoundConfiguration
            .toTokenBoundConfiguration(currentTimeMillisProvider)
    val riskAssessmentContext = context.takeIf { androidConfig.useRiskAssessmentConfiguration }

    if (androidConfig.httpUrlConnectionProviderOption == HttpUrlConnectionProviderOption.DEFAULT) {
        return HaapiConfiguration(
            keyStoreAlias = androidConfig.keyStoreAlias,
            clientId = androidConfig.clientId,
            baseUri = baseUri,
            tokenEndpointUri = tokenEndpointUri,
            authorizationEndpointUri = authorizationEndpointUri,
            authorizationParametersProvider = { oauthParams },
            httpHeadersProvider = { httpHeaders },
            appRedirect = androidConfig.appRedirect,
            isAutoRedirect = this.isAutoRedirect,
            minTokenTtl = minTokenTtl,
            currentTimeMillisProvider = currentTimeMillisProvider,
            revocationEndpointUri = revocationEndpointUri,
            useAttestation = androidConfig.attestationConfiguration.useAttestation,
            tokenBoundConfiguration = tokenBoundConfiguration,
            dPoPNonceStack = HttpClient.DPoPNonceStack(),
            tokenEndpointResponseListener = null,
            applicationContext = riskAssessmentContext,
        )
    } else {
        val httpURLConnectionProvider =
            requireNotNull(
                NativeRegistry.shared.httpURLConnectionProvider(androidConfig.httpUrlConnectionProviderOption.value),
            ) { "No httpUrlConnectionProvider registered for '${androidConfig.httpUrlConnectionProviderOption.value}'" }
        return HaapiConfiguration(
            keyStoreAlias = androidConfig.keyStoreAlias,
            clientId = androidConfig.clientId,
            baseUri = baseUri,
            tokenEndpointUri = tokenEndpointUri,
            authorizationEndpointUri = authorizationEndpointUri,
            authorizationParametersProvider = { oauthParams },
            httpHeadersProvider = { httpHeaders },
            appRedirect = androidConfig.appRedirect,
            isAutoRedirect = this.isAutoRedirect,
            httpUrlConnectionProvider = httpURLConnectionProvider.provider,
            minTokenTtl = minTokenTtl,
            currentTimeMillisProvider = currentTimeMillisProvider,
            revocationEndpointUri = revocationEndpointUri,
            useAttestation = androidConfig.attestationConfiguration.useAttestation,
            tokenBoundConfiguration = tokenBoundConfiguration,
            dPoPNonceStack = HttpClient.DPoPNonceStack(),
            tokenEndpointResponseListener = null,
            applicationContext = context,
        )
    }
}

/**
 * Converts an [AndroidTokenBoundConfigurationRecord] to the native SDK
 * [TokenBoundConfiguration].
 *
 * @param currentTimeMillisProvider The time provider resolved from
 *   [AndroidConfigurationRecord.currentTimeMillisProviderOption].
 */
internal fun AndroidTokenBoundConfigurationRecord.toTokenBoundConfiguration(
    currentTimeMillisProvider: () -> Long,
): TokenBoundConfiguration {
    val algorithmConfig =
        KeyPairAlgorithmConfig.valueOf(
            this.keyPairAlgorithmConfiguration.jwtAlgorithm,
        )
    val rnStorage =
        requireNotNull(
            NativeRegistry.shared.storage(storageOption.value),
        ) { "No Storage resolver registered for '${this.storageOption.value}'" }

    return TokenBoundConfiguration(
        keyAlias = this.keyAlias,
        keyPairAlgorithmConfig = algorithmConfig,
        storage = rnStorage.toStorage(),
        currentTimeMillisProvider = currentTimeMillisProvider,
    )
}

/**
 * Converts this bridge record to a native [DcrConfiguration].
 *
 * Resolves the Android application context via [NativeRegistry] using the [contextOption] key.
 *
 * @throws IllegalArgumentException if no context resolver is registered for the key.
 */
internal fun AndroidDcrConfigurationRecord.toDcrConfiguration(nativeRegistry: NativeRegistry): DcrConfiguration {
    val context = nativeRegistry.applicationContext(this.contextOption.value)
    return context?.let {
        DcrConfiguration(
            templateClientId = this.templateClientId,
            clientRegistrationEndpointUri = URI(clientRegistrationEndpointUrl),
            context = context,
        )
    } ?: throw IllegalArgumentException(
        "Cannot resolve ${contextOption.value}, the context has to be registered for this key.",
    )
}
