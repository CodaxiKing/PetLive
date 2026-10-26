const { withInfoPlist } = require('expo/config-plugins');
const ACOES = [
  { id: 'sos', titulo: 'SOS', icone: 'UIApplicationShortcutIconTypeSearch' },
  { id: 'peso', titulo: 'Registrar peso', icone: 'UIApplicationShortcutIconTypeAdd' },
  { id: 'passeio', titulo: 'Iniciar passeio', icone: 'UIApplicationShortcutIconTypeLocation' },
];
function atalhos(plist) {
  const outros = (plist.UIApplicationShortcutItems ?? []).filter(a => !String(a.UIApplicationShortcutItemType ?? '').startsWith('app.petlive.atalho.'));
  plist.UIApplicationShortcutItems = [...outros, ...ACOES.map(a => ({ UIApplicationShortcutItemType: `app.petlive.atalho.${a.id}`,
    UIApplicationShortcutItemTitle: a.titulo, UIApplicationShortcutItemIconType: a.icone }))];
  return plist;
}
module.exports = config => withInfoPlist(config, cfg => { cfg.modResults = atalhos(cfg.modResults); return cfg; });
module.exports.atalhos = atalhos;
