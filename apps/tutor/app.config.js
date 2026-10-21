// Configuração dinâmica sobre o app.json: as chaves do Google Maps vêm do
// ambiente do build (segredos do EAS), nunca do repositório.
//   GOOGLE_MAPS_ANDROID_KEY / GOOGLE_MAPS_IOS_KEY: Maps SDK (chaves restritas
//   ao pacote app.petlive.tutor e ao bundle id). Sem elas o build sai igual,
//   e o app segue com o mapa do OpenStreetMap (src/mapa/MapaLugares.tsx).
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
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
    // O app só troca para o mapa do Google se o build tiver a chave da plataforma.
    mapaGoogle: {
      android: Boolean(process.env.GOOGLE_MAPS_ANDROID_KEY),
      ios: Boolean(process.env.GOOGLE_MAPS_IOS_KEY),
    },
  },
});
