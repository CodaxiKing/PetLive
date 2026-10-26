import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../auth/AuthProvider';
import type { LimitesPlano } from './limites';
import { consultarLimites } from './consultarLimites';

export function useLimitesPlano() {
  const { user } = useAuth();
  const tutor = user?.id;
  const [resposta, setResposta] = useState<{ tutor: string; dados: LimitesPlano | null; erro: boolean } | null>(null);
  useFocusEffect(useCallback(() => {
    let atual = true;
    if (!tutor) return;
    consultarLimites(tutor).then(dados => {
      if (!atual) return;
      setResposta({ tutor, dados, erro: false });
    }).catch(() => {
      if (atual) setResposta({ tutor, dados: null, erro: true });
    });
    return () => { atual = false; };
  }, [tutor]));
  return resposta?.tutor === tutor ? resposta : null;
}
