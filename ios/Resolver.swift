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
/// A type that can resolve a dependency for a given string key.
///
/// Conforming types declare the concrete ``Item`` they provide and return
/// `nil` when the key is unrecognised or unsupported.
///
/// Resolvers are stored as type-erased `any Resolver` in ``NativeRegistry``,
/// which iterates them and casts the result to the expected type at the call site.
public protocol Resolver: Sendable {
    /// The concrete type this resolver provides.
    associatedtype Item: Sendable

    /// Returns the resolved item for `key`, or `nil` if this resolver
    /// cannot handle the given key.
    /// - Parameter key: A string identifier (typically an enum raw value such as ``URLSessionOption``).
    func resolve(for key: String) -> Item?
}
