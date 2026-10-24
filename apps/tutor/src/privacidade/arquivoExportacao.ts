import { File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Passeio } from '../passeios/passeio';
import { FotosPasseioLocal } from '../passeios/fotos';

/** Arquivo JSON evita o limite de texto do menu de compartilhamento e acumular todas as fotos na memória. */
export async function compartilharExportacao(dados: Record<string, unknown>, tutorId: string, passeios: Passeio[], verificarConta: () => Promise<void>) {
  if (Platform.OS === 'web') throw new Error('Abra o PetLive no celular para exportar os dados em arquivo.');
  if (!await Sharing.isAvailableAsync()) throw new Error('O compartilhamento de arquivos não está disponível neste aparelho.');
  const arquivo = new File(Paths.cache, `petlive-dados-${Crypto.randomUUID()}.json`);
  try {
    arquivo.create();
    const json = JSON.stringify(dados);
    arquivo.write(`${json.slice(0, -1)}${json === '{}' ? '' : ','}"fotos_passeios":[`);
    let primeiro = true;
    for await (const foto of new FotosPasseioLocal(tutorId).exportar(passeios)) {
      arquivo.write(`${primeiro ? '' : ','}${JSON.stringify(foto)}`, { append: true });
      primeiro = false;
    }
    arquivo.write(']}', { append: true });
    await verificarConta();
    await Sharing.shareAsync(arquivo.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Meus dados — PetLive' });
  } catch (e) { if (arquivo.exists) arquivo.delete(); throw e; }
}
