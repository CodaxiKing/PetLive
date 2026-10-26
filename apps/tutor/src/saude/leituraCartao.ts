import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { dataParaExibicao, dataParaIso } from './types';

/** Ler o cartão de vacina por foto (BUSINESS.md 5.22, Premium): função scan-vaccine-card. */

export type VacinaLida = {
  nome: string;
  aplicada_em: string | null;
  proxima_dose: string | null;
  lote: string | null;
  veterinario: string | null;
  confianca: 'alta' | 'media' | 'baixa';
};
export type Leitura = { legivel: boolean; vacinas: VacinaLida[]; restantes: number };

/** Linha da tela de revisão: os campos editáveis em DD/MM/AAAA. */
export type LinhaRevisao = {
  incluir: boolean;
  nome: string;
  aplicada: string;
  proxima: string;
  lote: string;
  conferir: boolean;
  /** Mesmo tipo e mesma data de uma vacina que o pet já tem: não é salva de novo. */
  jaCadastrada: boolean;
};

// A leitura passa da câmera para a revisão em memória: nada é gravado até o tutor salvar.
const leituras = new Map<string, Leitura>();
export const guardarLeitura = (petId: string, leitura: Leitura) => leituras.set(petId, leitura);
export const pegarLeitura = (petId: string) => leituras.get(petId) ?? null;
export const esquecerLeitura = (petId: string) => leituras.delete(petId);

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (iso: string | null) => (iso && ISO.test(iso) && !Number.isNaN(Date.parse(`${iso}T12:00:00Z`)) ? iso : null);

/** Envia a foto para leitura. A foto não é guardada no servidor. */
export async function lerCartao(petId: string, uri: string): Promise<Leitura> {
  let imagem: string;
  try {
    imagem = await new File(uri).base64();
  } catch {
    throw new Error('Não deu para ler a foto. Fotografe novamente.');
  }
  const { data, error } = await supabase.functions.invoke<Leitura & { erro?: string }>('scan-vaccine-card', {
    body: { pet_id: petId, imagem, tipo: 'image/jpeg' },
  });
  if (error) {
    // A função devolve a explicação em { erro } também nos códigos de erro.
    let msg = 'Não deu para ler o cartão agora. Tente de novo.';
    try {
      const corpo = (await (error as { context?: Response }).context?.json()) as { erro?: string } | undefined;
      if (corpo?.erro) msg = corpo.erro;
    } catch {
      /* resposta sem corpo */
    }
    throw new Error(msg);
  }
  if (!data) throw new Error('Não deu para ler o cartão agora. Tente de novo.');
  return {
    legivel: Boolean(data.legivel),
    restantes: Number(data.restantes ?? 0),
    vacinas: (data.vacinas ?? [])
      .filter((v) => typeof v.nome === 'string' && v.nome.trim())
      .map((v) => ({
        nome: v.nome.trim().slice(0, 80),
        aplicada_em: dataValida(v.aplicada_em),
        proxima_dose: dataValida(v.proxima_dose),
        lote: v.lote?.trim().slice(0, 40) || null,
        veterinario: v.veterinario?.trim().slice(0, 80) || null,
        confianca: v.confianca === 'alta' || v.confianca === 'media' ? v.confianca : 'baixa',
      })),
  };
}

/** Converte a leitura nas linhas da revisão. Sem data ou com dúvida, a linha pede conferência. */
export function linhasDaLeitura(leitura: Leitura): LinhaRevisao[] {
  return leitura.vacinas.map((v) => ({
    incluir: true,
    nome: v.nome,
    aplicada: dataParaExibicao(v.aplicada_em),
    proxima: dataParaExibicao(v.proxima_dose),
    lote: v.lote ?? '',
    conferir: v.confianca !== 'alta' || !v.aplicada_em,
    jaCadastrada: false,
  }));
}

/** "V10 (múltipla)" e "v-10" viram "v10": o tipo da vacina para comparar. */
export function tipoVacina(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Marca as linhas que o pet já tem (mesmo tipo e mesma data de aplicação, BUSINESS.md 5.22). */
export function marcarJaCadastradas(linhas: LinhaRevisao[], existentes: { nome: string; aplicada_em: string }[]): LinhaRevisao[] {
  const chaves = new Set(existentes.map((v) => `${tipoVacina(v.nome)}@${v.aplicada_em}`));
  return linhas.map((l) => {
    const aplicada = dataParaIso(l.aplicada);
    const ja = Boolean(aplicada && chaves.has(`${tipoVacina(l.nome)}@${aplicada}`));
    return { ...l, jaCadastrada: ja, incluir: ja ? false : l.incluir };
  });
}

/** Confere as linhas marcadas; devolve a mensagem do primeiro problema ou null. */
export function validarRevisao(linhas: LinhaRevisao[]): string | null {
  const marcadas = linhas.filter((l) => l.incluir && !l.jaCadastrada);
  if (marcadas.length === 0) return 'Marque pelo menos uma vacina para salvar.';
  for (const l of marcadas) {
    if (l.nome.trim().length < 2) return 'Uma vacina marcada está sem nome.';
    const aplicada = dataParaIso(l.aplicada);
    if (!aplicada) return `Confira a data em que ${l.nome.trim()} foi aplicada.`;
    if (aplicada > new Date().toISOString().slice(0, 10)) return `A data de ${l.nome.trim()} está no futuro.`;
    if (l.proxima.trim() && !dataParaIso(l.proxima)) return `Confira a próxima dose de ${l.nome.trim()}.`;
  }
  return null;
}

/** Grava as vacinas marcadas no pet. */
export async function salvarRevisao(petId: string, linhas: LinhaRevisao[]): Promise<number> {
  const problema = validarRevisao(linhas);
  if (problema) throw new Error(problema);
  const registros = linhas
    .filter((l) => l.incluir && !l.jaCadastrada)
    .map((l) => ({
      pet_id: petId,
      nome: l.nome.trim(),
      aplicada_em: dataParaIso(l.aplicada),
      proxima_dose: l.proxima.trim() ? dataParaIso(l.proxima) : null,
      lote: l.lote.trim() || null,
      observacao: 'Lida da foto do cartão',
    }));
  const { error } = await supabase.from('vaccinations').insert(registros);
  if (error) throw new Error('Não deu para salvar as vacinas. Tente de novo.');
  return registros.length;
}
