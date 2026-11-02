require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# Example-app E2E hooks only — never part of the SDK or its npm package.
Pod::Spec.new do |s|
  s.name           = 'HaapiE2e'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'UNLICENSED'
  s.author         = 'Curity AB'
  s.homepage       = 'https://curity.io'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '6.0'
  s.source         = { path: '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.swift"
end
