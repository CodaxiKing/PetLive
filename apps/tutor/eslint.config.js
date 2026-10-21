// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // eslint-plugin-import não segue cadeias de re-export `export *`, então ele
    // acusa falsos positivos em símbolos que o TypeScript resolve normalmente
    // (ex.: Notifications.AndroidImportance e Notifications.IosAuthorizationStatus,
    // re-exportados por expo-notifications via export * from './...types').
    files: ['src/notificacoes/**/*.ts'],
    rules: {
      'import/namespace': 'off',
    },
  },
]);
