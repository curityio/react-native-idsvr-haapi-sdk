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

import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import se.curity.identityserver.haapi.android.driver.internal.HaapiUnrecoverableException
import se.curity.identityserver.haapi.android.sdk.models.HaapiResponse
import se.curity.identityserver.haapi.android.sdk.models.Link
import se.curity.identityserver.haapi.android.sdk.models.actions.FormActionModel
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNFormActionModelRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNHaapiRepresentationRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNHaapiResponseRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNLinkRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNResponseCategory
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNStepType

// region Stubs
//
// Hand-rolled stubs for our own interfaces (HaapiFlowInvoker / HaapiResponseMapping)
// — clearer than Mockito and avoids surprise behaviors. Mockito is only used
// to stand in for SDK types with `internal` constructors (FormActionModel,
// Link) — see the per-test `mock { on { ... } doReturn ... }` blocks.

private class RecordingMapping : HaapiResponseMapping {
    override var collectedFormActionModels: List<FormActionModel> = emptyList()
    override var collectedLinks: List<Link> = emptyList()

    var convertedResponses = mutableListOf<HaapiResponse>()
    var stubbedRecord: RNHaapiResponseRecord = RNHaapiResponseRecord()

    override fun convert(response: HaapiResponse): RNHaapiResponseRecord {
        convertedResponses += response
        return stubbedRecord
    }
}

private class RecordingInvoker : HaapiFlowInvoker {
    var startCalls = 0
    var submitFormCalls = mutableListOf<Pair<FormActionModel, Map<String, Any>>>()
    var followLinkCalls = mutableListOf<Link>()

    var stubbedResponse: HaapiResponse = mockk(relaxed = true)
    var startThrows: Throwable? = null
    var submitFormThrows: Throwable? = null
    var followLinkThrows: Throwable? = null

    override suspend fun start(): HaapiResponse {
        startCalls += 1
        startThrows?.let { throw it }
        return stubbedResponse
    }

    override suspend fun submitForm(
        form: FormActionModel,
        parameters: Map<String, Any>,
    ): HaapiResponse {
        submitFormCalls += form to parameters
        submitFormThrows?.let { throw it }
        return stubbedResponse
    }

    override suspend fun followLink(link: Link): HaapiResponse {
        followLinkCalls += link
        followLinkThrows?.let { throw it }
        return stubbedResponse
    }
}

// endregion

class RNHaapiManagerBridgeTest {
    // region Keystore failures of a hardware-only DPoP key

    private val keystoreFailure = HaapiUnrecoverableException.KeyStoreException(Exception("keystore"))

    @Test
    fun keystoreFailureIsReportedAsADpopKeyFailureWhenTheBindingSaysSo() =
        runTest {
            val invoker = RecordingInvoker().apply { startThrows = keystoreFailure }
            val bridge = RNHaapiManagerBridge(invoker, RecordingMapping(), keyStoreFailureIsDpopKey = true)

            try {
                bridge.start()
                fail("Expected DpopKeyCreationException")
            } catch (e: DpopKeyCreationException) {
                assertSame(keystoreFailure, e.cause)
            }
        }

    @Test
    fun keystoreFailurePropagatesUnchangedOtherwise() =
        runTest {
            val invoker = RecordingInvoker().apply { startThrows = keystoreFailure }
            val bridge = RNHaapiManagerBridge(invoker, RecordingMapping())

            try {
                bridge.start()
                fail("Expected the native KeyStoreException")
            } catch (e: HaapiUnrecoverableException.KeyStoreException) {
                assertSame(keystoreFailure, e)
            }
        }

    @Test
    fun otherFailuresPropagateUnchangedEvenForAHardwareOnlyKey() =
        runTest {
            val other = IllegalStateException("boom")
            val invoker = RecordingInvoker().apply { startThrows = other }
            val bridge = RNHaapiManagerBridge(invoker, RecordingMapping(), keyStoreFailureIsDpopKey = true)

            try {
                bridge.start()
                fail("Expected the original exception")
            } catch (e: IllegalStateException) {
                assertSame(other, e)
            }
        }

    // A HAAPI token that expires mid-flow is renewed inside submitForm / followLink, which mints a new DPoP key.

    private val cachedForm =
        RNFormActionModelRecord().apply {
            href = "/authn/x"
            method = "POST"
        }
    private val cachedLink =
        RNLinkRecord().apply {
            href = "/x"
            rel = "self"
        }

    /** A bridge whose cache holds [cachedForm] and [cachedLink], as after `start()`. */
    private suspend fun startedBridge(
        invoker: RecordingInvoker,
        keyStoreFailureIsDpopKey: Boolean = false,
    ): RNHaapiManagerBridge {
        val mapping =
            RecordingMapping().apply {
                collectedFormActionModels =
                    listOf(
                        mockk<FormActionModel> {
                            every { href } returns "/authn/x"
                            every { method } returns "POST"
                        },
                    )
                collectedLinks =
                    listOf(
                        mockk<Link> {
                            every { href } returns "/x"
                            every { rel } returns "self"
                        },
                    )
            }
        return RNHaapiManagerBridge(invoker, mapping, keyStoreFailureIsDpopKey).apply { start() }
    }

    @Test
    fun submitFormReportsAKeystoreFailureAsADpopKeyFailureWhenTheBindingSaysSo() =
        runTest {
            val invoker = RecordingInvoker().apply { submitFormThrows = keystoreFailure }
            val bridge = startedBridge(invoker, keyStoreFailureIsDpopKey = true)

            try {
                bridge.submitForm(cachedForm, emptyMap())
                fail("Expected DpopKeyCreationException")
            } catch (e: DpopKeyCreationException) {
                assertSame(keystoreFailure, e.cause)
            }
        }

    @Test
    fun submitFormPropagatesAKeystoreFailureUnchangedOtherwise() =
        runTest {
            val invoker = RecordingInvoker().apply { submitFormThrows = keystoreFailure }
            val bridge = startedBridge(invoker)

            try {
                bridge.submitForm(cachedForm, emptyMap())
                fail("Expected the native KeyStoreException")
            } catch (e: HaapiUnrecoverableException.KeyStoreException) {
                assertSame(keystoreFailure, e)
            }
        }

    @Test
    fun followLinkReportsAKeystoreFailureAsADpopKeyFailureWhenTheBindingSaysSo() =
        runTest {
            val invoker = RecordingInvoker().apply { followLinkThrows = keystoreFailure }
            val bridge = startedBridge(invoker, keyStoreFailureIsDpopKey = true)

            try {
                bridge.followLink(cachedLink)
                fail("Expected DpopKeyCreationException")
            } catch (e: DpopKeyCreationException) {
                assertSame(keystoreFailure, e.cause)
            }
        }

    @Test
    fun followLinkPropagatesAKeystoreFailureUnchangedOtherwise() =
        runTest {
            val invoker = RecordingInvoker().apply { followLinkThrows = keystoreFailure }
            val bridge = startedBridge(invoker)

            try {
                bridge.followLink(cachedLink)
                fail("Expected the native KeyStoreException")
            } catch (e: HaapiUnrecoverableException.KeyStoreException) {
                assertSame(keystoreFailure, e)
            }
        }

    // endregion

    // region start

    @Test
    fun startCallsInvokerAndConvertsResponse() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            val record = bridge.start()

            assertEquals(1, invoker.startCalls)
            assertEquals(1, mapping.convertedResponses.size)
            assertSame(invoker.stubbedResponse, mapping.convertedResponses.first())
            assertSame(mapping.stubbedRecord, record)
        }

    @Test
    fun startPopulatesCacheFromMapperCollectedFields() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val expectedModel: FormActionModel = mockk(relaxed = true)
            val expectedLink: Link = mockk(relaxed = true)
            mapping.collectedFormActionModels = listOf(expectedModel)
            mapping.collectedLinks = listOf(expectedLink)

            val bridge = RNHaapiManagerBridge(invoker, mapping)
            bridge.start()

            assertEquals(listOf(expectedModel), bridge.lastFormActionModels)
            assertEquals(listOf(expectedLink), bridge.lastLinks)
        }

    @Test
    fun startNativeThrowPropagatesUnchanged() =
        runTest {
            // SDK exceptions propagate to the module dispatch which
            // normalizes them into a typed `HaapiError` envelope before
            // they reach JS.
            val invoker = RecordingInvoker().apply { startThrows = RuntimeException("network down") }
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            val thrown =
                try {
                    bridge.start()
                    org.junit.Assert.fail("expected RuntimeException to propagate")
                    error("unreachable")
                } catch (e: RuntimeException) {
                    e
                }

            assertEquals(1, invoker.startCalls)
            assertEquals("network down", thrown.message)
            assertEquals("mapper must not see a response when invoker throws", 0, mapping.convertedResponses.size)
        }

    // endregion

    // region submitForm

    @Test
    fun submitFormWithCachedActionForwardsToInvoker() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val cachedModel: FormActionModel =
                mockk {
                    every { href } returns "/authn/authentication/select"
                    every { method } returns "POST"
                }
            mapping.collectedFormActionModels = listOf(cachedModel)
            val bridge = RNHaapiManagerBridge(invoker, mapping)
            bridge.start() // populates cache
            mapping.convertedResponses.clear() // reset to assert the next convert

            val record =
                bridge.submitForm(
                    record =
                        RNFormActionModelRecord().apply {
                            href = "/authn/authentication/select"
                            method = "POST"
                        },
                    parameters = mapOf("authenticator" to "username"),
                )

            assertEquals(1, invoker.submitFormCalls.size)
            assertSame(cachedModel, invoker.submitFormCalls.first().first)
            assertEquals(mapOf("authenticator" to "username"), invoker.submitFormCalls.first().second)
            assertSame(mapping.stubbedRecord, record)
        }

    @Test
    fun submitFormWithUnknownActionThrowsWithoutCallingInvoker() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            val ex =
                try {
                    bridge.submitForm(
                        record =
                            RNFormActionModelRecord().apply {
                                href = "/unknown"
                                method = "GET"
                            },
                        parameters = emptyMap(),
                    )
                    org.junit.Assert.fail("expected HaapiAccessorStore.StoreException")
                    error("unreachable")
                } catch (e: HaapiAccessorStore.StoreException) {
                    e
                }

            assertEquals(
                "cache miss should surface as HAAPI_FLOW_CACHE_MISS",
                HaapiAccessorStore.ERROR_FLOW_CACHE_MISS,
                ex.code,
            )
            assertTrue(
                "message should mention href + method",
                ex.message!!.contains("/unknown") && ex.message!!.contains("GET"),
            )
            assertEquals("invoker must not be called on cache miss", 0, invoker.submitFormCalls.size)
        }

    @Test
    fun submitFormNativeThrowPropagatesUnchanged() =
        runTest {
            // SDK exceptions from `invoker.submitForm` propagate unchanged
            // so the module's normalizer can produce a typed `HaapiError`
            // for JS.
            val invoker =
                RecordingInvoker().apply {
                    submitFormThrows = RuntimeException("submit failed")
                }
            val mapping = RecordingMapping()
            val cachedModel: FormActionModel =
                mockk {
                    every { href } returns "/authn/x"
                    every { method } returns "POST"
                }
            mapping.collectedFormActionModels = listOf(cachedModel)
            val bridge = RNHaapiManagerBridge(invoker, mapping)
            bridge.start() // populates cache

            val thrown =
                try {
                    bridge.submitForm(
                        record =
                            RNFormActionModelRecord().apply {
                                href = "/authn/x"
                                method = "POST"
                            },
                        parameters = emptyMap(),
                    )
                    org.junit.Assert.fail("expected RuntimeException to propagate")
                    error("unreachable")
                } catch (e: RuntimeException) {
                    e
                }

            assertEquals(1, invoker.submitFormCalls.size)
            assertEquals("submit failed", thrown.message)
        }

    // endregion

    // region followLink

    @Test
    fun followLinkWithCachedLinkForwardsToInvoker() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val cachedLink: Link =
                mockk {
                    every { href } returns "/help"
                    every { rel } returns "help"
                }
            mapping.collectedLinks = listOf(cachedLink)
            val bridge = RNHaapiManagerBridge(invoker, mapping)
            bridge.start() // populates cache

            val record =
                bridge.followLink(
                    RNLinkRecord().apply {
                        href = "/help"
                        rel = "help"
                    },
                )

            assertEquals(1, invoker.followLinkCalls.size)
            assertSame(cachedLink, invoker.followLinkCalls.first())
            assertSame(mapping.stubbedRecord, record)
        }

    @Test
    fun followLinkWithUnknownLinkThrowsWithoutCallingInvoker() =
        runTest {
            val invoker = RecordingInvoker()
            val bridge = RNHaapiManagerBridge(invoker, RecordingMapping())

            val ex =
                try {
                    bridge.followLink(
                        RNLinkRecord().apply {
                            href = "/missing"
                            rel = "next"
                        },
                    )
                    org.junit.Assert.fail("expected HaapiAccessorStore.StoreException")
                    error("unreachable")
                } catch (e: HaapiAccessorStore.StoreException) {
                    e
                }

            assertEquals(
                "cache miss should surface as HAAPI_FLOW_CACHE_MISS",
                HaapiAccessorStore.ERROR_FLOW_CACHE_MISS,
                ex.code,
            )
            assertTrue(
                "message should mention href + rel",
                ex.message!!.contains("/missing") && ex.message!!.contains("next"),
            )
            assertEquals("invoker must not be called on cache miss", 0, invoker.followLinkCalls.size)
        }

    @Test
    fun followLinkNativeThrowPropagatesUnchanged() =
        runTest {
            // SDK exceptions from `invoker.followLink` propagate unchanged
            // so the module's normalizer can produce a typed `HaapiError`
            // for JS.
            val invoker =
                RecordingInvoker().apply {
                    followLinkThrows = RuntimeException("follow failed")
                }
            val mapping = RecordingMapping()
            val cachedLink: Link =
                mockk {
                    every { href } returns "/x"
                    every { rel } returns "self"
                }
            mapping.collectedLinks = listOf(cachedLink)
            val bridge = RNHaapiManagerBridge(invoker, mapping)
            bridge.start()

            val thrown =
                try {
                    bridge.followLink(
                        RNLinkRecord().apply {
                            href = "/x"
                            rel = "self"
                        },
                    )
                    org.junit.Assert.fail("expected RuntimeException to propagate")
                    error("unreachable")
                } catch (e: RuntimeException) {
                    e
                }

            assertEquals(1, invoker.followLinkCalls.size)
            assertEquals("follow failed", thrown.message)
        }

    // endregion

    // region clearCaches

    @Test
    fun clearCachesEmptiesBothLists() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping =
                RecordingMapping().apply {
                    collectedFormActionModels = listOf(mockk(relaxed = true))
                    collectedLinks = listOf(mockk(relaxed = true))
                }
            val bridge = RNHaapiManagerBridge(invoker, mapping)
            bridge.start() // populates cache

            assertTrue(bridge.lastFormActionModels.isNotEmpty())
            assertTrue(bridge.lastLinks.isNotEmpty())

            bridge.clearCaches()

            assertTrue(bridge.lastFormActionModels.isEmpty())
            assertTrue(bridge.lastLinks.isEmpty())
        }

    @Test
    fun clearCachesOnFreshBridgeIsNoOp() {
        val bridge = RNHaapiManagerBridge(RecordingInvoker(), RecordingMapping())
        bridge.clearCaches() // must not throw
        assertTrue(bridge.lastFormActionModels.isEmpty())
        assertTrue(bridge.lastLinks.isEmpty())
    }

    // endregion

    // region HSRN-33 flow-lifetime cache semantics
    //
    // These tests pin down the accumulating cache + reset rules introduced
    // by HSRN-33. The rules:
    //   - start() -> anything: reset, then add.
    //   - followLink() -> new-step representation: reset, then add.
    //   - followLink() -> continuation step (continueSame / polling): merge.
    //   - submitForm() / *-> problem: append (never reset).
    //   - Lookup is newest-first (`findLast`).
    //   - Dedup-on-append keeps cache size bounded under polling.
    //
    // `RecordingMapping.stubbedRecord.responseCategory` is the bridge's
    // `isRepresentation` signal and `.representation?.stepType` is the
    // continuation signal (the bridge reads both off the converted record),
    // so these tests drive them by setting those fields before each call.

    private fun formActionMock(
        hrefValue: String,
        methodValue: String = "POST",
    ): FormActionModel =
        mockk {
            every { href } returns hrefValue
            every { method } returns methodValue
        }

    private fun linkMock(
        hrefValue: String,
        relValue: String,
    ): Link =
        mockk {
            every { href } returns hrefValue
            every { rel } returns relValue
        }

    private fun representationRecord(step: RNStepType): RNHaapiRepresentationRecord =
        RNHaapiRepresentationRecord().apply { stepType = step }

    /** HSRN-33 happy path: representation -> submitForm -> problem -> resubmit succeeds. */
    @Test
    fun problemResponseDoesNotEvictPriorFormAction() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            // Step 1: start() -> representation with the login form.
            val loginAction = formActionMock("/login")
            mapping.stubbedRecord.responseCategory = RNResponseCategory.REPRESENTATION
            mapping.collectedFormActionModels = listOf(loginAction)
            mapping.collectedLinks = emptyList()
            bridge.start()

            // Step 2: submitForm -> problem (problem only carries its own links).
            val problemLink = linkMock("/help", "help")
            mapping.stubbedRecord.responseCategory = RNResponseCategory.PROBLEM
            mapping.collectedFormActionModels = emptyList()
            mapping.collectedLinks = listOf(problemLink)
            bridge.submitForm(
                record =
                    RNFormActionModelRecord().apply {
                        href = "/login"
                        method = "POST"
                    },
                parameters = emptyMap(),
            )

            // Step 3: retry the original form -- pre-HSRN-33 this threw FlowCacheMiss.
            bridge.submitForm(
                record =
                    RNFormActionModelRecord().apply {
                        href = "/login"
                        method = "POST"
                    },
                parameters = mapOf("fixed" to "true"),
            )

            assertEquals("both submit attempts must reach the invoker", 2, invoker.submitFormCalls.size)
            assertEquals(
                "prior form action remains cached across the problem",
                listOf("/login"),
                bridge.lastFormActionModels.map { it.href },
            )
            assertTrue(
                "problem.links are additive -- not replacing",
                bridge.lastLinks.any { it.href == "/help" && it.rel == "help" },
            )
        }

    /** Screenshot reproduction: prior-step link must remain followable after a problem. */
    @Test
    fun problemResponseDoesNotEvictPriorRepresentationLink() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            val registerLink = linkMock("/dev/authn/register/create/htmlSql", "register-create")
            val loginAction = formActionMock("/login")
            mapping.stubbedRecord.responseCategory = RNResponseCategory.REPRESENTATION
            mapping.collectedFormActionModels = listOf(loginAction)
            mapping.collectedLinks = listOf(registerLink)
            bridge.start()

            // submitForm -> problem whose links DO NOT include `register-create`.
            mapping.stubbedRecord.responseCategory = RNResponseCategory.PROBLEM
            mapping.collectedFormActionModels = emptyList()
            mapping.collectedLinks = listOf(linkMock("/help", "help"))
            bridge.submitForm(
                record =
                    RNFormActionModelRecord().apply {
                        href = "/login"
                        method = "POST"
                    },
                parameters = emptyMap(),
            )

            // User taps the register-create button rendered from the prior step.
            bridge.followLink(
                RNLinkRecord().apply {
                    href = "/dev/authn/register/create/htmlSql"
                    rel = "register-create"
                },
            )

            assertEquals(
                "follow on the prior-representation link must reach the invoker",
                1,
                invoker.followLinkCalls.size,
            )
            assertSame(registerLink, invoker.followLinkCalls.first())
        }

    /** submitForm -> representation B accumulates (does not reset). */
    @Test
    fun submitFormToRepresentationAccumulatesModels() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            val loginAction = formActionMock("/login")
            mapping.stubbedRecord.responseCategory = RNResponseCategory.REPRESENTATION
            mapping.collectedFormActionModels = listOf(loginAction)
            mapping.collectedLinks = emptyList()
            bridge.start()

            val mfaAction = formActionMock("/mfa")
            mapping.collectedFormActionModels = listOf(mfaAction)
            mapping.collectedLinks = emptyList()
            bridge.submitForm(
                record =
                    RNFormActionModelRecord().apply {
                        href = "/login"
                        method = "POST"
                    },
                parameters = emptyMap(),
            )

            assertEquals(
                "submitForm to a representation must accumulate -- prior step's action stays cached",
                listOf("/login", "/mfa"),
                bridge.lastFormActionModels.map { it.href },
            )
        }

    /** followLink -> new-step representation evicts prior step's surface. */
    @Test
    fun followLinkToRepresentationResetsCache() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            val loginAction = formActionMock("/login")
            val registerLink = linkMock("/register", "register-create")
            mapping.stubbedRecord.responseCategory = RNResponseCategory.REPRESENTATION
            mapping.stubbedRecord.representation = representationRecord(RNStepType.INTERACTIVE_FORM)
            mapping.collectedFormActionModels = listOf(loginAction)
            mapping.collectedLinks = listOf(registerLink)
            bridge.start()

            // followLink lands on a NEW-step (interactive form) representation,
            // so prior step's models are evicted.
            val registerForm = formActionMock("/register")
            val cancelLink = linkMock("/cancel", "cancel")
            mapping.stubbedRecord.representation = representationRecord(RNStepType.INTERACTIVE_FORM)
            mapping.collectedFormActionModels = listOf(registerForm)
            mapping.collectedLinks = listOf(cancelLink)
            bridge.followLink(
                RNLinkRecord().apply {
                    href = "/register"
                    rel = "register-create"
                },
            )

            assertEquals(
                "followLink -> new-step representation evicts prior step's actions",
                listOf("/register"),
                bridge.lastFormActionModels.map { it.href },
            )
            assertEquals(
                "followLink -> new-step representation evicts prior step's links",
                listOf("/cancel"),
                bridge.lastLinks.map { it.href },
            )
        }

    /**
     * followLink -> ContinueSameStep MUST merge, not reset. A continue-same-step
     * is the *same* logical step continuing (e.g. after a client operation), so
     * prior chrome -- a `cancel` link, a prior form -- must stay addressable for
     * a responsive multi-model UI.
     */
    @Test
    fun followLinkToContinueSameStepMergesCache() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            val loginAction = formActionMock("/login")
            val cancelLink = linkMock("/cancel", "cancel")
            mapping.stubbedRecord.responseCategory = RNResponseCategory.REPRESENTATION
            mapping.stubbedRecord.representation = representationRecord(RNStepType.INTERACTIVE_FORM)
            mapping.collectedFormActionModels = listOf(loginAction)
            mapping.collectedLinks = listOf(cancelLink)
            bridge.start()

            // followLink(cancel) -> ContinueSameStep with a poll action. Merge.
            val pollAction = formActionMock("/poll")
            mapping.stubbedRecord.representation = representationRecord(RNStepType.CONTINUE_SAME)
            mapping.collectedFormActionModels = listOf(pollAction)
            mapping.collectedLinks = emptyList()
            bridge.followLink(
                RNLinkRecord().apply {
                    href = "/cancel"
                    rel = "cancel"
                },
            )

            assertEquals(
                "followLink -> continueSame merges: prior action kept, continuation's added",
                listOf("/login", "/poll"),
                bridge.lastFormActionModels.map { it.href },
            )
            assertEquals(
                "prior step's cancel link survives a continue-same continuation",
                listOf("/cancel"),
                bridge.lastLinks.map { it.href },
            )
        }

    /**
     * followLink -> PollingStep: same merge semantics as continueSame. A polling
     * step reached via a link is the same out-of-band operation continuing, so
     * prior state is preserved.
     */
    @Test
    fun followLinkToPollingStepMergesCache() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            val loginAction = formActionMock("/login")
            val pollLink = linkMock("/poll", "poll")
            mapping.stubbedRecord.responseCategory = RNResponseCategory.REPRESENTATION
            mapping.stubbedRecord.representation = representationRecord(RNStepType.INTERACTIVE_FORM)
            mapping.collectedFormActionModels = listOf(loginAction)
            mapping.collectedLinks = listOf(pollLink)
            bridge.start()

            val pollAction = formActionMock("/poll")
            mapping.stubbedRecord.representation = representationRecord(RNStepType.POLLING)
            mapping.collectedFormActionModels = listOf(pollAction)
            mapping.collectedLinks = emptyList()
            bridge.followLink(
                RNLinkRecord().apply {
                    href = "/poll"
                    rel = "poll"
                },
            )

            assertEquals(
                "followLink -> polling merges: prior action kept alongside the poll action",
                listOf("/login", "/poll"),
                bridge.lastFormActionModels.map { it.href },
            )
        }

    /**
     * submitForm -> ContinueSameStep merges (submitForm never resets). The
     * continue action typically arrives after a client operation completes;
     * the prior step's form + links must stay re-dispatchable.
     */
    @Test
    fun submitFormToContinueSameStepMergesCache() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            val loginAction = formActionMock("/login")
            val cancelLink = linkMock("/cancel", "cancel")
            mapping.stubbedRecord.responseCategory = RNResponseCategory.REPRESENTATION
            mapping.stubbedRecord.representation = representationRecord(RNStepType.INTERACTIVE_FORM)
            mapping.collectedFormActionModels = listOf(loginAction)
            mapping.collectedLinks = listOf(cancelLink)
            bridge.start()

            val continueAction = formActionMock("/continue")
            mapping.stubbedRecord.representation = representationRecord(RNStepType.CONTINUE_SAME)
            mapping.collectedFormActionModels = listOf(continueAction)
            mapping.collectedLinks = emptyList()
            bridge.submitForm(
                record =
                    RNFormActionModelRecord().apply {
                        href = "/login"
                        method = "POST"
                    },
                parameters = emptyMap(),
            )

            assertEquals(
                "submitForm -> continueSame merges: prior login action kept, continue added",
                listOf("/login", "/continue"),
                bridge.lastFormActionModels.map { it.href },
            )
            assertEquals(
                "prior step's cancel link survives a submitForm-driven continue-same step",
                listOf("/cancel"),
                bridge.lastLinks.map { it.href },
            )
        }

    /**
     * Realistic polling loop: start -> form -> submitForm -> PollingStep
     * (pending), then re-submit the poll action repeatedly. Each poll must
     * resolve (reach the invoker), the cache stays bounded (dedup), and the
     * prior login action is preserved across the whole loop.
     */
    @Test
    fun pollingStepLoopResolvesAndStaysBounded() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            val loginAction = formActionMock("/login")
            mapping.stubbedRecord.responseCategory = RNResponseCategory.REPRESENTATION
            mapping.stubbedRecord.representation = representationRecord(RNStepType.INTERACTIVE_FORM)
            mapping.collectedFormActionModels = listOf(loginAction)
            mapping.collectedLinks = emptyList()
            bridge.start()

            // submitForm(/login) -> PollingStep (pending) with poll + cancel.
            mapping.stubbedRecord.representation = representationRecord(RNStepType.POLLING)
            mapping.collectedFormActionModels = listOf(formActionMock("/poll"))
            mapping.collectedLinks = listOf(linkMock("/cancel", "cancel"))
            bridge.submitForm(
                record =
                    RNFormActionModelRecord().apply {
                        href = "/login"
                        method = "POST"
                    },
                parameters = emptyMap(),
            )

            // Re-submit the poll action; each response is a fresh PollingStep.
            repeat(10) {
                mapping.collectedFormActionModels = listOf(formActionMock("/poll"))
                mapping.collectedLinks = listOf(linkMock("/cancel", "cancel"))
                bridge.submitForm(
                    record =
                        RNFormActionModelRecord().apply {
                            href = "/poll"
                            method = "POST"
                        },
                    parameters = emptyMap(),
                )
            }

            assertEquals(
                "every poll iteration must resolve the poll action and reach the invoker (1 login + 10 polls)",
                11,
                invoker.submitFormCalls.size,
            )
            assertEquals(
                "poll loop stays bounded -- one /login + one /poll, no per-iteration growth",
                listOf("/login", "/poll"),
                bridge.lastFormActionModels.map { it.href },
            )
            assertEquals(
                "poll loop keeps a single /cancel link, not one per iteration",
                listOf("/cancel"),
                bridge.lastLinks.map { it.href },
            )
        }

    /**
     * followLink -> continuation step in a LOOP. The `followLink` branch is the
     * only call kind whose reset decision reads isContinuation (start always
     * resets; submitForm never does), and both existing bounded-loop tests
     * drive submitForm. This locks the followLink->continuation branch under
     * repetition: it must keep merging (never reset), stay bounded, and leave
     * the prior step's action dispatchable. Alternates polling / continueSame
     * to exercise both continuation types on this branch.
     */
    @Test
    fun followLinkToContinuationStepLoopResolvesAndStaysBounded() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            // Step 1: start() -> interactive form A: login action + cancel link.
            mapping.stubbedRecord.responseCategory = RNResponseCategory.REPRESENTATION
            mapping.stubbedRecord.representation = representationRecord(RNStepType.INTERACTIVE_FORM)
            mapping.collectedFormActionModels = listOf(formActionMock("/login"))
            mapping.collectedLinks = listOf(linkMock("/cancel", "cancel"))
            bridge.start()

            // Step 2: 10x followLink(/cancel), each landing on a continuation step
            // (alternating polling / continueSame). The cancel link is re-emitted
            // each iteration so it stays resolvable for the next follow.
            repeat(10) { i ->
                mapping.stubbedRecord.representation =
                    representationRecord(
                        if (i % 2 == 0) RNStepType.POLLING else RNStepType.CONTINUE_SAME,
                    )
                mapping.collectedFormActionModels = listOf(formActionMock("/poll"))
                mapping.collectedLinks = listOf(linkMock("/cancel", "cancel"))
                bridge.followLink(
                    RNLinkRecord().apply {
                        href = "/cancel"
                        rel = "cancel"
                    },
                )
            }

            // Step 3: the prior-step /login action must still be dispatchable --
            // if any followLink had reset, /login would be gone and this throws.
            bridge.submitForm(
                record =
                    RNFormActionModelRecord().apply {
                        href = "/login"
                        method = "POST"
                    },
                parameters = emptyMap(),
            )

            assertEquals(
                "every followLink to a continuation step must reach the invoker across the loop",
                10,
                invoker.followLinkCalls.size,
            )
            assertEquals(
                "followLink -> continuation loop never resets (/login survives) and stays bounded (single /poll)",
                listOf("/login", "/poll"),
                bridge.lastFormActionModels.map { it.href },
            )
            assertEquals(
                "dedup keeps exactly one /cancel link across all 10 continuation follows",
                1,
                bridge.lastLinks.size,
            )
            assertEquals(
                "the prior /login action survived 10 continuation follows and still resolves (no cache miss)",
                1,
                invoker.submitFormCalls.size,
            )
        }

    /** followLink -> problem preserves prior cache (symmetric to submitForm -> problem). */
    @Test
    fun followLinkToProblemPreservesPriorCache() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            val loginAction = formActionMock("/login")
            val helpLink = linkMock("/help", "help")
            mapping.stubbedRecord.responseCategory = RNResponseCategory.REPRESENTATION
            mapping.collectedFormActionModels = listOf(loginAction)
            mapping.collectedLinks = listOf(helpLink)
            bridge.start()

            mapping.stubbedRecord.responseCategory = RNResponseCategory.PROBLEM
            mapping.collectedFormActionModels = emptyList()
            mapping.collectedLinks = listOf(linkMock("/back", "back"))
            bridge.followLink(
                RNLinkRecord().apply {
                    href = "/help"
                    rel = "help"
                },
            )

            assertEquals(
                "followLink -> problem keeps prior form actions",
                listOf("/login"),
                bridge.lastFormActionModels.map { it.href },
            )
            assertEquals(
                "followLink -> problem unions problem.links onto prior link cache",
                setOf("/help", "/back"),
                bridge.lastLinks.map { it.href }.toSet(),
            )
        }

    /**
     * start() mid-flow -> problem: cache is still reset. `start()` always
     * resets — it's the "begin fresh" entry-point. A problem returned by
     * start() doesn't undo the host's signalled intent to abandon prior
     * state. Differs from `submitForm -> problem` and `followLink -> problem`,
     * which both preserve.
     */
    @Test
    fun startToProblemResetsCache() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            val initialAction = formActionMock("/initial")
            val initialLink = linkMock("/help", "help")
            mapping.stubbedRecord.responseCategory = RNResponseCategory.REPRESENTATION
            mapping.collectedFormActionModels = listOf(initialAction)
            mapping.collectedLinks = listOf(initialLink)
            bridge.start()

            // Re-start mid-flow -> server returns a problem (rare but possible).
            mapping.stubbedRecord.responseCategory = RNResponseCategory.PROBLEM
            mapping.collectedFormActionModels = emptyList()
            mapping.collectedLinks = listOf(linkMock("/recover", "recover"))
            bridge.start()

            assertTrue(
                "start() always resets -- prior form actions evicted even when start returns a problem",
                bridge.lastFormActionModels.isEmpty(),
            )
            assertEquals(
                "after reset, only the problem's links remain -- prior step's /help is gone",
                listOf("/recover"),
                bridge.lastLinks.map { it.href },
            )
        }

    /** start() mid-flow -> representation resets the cache. */
    @Test
    fun startToRepresentationResetsCache() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            val initialAction = formActionMock("/initial")
            mapping.stubbedRecord.responseCategory = RNResponseCategory.REPRESENTATION
            mapping.collectedFormActionModels = listOf(initialAction)
            mapping.collectedLinks = emptyList()
            bridge.start()

            val freshAction = formActionMock("/fresh")
            mapping.collectedFormActionModels = listOf(freshAction)
            mapping.collectedLinks = emptyList()
            bridge.start()

            assertEquals(
                "start() to a fresh representation must replace the cache, not accumulate",
                listOf("/fresh"),
                bridge.lastFormActionModels.map { it.href },
            )
        }

    /** Lookup is newest-first: a later cache entry with the same key shadows older ones. */
    @Test
    fun lookupReturnsNewestEntryOnCollision() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            val stepAForm = formActionMock("/submit")
            mapping.stubbedRecord.responseCategory = RNResponseCategory.REPRESENTATION
            mapping.collectedFormActionModels = listOf(stepAForm)
            mapping.collectedLinks = emptyList()
            bridge.start()

            // submitForm advances to representation B that ALSO carries (/submit, POST).
            val stepBForm = formActionMock("/submit")
            mapping.collectedFormActionModels = listOf(stepBForm)
            mapping.collectedLinks = emptyList()
            bridge.submitForm(
                record =
                    RNFormActionModelRecord().apply {
                        href = "/submit"
                        method = "POST"
                    },
                parameters = emptyMap(),
            )

            // Third submit at (/submit, POST) must resolve to step B's instance.
            bridge.submitForm(
                record =
                    RNFormActionModelRecord().apply {
                        href = "/submit"
                        method = "POST"
                    },
                parameters = emptyMap(),
            )

            assertEquals(
                "dedup-on-append collapses duplicate (href, method) entries",
                1,
                bridge.lastFormActionModels.size,
            )
            assertSame(
                "newest-first lookup resolves to step B's FormActionModel",
                stepBForm,
                invoker.submitFormCalls.last().first,
            )
        }

    /** Polling does NOT grow the cache unboundedly thanks to dedup-on-append. */
    @Test
    fun pollingDoesNotGrowCacheUnboundedly() =
        runTest {
            val invoker = RecordingInvoker()
            val mapping = RecordingMapping()
            val bridge = RNHaapiManagerBridge(invoker, mapping)

            val pollAction = formActionMock("/poll")
            val cancelLink = linkMock("/cancel", "cancel")
            mapping.stubbedRecord.responseCategory = RNResponseCategory.REPRESENTATION
            mapping.collectedFormActionModels = listOf(pollAction)
            mapping.collectedLinks = listOf(cancelLink)
            bridge.start()

            // Each poll iteration returns a fresh native instance carrying the same key.
            repeat(10) {
                mapping.collectedFormActionModels = listOf(formActionMock("/poll"))
                mapping.collectedLinks = listOf(linkMock("/cancel", "cancel"))
                bridge.submitForm(
                    record =
                        RNFormActionModelRecord().apply {
                            href = "/poll"
                            method = "POST"
                        },
                    parameters = emptyMap(),
                )
            }

            assertEquals(
                "dedup-on-append keeps exactly one cached entry per unique (href, method)",
                1,
                bridge.lastFormActionModels.size,
            )
            assertEquals(
                "dedup-on-append keeps exactly one cached entry per unique (href, rel)",
                1,
                bridge.lastLinks.size,
            )
            assertEquals(
                "every poll iteration reaches the invoker",
                10,
                invoker.submitFormCalls.size,
            )
        }

    // endregion
}
