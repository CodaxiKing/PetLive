import { requireOptionalNativeModule, NativeModule } from 'expo';
import { conferirAcao, type AcaoRapida } from './acoes';

declare class AtalhosNativos extends NativeModule<{ acao: () => void }> { consumir(): string | null }

/** Sem módulo (APK antigo/Android/Expo Go), segue com os atalhos existentes. */
export function ouvirAtalhoIOS(receber: (acao: AcaoRapida) => void): () => void {
  const modulo = requireOptionalNativeModule<AtalhosNativos>('PetLiveShortcuts');
  if (!modulo) return () => {};
  const consumir = () => {
    const acao = conferirAcao(modulo.consumir());
    if (acao) receber(acao);
  };
  const inscricao = modulo.addListener('acao', consumir);
  consumir();
  return () => inscricao.remove();
}
