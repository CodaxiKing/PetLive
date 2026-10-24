import { File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { conferirRelatorio, despesasCsv, despesasHtml, mesValido } from './relatorio';

async function conferirConta(tutorId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== tutorId) throw new Error('A conta mudou. Abra as despesas novamente.');
}
export async function exportarDespesas(tutorId: string, mes: string, petId: string | null, formato: 'csv' | 'pdf', aindaNaTela: () => boolean = () => true) {
  if (!mesValido(mes)) throw new Error('Escolha um mês válido.');
  if (Platform.OS === 'web') throw new Error('Abra o app no celular para compartilhar o relatório.');
  if (!await Sharing.isAvailableAsync()) throw new Error('O compartilhamento de arquivos não está disponível neste aparelho.');
  const verificar = async () => { await conferirConta(tutorId); if (!aindaNaTela()) throw new Error('Abra as despesas novamente para exportar.'); };
  await verificar();
  const { data, error } = await supabase.rpc('despesas_exportar', { p_tutor: tutorId, p_mes: `${mes}-01`, p_pet: petId });
  if (error) throw new Error(error.message);
  const relatorio = conferirRelatorio(data, mes);
  await verificar();
  let arquivo: File | undefined;
  try {
    if (formato === 'csv') {
      arquivo = new File(Paths.cache, `petlive-despesas-${mes}-${Crypto.randomUUID()}.csv`);
      arquivo.create(); await arquivo.write(despesasCsv(relatorio));
    } else {
      const { uri } = await Print.printToFileAsync({ html: despesasHtml(relatorio) });
      arquivo = new File(uri);
    }
    await verificar();
    await Sharing.shareAsync(arquivo.uri, { mimeType: formato === 'csv' ? 'text/csv' : 'application/pdf',
      UTI: formato === 'csv' ? 'public.comma-separated-values-text' : 'com.adobe.pdf', dialogTitle: `Despesas de ${mes} — PetLive` });
  } finally {
    // A folha de compartilhamento já terminou. Não acumular dados financeiros no cache.
    try { if (arquivo?.exists) arquivo.delete(); } catch { /* O sistema também pode já ter removido o cache. */ }
  }
}
