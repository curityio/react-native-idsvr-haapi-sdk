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
import XCTest
@testable import RNIdsvrHaapiSdk

// MARK: - Mock Resolvers

/// A resolver that always returns a fixed URLSession for a specific key.
private struct StubURLSessionResolver: Resolver {
    typealias Item = URLSession
    let matchingKey: String
    let session: URLSession

    func resolve(for key: String) -> URLSession? {
        key == matchingKey ? session : nil
    }
}

/// A resolver whose Item type is not URLSession.
private struct StringResolver: Resolver {
    typealias Item = String

    func resolve(for key: String) -> String? {
        "value-for-\(key)"
    }
}

// MARK: - Tests

final class NativeRegistryTests: XCTestCase {

    func testEmptyRegistryReturnsNil() {
        let registry = NativeRegistry()
        XCTAssertNil(registry.urlSession(for: "anything"))
    }

    func testInitWithResolvers() {
        let session = URLSession(configuration: .ephemeral)
        let resolver = StubURLSessionResolver(matchingKey: "ephemeral", session: session)
        let registry = NativeRegistry([resolver])

        let result = registry.urlSession(for: "ephemeral")
        XCTAssertTrue(result === session)
    }

    func testAddResolver() {
        let registry = NativeRegistry()
        XCTAssertNil(registry.urlSession(for: "added"))

        let session = URLSession(configuration: .ephemeral)
        registry.addResolver(StubURLSessionResolver(matchingKey: "added", session: session))

        let result = registry.urlSession(for: "added")
        XCTAssertTrue(result === session)
    }

    func testNonURLSessionResolverIgnored() {
        let registry = NativeRegistry([StringResolver()])
        XCTAssertNil(registry.urlSession(for: "any-key"))
    }

    func testFirstMatchWins() {
        let first = URLSession(configuration: .ephemeral)
        let second = URLSession(configuration: .default)
        let registry = NativeRegistry([
            StubURLSessionResolver(matchingKey: "key", session: first),
            StubURLSessionResolver(matchingKey: "key", session: second),
        ])

        let result = registry.urlSession(for: "key")
        XCTAssertTrue(result === first)
    }

    func testAddedResolverTakesPriority() {
        let defaultSession = URLSession(configuration: .default)
        let customSession = URLSession(configuration: .ephemeral)
        let registry = NativeRegistry([
            StubURLSessionResolver(matchingKey: "key", session: defaultSession),
        ])

        registry.addResolver(StubURLSessionResolver(matchingKey: "key", session: customSession))

        let result = registry.urlSession(for: "key")
        XCTAssertTrue(result === customSession)
    }

    func testUnrecognizedKeyReturnsNil() {
        let session = URLSession(configuration: .ephemeral)
        let registry = NativeRegistry([
            StubURLSessionResolver(matchingKey: "known", session: session),
        ])

        XCTAssertNil(registry.urlSession(for: "unknown"))
    }

    func testConcurrentAccess() {
        let registry = NativeRegistry()
        let iterations = 1000

        DispatchQueue.concurrentPerform(iterations: iterations) { i in
            if i.isMultiple(of: 2) {
                let session = URLSession(configuration: .ephemeral)
                registry.addResolver(
                    StubURLSessionResolver(matchingKey: "key-\(i)", session: session)
                )
            } else {
                _ = registry.urlSession(for: "key-\(i)")
            }
        }

        // If we reach here without crashing, concurrent access is safe.
    }
}
