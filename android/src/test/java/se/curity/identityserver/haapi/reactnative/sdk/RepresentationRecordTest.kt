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
import org.junit.Assert.assertTrue
import org.junit.Test
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNActionKind
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNActionRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNActionType
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNFormFieldRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNFormFieldType
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNHaapiRepresentationRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNHaapiResponseRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNProblemRepresentationRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNProblemType
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNPropertiesRecord
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNRepresentationType
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNResponseCategory
import se.curity.identityserver.haapi.reactnative.sdk.representations.RNStepType

class RepresentationRecordTest {
    // region RNHaapiResponseRecord

    @Test
    fun responseRecordDefaultResponseCategory() {
        val record = RNHaapiResponseRecord()
        assertEquals(RNResponseCategory.REPRESENTATION, record.responseCategory)
    }

    @Test
    fun responseRecordDefaultRepresentationIsNull() {
        val record = RNHaapiResponseRecord()
        assertNull(record.representation)
    }

    @Test
    fun responseRecordDefaultProblemIsNull() {
        val record = RNHaapiResponseRecord()
        assertNull(record.problem)
    }

    // endregion

    // region RNHaapiRepresentationRecord

    @Test
    fun representationRecordDefaultStepType() {
        val record = RNHaapiRepresentationRecord()
        assertEquals(RNStepType.GENERIC_REPRESENTATION, record.stepType)
    }

    @Test
    fun representationRecordDefaultType() {
        val record = RNHaapiRepresentationRecord()
        assertEquals(RNRepresentationType.AUTHENTICATION_STEP, record.type)
    }

    @Test
    fun representationRecordDefaultActionsEmpty() {
        val record = RNHaapiRepresentationRecord()
        assertTrue(record.actions.isEmpty())
    }

    @Test
    fun representationRecordDefaultLinksEmpty() {
        val record = RNHaapiRepresentationRecord()
        assertTrue(record.links.isEmpty())
    }

    @Test
    fun representationRecordDefaultMessagesEmpty() {
        val record = RNHaapiRepresentationRecord()
        assertTrue(record.messages.isEmpty())
    }

    @Test
    fun representationRecordDefaultMetadataIsNull() {
        val record = RNHaapiRepresentationRecord()
        assertNull(record.metadata)
    }

    @Test
    fun representationRecordDefaultTitleIsNull() {
        val record = RNHaapiRepresentationRecord()
        assertNull(record.title)
    }

    @Test
    fun representationRecordDefaultAuthenticatorsIsNull() {
        val record = RNHaapiRepresentationRecord()
        assertNull(record.authenticators)
    }

    @Test
    fun representationRecordDefaultPropertiesIsNull() {
        val record = RNHaapiRepresentationRecord()
        assertNull(record.properties)
    }

    @Test
    fun representationRecordDefaultRedirectActionIsNull() {
        val record = RNHaapiRepresentationRecord()
        assertNull(record.redirectAction)
    }

    @Test
    fun representationRecordDefaultMainActionIsNull() {
        val record = RNHaapiRepresentationRecord()
        assertNull(record.mainAction)
    }

    @Test
    fun representationRecordDefaultCancelActionIsNull() {
        val record = RNHaapiRepresentationRecord()
        assertNull(record.cancelAction)
    }

    @Test
    fun representationRecordDefaultPollingPropertiesIsNull() {
        val record = RNHaapiRepresentationRecord()
        assertNull(record.pollingProperties)
    }

    @Test
    fun representationRecordDefaultOauthPropertiesIsNull() {
        val record = RNHaapiRepresentationRecord()
        assertNull(record.oauthProperties)
    }

    @Test
    fun representationRecordDefaultClientOperationActionModelIsNull() {
        val record = RNHaapiRepresentationRecord()
        assertNull(record.clientOperationActionModel)
    }

    @Test
    fun representationRecordDefaultActivationLinkIsNull() {
        val record = RNHaapiRepresentationRecord()
        assertNull(record.activationLink)
    }

    // endregion

    // region RNActionRecord

    @Test
    fun actionRecordDefaultActionType() {
        val record = RNActionRecord()
        assertEquals(RNActionType.FORM, record.actionType)
    }

    @Test
    fun actionRecordDefaultKind() {
        val record = RNActionRecord()
        assertEquals(RNActionKind.OTHER, record.kind)
    }

    @Test
    fun actionRecordDefaultTitleIsNull() {
        val record = RNActionRecord()
        assertNull(record.title)
    }

    @Test
    fun actionRecordDefaultModelIsNull() {
        val record = RNActionRecord()
        assertNull(record.model)
    }

    @Test
    fun actionRecordDefaultClientOperationModelIsNull() {
        val record = RNActionRecord()
        assertNull(record.clientOperationModel)
    }

    @Test
    fun actionRecordDefaultOptionsIsNull() {
        val record = RNActionRecord()
        assertNull(record.options)
    }

    // endregion

    // region RNFormFieldRecord

    @Test
    fun formFieldRecordDefaultFieldType() {
        val record = RNFormFieldRecord()
        assertEquals(RNFormFieldType.TEXT, record.fieldType)
    }

    @Test
    fun formFieldRecordDefaultName() {
        val record = RNFormFieldRecord()
        assertEquals("", record.name)
    }

    @Test
    fun formFieldRecordDefaultValueIsNull() {
        val record = RNFormFieldRecord()
        assertNull(record.value)
    }

    @Test
    fun formFieldRecordDefaultIsRequired() {
        val record = RNFormFieldRecord()
        assertTrue(record.isRequired)
    }

    @Test
    fun formFieldRecordDefaultLabelIsNull() {
        val record = RNFormFieldRecord()
        assertNull(record.label)
    }

    @Test
    fun formFieldRecordDefaultPlaceholderIsNull() {
        val record = RNFormFieldRecord()
        assertNull(record.placeholder)
    }

    @Test
    fun formFieldRecordDefaultKindIsNull() {
        val record = RNFormFieldRecord()
        assertNull(record.kind)
    }

    @Test
    fun formFieldRecordDefaultMinLengthIsNull() {
        val record = RNFormFieldRecord()
        assertNull(record.minLength)
    }

    @Test
    fun formFieldRecordDefaultMaxLengthIsNull() {
        val record = RNFormFieldRecord()
        assertNull(record.maxLength)
    }

    @Test
    fun formFieldRecordDefaultOptionsIsNull() {
        val record = RNFormFieldRecord()
        assertNull(record.options)
    }

    @Test
    fun formFieldRecordDefaultCheckedIsNull() {
        val record = RNFormFieldRecord()
        assertNull(record.checked)
    }

    @Test
    fun formFieldRecordDefaultReadOnlyIsNull() {
        val record = RNFormFieldRecord()
        assertNull(record.readOnly)
    }

    // endregion

    // region RNProblemRepresentationRecord

    @Test
    fun problemRecordDefaultProblemKind() {
        val record = RNProblemRepresentationRecord()
        assertEquals("problem", record.problemKind)
    }

    @Test
    fun problemRecordDefaultType() {
        val record = RNProblemRepresentationRecord()
        assertEquals(RNProblemType.UNEXPECTED, record.type)
    }

    @Test
    fun problemRecordDefaultMetadataIsNull() {
        val record = RNProblemRepresentationRecord()
        assertNull(record.metadata)
    }

    @Test
    fun problemRecordDefaultTitleIsNull() {
        val record = RNProblemRepresentationRecord()
        assertNull(record.title)
    }

    @Test
    fun problemRecordDefaultMessagesEmpty() {
        val record = RNProblemRepresentationRecord()
        assertTrue(record.messages.isEmpty())
    }

    @Test
    fun problemRecordDefaultLinksEmpty() {
        val record = RNProblemRepresentationRecord()
        assertTrue(record.links.isEmpty())
    }

    @Test
    fun problemRecordDefaultInvalidFieldsIsNull() {
        val record = RNProblemRepresentationRecord()
        assertNull(record.invalidFields)
    }

    @Test
    fun problemRecordDefaultErrorDescriptionIsNull() {
        val record = RNProblemRepresentationRecord()
        assertNull(record.errorDescription)
    }

    @Test
    fun problemRecordDefaultErrorIsNull() {
        val record = RNProblemRepresentationRecord()
        assertNull(record.error)
    }

    // Layer-(b) lock-in for `RNProblemRepresentationRecord.iss`. The converter
    // wires `iss` from `AuthorizationProblem` as of HAAPI SDK 5.5.0 (HSRN-0 —
    // see the `is AuthorizationProblem` arm in `MappingCommon.kt` and the
    // round-trip tests in `MappingCommonTest`). A default-constructed Record
    // must still report `iss` as null so an absent-`iss` problem never surfaces
    // a stale value.
    @Test
    fun problemRecordDefaultIssIsNull() {
        val record = RNProblemRepresentationRecord()
        assertNull(record.iss)
    }

    // endregion

    // region RNPropertiesRecord (HSRN-20 — lock-in for default state across
    // all polling, OAuth-authorization-response, and generic sub-groups so a
    // future drift in field declarations or initial values is caught at test
    // time rather than at bridge-runtime).

    @Test
    fun propertiesRecordDefaultKind() {
        val record = RNPropertiesRecord()
        assertEquals("generic", record.kind)
    }

    @Test
    fun propertiesRecordDefaultRawJsonStringIsNull() {
        val record = RNPropertiesRecord()
        assertNull(record.rawJsonString)
    }

    // OAuth authorization-response sub-group

    @Test
    fun propertiesRecordDefaultCodeIsNull() {
        val record = RNPropertiesRecord()
        assertNull(record.code)
    }

    @Test
    fun propertiesRecordDefaultIdTokenIsNull() {
        val record = RNPropertiesRecord()
        assertNull(record.idToken)
    }

    @Test
    fun propertiesRecordDefaultScopeIsNull() {
        val record = RNPropertiesRecord()
        assertNull(record.scope)
    }

    @Test
    fun propertiesRecordDefaultStateIsNull() {
        val record = RNPropertiesRecord()
        assertNull(record.state)
    }

    // Polling sub-group

    @Test
    fun propertiesRecordDefaultRecipientOfCommunicationIsNull() {
        val record = RNPropertiesRecord()
        assertNull(record.recipientOfCommunication)
    }

    @Test
    fun propertiesRecordDefaultStatusIsNull() {
        val record = RNPropertiesRecord()
        assertNull(record.status)
    }

    // 5.4.0 / HSRN-20 — `interval` was added in the HAAPI SDK 5.4.0 polling
    // properties surface. Locks the default value so the converter's job is
    // to populate it from the SDK struct, not the other way around.
    @Test
    fun propertiesRecordDefaultIntervalIsNull() {
        val record = RNPropertiesRecord()
        assertNull(record.interval)
    }

    @Test
    fun propertiesRecordDefaultMaxWaitTimeIsNull() {
        val record = RNPropertiesRecord()
        assertNull(record.maxWaitTime)
    }

    @Test
    fun propertiesRecordDefaultMaxWaitRemainingTimeIsNull() {
        val record = RNPropertiesRecord()
        assertNull(record.maxWaitRemainingTime)
    }

    // endregion
}
