internal import Expo
import React
import ReactAppDependencyProvider
// Explicit access level: this target already uses `internal import Expo`, and Swift 6
// rejects mixing implicit and explicit import access levels for the same module.
internal import IdsvrHaapiReactNativeSdk

// MARK: - Development-only TLS bypass
//
// A locally installed Identity Server is reached over HTTPS at the host machine's IP with a
// self-signed certificate, which URLSession rejects (NSURLErrorDomain -1202). The SDK resolves
// its URLSession through NativeRegistry, so the app injects one that accepts any server trust
// — the iOS counterpart of UnsafeHttpURLConnectionResolver on Android.
//
// Selected only when the configuration asks for URLSessionOption.custom; the SDK's own resolver
// returns nil for that key precisely so a host app can supply this. Example app only — never
// shipped in the SDK, and never appropriate for a production client.

private final class TrustAnyServerCertificateDelegate: NSObject, URLSessionDelegate, @unchecked Sendable {
  func urlSession(
    _ session: URLSession,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
          let serverTrust = challenge.protectionSpace.serverTrust
    else {
      // Anything that is not a server-trust challenge keeps standard handling.
      completionHandler(.performDefaultHandling, nil)
      return
    }
    completionHandler(.useCredential, URLCredential(trust: serverTrust))
  }
}

struct UnsafeURLSessionResolver: Resolver {
  typealias Item = URLSession

  // URLSessionOption is internal to the SDK, so the app matches its raw value.
  private static let customOptionKey = "custom"

  nonisolated(unsafe) private static let session = URLSession(
    configuration: .default,
    delegate: TrustAnyServerCertificateDelegate(),
    delegateQueue: nil
  )

  func resolve(for key: String) -> URLSession? {
    key == Self.customOptionKey ? Self.session : nil
  }
}

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    NativeRegistry.shared.addResolver(UnsafeURLSessionResolver())

    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
