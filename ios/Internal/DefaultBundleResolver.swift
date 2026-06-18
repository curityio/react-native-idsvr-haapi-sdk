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

struct DefaultBundleResolver: Resolver {
    typealias Item = Bundle

    func resolve(for key: String) -> Bundle? {
        guard let option = BundleOption(rawValue: key) else {
            return nil
        }
        switch option {
        case .main:
            return .main
        default:
            return nil
        }
    }
}
