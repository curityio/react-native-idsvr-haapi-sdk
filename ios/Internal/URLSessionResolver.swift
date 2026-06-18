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

struct URLSessionResolver: Resolver {
    typealias Item = URLSession

    func resolve(for key: String) -> URLSession? {
        guard let option = URLSessionOption(rawValue: key) else {
            return nil
        }
        switch option {
        case .default:
            return URLSession(configuration: URLSessionConfiguration.haapi)
        case .ephemeral:
            return URLSession(configuration: .ephemeral)
        case .custom:
            return nil
        }
    }
}
