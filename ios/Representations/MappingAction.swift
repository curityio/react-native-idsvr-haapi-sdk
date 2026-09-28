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
import IdsvrHaapiSdk

/// Action, form field, and authenticator mapping for ``HaapiResponseMapper``.
extension HaapiResponseMapper {

    /// Maps a native Action into an RNActionRecord, caching form action models.
    func convertAction(_ action: any Action) -> RNActionRecord {
        let record = RNActionRecord()
        record.kind = convertActionKind(action.kind)
        record.title = action.title.map { convertMessage($0) }

        switch action {
        case let formAction as FormAction:
            record.actionType = .form
            record.model = convertFormActionModel(formAction.model)
            collectedFormActionModels.append(formAction.model)
        case let selectorAction as SelectorAction:
            record.actionType = .selector
            record.options = selectorAction.model.options.map { convertAction($0) }
        case let clientOpAction as ClientOperationAction:
            record.actionType = .clientOperation
            record.clientOperationModel = convertClientOperationActionModel(clientOpAction.model)
        default:
            break
        }

        return record
    }

    /// Maps a native FormActionModel into an RNFormActionModelRecord.
    func convertFormActionModel(_ model: FormActionModel) -> RNFormActionModelRecord {
        let record = RNFormActionModelRecord()
        record.actionTitle = model.actionTitle.map { convertMessage($0) }
        record.fields = model.fields.map { convertFormField($0) }
        record.type = model.type
        record.method = model.method
        record.href = model.href
        return record
    }

    /// Maps a native FormField into an RNFormFieldRecord.
    func convertFormField(_ field: any FormField) -> RNFormFieldRecord {
        let record = RNFormFieldRecord()

        switch field {
        case let f as HiddenFormField:
            record.fieldType = .hidden
            record.name = f.name
            record.value = f.value
            record.label = f.label.map { convertMessage($0) }
        case let f as TextFormField:
            record.fieldType = .text
            record.name = f.name
            record.value = f.value
            record.label = f.label.map { convertMessage($0) }
            record.placeholder = f.placeholder.map { convertMessage($0) }
            record.kind = f.kind.map { convertTextFieldKind($0) }
        case let f as UsernameFormField:
            record.fieldType = .username
            record.name = f.name
            record.value = f.value
            record.label = f.label.map { convertMessage($0) }
            record.placeholder = f.placeholder.map { convertMessage($0) }
        case let f as PasswordFormField:
            record.fieldType = .password
            record.name = f.name
            record.value = f.value
            record.label = f.label.map { convertMessage($0) }
            record.placeholder = f.placeholder.map { convertMessage($0) }
        case let f as SelectFormField:
            record.fieldType = .select
            record.name = f.name
            record.value = f.value
            record.label = f.label.map { convertMessage($0) }
            record.options = f.options.map {
                RNSelectOptionRecord(label: $0.label.literal, value: $0.value, selected: $0.selected)
            }
        case let f as CheckboxFormField:
            record.fieldType = .checkbox
            record.name = f.name
            record.value = f.value
            record.label = f.label.map { convertMessage($0) }
            record.checked = f.checked
            record.readOnly = f.readonly
        case let f as ContextFormField:
            record.fieldType = .context
            record.name = f.name
        default:
            break
        }

        return record
    }

    /// Maps an authenticator option into an RNAuthenticatorOptionRecord.
    func convertAuthenticatorOption(
        _ option: AuthenticatorSelectorStep.AuthenticatorOption
    ) -> RNAuthenticatorOptionRecord {
        RNAuthenticatorOptionRecord(
            title: convertMessage(option.title),
            type: option.type,
            action: convertAction(option.action)
        )
    }
}
