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
public import ExpoModulesCore
import IdsvrHaapiSdk

/// Expo Module that bridges the Curity HAAPI SDK to React Native on iOS.
///
/// Exposes `initializeForHaapi(config)` and `initializeForOAuth(config)` async
/// functions to JavaScript that build the matching native accessor and stash
/// it on ``HaapiAccessorStore/shared``. After initialization, JS dispatches
/// flow operations through ``RNHaapiManagerBridge`` and OAuth token operations
/// through ``RNOAuthTokenManagerBridge``. `close()` clears the store and
/// drops both bridges, preserving the strict re-init semantics from § 7
/// of HSRN-8.
public class IdsvrHaapiReactNativeSdkModule: Module, @unchecked Sendable {
    /// Lock guarding every mutable instance property below.
    ///
    /// Expo hands the module to JavaScript as a `Sendable` value and may
    /// invoke its `AsyncFunction`s from arbitrary executor threads — the SDK
    /// is explicitly meant to be driven off the main thread, so the module is
    /// **not** actor-isolated. Instead, all access to the mutable state below
    /// is serialized through `stateLock`; maintaining that discipline is what
    /// makes the `@unchecked Sendable` conformance sound. The lock is never
    /// held across an `await` — callers read/swap state in a short critical
    /// section, then suspend.
    private let stateLock = NSLock()

    private func withStateLock<T>(_ body: () -> T) -> T {
        stateLock.lock()
        defer { stateLock.unlock() }
        return body()
    }

    private var _builderProvider: HaapiAccessorBuilderProvider = DefaultHaapiAccessorBuilderProvider()
    private var _accessorStore: HaapiAccessorStore = HaapiAccessorStore.shared
    private var _haapiManagerBridge: RNHaapiManagerBridge?
    private var _oauthTokenManagerBridge: RNOAuthTokenManagerBridge?

    /// Builder seam — production wires ``DefaultHaapiAccessorBuilderProvider``;
    /// tests override with a stub returning a fake accessor.
    internal var builderProvider: HaapiAccessorBuilderProvider {
        get { withStateLock { _builderProvider } }
        set { withStateLock { _builderProvider = newValue } }
    }

    /// Accessor store seam — defaults to the process-wide singleton.
    /// Tests override with their own instance for isolation.
    internal var accessorStore: HaapiAccessorStore {
        get { withStateLock { _accessorStore } }
        set { withStateLock { _accessorStore = newValue } }
    }

    /// Per-mode bridges. `haapiManagerBridge` is non-nil only after
    /// `initializeForHaapi`; `oauthTokenManagerBridge` is non-nil after
    /// either factory entry point. Both nilled in `close`. A flow/token op
    /// that races a concurrent `close()` observes either the live bridge or
    /// `nil` (→ `notInitialized`) — never a torn value.
    internal var haapiManagerBridge: RNHaapiManagerBridge? {
        get { withStateLock { _haapiManagerBridge } }
        set { withStateLock { _haapiManagerBridge = newValue } }
    }
    internal var oauthTokenManagerBridge: RNOAuthTokenManagerBridge? {
        get { withStateLock { _oauthTokenManagerBridge } }
        set { withStateLock { _oauthTokenManagerBridge = newValue } }
    }

    /// Structured logger that sends events to JavaScript via `onLog`.
    /// First touched in `OnCreate` (single-threaded module setup) before any
    /// `AsyncFunction` can run, so the `lazy` initialization is sequenced
    /// ahead of any concurrent access.
    private lazy var log = RNModuleLogger(module: self)

    public func definition() -> ModuleDefinition {
        Name("IdsvrHaapiReactNativeSdk")

        Events("onLog")

        OnCreate {
            HaapiLogger.followUpTags = DriverFollowUpTag.allCases + SdkFollowUpTag.allCases
            HaapiLogger.setLogType(.error)
            HaapiLogger.isSensitiveValueMasked = true
            // The shared sink is installed on `HaapiLogger` exactly once
            // per process (idempotent under the install guard); every
            // OnCreate just rebinds the active module, so re-creates of
            // the JS context don't leak additional sinks.
            RNLogSink.shared.attach(module: self)
            Self.installSharedLogSinkIfNeeded()
            self.log.info("The JS context is created/reloaded.")
        }

        OnDestroy {
            self.log.info("The JS context is torn down.")
            // Detach the active module before tearing down so a stray
            // log emitted between OnDestroy and the next OnCreate
            // doesn't reach a stale weak reference.
            RNLogSink.shared.detach()
            self.handleClose()
        }

        AsyncFunction("initializeForHaapi") { (config: RNHaapiConfigurationRecord) async throws in
            try await self.handleInitializeForHaapi(config)
        }

        AsyncFunction("initializeForOAuth") { (config: RNHaapiConfigurationRecord) async throws in
            try await self.handleInitializeForOAuth(config)
        }

        AsyncFunction("start") { () async throws -> [String: Any] in
            let record = try await self.handleStart()
            return record.toDictionary()
        }

        AsyncFunction("submitForm") { (formModel: RNFormActionModelRecord, parameters: [String: any Sendable]) async throws -> [String: Any] in
            let record = try await self.handleSubmitForm(formModel, parameters: parameters)
            return record.toDictionary()
        }

        AsyncFunction("followLink") { (linkRecord: RNLinkRecord) async throws -> [String: Any] in
            let record = try await self.handleFollowLink(linkRecord)
            return record.toDictionary()
        }

        AsyncFunction("oauthFetchAccessToken") {
            (authorizationCode: String, additionalParameters: [String: String]?) async throws -> RNTokenResponseRecord in
            try await self.handleOAuthFetchAccessToken(
                authorizationCode: authorizationCode,
                additionalParameters: additionalParameters
            )
        }

        AsyncFunction("oauthRefreshAccessToken") {
            (refreshToken: String, additionalParameters: [String: String]?) async throws -> RNTokenResponseRecord in
            try await self.handleOAuthRefreshAccessToken(
                refreshToken: refreshToken,
                additionalParameters: additionalParameters
            )
        }

        AsyncFunction("oauthRevokeAccessToken") { (token: String) async throws in
            try await self.handleOAuthRevokeAccessToken(token: token)
        }

        AsyncFunction("oauthRevokeRefreshToken") { (token: String) async throws in
            try await self.handleOAuthRevokeRefreshToken(token: token)
        }

        AsyncFunction("oauthCreateDpopProof") {
            (accessToken: String, httpMethod: String, url: String, nonce: String?) async throws -> String? in
            try await self.handleOAuthCreateDpopProof(
                accessToken: accessToken,
                httpMethod: httpMethod,
                url: url,
                nonce: nonce
            )
        }

        Function("close") {
            self.log.info("close")
            self.handleClose()
        }

        AsyncFunction("configureLogger") { (configuration: RNLoggerConfigurationRecord) in
            HaapiLogger.setLogType(configuration.logLevel.toLogType())
            HaapiLogger.isSensitiveValueMasked = configuration.isSensitiveValueMasked
        }
    }

    // MARK: - Log-sink installation

    /// Installs the shared `RNLogSink` on `IdsvrHaapiSdk.HaapiLogger`
    /// exactly once per process. Subsequent `OnCreate` cycles call this
    /// freely; the guard short-circuits.
    ///
    /// `IdsvrHaapiSdk.HaapiLogger.appendLogSink` has no `remove` /
    /// `replace` counterpart, so the only way to keep the sink list
    /// bounded across Fast-Refresh / context-reload cycles is to install
    /// a single sink and rebind its target module via
    /// ``RNLogSink/attach(module:)`` from `OnCreate`.
    ///
    /// `nonisolated(unsafe)`: the Bool flag is mutable shared state, but
    /// it is exclusively accessed under ``sharedLogSinkLock``. The Swift 6
    /// concurrency checker can't infer that lock-discipline by itself, so
    /// we opt out explicitly. `NSLock` is itself `Sendable`, so its `let`
    /// needs no annotation.
    nonisolated(unsafe) private static var sharedLogSinkInstalled: Bool = false
    private static let sharedLogSinkLock = NSLock()

    fileprivate static func installSharedLogSinkIfNeeded() {
        sharedLogSinkLock.lock()
        defer { sharedLogSinkLock.unlock() }
        if !sharedLogSinkInstalled {
            HaapiLogger.appendLogSink(RNLogSink.shared)
            sharedLogSinkInstalled = true
        }
    }

    // MARK: - Handlers (internal for testing)

    /// Builds a ``HaapiAccessor`` and wires both bridges. Throws
    /// ``HaapiAccessorBridgeException`` with code
    /// `HAAPI_ACCESSOR_ALREADY_INITIALIZED` if the store is non-empty.
    ///
    /// Reserve before building (HSRN-42): the reverse order let the native
    /// SDK's duplicate detection answer first whenever the re-init reused the
    /// client id, making the documented code unreachable and building a full
    /// accessor only to discard it.
    internal func handleInitializeForHaapi(_ config: RNHaapiConfigurationRecord) async throws {
        log.debug("initializeForHaapi called with config: \(config)")
        do {
            try accessorStore.reserve()
        } catch {
            log.error("Failed to initializeForHaapi: \(String(describing: error))")
            throw HaapiErrorNormalizer.normalize(error)
        }
        let accessor: any HaapiAccessor
        // Resolved once and shared with the bridge below, so the DPoP decision can't disagree with
        // the binding the accessor was built with.
        let tokenBinding: TokenBoundConfiguration
        do {
            tokenBinding = try config.iosConfig.nativeTokenBinding()
            accessor = try await builderProvider.buildForHaapi(configuration: config)
        } catch {
            accessorStore.cancelReservation()
            log.error("Failed to initializeForHaapi: \(String(describing: error))")
            throw HaapiErrorNormalizer.normalize(error)
        }
        do {
            try storeSetHaapi(accessor)
        } catch {
            // Reachable only via an interleaved close(): reserve() excludes a
            // rival, but clear() frees the reservation, so `init` (building) ->
            // close() -> `init` lets a newcomer commit first. The accessor
            // exists by now, so close it rather than leak it.
            accessor.close()
            log.error("Failed to initializeForHaapi: \(String(describing: error))")
            throw HaapiErrorNormalizer.normalize(error)
        }
        let haapiBridge = RNHaapiManagerBridge(
            invoker: DefaultHaapiFlowInvoker(haapiManager: accessor.haapiManager)
        )
        let oauthBridge = RNOAuthTokenManagerBridge(
            invoker: DefaultOAuthTokenInvoker(oAuthTokenManager: accessor.oAuthTokenManager),
            dpopProvider: tokenExchangeDpopProvider(
                for: tokenBinding,
                dpop: { [haapiManager = accessor.haapiManager] in haapiManager.dpop }
            ),
            isTokenBound: bindsTokens(tokenBinding)
        )
        // Assign both bridges in a single critical section so a concurrent
        // close() cannot interleave between the two writes. The separate
        // setter calls each acquired `stateLock` independently, which let a
        // close() racing between them nil both fields and clear the store,
        // after which this method would still write `_oauthTokenManagerBridge`
        // — leaving an orphaned bridge with no store entry. Mirrors the atomic
        // clear in handleClose().
        withStateLock {
            _haapiManagerBridge = haapiBridge
            _oauthTokenManagerBridge = oauthBridge
        }
        log.info("HaapiAccessor created (HAAPI mode)")
    }

    /// Builds an ``OAuthAccessor`` and wires only the OAuth bridge. Throws
    /// ``HaapiAccessorBridgeException`` with code
    /// `HAAPI_ACCESSOR_ALREADY_INITIALIZED` if the store is non-empty.
    ///
    /// Reserve before building — see ``handleInitializeForHaapi(_:)`` (HSRN-42).
    ///
    /// If the store rejects the just-built accessor, the freshly-built
    /// accessor reference is dropped — `OAuthAccessor` exposes no public
    /// `close()` API in `IdsvrHaapiSdk` 5.7.1 because the OAuth-only mode
    /// holds no native handle that needs explicit teardown. ARC releases
    /// the impl when the local goes out of scope. Mirrors the Android
    /// OAuth-only failure path documented in HSRN-8 § 15.2 F-M3.
    internal func handleInitializeForOAuth(_ config: RNHaapiConfigurationRecord) async throws {
        log.debug("initializeForOAuth called with config: \(config)")
        do {
            try accessorStore.reserve()
        } catch {
            log.error("Failed to initializeForOAuth: \(String(describing: error))")
            throw HaapiErrorNormalizer.normalize(error)
        }
        let accessor: any OAuthAccessor
        // The same binding the HAAPI path resolves; here it only decides whether proofs can be made.
        let tokenBinding: TokenBoundConfiguration
        do {
            tokenBinding = try config.iosConfig.nativeTokenBinding()
            accessor = try await builderProvider.buildForOAuth(configuration: config)
        } catch {
            accessorStore.cancelReservation()
            log.error("Failed to initializeForOAuth: \(String(describing: error))")
            throw HaapiErrorNormalizer.normalize(error)
        }
        do {
            try storeSetOAuth(accessor)
        } catch {
            // No `accessor.close()` here — see the doc-comment above. The
            // local goes out of scope at the `throw`, ARC handles the rest.
            log.error("Failed to initializeForOAuth: \(String(describing: error))")
            throw HaapiErrorNormalizer.normalize(error)
        }
        oauthTokenManagerBridge = RNOAuthTokenManagerBridge(
            invoker: DefaultOAuthTokenInvoker(oAuthTokenManager: accessor.oAuthTokenManager),
            // dpopProvider defaults to { nil } — no HaapiManager to source DPoP from.
            isTokenBound: bindsTokens(tokenBinding)
        )
        log.info("OAuthAccessor created (OAuth-only mode)")
    }

    internal func handleStart() async throws -> RNHaapiResponseRecord {
        do {
            let bridge = try requireHaapiManagerBridge()
            log.info("start")
            return try await bridge.start()
        } catch {
            throw HaapiErrorNormalizer.normalize(error)
        }
    }

    internal func handleSubmitForm(
        _ formModel: RNFormActionModelRecord,
        parameters: [String: any Sendable]
    ) async throws -> RNHaapiResponseRecord {
        do {
            let bridge = try requireHaapiManagerBridge()
            log.info("submitForm")
            return try await bridge.submitForm(formModel, parameters: parameters)
        } catch {
            throw HaapiErrorNormalizer.normalize(error)
        }
    }

    internal func handleFollowLink(_ linkRecord: RNLinkRecord) async throws -> RNHaapiResponseRecord {
        do {
            let bridge = try requireHaapiManagerBridge()
            log.info("followLink")
            return try await bridge.followLink(linkRecord)
        } catch {
            throw HaapiErrorNormalizer.normalize(error)
        }
    }

    internal func handleOAuthFetchAccessToken(
        authorizationCode: String,
        additionalParameters: [String: String]?
    ) async throws -> RNTokenResponseRecord {
        do {
            let bridge = try requireOAuthBridge()
            log.info("oauthFetchAccessToken")
            return try await bridge.fetchAccessToken(
                authorizationCode: authorizationCode,
                additionalParameters: additionalParameters
            )
        } catch {
            throw HaapiErrorNormalizer.normalize(error)
        }
    }

    internal func handleOAuthRefreshAccessToken(
        refreshToken: String,
        additionalParameters: [String: String]?
    ) async throws -> RNTokenResponseRecord {
        do {
            let bridge = try requireOAuthBridge()
            log.info("oauthRefreshAccessToken")
            return try await bridge.refreshAccessToken(
                refreshToken: refreshToken,
                additionalParameters: additionalParameters
            )
        } catch {
            throw HaapiErrorNormalizer.normalize(error)
        }
    }

    internal func handleOAuthRevokeAccessToken(token: String) async throws {
        do {
            let bridge = try requireOAuthBridge()
            log.info("oauthRevokeAccessToken")
            try await bridge.revokeAccessToken(token: token)
        } catch {
            throw HaapiErrorNormalizer.normalize(error)
        }
    }

    internal func handleOAuthRevokeRefreshToken(token: String) async throws {
        do {
            let bridge = try requireOAuthBridge()
            log.info("oauthRevokeRefreshToken")
            try await bridge.revokeRefreshToken(token: token)
        } catch {
            throw HaapiErrorNormalizer.normalize(error)
        }
    }

    // Logs the operation name only: the token, URL and nonce never reach a log line.
    internal func handleOAuthCreateDpopProof(
        accessToken: String,
        httpMethod: String,
        url: String,
        nonce: String?
    ) async throws -> String? {
        do {
            let bridge = try requireOAuthBridge()
            log.info("oauthCreateDpopProof")
            return try await bridge.createDpopProof(accessToken: accessToken, httpMethod: httpMethod, url: url, nonce: nonce)
        } catch {
            throw HaapiErrorNormalizer.normalize(error)
        }
    }

    internal func handleClose() {
        // Capture the HAAPI bridge and nil both references in a single
        // critical section so a concurrent flow/token op never observes a
        // half-cleared module. The bridge is an `actor`, so the
        // fire-and-forget `clearCaches()` is sequenced after any in-flight
        // flow op, and the captured reference keeps the actor alive until the
        // cache is cleared; afterwards ARC deinitialises it.
        let bridgeToTearDown = withStateLock { () -> RNHaapiManagerBridge? in
            let bridge = _haapiManagerBridge
            _haapiManagerBridge = nil
            _oauthTokenManagerBridge = nil
            return bridge
        }
        accessorStore.clear()
        if let bridgeToTearDown {
            Task { await bridgeToTearDown.clearCaches() }
        }
    }

    // MARK: - Private helpers

    private func storeSetHaapi(_ accessor: any HaapiAccessor) throws {
        try accessorStore.setHaapi(accessor)
    }

    private func storeSetOAuth(_ accessor: any OAuthAccessor) throws {
        try accessorStore.setOAuth(accessor)
    }

    private func requireHaapiManagerBridge() throws -> RNHaapiManagerBridge {
        _ = try accessorStore.requireHaapi()
        // Invariant: store holds a HaapiAccessor → handleInitializeForHaapi
        // set haapiManagerBridge alongside the store entry.
        guard let bridge = haapiManagerBridge else {
            throw HaapiAccessorStore.StoreError.notInitialized
        }
        return bridge
    }

    private func requireOAuthBridge() throws -> RNOAuthTokenManagerBridge {
        _ = try accessorStore.requireOAuth()
        // Invariant: store holds an accessor (HaapiAccessor or OAuthAccessor)
        // → both factory entry points populate oauthTokenManagerBridge.
        guard let bridge = oauthTokenManagerBridge else {
            throw HaapiAccessorStore.StoreError.notInitialized
        }
        return bridge
    }
}

extension HaapiConfiguration {
    /// Creates a native ``HaapiConfiguration`` from the JavaScript configuration record.
    ///
    /// Resolves platform dependencies (URL session, bundles, token listeners) via
    /// ``NativeRegistry/shared`` and converts all string URLs to `URL` instances.
    ///
    /// - Parameter record: The top-level configuration record deserialized from JavaScript.
    /// - Throws: ``HaapiError/invalidConfiguration(reason:)`` if a required URL is malformed
    ///   or a resolver cannot provide a required dependency.
    convenience init(record: RNHaapiConfigurationRecord) throws {
        let iosConfig = record.iosConfig
        let httpHeaders = record.httpHeaders ?? [:]
        let authParams = record.authorizationParameters
        let authProvider = OAuthAuthorizationParameters(
            scopes: authParams?.scope ?? [],
            nonce: authParams?.nonce,
            acrValues: authParams?.acrValues ?? [],
            extraRequestParameters: authParams?.extraRequestParameters ?? [:]
        )
        guard let urlSession = NativeRegistry.shared.urlSession(for: record.iosConfig.urlSessionOption.rawValue)
        else {
            throw HaapiError.invalidConfiguration(
                reason: "Cannot resolve \(record.iosConfig.urlSessionOption.rawValue)"
            )
        }
        let revocationEndpointURL: URL? = if let urlString = record.revocationEndpointUrl {
            try URL(string: urlString, nameProperty: "revocationEndpointUrl")
        } else {
            nil
        }
        let riskAssessment: RiskAssessmentConfiguration? = if iosConfig.useRiskAssessmentConfiguration {
            RiskAssessmentConfiguration(
                operatingSystemName: ProcessInfo.processInfo.operatingSystemVersionString,
                operatingSystemVersion: osVersion(),
                deviceModelName: getDeviceIdentifier(),
                applicatonIdentifier: Bundle.main.bundleIdentifier ?? "unknown"
            )
        } else {
            nil
        }

        let tokenEndpointResponseListener = iosConfig.hasTokenEndpointResponseListener
              ? NativeRegistry.shared.getTokenEndpointResponseListener()
              : nil
        self.init(
            name: iosConfig.name,
            clientId: iosConfig.clientId,
            baseURL: try URL(string: record.baseUrl, nameProperty: "baseUrl"),
            tokenEndpointURL: try URL(string: record.tokenEndpointUrl, nameProperty: "tokenEndpointUrl"),
            authorizationEndpointURL: try URL(
                string: record.authorizationEndpointUrl,
                nameProperty: "authorizationEndpointUrl"
            ),
            appRedirect: iosConfig.appRedirect,
            httpHeadersProvider: { httpHeaders },
            authorizationParametersProvider: { authProvider },
            isAutoRedirect: record.isAutoRedirect,
            urlSession: urlSession,
            revocationEndpointURL: revocationEndpointURL,
            minTokenTtl: record.minTokenTtl,
            attestationConfiguration: try AttestationConfiguration(record: iosConfig.attestationConfiguration),
            tokenBoundConfiguration: try iosConfig.nativeTokenBinding(),
            tokenEndpointResponseListener: tokenEndpointResponseListener,
            clientAuthenticationMethod: try iosConfig.clientAuthenticationMethodConfiguration.toAuthMethod(NativeRegistry.shared),
            riskAssessmentConfiguration: riskAssessment,
            storage: iosConfig.nativeStorage()
        )
    }
}

extension URL {
    /// Creates a `URL` from the given string, throwing a descriptive error on failure.
    ///
    /// - Parameters:
    ///   - string: The URL string to parse.
    ///   - nameProperty: The configuration property name, included in the error message.
    /// - Throws: ``HaapiError/invalidConfiguration(reason:)`` if the string is not a valid URL.
    init(string: String, nameProperty: String) throws {
        guard let url = URL(string: string) else {
            throw HaapiError.invalidConfiguration(
                reason: "Cannot build an URL for this property \(nameProperty) : \(string)"
            )
        }
        self = url
    }
}

extension DCRConfiguration {
    /// Creates a native ``DCRConfiguration`` from the bridge record.
    ///
    /// - Parameter record: The DCR configuration record from JavaScript.
    /// - Throws: ``HaapiError/invalidConfiguration(reason:)`` if the endpoint URL is invalid.
    convenience init(record: RNDcrConfigurationRecord) throws {
        guard let url = URL(string: record.clientRegistrationEndpointUrl) else {
            throw HaapiError.invalidConfiguration(reason: "Invalid URL for clientRegistrationEndpointUrl")
        }
        self.init(
            templateClientId: record.templateClientId,
            clientRegistrationEndpointUrl: url
        )
    }
}

extension AttestationConfiguration {
    /// Creates a native ``AttestationConfiguration`` from the bridge record.
    ///
    /// - Parameter record: The attestation configuration record from JavaScript.
    convenience init(record: RNAttestationConfigurationRecord) throws {
        self.init(
            useAttestation: record.useAttestation,
            attestationMaxRetries: record.attestationMaxRetries
        )
    }
}

extension RNTokenBindingConfigurationRecord? {
    /// Converts the optional record to a native ``TokenBoundConfiguration``.
    ///
    /// An absent record, or `kind == .unbound`, gives ``UnboundedTokenConfiguration``;
    /// `kind == .bound` gives ``BoundedTokenConfiguration`` with the record's key type.
    ///
    /// - Throws: ``HaapiError/invalidConfiguration(reason:)`` when the record states no mode (a value
    ///   the bridge can't read as a mode is never taken as "no binding") or is bound without a key type.
    func toNativeTokenBinding() throws -> TokenBoundConfiguration {
        guard let self else {
            return UnboundedTokenConfiguration()
        }
        switch self.kind {
        case .unbound:
            return UnboundedTokenConfiguration()
        case .none:
            throw HaapiError.invalidConfiguration(reason: "tokenBindingConfiguration: kind is required.")
        case .bound:
            break
        }
        guard let keyPairType = self.keyPairType else {
            throw HaapiError.invalidConfiguration(reason: "tokenBindingConfiguration: keyPairType is required.")
        }
        // Fully qualify CryptoKeyType — `secureEnclave` clashes with
        // similarly-named cases in Apple's CryptoKit / Security frameworks
        // that the example pod chain pulls in.
        let cryptoKeyPairType: IdsvrHaapiSdk.CryptoKeyType = switch (keyPairType) {
        case .p256: IdsvrHaapiSdk.CryptoKeyType.p256
        case .secureEnclave: IdsvrHaapiSdk.CryptoKeyType.secureEnclave
        case .security: IdsvrHaapiSdk.CryptoKeyType.security
        }
        return BoundedTokenConfiguration(keyPairType: cryptoKeyPairType)
    }
}

extension iOSConfigurationRecord {
    /// The native token binding this configuration asks for; see ``resolveTokenBinding(_:deprecated:)``.
    func nativeTokenBinding() throws -> TokenBoundConfiguration {
        // Reads the deprecated field on purpose — the one expected deprecation warning in this module
        // (Swift can't suppress it locally). Goes away with the field in the next major version.
        try resolveTokenBinding(tokenBindingConfiguration, deprecated: tokenBoundConfiguration)
    }

    /// The access group and level ``nativeStorage()`` gives the native keychain builder; each is `nil`
    /// when unset, so the builder keeps its own default for it.
    var keychainStorageSettings: (accessGroup: String?, accessibility: IdsvrHaapiSdk.KeychainAccessibility?) {
        let accessibility: IdsvrHaapiSdk.KeychainAccessibility? = switch keychainConfiguration?.accessibility {
        case .afterFirstUnlockThisDeviceOnly: .afterFirstUnlockThisDeviceOnly
        case .whenUnlockedThisDeviceOnly: .whenUnlockedThisDeviceOnly
        case nil: nil
        }
        return (keychainConfiguration?.accessGroup, accessibility)
    }

    /// The keychain storage the native SDK keeps its items in.
    ///
    /// Without a keychain configuration this is exactly the default of `HaapiConfiguration.storage`
    /// (`StorageBuilder.Keychain().build()` in the native SDK's declaration) — recheck that when the
    /// native SDK version changes. Passing it rather than omitting the argument keeps a single
    /// `HaapiConfiguration` initialiser call.
    func nativeStorage() -> any Storage {
        let settings = keychainStorageSettings
        let keychain = StorageBuilder.Keychain()
        if let accessGroup = settings.accessGroup {
            keychain.accessGroup(accessGroup)
        }
        if let accessibility = settings.accessibility {
            keychain.accessibility(accessibility)
        }
        return keychain.build()
    }
}

/// Resolves the token binding from the current setting and the deprecated one.
///
/// The factories map the deprecated `tokenBoundConfiguration` onto `tokenBindingConfiguration`, so it
/// only reaches the bridge in a configuration built without them. It is then read as **bound** —
/// its key type, or Secure Enclave — because the deprecated classes serialise identically, and
/// reading binding the developer asked for as "no binding" would silently drop it.
///
/// - Throws: ``HaapiError/invalidConfiguration(reason:)`` when both are set, or as
///   ``Optional/toNativeTokenBinding()`` for the current setting.
func resolveTokenBinding(
    _ binding: RNTokenBindingConfigurationRecord?,
    deprecated: RNTokenBindingConfigurationRecord?
) throws -> TokenBoundConfiguration {
    guard let deprecated else {
        return try binding.toNativeTokenBinding()
    }
    guard binding == nil else {
        throw HaapiError.invalidConfiguration(
            reason: "both tokenBindingConfiguration and the deprecated tokenBoundConfiguration are set; "
                + "pass only tokenBindingConfiguration."
        )
    }
    let bound: RNTokenBindingConfigurationRecord? = RNTokenBindingConfigurationRecord(
        kind: .bound,
        keyPairType: deprecated.keyPairType ?? .secureEnclave
    )
    return try bound.toNativeTokenBinding()
}

/// Whether `tokenBinding` binds tokens: it decides whether the OAuth bridge can make DPoP proofs. Only the
/// configuration known to bind does, so one the native SDK adds later makes none.
func bindsTokens(_ tokenBinding: TokenBoundConfiguration) -> Bool {
    tokenBinding is BoundedTokenConfiguration
}

/// The DPoP the token exchange receives: the HAAPI flow's DPoP when binding is on, `nil` otherwise.
///
/// The native `OAuthTokenManager` rejects a DPoP at the token exchange under
/// ``UnboundedTokenConfiguration``, while the HAAPI flow always holds one — so it is withheld when
/// binding is off (as the native UIKit layer does).
func tokenExchangeDpopProvider(
    for tokenBinding: TokenBoundConfiguration,
    dpop: @escaping @Sendable () -> Dpop?
) -> @Sendable () -> Dpop? {
    if tokenBinding is UnboundedTokenConfiguration {
        return { nil }
    }
    return dpop
}

extension ClientAuthenticationMethodConfigurationRecord {
    /// Converts this record to a native ``ClientAuthenticationMethod`` by dispatching on ``kind``.
    ///
    /// MTLS and JWT asymmetric variants resolve `Bundle` instances via the given registry.
    ///
    /// - Parameter nativeRegistry: The registry used to resolve `Bundle` dependencies.
    /// - Throws: ``HaapiError/invalidConfiguration(reason:)`` if a required field is missing
    ///   or a bundle cannot be resolved.
    func toAuthMethod(_ nativeRegistry: NativeRegistry) throws -> ClientAuthenticationMethod {
        switch (kind) {
        case .none: return ClientAuthenticationMethodNone()
        case .secret:
            guard let secret else {
                throw HaapiError.invalidConfiguration(reason: "Secret: secret is required.")
            }
            return ClientAuthenticationMethodSecret(secret: secret)
        case .mtls:
            guard let pkcs12Filename else {
                throw HaapiError.invalidConfiguration(reason: "Mtls: pkcs12Filename is required.")
            }
            guard let pkcs12Passphrase else {
                throw HaapiError.invalidConfiguration(reason: "Mtls: pkcs12Passphrase is required.")
            }
            guard let serverPEMFilename else {
                throw HaapiError.invalidConfiguration(reason: "Mtls: serverPEMFilename is required.")
            }
            guard let bundleOption,
                    let bundle = nativeRegistry.bundle(for: bundleOption.rawValue)
            else {
                throw HaapiError.invalidConfiguration(reason: "Mtls: bundleOption is required.")
            }
            return try ClientAuthenticationMethodMTLS(
                pkcs12Filename: pkcs12Filename,
                pkcs12Passphrase: pkcs12Passphrase,
                serverPEMFilename: serverPEMFilename,
                isValidatingHostname: isValidatingHostname,
                bundle: bundle
            )
        case .mtlsKeyPinning:
            guard let pkcs12Filename else {
                throw HaapiError.invalidConfiguration(reason: "Mtls: pkcs12Filename is required.")
            }
            guard let pkcs12Passphrase else {
                throw HaapiError.invalidConfiguration(reason: "Mtls: pkcs12Passphrase is required.")
            }
            guard let serverKeyPinnings else {
                throw HaapiError.invalidConfiguration(reason: "Mtls: serverKeyPinnings is required.")
            }
            let serverKeys = serverKeyPinnings.map { record in
                KeyPinning(
                    hostname: record.hostname,
                    publicKeyHash: record.publicKeyHash
                )
            }
            guard let bundleOption,
                    let bundle = nativeRegistry.bundle(for: bundleOption.rawValue)
            else {
                throw HaapiError.invalidConfiguration(reason: "Mtls: bundleOption is required.")
            }
            return try ClientAuthenticationMethodMTLS(
                pkcs12Filename: pkcs12Filename,
                pkcs12Passphrase: pkcs12Passphrase,
                serverKeyPinnings: serverKeys,
                bundle: bundle
            )
        case .jwtAsymmetric:
            guard let pemFilename else {
                throw HaapiError.invalidConfiguration(reason: "jwtAsymmetric: pemFilename is required.")
            }
            guard let asymmetricAlgorithm else {
                throw HaapiError.invalidConfiguration(reason: "jwtAsymmetric: asymmetricAlgorithm is required.")
            }
            guard let bundleOption,
                    let bundle = nativeRegistry.bundle(for: bundleOption.rawValue)
            else {
                throw HaapiError.invalidConfiguration(reason: "jwtAsymmetric: bundleOption is required.")
            }
            return try ClientAuthenticationMethodJWTAsymmetric(
                pemFilename: pemFilename,
                signatureAlgorithm: asymmetricAlgorithm.toJWTAsymmetricAlgorithm(),
                bundle: bundle
            )
        case .jwtSymmetric:
            guard let symmetricAlgorithm else {
                throw HaapiError.invalidConfiguration(reason: "jwtSymmetric: symmetricAlgorithm is required.")
            }
            guard let secretKey else {
                throw HaapiError.invalidConfiguration(reason: "jwtSymmetric: secretKey is required.")
            }
            return ClientAuthenticationMethodJWTSymmetric(
                signatureAlgorithm: symmetricAlgorithm.toJWTSymmetricAlgorithm(),
                secretKey: secretKey
            )
        }
    }
}

extension RNJWTAsymmetricAlgorithm {
    /// Maps this bridge enum to the native SDK ``IdsvrHaapiSdk/JWTAsymmetricAlgorithm``.
    /// Type fully qualified: another module in the example pod chain shadows the
    /// unqualified name and Swift refuses to resolve it ("ambiguous for type lookup").
    func toJWTAsymmetricAlgorithm() -> IdsvrHaapiSdk.JWTAsymmetricAlgorithm {
        switch self {
        case .es256: return IdsvrHaapiSdk.JWTAsymmetricAlgorithm.es256
        case .es384: return IdsvrHaapiSdk.JWTAsymmetricAlgorithm.es384
        case .es512: return IdsvrHaapiSdk.JWTAsymmetricAlgorithm.es512
        case .ps256: return IdsvrHaapiSdk.JWTAsymmetricAlgorithm.ps256
        case .ps384: return IdsvrHaapiSdk.JWTAsymmetricAlgorithm.ps384
        case .ps512: return IdsvrHaapiSdk.JWTAsymmetricAlgorithm.ps512
        case .rs256: return IdsvrHaapiSdk.JWTAsymmetricAlgorithm.rs256
        case .rs384: return IdsvrHaapiSdk.JWTAsymmetricAlgorithm.rs384
        case .rs512: return IdsvrHaapiSdk.JWTAsymmetricAlgorithm.rs512
        }
    }
}

extension RNJWTSymmetricAlgorithm {
    /// Maps this bridge enum to the native SDK ``IdsvrHaapiSdk/JWTSymmetricAlgorithm``.
    /// Same shadowing concern as ``toJWTAsymmetricAlgorithm`` — fully qualify.
    func toJWTSymmetricAlgorithm() -> IdsvrHaapiSdk.JWTSymmetricAlgorithm {
        switch self {
        case .hs256: return IdsvrHaapiSdk.JWTSymmetricAlgorithm.hs256
        case .hs384: return IdsvrHaapiSdk.JWTSymmetricAlgorithm.hs384
        case .hs512: return IdsvrHaapiSdk.JWTSymmetricAlgorithm.hs512
        }
    }
}

/// Returns the hardware model identifier (e.g. `"iPhone15,2"`).
private func getDeviceIdentifier() -> String {
    var systemInfo = utsname()
    uname(&systemInfo)
    return withUnsafePointer(to: &systemInfo.machine) {
        $0.withMemoryRebound(to: CChar.self, capacity: 1) {
            String(validatingCString: $0) ?? "unknown"
        }
    }
}

/// Returns the OS version as a `"major.minor.patch"` string.
private func osVersion() -> String {
    let v = ProcessInfo.processInfo.operatingSystemVersion
    return "\(v.majorVersion).\(v.minorVersion).\(v.patchVersion)"
}

// Required by Swift 6 strict concurrency: Expo 56's `AsyncFunction` overload
// for `async throws` closures is `@Sendable`, so the captured `self` must be
// Sendable. The class has mutable instance state, so it can't be inferred
// Sendable automatically.
//
// Concurrent access to `self` is not actually possible: Expo's runtime
// serializes AsyncFunction dispatch per module, the bridge mutations
// happen via JS-side calls that are inherently single-threaded, and the
// shared singletons (`HaapiAccessorStore.shared`, `RNLogSink.shared`)
// own their own locking. Declared as an extension to keep the class
// header narrow (`: Module`) and the concurrency annotation orthogonal.
extension IdsvrHaapiReactNativeSdkModule: @unchecked Sendable {}
