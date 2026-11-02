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

/// An argument passed from JavaScript can't be used for the request it describes — a URL that is not an
/// absolute `http`/`https` URL with a host, for example.
///
/// ``HaapiErrorNormalizer`` reports it as `HAAPI_INVALID_ARGUMENT` with an unrecoverable `introspectCause`
/// recovery, the same error TypeScript and the Android bridge report for it. `message` names the parameter
/// and the rule it breaks; it never carries the argument's value, which may hold credentials.
internal struct InvalidArgumentError: Error {
    let message: String
}
