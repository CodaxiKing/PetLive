import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { Passeio } from './passeio';
import { sincronizarPasseios, type BasePasseios, type NuvemPasseios, type PasseioRemoto } from './sincronizar';

export async function conferirContaPasseios(tutorId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== tutorId) throw new Error('Entre novamente nesta conta para sincronizar os passeios.');
}

export async function apagarPasseiosNuvem(tutorId: string) {
  await conferirContaPasseios(tutorId);
  const { error } = await supabase.rpc('passeios_apagar_nuvem', { p_tutor: tutorId });
  if (error) throw new Error('Não foi possível apagar a cópia na nuvem. Confira a conexão e tente novamente.');
  await conferirContaPasseios(tutorId);
  await limparControlePasseios(tutorId);
}

export async function limparControlePasseios(tutorId: string) {
  await AsyncStorage.removeItem(`petlive:passeios:base-nuvem:v1:${tutorId}`);
}

export function sincronizadorPasseios(tutorId: string) {
  const chave = `petlive:passeios:base-nuvem:v1:${tutorId}`;
  const nuvem: NuvemPasseios = {
    async listar() {
      await conferirContaPasseios(tutorId);
      const { error: erroPreparacao } = await supabase.rpc('passeios_preparar_sincronizacao', { p_tutor: tutorId });
      if (erroPreparacao) throw new Error('A sincronização não está disponível agora. Confira a conexão e tente novamente; os dados ficam neste aparelho.');
      const todos: PasseioRemoto[] = [];
      for (let pagina = 0; ; pagina++) {
        await conferirContaPasseios(tutorId);
        const { data, error } = await supabase.from('passeios_tutor').select('id,versao,dados')
          .eq('tutor_id', tutorId).order('id').range(pagina * 100, pagina * 100 + 99);
        if (error) throw new Error('Não foi possível acessar a nuvem de passeios. Confira a conexão e tente novamente. Os dados locais foram preservados.');
        todos.push(...(data as PasseioRemoto[]));
        if (data.length < 100) return todos;
      }
    },
    async salvar(dados, versao) {
      await conferirContaPasseios(tutorId);
      const { data, error } = await supabase.rpc('passeio_sincronizar', { p_dados: dados, p_versao: versao });
      if (error) throw new Error(error.code === '40001' ? 'Conflito com outro aparelho. Exporte seus dados antes de apagar os passeios apenas deste aparelho e sincronizar para recuperar a cópia da nuvem.' : 'Falha ao enviar passeio. Confira a conexão e tente novamente; os dados locais foram preservados.');
      return data as PasseioRemoto;
    },
  };
  return async (locais: Passeio[], salvar: (passeios: Passeio[]) => Promise<void>) => {
    await conferirContaPasseios(tutorId);
    const texto = await AsyncStorage.getItem(chave);
    const base: BasePasseios = texto ? JSON.parse(texto) : {};
    if (!base || typeof base !== 'object' || Array.isArray(base)) throw new Error('Não foi possível ler o controle de sincronização. Os dados foram preservados.');
    const resultado = await sincronizarPasseios(locais, base, tutorId, nuvem);
    await conferirContaPasseios(tutorId);
    await salvar(resultado.passeios);
    await AsyncStorage.setItem(chave, JSON.stringify(resultado.base));
    return resultado.passeios;
  };
}
