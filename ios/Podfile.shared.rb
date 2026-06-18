# Shared Hermes / new-arch / RN flag setup for every Podfile in this repo.
#
# Both `example/ios/Podfile` (the app) and `ios/Podfile` (the test workspace)
# require this file. Flag values flow from `example/ios/Podfile.properties.json`
# — that file is the single source of truth. Flip a flag there to apply it
# to both surfaces; do not duplicate flag logic in the Podfiles themselves.
#
# When ExpoModulesCore ships as a Swift Package and the Podfiles go away
# (HSRN-24+), delete this helper alongside them.

require 'json'

# Loads Podfile.properties.json from the given path and sets the RCT_* ENV
# vars the React Native pod scripts expect. Returns the parsed properties hash.
def haapi_load_shared_properties(properties_path)
  props = JSON.parse(File.read(properties_path)) rescue {}

  ENV['RCT_NEW_ARCH_ENABLED'] ||= '0' if props['newArchEnabled'] == 'false'
  ENV['EX_DEV_CLIENT_NETWORK_INSPECTOR'] ||= props['EX_DEV_CLIENT_NETWORK_INSPECTOR']
  unless props['ios.buildReactNativeFromSource'] == 'true' || props['newArchEnabled'] == 'false'
    ENV['RCT_USE_RN_DEP']         ||= '1'
    ENV['RCT_USE_PREBUILT_RNCORE'] ||= '1'
  end

  props
end

# Returns the iOS deployment target from the properties hash, defaulting to
# 16.4 (the SDK's deployment floor — Expo 56's expo-modules-core requires it).
def haapi_deployment_target(props)
  props['ios.deploymentTarget'] || '16.4'
end

# Returns the hermes-enabled boolean. Default: true when `expo.jsEngine`
# is unset or explicitly set to 'hermes'.
def haapi_hermes_enabled?(props)
  props['expo.jsEngine'].nil? || props['expo.jsEngine'] == 'hermes'
end
