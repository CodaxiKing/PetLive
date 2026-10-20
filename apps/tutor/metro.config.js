// Metro com o serializer do Sentry: grava o Debug ID no bundle e nas
// source maps para symbolication dos erros reportados.
// Fonte: docs do Sentry > Expo > "Add Sentry Metro Plugin".
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = config;
