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

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors

// region Mock Resolvers

/** A resolver that always returns a fixed value for a specific key. */
private class StubStringResolver(
    private val matchingKey: String,
    private val value: String,
) : Resolver<String> {
    override fun resolve(key: String): String? = if (key == matchingKey) value else null
}

/** A resolver whose Item type is Int (different from String). */
private class IntResolver : Resolver<Int> {
    override fun resolve(key: String): Int? = key.toIntOrNull()
}

// endregion

class NativeRegistryTest {
    @Test
    fun emptyRegistryReturnsNull() {
        val registry = NativeRegistry()
        assertNull(registry.resolve("anything", String::class.java))
    }

    @Test
    fun initWithResolvers() {
        val resolver = StubStringResolver("greeting", "hello")
        val registry = NativeRegistry(listOf(resolver))

        assertEquals("hello", registry.resolve("greeting", String::class.java))
    }

    @Test
    fun addResolver() {
        val registry = NativeRegistry()
        assertNull(registry.resolve("added", String::class.java))

        registry.addResolver(StubStringResolver("added", "value"))

        assertEquals("value", registry.resolve("added", String::class.java))
    }

    @Test
    fun nonMatchingTypeIsIgnored() {
        val registry = NativeRegistry(listOf(IntResolver()))
        assertNull(registry.resolve("42", String::class.java))
    }

    @Test
    fun firstMatchWins() {
        val first = "first"
        val second = "second"
        val registry =
            NativeRegistry(
                listOf(
                    StubStringResolver("key", first),
                    StubStringResolver("key", second),
                ),
            )

        assertSame(first, registry.resolve("key", String::class.java))
    }

    @Test
    fun addedResolverTakesPriority() {
        val registry =
            NativeRegistry(
                listOf(
                    StubStringResolver("key", "default"),
                ),
            )

        registry.addResolver(StubStringResolver("key", "custom"))

        assertEquals("custom", registry.resolve("key", String::class.java))
    }

    @Test
    fun unrecognizedKeyReturnsNull() {
        val registry =
            NativeRegistry(
                listOf(
                    StubStringResolver("known", "value"),
                ),
            )

        assertNull(registry.resolve("unknown", String::class.java))
    }

    @Test
    fun concurrentAccess() {
        val registry = NativeRegistry()
        val iterations = 1000
        val executor = Executors.newFixedThreadPool(8)
        val latch = CountDownLatch(iterations)

        repeat(iterations) { i ->
            executor.submit {
                try {
                    if (i % 2 == 0) {
                        registry.addResolver(StubStringResolver("key-$i", "val-$i"))
                    } else {
                        registry.resolve("key-$i", String::class.java)
                    }
                } finally {
                    latch.countDown()
                }
            }
        }

        latch.await()
        executor.shutdown()
        // If we reach here without crashing, concurrent access is safe.
    }
}
