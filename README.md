# HAAPI React Native SDK (@curity/identityserver-haapi-react-native-sdk)

React Native bridge for the Curity Identity Server's Hypermedia
Authentication API (HAAPI). Enables OAuth 2.0 / OIDC + HAAPI
authentication flows in React Native + Expo apps via the native
HAAPI iOS and Android SDKs published by Curity.

## Requirements

- Node.js 22 or later
- npm 10 or later
- React Native 0.85 or later
- Expo SDK 56
- Xcode 26.2 or later (for iOS development)
- iOS 16.4 or later (deployment target floor; required by Expo 56's expo-modules-core)
- CocoaPods 1.16 or later (still required for Expo autolinking; the HAAPI SDK is pulled in via Swift Package Manager from inside the podspec)
- Android Studio (for Android development)
- Java Development Kit (JDK) 17 or later (for Android development)
- Android SDK (compileSdk 36, minSdk 26)
- Gradle
- An emulator or physical device for testing
- A Curity Identity Server instance with HAAPI enabled

## Installation

```bash
npm install @curity/identityserver-haapi-react-native-sdk
```

**Android** integration is automatic — the HAAPI Android SDK is resolved
through this package's Gradle file via Expo autolinking; no extra wiring
required.

**iOS** uses Swift Package Manager. Add this package's Expo config plugin
to the `plugins` array of your `app.json` (or `app.config.js`) so that
`expo prebuild` embeds the HAAPI Swift package into your Xcode project —
no manual Podfile or `.xcodeproj` editing:

```json
{
  "expo": {
    "plugins": ["@curity/identityserver-haapi-react-native-sdk"]
  }
}
```

Then run `npx expo prebuild` (or `npx expo run:ios`) to apply it. The
HAAPI SDK version is pinned automatically from this package — you do not
specify it in `app.json`.

## Quick Start

```typescript
import {
    initializeForHaapi,
    createHaapiConfiguration,
    createIOSConfiguration,
    createAndroidConfiguration,
} from '@curity/identityserver-haapi-react-native-sdk';

const accessor = await initializeForHaapi(
    createHaapiConfiguration({
        baseUrl: 'https://your-curity-server',
        authorizationEndpointUrl: 'https://your-curity-server/oauth/authorize',
        tokenEndpointUrl: 'https://your-curity-server/oauth/token',
        iosConfig: createIOSConfiguration({ /* ... */ }),
        androidConfig: createAndroidConfiguration({ /* ... */ }),
    })
);

const response = await accessor.haapiManager.start();
// Drive the flow via accessor.haapiManager.submitForm / followLink,
// then exchange the auth code via accessor.oauthTokenManager.fetchAccessToken.

await accessor.close();
```

`accessor.close()` is mandatory before re-initialising or switching
modes. Re-init without close rejects with
`error.code === "HAAPI_ACCESSOR_ALREADY_INITIALIZED"`.

## Documentation

Full documentation is available in the Curity developer guide:

- [React Native SDK reference](https://curity.io/docs/identity-server/developer-guide/haapi-sdks/sdk-layer/react-native-sdk/)
  — the SDK-layer guide covering configuration, the HAAPI flow, and the
  public API.
- [React Native quickstart](https://curity.io/docs/identity-server/developer-guide/haapi-sdks/getting-started/quickstart-react-native/)
  — a step-by-step guide to get a HAAPI flow running in a React Native
  app.

In addition, the TypeScript types shipped with this package serve as an
inline reference — every public API has JSDoc, which your IDE's
IntelliSense will surface.

## License

Proprietary — Curity AB. SPDX identifier `UNLICENSED` (see
`package.json`). For licensing terms and contact, see [`legal.md`](./legal.md).
