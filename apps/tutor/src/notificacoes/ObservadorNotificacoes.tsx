import { useEffect, useRef, useState } from 'react';
import { router, useRootNavigationState } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { atualizarPacoteEmergencia } from '../sos/pacote';
import { marcarLido } from './caixa';
import { destinoNotificacao } from './destino';
import { registrarCategoriaDose, tratarRespostaDose } from './doses';
import { registrarTarefaDose } from './tarefaDose';

/** Guarda o toque até a sessão e o navegador estarem prontos, inclusive após login. */
export function ObservadorNotificacoes() {
  const { user, carregando } = useAuth();
  const navegacao = useRootNavigationState();
  const [pendente, setPendente] = useState<Notifications.NotificationResponse | null>(
    () => Notifications.getLastNotificationResponse(),
  );
  const ultima = useRef<string | null>(null);

  useEffect(() => {
    registrarCategoriaDose().catch(() => undefined);
    registrarTarefaDose().catch(() => undefined);
    const assinatura = Notifications.addNotificationResponseReceivedListener(setPendente);
    return () => assinatura.remove();
  }, []);

  useEffect(() => {
    if (user) atualizarPacoteEmergencia().catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (carregando || !user || !navegacao?.key || !pendente) return;
    const chave = `${pendente.notification.request.identifier}:${pendente.notification.date}:${pendente.actionIdentifier}`;
    if (ultima.current === chave) return;
    ultima.current = chave;
    const conta = user.id;
    async function tratar() {
      // Confere a sessão também após ações assíncronas (ex.: dose dada).
      const atual = await supabase.auth.getSession();
      if (atual.data.session?.user.id !== conta) return;
      Notifications.clearLastNotificationResponse();
      const resposta = pendente!;
      const eraDose = await tratarRespostaDose(resposta).catch(() => true);
      if (eraDose) return;
      const sessao = await supabase.auth.getSession();
      if (sessao.data.session?.user.id !== conta) return;
      const dados = resposta.notification.request.content.data ?? {};
      if (typeof dados.aviso_id === 'string') void marcarLido(dados.aviso_id).catch(() => undefined);
      const destino = destinoNotificacao(dados);
      if (destino) router.push(destino as never);
    }
    void tratar().catch(() => undefined);
  }, [carregando, user, navegacao?.key, pendente]);
  return null;
}
