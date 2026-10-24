export type Plano = 'gratis' | 'premium';
export type ConsultaPlano = { tutorId: string; plano: Plano; erro: boolean; carregando?: boolean };

/** Só uma resposta reconhecida confirma o plano; perfil ausente é falha. */
export function confirmarConsultaPlano(tutorId: string, plano: unknown, erro = false): ConsultaPlano {
  return { tutorId, plano: plano === 'premium' && !erro ? 'premium' : 'gratis', erro: erro || (plano !== 'premium' && plano !== 'gratis') };
}

/** Nunca reaproveita o benefício de uma conta em outra sessão. */
export function estadoPlanoDaConta(tutorId: string | undefined, consulta: ConsultaPlano | null) {
  if (!tutorId) return { plano: 'gratis' as Plano, carregando: false, erro: false };
  if (consulta?.tutorId !== tutorId) return { plano: 'gratis' as Plano, carregando: true, erro: false };
  if (consulta.carregando) return { plano: 'gratis' as Plano, carregando: true, erro: false };
  return { plano: consulta.erro ? 'gratis' as Plano : consulta.plano, carregando: false, erro: consulta.erro };
}
