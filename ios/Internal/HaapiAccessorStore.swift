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

/// Thread-safe singleton that owns the currently-active accessor
/// (``HaapiAccessor`` for full HAAPI flow + tokens, or ``OAuthAccessor``
/// for token-only mode).
///
/// The store is the single source of truth for "is the bridge initialized?". It is
/// written by `initializeForHaapi` / `initializeForOAuth` / `close` on the Expo
/// module, and read by every flow / OAuth bridge method to obtain the current
/// accessor. Access is guarded by an `NSLock`, mirroring the thread-safety pattern
/// used by ``NativeRegistry``.
///
/// Visibility: `internal`. The store is consumed only by
/// ``IdsvrHaapiReactNativeSdkModule`` and helpers under `Internal/`. Tests reach
/// it via `@testable import`. This type must stay `internal`: the Records it
/// transitively touches are themselves `internal`, and HSRN-23's full native
/// test workspace now catches the same access-control mistake the consuming app
/// pod build would catch.
final class HaapiAccessorStore: @unchecked Sendable {
    /// Process-wide singleton. Tests should construct their own instance.
    static let shared = HaapiAccessorStore()

    /// Stable error codes surfaced to JS via `error.code`. These must stay
    /// backwards-compatible once shipped. Follow-up structured-error work
    /// extends this taxonomy.
    enum ErrorCode {
        static let alreadyInitialized = "HAAPI_ACCESSOR_ALREADY_INITIALIZED"
        static let notInitialized = "HAAPI_ACCESSOR_NOT_INITIALIZED"
        static let wrongKind = "HAAPI_ACCESSOR_WRONG_KIND"
        /// Raised by the flow bridge when a `submitForm` / `followLink`
        /// record can't be matched to a cached native model — typically
        /// because the host kept a `FormAction` / `Link` from a previous
        /// accessor lifecycle (after `close()` or before re-init).
        static let flowCacheMiss = "HAAPI_FLOW_CACHE_MISS"
    }

    /// Errors thrown by the store. Each case maps to a stable string code in
    /// ``ErrorCode``; the bridge layer uses ``code`` when re-throwing into
    /// JavaScript so callers can branch on `error.code`.
    enum StoreError: Error, Equatable {
        /// `setHaapi` / `setOAuth` called while an accessor is already held.
        case alreadyInitialized
        /// `requireHaapi` / `requireOAuth` called with no accessor held.
        case notInitialized
        /// `requireHaapi` called while the stored accessor is OAuth-only.
        case wrongKind
        /// `submitForm` / `followLink` record didn't match any cached
        /// native model — see ``ErrorCode/flowCacheMiss``.
        case flowCacheMiss(reason: String)

        /// The stable error code that should be surfaced to JavaScript.
        var code: String {
            switch self {
            case .alreadyInitialized: return ErrorCode.alreadyInitialized
            case .notInitialized: return ErrorCode.notInitialized
            case .wrongKind: return ErrorCode.wrongKind
            case .flowCacheMiss: return ErrorCode.flowCacheMiss
            }
        }

        static func == (lhs: StoreError, rhs: StoreError) -> Bool {
            switch (lhs, rhs) {
            case (.alreadyInitialized, .alreadyInitialized),
                 (.notInitialized, .notInitialized),
                 (.wrongKind, .wrongKind):
                return true
            case let (.flowCacheMiss(l), .flowCacheMiss(r)):
                return l == r
            default:
                return false
            }
        }
    }

    private let lock = NSLock()
    private var current: HaapiManagerAccessor?

    /// Set while an initialization builds its accessor. ``current`` cannot
    /// serve this purpose — it is still `nil` then, and that window is what made
    /// ``StoreError/alreadyInitialized`` unreachable (HSRN-42): the native SDK's
    /// own duplicate detection answered first.
    private var reserved = false

    /// Creates a new empty store. The ``shared`` singleton is the runtime
    /// instance; this initializer exists for isolated unit tests.
    init() {}

    /// Claims the slot for an initialization about to build. Callers must
    /// follow a success with exactly one of ``setHaapi(_:)`` / ``setOAuth(_:)``
    /// or ``cancelReservation()``.
    ///
    /// The lock is deliberately not held across the caller's build: `NSLock`
    /// must not span an `await`, and blocking `close()` behind a network-bound
    /// build would strand a hung init. The reservation excludes a rival; the
    /// lock does not.
    ///
    /// - Throws: ``StoreError/alreadyInitialized`` if an accessor is already
    ///   held, or another initialization already holds the slot.
    func reserve() throws {
        lock.lock()
        defer { lock.unlock() }
        if current != nil || reserved { throw StoreError.alreadyInitialized }
        reserved = true
    }

    /// Releases the slot after a failed build, so one bad config cannot brick
    /// the bridge.
    ///
    /// Accepted trade-off: ``clear()`` releases reservations too, so a build
    /// failing after an interleaved `close()` can release a newcomer's claim.
    /// Worst case is one extra accessor, built and then closed by the
    /// ``setHaapi(_:)`` guard — not worth threading ownership through the API.
    func cancelReservation() {
        lock.lock()
        defer { lock.unlock() }
        reserved = false
    }

    /// Stores a full-flow ``HaapiAccessor``.
    /// - Throws: ``StoreError/alreadyInitialized`` if an accessor is already held.
    func setHaapi(_ accessor: HaapiAccessor) throws {
        lock.lock()
        defer { lock.unlock() }
        if current != nil { throw StoreError.alreadyInitialized }
        current = accessor
        reserved = false
    }

    /// Stores a token-management-only ``OAuthAccessor``.
    /// - Throws: ``StoreError/alreadyInitialized`` if an accessor is already held.
    func setOAuth(_ accessor: OAuthAccessor) throws {
        lock.lock()
        defer { lock.unlock() }
        if current != nil { throw StoreError.alreadyInitialized }
        current = accessor
        reserved = false
    }

    /// Returns the current accessor as a ``HaapiAccessor`` (the full-flow kind).
    /// - Throws:
    ///   - ``StoreError/notInitialized`` if no accessor is held.
    ///   - ``StoreError/wrongKind`` if the held accessor is OAuth-only.
    func requireHaapi() throws -> HaapiAccessor {
        lock.lock()
        defer { lock.unlock() }
        guard let snapshot = current else { throw StoreError.notInitialized }
        guard let haapi = snapshot as? HaapiAccessor else { throw StoreError.wrongKind }
        return haapi
    }

    /// Returns the current accessor as an ``OAuthAccessor``. Succeeds for both
    /// ``HaapiAccessor`` (which extends ``OAuthAccessor``) and plain
    /// ``OAuthAccessor``.
    /// - Throws: ``StoreError/notInitialized`` if no accessor is held.
    func requireOAuth() throws -> OAuthAccessor {
        lock.lock()
        defer { lock.unlock() }
        guard let snapshot = current else { throw StoreError.notInitialized }
        // HaapiAccessor: OAuthAccessor — the cast succeeds for both accessor kinds.
        guard let oauth = snapshot as? OAuthAccessor else { throw StoreError.wrongKind }
        return oauth
    }

    /// Closes the underlying ``HaapiManager`` (only if the stored accessor is a
    /// ``HaapiAccessor``) and drops the reference. Safe to call when empty.
    /// Safe for ``OAuthAccessor`` — there is no flow manager to tear down.
    ///
    /// The store's lock is released **before** the SDK's ``close()`` runs:
    /// the snapshot-and-null happens under the lock, then the lock is
    /// dropped, and ``close()`` is called against the captured snapshot.
    /// This avoids holding the store's lock across an SDK callback that
    /// may itself acquire other locks (or, in the future, call back into
    /// the store) — which would otherwise risk a lock-ordering deadlock.
    func clear() {
        lock.lock()
        let snapshot = current
        current = nil
        // Freed here too, or a hung build would strand the bridge with no
        // way back: close() is the host's only reset.
        reserved = false
        lock.unlock()
        // HaapiAccessor.close() default is provided via protocol extension in the SDK,
        // forwarding to haapiManager.close(). Mocks may override close() to record.
        (snapshot as? HaapiAccessor)?.close()
    }
}
