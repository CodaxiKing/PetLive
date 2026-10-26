import { beforeEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { ouvirAtalhoIOS } from '../atalhos/nativoIOS';
const m = vi.hoisted(() => ({ optional: vi.fn(), consumir: vi.fn(), add: vi.fn(), remove: vi.fn() }));
vi.mock('expo', () => ({ requireOptionalNativeModule: m.optional, NativeModule: class {} }));
const require = createRequire(import.meta.url);
const { atalhos } = require('../../plugins/atalhos-ios.js');
beforeEach(() => { vi.resetAllMocks(); m.optional.mockReturnValue({ consumir: m.consumir, addListener: m.add }); m.add.mockReturnValue({ remove: m.remove }); });
it('reaplica três atalhos sem duplicar nem remover os de outro módulo', () => {
  const outros = { UIApplicationShortcutItemType: 'outro', UIApplicationShortcutItemTitle: 'Outro' };
  const plist = { UIApplicationShortcutItems: [outros] };
  atalhos(plist); atalhos(plist);
  expect(plist.UIApplicationShortcutItems).toHaveLength(4);
  expect(plist.UIApplicationShortcutItems[0]).toEqual(outros);
  expect(plist.UIApplicationShortcutItems.map((a: { UIApplicationShortcutItemType: string }) => a.UIApplicationShortcutItemType)).toContain('app.petlive.atalho.sos');
});
it('retoma a intenção inicial e escuta ações novas, filtrando valores desconhecidos', () => {
  m.consumir.mockReturnValueOnce('peso'); const receber = vi.fn();
  const parar = ouvirAtalhoIOS(receber);
  expect(receber).toHaveBeenCalledWith('peso');
  const ouvir = m.add.mock.calls[0][1];
  m.consumir.mockReturnValueOnce('desconhecido'); ouvir();
  expect(receber).toHaveBeenCalledTimes(1);
  m.consumir.mockReturnValueOnce('passeio'); ouvir();
  expect(receber).toHaveBeenLastCalledWith('passeio'); parar(); expect(m.remove).toHaveBeenCalledOnce();
});
it('binário sem módulo não impede abrir o app', () => {
  m.optional.mockReturnValue(null); expect(() => ouvirAtalhoIOS(vi.fn())()).not.toThrow();
});
