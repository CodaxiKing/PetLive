import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { conferirAcao, consumirAcao, guardarAcao } from '../atalhos/acoes';
const require = createRequire(import.meta.url);
const { recursos, metadados } = require('../../plugins/atalhos-android.js');

describe('atalhos do ícone no Android', () => {
  it('aceita somente as três ações previstas, sem permitir navegação arbitrária', () => {
    for (const acao of ['sos', 'peso', 'passeio']) expect(conferirAcao(acao)).toBe(acao);
    for (const valor of [null, undefined, ['sos'], 'https://exemplo.com', '/pet/outro/peso', 'SOS', '__proto__']) expect(conferirAcao(valor)).toBeNull();
  });
  it('retoma após login uma única vez, expira e substitui a intenção anterior', () => {
    guardarAcao('peso', 1000); expect(consumirAcao(2000)).toBe('peso'); expect(consumirAcao(3000)).toBeNull();
    guardarAcao('sos', 1000); expect(consumirAcao(601000)).toBeNull();
    guardarAcao('peso', 1000); guardarAcao('passeio', 2000); expect(consumirAcao(3000)).toBe('passeio');
  });
  it('gera intents explícitos com destinos constantes, labels e três ícones locais', () => {
    const arquivos = recursos('app.petlive.tutor', 'app.petlive.tutor.MainActivity');
    const xml = arquivos['xml/petlive_atalhos.xml'];
    for (const acao of ['sos', 'peso', 'passeio']) {
      expect(xml).toContain(`petlive://acao-rapida?acao=${acao}`);
      expect(xml).toContain(`@string/petlive_atalho_${acao}`);
      expect(arquivos[`drawable/petlive_atalho_${acao}.xml`]).toContain('<vector');
    }
    expect((xml.match(/<shortcut /g) ?? []).length).toBe(3);
    expect(xml).toContain('android:targetPackage="app.petlive.tutor"');
    expect(xml).toContain('android:targetClass="app.petlive.tutor.MainActivity"');
    expect(xml).not.toContain('pet_id'); expect(xml).not.toContain('tutor_id');
    expect(arquivos['values/petlive_atalhos.xml']).toContain('Registrar peso');
  });
  it('preserva metadados existentes e não duplica atalhos na reaplicação', () => {
    const manifesto = { manifest: { application: [{ activity: [{ $: { 'android:name': '.MainActivity' },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }], category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }] }],
      'meta-data': [{ $: { 'android:name': 'existente', 'android:value': 'sim' } }],
    }] }] } };
    metadados(manifesto); metadados(manifesto);
    const dados = manifesto.manifest.application[0].activity[0]['meta-data'];
    expect(dados).toHaveLength(2); expect(dados[0].$['android:name']).toBe('existente');
    expect(dados[1].$['android:name']).toBe('android.app.shortcuts');
  });
});
