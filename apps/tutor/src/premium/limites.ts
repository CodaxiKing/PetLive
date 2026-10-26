export type LimitesPlano = { ativos: boolean; petsLimite: number | null; petsSomenteLeitura: string[]; petsAtivos?: number; podeCadastrarPet?: boolean };
export function conferirLimites(valor: unknown): LimitesPlano {
  if (!valor || typeof valor !== 'object') throw new Error('Resposta de limites inválida.');
  const d = valor as Record<string, unknown>;
  if (typeof d.limites_ativos !== 'boolean' ||
    (d.pets_limite !== null && (!Number.isInteger(d.pets_limite) || Number(d.pets_limite) < 1)) ||
    !Array.isArray(d.pets_somente_leitura) || d.pets_somente_leitura.some(id => typeof id !== 'string' || !id)) throw new Error('Resposta de limites inválida.');
  if (!d.limites_ativos && (d.pets_limite !== null || d.pets_somente_leitura.length)) throw new Error('Limites inconsistentes.');
  // Os dois campos são opcionais somente para compatibilidade com o servidor anterior.
  const cadastro = 'pets_ativos' in d || 'pode_cadastrar_pet' in d;
  if (cadastro && (!Number.isSafeInteger(d.pets_ativos) || Number(d.pets_ativos) < 0 || typeof d.pode_cadastrar_pet !== 'boolean' ||
    d.pode_cadastrar_pet !== (!d.limites_ativos || d.pets_limite === null || Number(d.pets_ativos) < Number(d.pets_limite)))) throw new Error('Quota de cadastro inconsistente.');
  return { ativos: d.limites_ativos, petsLimite: d.pets_limite as number | null, petsSomenteLeitura: d.pets_somente_leitura,
    ...(cadastro ? { petsAtivos: d.pets_ativos as number, podeCadastrarPet: d.pode_cadastrar_pet as boolean } : {}) };
}

export function limiteCadastroAtingido(limites: LimitesPlano | null | undefined): boolean {
  return limites?.ativos === true && limites.podeCadastrarPet === false;
}
