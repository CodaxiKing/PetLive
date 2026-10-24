export type FiltrosAdocao = { especie: '' | 'cao' | 'gato'; filhote: boolean; porte: '' | 'pequeno' | 'medio' | 'grande'; sexo: '' | 'macho' | 'femea'; cidade: string; favoritos: boolean };
export const FILTROS_ADOCAO: FiltrosAdocao = { especie: '', filhote: false, porte: '', sexo: '', cidade: '', favoritos: false };
export type PetAdocao = { id: string; nome: string; especie: 'cao' | 'gato'; nascimento: string | null; porte: string; sexo: string;
  castrado: boolean | null; vacinado: boolean | null; vermifugado: boolean | null; descricao: string; fotos: string[];
  criado_em: string; ong_nome: string; cidade: string; bairro: string; favorito: boolean };
export type CursorAdocao = { criado_em: string; id: string };
export type PaginaAdocao = { itens: PetAdocao[]; tem_mais: boolean };
export function fotoAdocao(valor: unknown): string | null {
  if (typeof valor !== 'string' || valor.length > 2048) return null;
  try { const u = new URL(valor); return u.protocol === 'https:' && Boolean(u.hostname) && !u.username && !u.password ? valor : null; } catch { return null; }
}
export function conferirPaginaAdocao(valor: unknown): PaginaAdocao {
  const p = valor as PaginaAdocao | null;
  if (!p || typeof p.tem_mais !== 'boolean' || !Array.isArray(p.itens) || p.itens.length > 20 || (p.tem_mais && p.itens.length !== 20) || p.itens.some((i) =>
    !i || typeof i.id !== 'string' || typeof i.nome !== 'string' || !['cao', 'gato'].includes(i.especie) || typeof i.criado_em !== 'string' || !Number.isFinite(Date.parse(i.criado_em)) ||
    (i.nascimento !== null && (typeof i.nascimento !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(i.nascimento))) ||
    !['pequeno', 'medio', 'grande'].includes(i.porte) || !['macho', 'femea', 'nao_informado'].includes(i.sexo) ||
    [i.castrado, i.vacinado, i.vermifugado].some((v) => v !== null && typeof v !== 'boolean') ||
    [i.descricao, i.ong_nome, i.cidade, i.bairro].some((v) => typeof v !== 'string') || typeof i.favorito !== 'boolean' || !Array.isArray(i.fotos) || i.fotos.length > 6 || i.fotos.some((v) => !fotoAdocao(v)))) {
    throw new Error('A lista de adoção recebida está incompleta. Tente novamente.');
  }
  return p;
}
export function idadeAdocao(nascimento: string | null, hoje = new Date()): string {
  if (!nascimento) return 'Idade não informada';
  const [a, m, d] = nascimento.split('-').map(Number);
  let meses = (hoje.getFullYear() - a) * 12 + hoje.getMonth() + 1 - m;
  if (hoje.getDate() < d) meses -= 1;
  if (meses < 1) return 'Menos de 1 mês';
  if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  const anos = Math.floor(meses / 12); return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
}
export function juntarPaginaAdocao(atual: PetAdocao[], nova: PetAdocao[]) {
  const mapa = new Map(atual.map((i) => [i.id, i])); for (const i of nova) mapa.set(i.id, i); return [...mapa.values()];
}
export type ReciboInteresse = { id: string; criado_em: string };
export type DetalheAdocao = { pet: PetAdocao; contato: ReciboInteresse | null };
export function conferirReciboInteresse(valor: unknown): ReciboInteresse {
  const r = valor as ReciboInteresse | null;
  if (!r || typeof r.id !== 'string' || !r.id || typeof r.criado_em !== 'string' || !Number.isFinite(Date.parse(r.criado_em))) {
    throw new Error('Não foi possível confirmar o interesse. Atualize a ficha antes de tentar novamente.');
  }
  return r;
}
export function conferirDetalheAdocao(valor: unknown): DetalheAdocao | null {
  if (valor === null) return null;
  const d = valor as DetalheAdocao;
  if (!d || !('contato' in d)) throw new Error('A ficha recebida está incompleta. Tente novamente.');
  const pet = conferirPaginaAdocao({ itens: [d.pet], tem_mais: false }).itens[0];
  return { pet, contato: d.contato === null ? null : conferirReciboInteresse(d.contato) };
}
export function validarInteresse(mensagem: string, email: string, concordo: boolean) {
  const texto = mensagem.trim(), resposta = email.trim().toLowerCase();
  if (texto.length < 10 || texto.length > 1000) throw new Error('Escreva uma mensagem de 10 a 1000 caracteres.');
  if (resposta.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resposta)) throw new Error('Informe um e-mail válido para resposta.');
  if (!concordo) throw new Error('Confirme o compartilhamento com a ONG.');
  return { mensagem: texto, email: resposta };
}
