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
import ExpoModulesCore

/// What the E2E harness needs from native code on iOS: the DPoP scenarios' own request to the server's
/// userinfo endpoint. The storage hooks are Android-only; `index.ts` describes which hooks each platform has.
public class HaapiE2eModule: Module {
    public func definition() -> ModuleDefinition {
        Name("HaapiE2e")

        AsyncFunction("dpopRequest") {
            (url: String, method: String, authorization: String, dpop: String) async throws -> DpopResponseRecord in
            try await DpopRequest.send(url: url, method: method, authorization: authorization, dpop: dpop)
        }
    }
}

/// What a resource server answered, reduced to what the scenarios assert on.
struct DpopResponseRecord: Record {
    @Field var status: Int = 0
    @Field var wwwAuthenticate: String?
    @Field var dpopNonce: String?
    @Field var body: String = ""

    init() {}
}

/// Sends one request with the DPoP headers over a session that accepts a development server's
/// self-signed certificate — the affordance the example's `UnsafeURLSessionResolver` gives the SDK. Example
/// only; never part of the SDK.
enum DpopRequest {
    static func send(url: String, method: String, authorization: String, dpop: String) async throws
        -> DpopResponseRecord
    {
        guard let target = URL(string: url) else {
            throw URLError(.badURL)
        }
        var request = URLRequest(url: target)
        request.httpMethod = method
        request.setValue(authorization, forHTTPHeaderField: "Authorization")
        request.setValue(dpop, forHTTPHeaderField: "DPoP")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        var record = DpopResponseRecord()
        record.status = http.statusCode
        record.wwwAuthenticate = http.value(forHTTPHeaderField: "WWW-Authenticate")
        record.dpopNonce = http.value(forHTTPHeaderField: "DPoP-Nonce")
        record.body = String(decoding: data, as: UTF8.self)
        return record
    }

    private static let session = URLSession(
        configuration: .ephemeral,
        delegate: TrustAnyServerCertificateDelegate(),
        delegateQueue: nil
    )
}

private final class TrustAnyServerCertificateDelegate: NSObject, URLSessionDelegate, @unchecked Sendable {
    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let serverTrust = challenge.protectionSpace.serverTrust
        else {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        completionHandler(.useCredential, URLCredential(trust: serverTrust))
    }
}
