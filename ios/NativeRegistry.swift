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
import Foundation
import IdsvrHaapiSdk

/// A thread-safe service locator that holds type-erased ``Resolver`` instances
/// and provides convenience look-ups for platform-specific dependencies.
///
/// The default ``shared`` instance is pre-populated with a ``URLSessionResolver``.
/// Host apps can call ``addResolver(_:)`` to register additional resolvers at
/// runtime (e.g., a custom `URLSession` backed by a pinned TLS configuration).
///
/// All access is guarded by an `NSLock`, making the registry safe to read and
/// mutate from any thread or Swift concurrency context.
public final class NativeRegistry: @unchecked Sendable {
    private let lock = NSLock()
    private var resolvers = [any Resolver]()
    private var tokenEndpointListener: OAuthTokenManager.TokenEndpointResponseListener?

    /// Creates a new registry, optionally pre-populated with resolvers.
    /// - Parameter resolvers: An array of resolvers available at construction time.
    public init(_ resolvers: [any Resolver] = []) {
        self.resolvers = resolvers
    }

    /// Inserts a resolver at the front of the registry so it takes
    /// priority over previously registered (default) resolvers.
    /// - Parameter resolver: The resolver to register.
    public func addResolver(_ resolver: any Resolver) {
        lock.lock()
        defer { lock.unlock() }
        resolvers.insert(resolver, at: 0)
    }

    /// Returns the first `URLSession` resolved for the given key, or `nil`
    /// if no registered resolver can provide one.
    /// - Parameter key: A key passed to each resolver (e.g., a ``URLSessionOption`` raw value).
    public func urlSession(for key: String) -> URLSession? {
        lock.lock()
        defer { lock.unlock() }
        for resolver in resolvers {
            if let session = resolver.resolve(for: key) as? URLSession {
                return session
            }
        }
        return nil
    }

    /// Returns the first `Bundle` resolved for the given key, or `nil`
    /// if no registered resolver can provide one.
    /// - Parameter key: A key passed to each resolver (e.g., a ``BundleOption`` raw value).
    public func bundle(for key: String) -> Bundle? {
        lock.lock()
        defer { lock.unlock() }
        for resolver in resolvers {
            if let bundle = resolver.resolve(for: key) as? Bundle {
                return bundle
            }
        }
        return nil
    }

    /// Stores a token endpoint response listener that will be invoked whenever
    /// the SDK receives a token response from the Curity Identity Server.
    /// - Parameter listener: The listener to register.
    public func setTokenEndpointResponseListener(_ listener: OAuthTokenManager.TokenEndpointResponseListener) {
        lock.lock()
        defer { lock.unlock() }
        tokenEndpointListener = listener
    }

    /// Returns the currently registered token endpoint response listener, or `nil`
    /// if none has been set.
    public func getTokenEndpointResponseListener() -> OAuthTokenManager.TokenEndpointResponseListener? {
        lock.lock()
        defer { lock.unlock() }
        return tokenEndpointListener
    }
}
