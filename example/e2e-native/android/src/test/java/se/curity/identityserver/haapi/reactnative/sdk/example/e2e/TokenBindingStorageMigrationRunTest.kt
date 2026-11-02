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
package se.curity.identityserver.haapi.reactnative.sdk.example.e2e

import android.app.ActivityManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.os.Parcel
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkObject
import io.mockk.mockkStatic
import io.mockk.unmockkAll
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import se.curity.identityserver.haapi.android.driver.Storage
import se.curity.identityserver.haapi.android.driver.StorageBuilder
import se.curity.identityserver.haapi.reactnative.sdk.RNStorage
import java.util.concurrent.atomic.AtomicInteger

/**
 * [TokenBindingStorageMigration.run], the entry point the app calls from `Application.onCreate()`: every one
 * of the app's processes calls it, so it moves only in the app's main process, and only once in it. A
 * process here is its id; the native default storage is in memory. The JVM runs the lookup Android 8.x uses
 * for the process name; Android 9 and later answer it with `Application.getProcessName()`.
 */
class TokenBindingStorageMigrationRunTest {
    private val previous = ExistingStore(mapOf("HAAPI_KP_LOCATION_haapi-dpop-example-s-0123456789abcdef" to "Hardware"))
    private val defaultStorage = InMemoryNativeStorage()
    private val state = MemoryPreferences()

    @Before
    fun setUp() {
        mockkStatic(android.os.Process::class)
        mockkObject(StorageBuilder)
        every { StorageBuilder.encrypted(any(), any()) } returns defaultStorage
    }

    @After
    fun tearDown() = unmockkAll()

    @Test
    fun theMainProcessMoves() {
        val main = process(APP)

        TokenBindingStorageMigration.run(main, previous)

        assertEquals("Hardware", defaultStorage.get(previous.entries.keys.single()))
    }

    @Test
    fun anotherProcessOfTheAppNeverMoves() {
        // A widget's process starts later in the same launch, after the main process prepared the move. Its
        // copy would miss what the main process does from then on, so it must not switch the app.
        TokenBindingStorageMigration.run(process(APP), previous)
        val copied = defaultStorage.getAll()

        val widget = process("$APP:widget")
        TokenBindingStorageMigration.run(widget, previous)

        assertFalse(TokenBindingStorageMigration.useDefaultStorage(widget))
        assertEquals(copied, defaultStorage.getAll())
    }

    @Test
    fun aSecondCallInTheSameProcessDoesNotSwitch() {
        // Only a canary an earlier process wrote proves that the default storage survives a restart.
        val main = process(APP)
        TokenBindingStorageMigration.run(main, previous)

        TokenBindingStorageMigration.run(main, previous)
        assertFalse(TokenBindingStorageMigration.useDefaultStorage(main))

        val nextLaunch = process(APP)
        TokenBindingStorageMigration.run(nextLaunch, previous)
        assertTrue(TokenBindingStorageMigration.useDefaultStorage(nextLaunch))
    }

    /** A new process of the app, named [name], with its own id; the app's main process is named [APP]. */
    private fun process(name: String): Context {
        val pid = nextPid.incrementAndGet()
        every { android.os.Process.myPid() } returns pid
        state.restart()
        val running =
            mockk<ActivityManager.RunningAppProcessInfo>().apply {
                this.pid = pid
                processName = name
            }
        val activityManager = mockk<ActivityManager> { every { runningAppProcesses } returns listOf(running) }
        val application = mockk<ApplicationInfo>().apply { processName = APP }
        return mockk {
            every { applicationInfo } returns application
            every { getSystemService(Context.ACTIVITY_SERVICE) } returns activityManager
            every { getSharedPreferences("token_binding_migration", Context.MODE_PRIVATE) } returns state
        }
    }

    private class ExistingStore(
        initial: Map<String, String>,
    ) : RNStorage {
        val entries = initial.toMutableMap()

        override fun delete(key: String) {
            entries.remove(key)
        }

        override fun get(key: String): String? = entries[key]

        override fun getAll(): Map<String, String> = entries.toMap()

        override fun set(
            value: String,
            key: String,
        ) {
            entries[key] = value
        }
    }

    /** The native SDK's default storage, in memory. */
    private class InMemoryNativeStorage : Storage {
        private val entries = mutableMapOf<String, String>()

        override fun delete(key: String) {
            entries.remove(key)
        }

        override fun get(key: String): String? = entries[key]

        override fun getAll(): Map<String, String> = entries.toMap()

        override fun set(
            value: String,
            key: String,
        ) {
            entries[key] = value
        }

        override fun describeContents(): Int = 0

        override fun writeToParcel(
            dest: Parcel,
            flags: Int,
        ) = Unit
    }

    private companion object {
        const val APP = "com.example.app"

        /** Ids no other test in this JVM has used: the move remembers the process it last ran in. */
        val nextPid = AtomicInteger(1000)
    }
}
