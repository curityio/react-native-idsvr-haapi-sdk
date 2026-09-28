const { withXcodeProject } = require('expo/config-plugins');

// Normalizes the example app's iOS build settings to match this repo's intent,
// re-applying on every `expo prebuild` so the committed project stays in sync
// (Expo's iOS template would otherwise reset these to its defaults on --clean):
//
//   * SWIFT_VERSION = 6.0  — the example dogfoods a Swift 6 SDK, so its own app
//     target stays in Swift 6 language mode (the template defaults to 5.0).
//     SDK side: `IdsvrHaapiReactNativeSdk.podspec` already sets `s.swift_version = '6.0'`.
//   * MACOSX_DEPLOYMENT_TARGET removed — the app is iOS-only (`SDKROOT = iphoneos`,
//     Catalyst disabled), so the template's macOS deployment target is dead weight.
//   * DEVELOPMENT_TEAM = the Curity team — device builds only sign under the team that
//     owns `io.curity.cat.ios.client`, and the server's attestation policies pin that
//     app id. Whoever runs `expo prebuild` would otherwise have their own Xcode team
//     stamped in (the committed project carried a personal team until HSRN-27, which
//     made every device build fail with "No profiles for 'io.curity.cat.ios.client'
//     were found" even with valid certificates installed).
//
// Example-only — intentionally NOT part of the shipped SDK plugin. Consumer apps
// choose their own Swift language mode / platforms / signing team; the SDK pod
// compiles as Swift 6 regardless.
const SWIFT_VERSION = '6.0';
const DEVELOPMENT_TEAM = 'ALY8Q7BNK9';

function withExampleIosBuildSettings(config) {
  return withXcodeProject(config, (configWithXcodeProject) => {
    const project = configWithXcodeProject.modResults;
    const buildConfigurations = project.pbxXCBuildConfigurationSection();

    Object.keys(buildConfigurations).forEach((key) => {
      if (key.endsWith('_comment')) {
        return;
      }

      const buildSettings = buildConfigurations[key].buildSettings;
      if (!buildSettings) {
        return;
      }

      // Only touch the app-target configs (the ones the template stamps a
      // SWIFT_VERSION onto); leave project-level configs that omit it alone.
      if (buildSettings.SWIFT_VERSION) {
        buildSettings.SWIFT_VERSION = SWIFT_VERSION;
        buildSettings.DEVELOPMENT_TEAM = DEVELOPMENT_TEAM;
      }

      // iOS-only app — drop the spurious macOS deployment target if present.
      if (buildSettings.MACOSX_DEPLOYMENT_TARGET) {
        delete buildSettings.MACOSX_DEPLOYMENT_TARGET;
      }
    });

    return configWithXcodeProject;
  });
}

module.exports = withExampleIosBuildSettings;
