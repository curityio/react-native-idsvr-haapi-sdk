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

import se.curity.identityserver.haapi.android.sdk.models.AuthenticatorSelectorStep
import se.curity.identityserver.haapi.android.sdk.models.actions.Action
import se.curity.identityserver.haapi.android.sdk.models.actions.FormActionModel
import se.curity.identityserver.haapi.android.sdk.models.actions.FormField

/** Maps a native [Action] into an [RNActionRecord], caching form action models. */
internal fun HaapiResponseMapper.convertAction(action: Action): RNActionRecord {
    val record = RNActionRecord()
    record.kind = convertActionKind(action.kind)
    record.title = action.title?.let { convertMessage(it) }

    when (action) {
        is Action.Form -> {
            record.actionType = RNActionType.FORM
            record.model = convertFormActionModel(action.model)
            collectedFormActionModels = collectedFormActionModels + action.model
        }

        is Action.Selector -> {
            record.actionType = RNActionType.SELECTOR
            record.options = action.model.options.map { convertAction(it) }
        }

        is Action.ClientOperation -> {
            record.actionType = RNActionType.CLIENT_OPERATION
            record.clientOperationModel =
                convertClientOperationActionModel(action.model)
        }
    }

    return record
}

/** Maps a native [FormActionModel] into an [RNFormActionModelRecord]. */
internal fun HaapiResponseMapper.convertFormActionModel(model: FormActionModel): RNFormActionModelRecord {
    val record = RNFormActionModelRecord()
    record.actionTitle = model.actionTitle?.let { convertMessage(it) }
    record.fields = model.fields.map { convertFormField(it) }
    record.type = model.type
    record.method = model.method
    record.href = model.href
    return record
}

/** Maps a native [FormField] into an [RNFormFieldRecord]. */
internal fun HaapiResponseMapper.convertFormField(field: FormField): RNFormFieldRecord {
    val record = RNFormFieldRecord()
    record.name = field.name
    record.label = field.label?.let { convertMessage(it) }
    record.placeholder = field.placeholder?.let { convertMessage(it) }
    record.isRequired = field.isRequired

    when (field) {
        is FormField.Hidden -> {
            record.fieldType = RNFormFieldType.HIDDEN
            record.value = field.value
        }

        is FormField.Text -> {
            record.fieldType = RNFormFieldType.TEXT
            record.value = field.value
            record.kind = field.kind?.let { convertTextFieldKind(it) }
        }

        is FormField.Username -> {
            record.fieldType = RNFormFieldType.USERNAME
            record.value = field.value
        }

        is FormField.Password -> {
            record.fieldType = RNFormFieldType.PASSWORD
            record.value = field.value
        }

        is FormField.Select -> {
            record.fieldType = RNFormFieldType.SELECT
            record.value = field.value
            record.options =
                field.options.map { option ->
                    RNSelectOptionRecord().apply {
                        label = option.label.literal
                        value = option.value
                        selected = option.selected
                    }
                }
        }

        is FormField.Checkbox -> {
            record.fieldType = RNFormFieldType.CHECKBOX
            record.value = field.value
            record.checked = field.checked
            record.readOnly = field.readonly
        }

        is FormField.Context -> {
            record.fieldType = RNFormFieldType.CONTEXT
            record.value = field.value
        }

        else -> {
            record.fieldType = RNFormFieldType.TEXT
            record.value = field.value
        }
    }

    return record
}

/** Maps an authenticator option into an [RNAuthenticatorOptionRecord]. */
internal fun HaapiResponseMapper.convertAuthenticatorOption(
    option: AuthenticatorSelectorStep.AuthenticatorOption,
): RNAuthenticatorOptionRecord {
    val record = RNAuthenticatorOptionRecord()
    record.title = convertMessage(option.title)
    record.type = option.type
    record.action = convertAction(option.action)
    return record
}
