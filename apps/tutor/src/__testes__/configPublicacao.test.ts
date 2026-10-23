import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..');

function lerJSON(arquivo: string) {
  return JSON.parse(readFileSync(join(RAIZ, arquivo), 'utf8'));
}

describe('eas.json (publicação nas lojas)', () => {
  const eas = lerJSON('eas.json');

  it('tem CLI configurado com a versão gerenciada remotamente pelo EAS', () => {
    expect(eas.cli.version).toBe('>= 16.0.0');
    expect(eas.cli.appVersionSource).toBe('remote');
  });

  it('tem perfil de build production que abrange iOS e Android', () => {
    const producao = eas.build.production;
    expect(producao.channel).toBe('production');
    expect(producao.autoIncrement).toBe(true);
    // O Android deve gerar o .aab (app bundle) no perfil de produção.
    expect(producao.android.buildType).toBe('app-bundle');
  });

  it('tem perfil de submit production (App Store Connect e Google Play Console)', () => {
    expect(eas.submit.production).toBeDefined();
  });
});

describe('app.json (identidade do app e EAS Update)', () => {
  const expo = lerJSON('app.json').expo;

  it('tem nome, slug e versão', () => {
    expect(expo.name).toBe('PetLive');
    expect(expo.slug).toBe('petlive-tutor');
    expect(expo.version).toBeDefined();
  });

  it('tem bundle ID do iOS e package name do Android', () => {
    expect(expo.ios.bundleIdentifier).toBe('app.petlive.tutor');
    expect(expo.android.package).toBe('app.petlive.tutor');
  });

  it('tem EAS Update configurado (runtimeVersion pela versão do app e canal de produção)', () => {
    expect(expo.runtimeVersion.policy).toBe('appVersion');
    expect(expo.updates.url).toContain('u.expo.dev');
    expect(expo.updates.enabled).toBe(true);
    expect(expo.updates.checkAutomatically).toBe('ON_LOAD');
  });
});
