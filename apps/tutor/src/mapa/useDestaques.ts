import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { consultarDestaques, type DestaquesLugares } from './destaques';

/** Estado efêmero: cache/offline do mapa nunca concede destaque pago. */
export function useDestaques(ids: string[]) {
  const chave = JSON.stringify([...new Set(ids)].sort());
  const [destaques, setDestaques] = useState<DestaquesLugares>({});
  useFocusEffect(useCallback(() => {
    let vivo = true, requisicao = 0, expirar: ReturnType<typeof setTimeout> | undefined;
    const lista = JSON.parse(chave) as string[];
    async function atualizar() {
      const req = ++requisicao;
      if (AppState.currentState !== 'active') { setDestaques({}); return; }
      try {
        const d = await consultarDestaques(lista);
        if (!vivo || req !== requisicao || AppState.currentState !== 'active') return;
        clearTimeout(expirar); setDestaques(d);
        function conferirPrazo(atual: DestaquesLugares) {
          const ativos = Object.fromEntries(Object.entries(atual).filter(([, fim]) => fim > Date.now()));
          setDestaques(ativos);
          const proximo = Math.min(...Object.values(ativos));
          if (Number.isFinite(proximo)) expirar = setTimeout(() => { if (vivo) conferirPrazo(ativos); }, Math.min(2_000_000_000, Math.max(1, proximo - Date.now())));
        }
        conferirPrazo(d);
      } catch { if (vivo && req === requisicao) { clearTimeout(expirar); setDestaques({}); } }
    }
    setDestaques({}); void atualizar();
    const intervalo = setInterval(() => { void atualizar(); }, 60_000);
    const app = AppState.addEventListener('change', (estado) => { if (estado === 'active') void atualizar(); else { requisicao += 1; clearTimeout(expirar); setDestaques({}); } });
    return () => { vivo = false; requisicao += 1; clearInterval(intervalo); clearTimeout(expirar); app.remove(); setDestaques({}); };
  }, [chave]));
  return destaques;
}

/** Uma assinatura por mapa/perfil; os pins recebem somente o booleano. */
export function useAnimacaoDestaque() {
  const [foco, setFoco] = useState(false), [ativo, setAtivo] = useState(AppState.currentState === 'active'), [reduzido, setReduzido] = useState(true);
  useFocusEffect(useCallback(() => { setFoco(true); return () => setFoco(false); }, []));
  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => { if (vivo) setReduzido(r); }, () => undefined);
    const movimento = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzido);
    const app = AppState.addEventListener('change', (s) => setAtivo(s === 'active'));
    return () => { vivo = false; movimento.remove(); app.remove(); };
  }, []);
  return foco && ativo && !reduzido;
}
