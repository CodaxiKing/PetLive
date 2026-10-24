// Atalhos estáticos do launcher. Nenhuma informação da conta vai para o sistema.
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');
const ACOES = [
  { id: 'sos', titulo: 'SOS', desenho: 'M10,3h4v7h7v4h-7v7h-4v-7H3v-4h7z' },
  { id: 'peso', titulo: 'Registrar peso', desenho: 'M6,3h12v18H6z M9,7h6v4H9z' },
  { id: 'passeio', titulo: 'Iniciar passeio', desenho: 'M12,3a2,2 0,1 0,0.01 0 M10,8l4,1 3,4 M11,9l-3,4 -3,1 M12,10l-1,5 -4,6 M11,15l4,1 3,5' },
];
const escapar = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
function recursos(pacote, atividade) {
  const arquivos = { 'xml/petlive_atalhos.xml': `<?xml version="1.0" encoding="utf-8"?>\n<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">${ACOES.map((a) => `
  <shortcut android:shortcutId="petlive_${a.id}" android:enabled="true" android:icon="@drawable/petlive_atalho_${a.id}" android:shortcutShortLabel="@string/petlive_atalho_${a.id}">
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${escapar(pacote)}" android:targetClass="${escapar(atividade)}" android:data="petlive://acao-rapida?acao=${a.id}" />
  </shortcut>`).join('')}\n</shortcuts>`,
    'values/petlive_atalhos.xml': `<?xml version="1.0" encoding="utf-8"?>\n<resources>${ACOES.map((a) => `<string name="petlive_atalho_${a.id}">${a.titulo}</string>`).join('')}</resources>` };
  for (const a of ACOES) arquivos[`drawable/petlive_atalho_${a.id}.xml`] = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="48dp" android:height="48dp" android:viewportWidth="48" android:viewportHeight="48">
  <path android:fillColor="#A9DCF6" android:pathData="M24,0 A24,24 0,1 1,23.99,0 Z" />
  <group android:translateX="12" android:translateY="12"><path android:fillColor="@android:color/transparent" android:strokeColor="#17212F" android:strokeWidth="1.5" android:strokeLineCap="round" android:strokeLineJoin="round" android:pathData="${a.desenho}" /></group>
</vector>`;
  return arquivos;
}
function metadados(manifesto) {
  const atividade = AndroidConfig.Manifest.getMainActivityOrThrow(manifesto);
  atividade['meta-data'] = [...(atividade['meta-data'] ?? []).filter((m) => m.$['android:name'] !== 'android.app.shortcuts'),
    { $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/petlive_atalhos' } }];
  return manifesto;
}
module.exports = function atalhosAndroid(config) {
  config = withAndroidManifest(config, (cfg) => { cfg.modResults = metadados(cfg.modResults); return cfg; });
  return withDangerousMod(config, ['android', async (cfg) => {
    const pacote = cfg.android?.package;
    if (!pacote) throw new Error('Configure android.package para gerar os atalhos.');
    const pasta = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res');
    for (const [nome, conteudo] of Object.entries(recursos(pacote, `${pacote}.MainActivity`))) {
      const destino = path.join(pasta, nome);
      await fs.mkdir(path.dirname(destino), { recursive: true }); await fs.writeFile(destino, conteudo, 'utf8');
    }
    return cfg;
  }]);
};
module.exports.recursos = recursos;
module.exports.metadados = metadados;
