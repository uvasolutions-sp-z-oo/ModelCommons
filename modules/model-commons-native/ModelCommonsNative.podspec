require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
repository = package.fetch('repository').fetch('url').sub(/^git\+/, '')

Pod::Spec.new do |s|
  s.name           = 'ModelCommonsNative'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'ModelCommons contributors'
  s.homepage       = repository.delete_suffix('.git')
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => repository, :tag => "modelcommons-native-v#{s.version}" }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = 'ios/**/*.{h,m,mm,swift}', 'modules/model-commons-native/ios/**/*.{h,m,mm,swift}'
end
