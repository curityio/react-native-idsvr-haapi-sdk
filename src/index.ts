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
// `getHaapiNativeModule` and `IdsvrHaapiReactNativeSdkModule` are deliberately
// not re-exported — they are internal helpers consumed only by the accessor
// factories below. Host apps must go through `initializeForHaapi` /
// `initializeForOAuth`, never `requireNativeModule` directly.

// Manager + accessor public contracts (concrete `*Impl` classes are
// deliberately not re-exported — host apps obtain manager instances from
// the accessor returned by `initializeForHaapi` / `initializeForOAuth`).
export type { HaapiManager } from './haapi-manager'
export type { OAuthTokenManager } from './oauth-token-manager'
export type { HaapiAccessor, OAuthAccessor } from './haapi-accessor'
export { initializeForHaapi, initializeForOAuth } from './haapi-accessor'

export { HaapiErrorCode, isHaapiError } from './errors'
export type {
    HaapiError,
    HaapiErrorCategory,
    RecoverySuggestion,
    UnrecoverableAction,
    RetryCondition,
    HaapiServerErrorInfo,
} from './errors'

// Logging — `RNLogger` is exported as a *type* only; host apps obtain
// an instance via the `getRNLogger(configuration)` factory so the native
// log-event subscription stays a singleton, and the configuration is
// forwarded to the native HAAPI logger atomically on first call.
export { RNLogLevel, getRNLogger } from './logging'
export type {
    RNLogEvent,
    RNLogSinkHandler,
    RNLoggerConfiguration,
    Logger,
    RNLogger,
} from './logging'
export type { RNHaapiConfiguration, OAuthAuthorizationParameters } from './haapi-configuration'
export { createHaapiConfiguration } from './haapi-configuration'

// HAAPI Response Models
export {
    RepresentationType,
    ActionKind,
    ActionType,
    PollingStatus,
    ProblemType,
    FormFieldType,
    ClientOperationName,
    StepType,
} from './models'
export type {
    Message,
    UserMessage,
    Metadata,
    Link,
    GenericProperties,
    OAuthAuthorizationResponseProperties,
    PollingProperties,
    Properties,
    SelectOption,
    HiddenFormField,
    TextFormField,
    UsernameFormField,
    PasswordFormField,
    SelectFormField,
    CheckboxFormField,
    ContextFormField,
    FormField,
    FormActionModel,
    CredentialParameter,
    AuthenticatorSelection,
    WebAuthnCredential,
    WebAuthnRegistrationPublicKey,
    WebAuthnAuthenticationPublicKey,
    ExternalBrowserClientOperationActionModel,
    BankIdClientOperationActionModel,
    EncapClientOperationActionModel,
    WebAuthnRegistrationClientOperationActionModel,
    WebAuthnAuthenticationClientOperationActionModel,
    GenericClientOperationActionModel,
    ClientOperationActionModel,
    FormAction,
    ClientOperationAction,
    SelectorAction,
    Action,
    AuthenticatorOption,
    AuthenticatorSelectorStep,
    InteractiveFormStep,
    UserConsentStep,
    RedirectionStep,
    PollingStep,
    ContinueSameStep,
    OAuthAuthorizationResponseStep,
    ExternalBrowserClientOperationStep,
    BankIdClientOperationStep,
    EncapClientOperationStep,
    WebAuthnRegistrationClientOperationStep,
    WebAuthnAuthenticationClientOperationStep,
    GenericClientOperationStep,
    GenericRepresentationStep,
    HaapiRepresentation,
    InvalidField,
    Problem,
    InvalidInputProblem,
    AuthorizationProblem,
    ProblemRepresentation,
    SuccessfulTokenResponse,
    ErrorTokenResponse,
    TokenResponse,
    HaapiRepresentationResponse,
    HaapiProblemResponse,
    HaapiResponse,
} from './models'
export type { NoTokenBinding } from './token-binding'
export { TokenBindingKind, noTokenBinding } from './token-binding'
export type {
    AndroidConfiguration,
    AndroidAttestationConfiguration,
    AndroidTokenBindingConfiguration,
    AndroidTokenBoundConfiguration,
    KeyPairAlgorithmConfiguration,
    AndroidDcrConfiguration,
} from './android-configuration'
export {
    KeyPairAlgorithmConfig,
    StorageOption,
    DpopKeyPolicy,
    TokenEndpointResponseListenerOption,
    ApplicationContextOption,
    HttpUrlConnectionProviderOption,
    CurrentTimeMillisProviderOption,
    AndroidTokenBinding,
    createAndroidConfiguration,
} from './android-configuration'
export type {
    IOSConfiguration,
    IOSTokenBindingConfiguration,
    IOSTokenBinding,
    IOSTokenBoundConfiguration,
    IOSDcrConfiguration,
    IOSKeychainConfiguration,
} from './ios-configuration'
export {
    URLSessionOption,
    CryptoKeyType,
    BundleOption,
    KeychainAccessibility,
    iOSTokenBinding,
    UnboundedTokenConfiguration,
    BoundTokenConfiguration,
    createIOSConfiguration,
} from './ios-configuration'
export type {
    ClientAuthenticationMethodNone,
    ClientAuthenticationMethodSecret,
    ClientAuthenticationMethodMtlsKeyPinning,
    ClientAuthenticationMethodJwtSymmetric,
    KeyPinning,
    ClientAuthenticationMethodJWTAsymmetric,
    ClientAuthenticationMethodMTLS,
    ClientAuthenticationMethodConfiguration,
} from './clientAuthenticationMethods'
export {
    JwtSymmetricAlgorithm,
    JwtAsymmetricAlgorithm,
    ClientAuthenticationKind,
    KeyStoreOption,
    noAuthentication,
    iOSJwtAsymmetricAuthentication,
    iOSMtlsAuthentication,
    iOSMtlsKeyPinningAuthentication,
    jwtSymmetricAuthentication,
    AndroidMtlsAuthentication,
    AndroidJwtAsymmetricAuthentication,
    AndroidMtlsKeyPinningAuthentication,
    secretAuthentication,
} from './clientAuthenticationMethods'
export type {
    IOSAttestationConfiguration,
    DcrConfiguration,
} from './shared'