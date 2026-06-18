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
import IdsvrHaapiSdk

/// Test seam over ``HaapiManager``'s flow methods.
///
/// The native ``HaapiManager`` is `final`, so it can't be subclassed for
/// tests. The bridge depends on this protocol instead, and production
/// wiring uses ``DefaultHaapiFlowInvoker``. Tests provide hand-rolled stubs.
internal protocol HaapiFlowInvoker: Sendable {
    func start() async -> HaapiResult
    func submitForm(_ form: FormActionModel, parameters: [String: any Sendable]) async -> HaapiResult
    func followLink(_ link: Link) async -> HaapiResult
}

/// Production ``HaapiFlowInvoker`` that delegates straight to the native
/// ``HaapiManager``. Pulled out of the Expo module so the module file
/// becomes a thin DSL-only shell (HSRN-8 § 6).
internal struct DefaultHaapiFlowInvoker: HaapiFlowInvoker {
    let haapiManager: HaapiManager

    func start() async -> HaapiResult {
        await haapiManager.start()
    }

    func submitForm(_ form: FormActionModel, parameters: [String: any Sendable]) async -> HaapiResult {
        await haapiManager.submitForm(form, parameters: parameters)
    }

    func followLink(_ link: Link) async -> HaapiResult {
        await haapiManager.followLink(link)
    }
}
