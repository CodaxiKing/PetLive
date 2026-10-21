// Deixa o app conferir quais apps de mapa estão instalados (folha "Traçar
// rota com", BUSINESS.md 5.15). Android 11+ só revela pacotes declarados em
// <queries>; o iPhone só responde canOpenURL para esquemas listados.
const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

const PACOTES = ['com.google.android.apps.maps', 'com.waze'];
const ESQUEMAS = ['comgooglemaps', 'waze'];

module.exports = function appsDeMapa(config) {
  config = withAndroidManifest(config, (cfg) => {
    const manifesto = cfg.modResults.manifest;
    const queries = (manifesto.queries ??= [{}])[0];
    const existentes = new Set((queries.package ?? []).map((p) => p.$['android:name']));
    queries.package = [
      ...(queries.package ?? []),
      ...PACOTES.filter((p) => !existentes.has(p)).map((p) => ({ $: { 'android:name': p } })),
    ];
    return cfg;
  });

  return withInfoPlist(config, (cfg) => {
    const atuais = cfg.modResults.LSApplicationQueriesSchemes ?? [];
    cfg.modResults.LSApplicationQueriesSchemes = [...new Set([...atuais, ...ESQUEMAS])];
    return cfg;
  });
};
