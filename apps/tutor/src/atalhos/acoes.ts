export type AcaoRapida = 'sos' | 'peso' | 'passeio';
export function conferirAcao(valor: unknown): AcaoRapida | null {
  return valor === 'sos' || valor === 'peso' || valor === 'passeio' ? valor : null;
}
// Guarda somente o nome genérico da ação enquanto o tutor entra. Sem pet/conta.
let pendente: { acao: AcaoRapida; expira: number } | null = null;
export function guardarAcao(acao: AcaoRapida, agora = Date.now()) { pendente = { acao, expira: agora + 10 * 60 * 1000 }; }
export function consumirAcao(agora = Date.now()): AcaoRapida | null {
  const p = pendente; pendente = null;
  return p && p.expira > agora ? p.acao : null;
}
