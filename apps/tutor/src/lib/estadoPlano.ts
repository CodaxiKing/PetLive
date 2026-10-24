export type Plano = 'gratis' | 'premium';
export type ConsultaPlano = { tutorId: string; plano: Plano; erro: boolean };

/** Nunca reaproveita o benefício de uma conta em outra sessão. */
export function estadoPlanoDaConta(tutorId: string | undefined, consulta: ConsultaPlano | null) {
  if (!tutorId) return { plano: 'gratis' as Plano, carregando: false, erro: false };
  if (consulta?.tutorId !== tutorId) return { plano: 'gratis' as Plano, carregando: true, erro: false };
  return { plano: consulta.erro ? 'gratis' as Plano : consulta.plano, carregando: false, erro: consulta.erro };
}
