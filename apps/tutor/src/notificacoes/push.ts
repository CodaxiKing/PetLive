import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { garantirCanal, permissaoConcedida } from './notificacoes';
import { criarRegistroPush, type RegistroPush } from './registroPush';

const CHAVE = 'petlive:push:dispositivo:v1';
export const pushDisponivel = () =>
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
  ((Platform.OS === 'android' && Constants.expoConfig?.extra?.push?.android === true) ||
    (Platform.OS === 'ios' && Constants.expoConfig?.extra?.push?.ios === true));

export const registroPush = criarRegistroPush({
  permitido: async () => pushDisponivel() && await permissaoConcedida(),
  async obterToken() {
    await garantirCanal();
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) throw new Error('Projeto de notificações indisponível.');
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  },
  async ler() {
    const texto = await AsyncStorage.getItem(CHAVE);
    if (!texto) return null;
    const dado: unknown = JSON.parse(texto);
    if (typeof dado !== 'object' || !dado || !('tutor' in dado) || !('token' in dado) ||
        typeof dado.tutor !== 'string' || typeof dado.token !== 'string') return null;
    return dado as RegistroPush;
  },
  async salvar(registro) {
    if (registro) await AsyncStorage.setItem(CHAVE, JSON.stringify(registro));
    else await AsyncStorage.removeItem(CHAVE);
  },
  async registrar({ tutor, token }) {
    const { error } = await supabase.rpc('push_token_registrar', {
      p_tutor: tutor, p_token: token, p_plataforma: Platform.OS,
    });
    if (error) throw new Error('Não foi possível registrar os avisos.');
  },
  async desativar({ tutor, token }) {
    const { error } = await supabase.rpc('push_token_desativar', { p_tutor: tutor, p_token: token });
    if (error) throw new Error('Confira sua conexão para desativar os avisos deste aparelho.');
  },
});

/** Falhas de rede serão tentadas novamente ao voltar ao app. Não solicita permissão. */
export function atualizarPush() {
  if (pushDisponivel()) void registroPush.sincronizar().catch(() => undefined);
}
