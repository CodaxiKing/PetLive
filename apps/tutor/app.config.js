// Configuração dinâmica sobre o app.json: as chaves do Google Maps vêm do
// ambiente do build (segredos do EAS), nunca do repositório.
//   GOOGLE_MAPS_ANDROID_KEY / GOOGLE_MAPS_IOS_KEY: Maps SDK (chaves restritas
//   ao pacote app.petlive.tutor e ao bundle id). Sem elas o build sai igual,
//   e o app segue com o mapa do OpenStreetMap (src/mapa/MapaLugares.tsx).
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
  },
  plugins: [
    ...(config.plugins ?? []),
    ['expo-location', { isAndroidBackgroundLocationEnabled: true, isAndroidForegroundServiceEnabled: true, isIosBackgroundLocationEnabled: true,
      locationAlwaysAndWhenInUsePermission: 'Durante um passeio iniciado por você, o PetLive grava o trajeto mesmo com a tela apagada. Pause ou finalize para encerrar a localização.' }],
    ['expo-notifications', { defaultChannel: 'lembretes', enableRemoteNotifications: process.env.PETLIVE_IOS_PUSH === 'true' }],
    './plugins/atalhos-ios',
    ['expo-widgets', { enableAndroid: false, groupIdentifier: 'group.app.petlive.tutor', widgets: [{ name: 'ProximoPetIOS',
      displayName: 'Próxima dose', description: 'Próxima dose ou vacina do seu pet', ios: { supportedFamilies: ['systemSmall', 'systemMedium'], initialLayout: './src/widget/WidgetPetIOS.tsx' } }] }],
    ['expo-sharing', { ios: { enabled: false }, android: { enabled: false } }],
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY || undefined,
        iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY || undefined,
      },
    ],
  ],
  extra: {
    ...config.extra,
    passeioSegundoPlano: true,
    // Somente builds Android com a configuração Firebase registram push remoto.
    push: { android: Boolean(process.env.GOOGLE_SERVICES_JSON), ios: process.env.PETLIVE_IOS_PUSH === 'true' },
    // O app só troca para o mapa do Google se o build tiver a chave da plataforma.
    mapaGoogle: {
      android: Boolean(process.env.GOOGLE_MAPS_ANDROID_KEY),
      ios: Boolean(process.env.GOOGLE_MAPS_IOS_KEY),
    },
  },
});
