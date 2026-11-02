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
internal import ExpoModulesCore

/// Configuration for attestation usage.
///
/// Maps to the TypeScript `IOSAttestationConfiguration` interface.
struct RNAttestationConfigurationRecord: Record {
    /// Whether attestation is enabled.
    @Field var useAttestation: Bool
    /// Maximum number of retries for attestation operations. Must be >= 0.
    @Field var attestationMaxRetries: Int

    init() {}
    init(useAttestation: Bool, attestationMaxRetries: Int) {
        self.useAttestation = useAttestation
        self.attestationMaxRetries = attestationMaxRetries
    }
}

extension RNAttestationConfigurationRecord: CustomDebugStringConvertible {
    public var debugDescription: String {
        [
            "useAttestation": useAttestation,
            "attestationMaxRetries": attestationMaxRetries
        ].debugDescription
    }
}
