import { textoData, textoHorario, type Proximo } from './proximo';

export function apresentarWidgetIOS(proximo: Proximo | null, ocultar: boolean, agora = new Date()) {
  const vazio = { titulo: 'Abra o PetLive', detalhe: 'Atualize para conferir a próxima dose.', acao: 'Abrir PetLive', url: 'petlive://inicio' };
  if (!proximo) return vazio;
  if (proximo.tipo === 'erro') return { ...vazio, detalhe: proximo.mensagem };
  if (proximo.tipo === 'sem_conta') return { ...vazio, detalhe: 'Entre na sua conta para atualizar.' };
  if (proximo.tipo === 'nada') return { ...vazio, titulo: 'Tudo em dia!', detalhe: 'Nenhum cuidado pendente nesta consulta.' };
  if (proximo.tipo === 'vacina') return { titulo: `${proximo.pet} · ${proximo.vacina}`, detalhe: textoData(proximo.data, agora), acao: 'Ver carteirinha', url: `petlive://pet/${encodeURIComponent(proximo.pet_id)}/vacinas` };
  const podeConfirmar = !proximo.offline && Boolean(proximo.tutor_id);
  return { titulo: `${proximo.pet} · ${ocultar ? 'Remédio' : proximo.remedio}`,
    detalhe: `${textoHorario(proximo.prevista_para, agora)}${ocultar ? '' : ` · ${proximo.dose}`}`,
    acao: podeConfirmar ? 'Confirmar dose no app' : 'Atualizar no app',
    url: podeConfirmar ? `petlive://widget-dose?tutor=${encodeURIComponent(proximo.tutor_id!)}&medicamento=${encodeURIComponent(proximo.medication_id)}&quando=${encodeURIComponent(proximo.prevista_para)}` : 'petlive://inicio' };
}
