Pod::Spec.new do |s|
  s.name = 'PetLiveShortcuts'
  s.version = '1.0.0'
  s.summary = 'Atalhos do PetLive'
  s.description = 'Intenções locais e sem dados pessoais para os atalhos do ícone.'
  s.license = { :type => 'Proprietary' }
  s.author = 'PetLive'
  s.homepage = 'https://petlive.app'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
