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
package se.curity.identityserver.haapi.reactnative.sdk.representations

import io.mockk.every
import io.mockk.mockk
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import se.curity.identityserver.haapi.android.sdk.models.AuthorizationProblem
import se.curity.identityserver.haapi.android.sdk.models.PollingStatus
import se.curity.identityserver.haapi.android.sdk.models.Properties

// MARK: - Polling-properties converter tests (HSRN-20 / Phase 4)
//
// Layer-(a) round-trip and layer-(c) absence assertions for the polling
// converter on Android. Companion to `RepresentationRecordTest`'s
// `propertiesRecordDefault*` block (layer-(b)) and the iOS
// `MappingCommonTests.swift` cross-platform mirror.
//
// The `interval` field was added in HAAPI SDK 5.4.0 (see ai/plans/HSRN-20).
// Each test must FAIL if the corresponding `record.interval = props.interval`
// assignment in `MappingCommon.kt` is re-commented (rule 4 of
// `ai/knowledge/testing-philosophy.md`: failing on the right axis).

class MappingCommonTest {
    // region Fixture loader (shared __fixtures__/polling-properties.json)

    /**
     * Build a `Properties.Polling` test double from the shared JSON fixture.
     *
     * `Properties.Polling`'s primary constructor is Kotlin-source `internal`
     * to the HAAPI SDK module, so this test module can't call it directly
     * (the JVM bytecode is `public` per `javap` but Kotlin enforces the
     * source-level visibility at compile time). MockK stubs the getters
     * instead — the same workaround `RNOAuthTokenManagerBridgeTest` uses
     * for `SuccessfulTokenResponse` and the convention captured in
     * `android/CLAUDE.md`'s "Test Dependencies" block.
     *
     * Reads the named sub-object from `__fixtures__/polling-properties.json`
     * (exposed on the JVM test classpath via
     * `android/build.gradle::sourceSets.test.resources.srcDirs`). The
     * snake_case-vs-camelCase wire-format split documented in the OAuth
     * fixture doesn't apply here — HAAPI uses camelCase on the wire, so the
     * fixture keys match the SDK getter names 1:1.
     */
    private fun pollingProperties(name: String): Properties.Polling {
        val stream =
            requireNotNull(
                MappingCommonTest::class.java.getResourceAsStream("/polling-properties.json"),
            ) {
                "polling-properties.json missing from the test classpath — check " +
                    "`android/build.gradle::sourceSets.test.resources.srcDirs`."
            }
        val raw = JSONObject(stream.bufferedReader().use { it.readText() }).getJSONObject(name)
        return mockk {
            every { recipientOfCommunication } returns
                if (raw.has("recipientOfCommunication")) raw.getString("recipientOfCommunication") else null
            every { status } returns PollingStatus.PENDING
            every { rawJsonString } returns raw.toString()
            every { maxWaitTime } returns if (raw.has("maxWaitTime")) raw.getString("maxWaitTime") else null
            every { maxWaitRemainingTime } returns
                if (raw.has("maxWaitRemainingTime")) raw.getString("maxWaitRemainingTime") else null
            every { interval } returns if (raw.has("interval")) raw.getString("interval") else null
        }
    }

    // endregion

    // region convertPollingProperties (dedicated path)

    @Test
    fun convertPollingPropertiesPendingFullPopulatesAllFields() {
        val mapper = HaapiResponseMapper()
        val props = pollingProperties("pendingFull")

        val record = mapper.convertPollingProperties(props)

        assertEquals("polling", record.kind)
        assertEquals("+46-70-1234567", record.recipientOfCommunication)
        assertEquals(RNPollingStatus.PENDING, record.status)
        assertEquals("5000", record.interval)
        assertEquals("PT5M", record.maxWaitTime)
        assertEquals("PT4M30S", record.maxWaitRemainingTime)
    }

    @Test
    fun convertPollingPropertiesPendingMinimalPropagatesIntervalOnly() {
        val mapper = HaapiResponseMapper()
        val props = pollingProperties("pendingMinimal")

        val record = mapper.convertPollingProperties(props)

        assertEquals("polling", record.kind)
        assertEquals("+46-70-1234567", record.recipientOfCommunication)
        assertEquals(RNPollingStatus.PENDING, record.status)
        assertEquals("5000", record.interval)
        assertNull(record.maxWaitTime)
        assertNull(record.maxWaitRemainingTime)
    }

    @Test
    fun convertPollingPropertiesPendingWithoutIntervalIntervalIsNull() {
        val mapper = HaapiResponseMapper()
        val props = pollingProperties("pendingWithoutInterval")

        val record = mapper.convertPollingProperties(props)

        assertEquals("polling", record.kind)
        assertEquals("+46-70-1234567", record.recipientOfCommunication)
        assertEquals(RNPollingStatus.PENDING, record.status)
        // Layer-(c) assertion: absent interval in fixture must yield null
        // Record field, not an empty string or a stale value.
        assertNull(record.interval)
        assertEquals("PT5M", record.maxWaitTime)
        assertEquals("PT4M30S", record.maxWaitRemainingTime)
    }

    // endregion

    // region convertProperties (generic-dispatch path)

    /**
     * `convertProperties` is the in-line `when` path used by
     * `convertRepresentation` when it walks a `HaapiRepresentation`'s
     * `properties`. The polling arm must wire `interval` exactly like the
     * dedicated `convertPollingProperties` path. Two converters, one
     * contract: tested here so a divergence between the two arms is caught.
     */
    @Test
    fun convertPropertiesPollingPendingFullPopulatesInterval() {
        val mapper = HaapiResponseMapper()
        val props: Properties = pollingProperties("pendingFull")

        // `convertProperties` returns nullable; non-null is the load-bearing
        // contract for our polling case — captured by `requireNotNull`.
        val record = requireNotNull(mapper.convertProperties(props))

        assertEquals("polling", record.kind)
        assertEquals("+46-70-1234567", record.recipientOfCommunication)
        assertEquals(RNPollingStatus.PENDING, record.status)
        assertEquals("5000", record.interval)
        assertEquals("PT5M", record.maxWaitTime)
        assertEquals("PT4M30S", record.maxWaitRemainingTime)
    }

    @Test
    fun convertPropertiesPollingPendingWithoutIntervalIntervalIsNull() {
        val mapper = HaapiResponseMapper()
        val props: Properties = pollingProperties("pendingWithoutInterval")

        val record = requireNotNull(mapper.convertProperties(props))

        assertEquals("polling", record.kind)
        assertNull(record.interval)
    }

    // endregion

    // region convertProblem (AuthorizationProblem.iss — HSRN-0 / HAAPI SDK 5.5.0)
    //
    // `iss` (RFC 9207 issuer identifier) became available on
    // `AuthorizationProblem` in HAAPI SDK 5.5.0. Each test must FAIL if the
    // `record.iss = problem.iss` assignment in `MappingCommon.kt` is
    // re-commented (rule 4 of `ai/knowledge/testing-philosophy.md`).

    /**
     * Build an `AuthorizationProblem` test double from the shared JSON fixture.
     *
     * Pass-through fields the converter reads before the `is AuthorizationProblem`
     * arm (`metadata` / `title` / `messages` / `links`) are stubbed to safe
     * empty values; `type` relaxes to the OTHER discriminator. Only the fields
     * under test (`error` / `errorDescription` / `iss`) carry fixture values.
     * MockK stands in because the SDK model's constructor is source-`internal`
     * to the HAAPI module — same convention as `pollingProperties` above.
     */
    private fun authorizationProblem(name: String): AuthorizationProblem {
        val stream =
            requireNotNull(
                MappingCommonTest::class.java.getResourceAsStream("/authorization-problem.json"),
            ) {
                "authorization-problem.json missing from the test classpath — check " +
                    "`android/build.gradle::sourceSets.test.resources.srcDirs`."
            }
        val raw = JSONObject(stream.bufferedReader().use { it.readText() }).getJSONObject(name)
        return mockk(relaxed = true) {
            every { error } returns raw.getString("error")
            every { errorDescription } returns
                if (raw.has("errorDescription")) raw.getString("errorDescription") else null
            every { iss } returns if (raw.has("iss")) raw.getString("iss") else null
            every { metadata } returns null
            every { title } returns null
            every { messages } returns emptyList()
            every { links } returns emptyList()
        }
    }

    @Test
    fun convertProblemAuthorizationWithIssPopulatesIss() {
        val mapper = HaapiResponseMapper()
        val problem = authorizationProblem("withIss")

        val record = mapper.convertProblem(problem)

        assertEquals("authorization", record.problemKind)
        assertEquals("access_denied", record.error)
        assertEquals("https://issuer.example.com/oauth/v2/oauth-anonymous", record.iss)
    }

    @Test
    fun convertProblemAuthorizationWithoutIssIssIsNull() {
        val mapper = HaapiResponseMapper()
        val problem = authorizationProblem("withoutIss")

        val record = mapper.convertProblem(problem)

        assertEquals("authorization", record.problemKind)
        assertEquals("access_denied", record.error)
        // Layer-(c) assertion: absent iss in fixture must yield null Record
        // field, not an empty string or a stale value.
        assertNull(record.iss)
    }

    // endregion
}
