# Atualização manual do board — 26/10/2026

Projeto: [PetLive — Project 5](https://github.com/users/CodaxiKing/projects/5).

O usuário optou por atualizar o board manualmente, após pedir commit e push do código. Nenhum card foi alterado nesta rodada. Os códigos A/B/W abaixo são referências da [auditoria local](em-progresso-2026-10-26.md), não IDs do GitHub.

## Atualizações por task

Os textos da coluna “Atualização” podem ser copiados para os cards. Manter **In Progress** nos itens que ainda exigem implantação ou homologação. Esta entrega não comprova o funcionamento em produção.

| Task / referência | Status indicado | Atualização |
|---|---|---|
| Widget: próxima dose/vacina e botão Dei — A19 | In Progress | Android: cache por conta, expiração, tratamento de erros, proteção contra consultas concorrentes e dose atrasada na virada do dia. Confirmação já salva não vira erro por falha do cache. iOS: widget com timeline, privacidade e abertura da confirmação no app. Testes locais aprovados. Falta build nativo e QA de launcher/iPhone, logout, offline e confirmação real. |
| Excluir conta/exportar dados; Privacidade e dados; exportação/exclusão backend — A01, A24, B12 | In Progress | Implementadas fila com prazo de 30 dias, cancelamento, lease/retomada, limpeza de todos os buckets, bloqueio de uploads tardios e preparação de cron pausado. Novos pedidos dependem de flag e heartbeat recentes. SQL testado isoladamente nos formatos legado/app; não aplicado em produção. Faltam implantação e homologação com contas descartáveis antes da ativação. |
| Notificações locais e push — A03 | In Progress | Push remoto iOS preparado com opt-in de build PETLIVE_IOS_PUSH; permanece desligado por padrão. Falta configurar APNs/FCM e validar entrega/toque em aparelhos com build compatível. |
| Passeios com tela apagada — A18 | In Progress | Preparado GPS iOS em segundo plano com precisão completa, indicador e permissão adequada; Android preservado. Testes de disponibilidade/precisão aprovados. Falta build assinado e caminhada real, pausa, fim e interrupções do sistema. |
| Atalhos do ícone: SOS, peso e passeio — A20 | In Progress | Plugin e módulo Expo local iOS adicionados, com consumo da intenção inicial e encaminhamento para o fluxo existente. Autolinking e testes JS aprovados. Falta compilação Swift e QA no iPhone com app aberto/fechado e antes/depois do login. |
| Limites por plano — B05 | In Progress | Preparados avisos de pets em leitura, bloqueio das ações principais e de fotos/documentos no Storage. RPC informa contagem apenas dos pets próprios fora do memorial e disponibilidade de cadastro; lista/formulário bloqueiam novo cadastro quando o servidor confirma quota atingida. Consultas capturam a credencial e descartam resposta após troca de conta. Flag comercial continua desligada; cobrança adiada. Falta implantação e homologação concorrente. |
| Integrações: Play/App Store/Pix/outros — W05 | In Progress | Admin agora consulta jobs, última execução, agregados de push, flag/heartbeat LGPD e presença de configuração de Places/leitura de fotos. Edge Function usa guarda real de papel/2FA e sonda fixa OPTIONS do gateway Expo. Testes de acesso e falhas aprovados. Não certifica credenciais APNs/FCM, lojas, SMTP ou pagamento. Falta implantação/QA. |
| Precisão do reconhecimento por foto — B11 | In Progress | Runner exige critérios explícitos e amostras por espécie, contabiliza erros/recusas, empates e falsos positivos, embaralha candidatos com semente e gera relatório com modelo/hash. Métricas testadas sinteticamente; nenhuma foto enviada nesta rodada. Falta definir critérios/amostra consentida e medir o serviço real. |
| Campanhas e notificações: público, canal e agendamento | Todo → In Progress | Corrigidos datas/fusos/DST, trava contra ações simultâneas, respostas antigas de alcance e erros acessíveis. Cinco testes aprovados em três fusos. Falta homologar push com admin/2FA e integrar canal e-mail; nenhuma campanha foi disparada. |
| QR da coleira — A05 | In Progress | Etiqueta com identidade visual PetLive no commit 4a9cba0. Falta homologar captura/compartilhamento, nomes longos e leitura em outro aparelho/impressão. |

## Itens adiados ou sem nova conclusão

Premium, gestão de assinatura, webhooks, cupons comerciais e destaques pagos continuam adiados por orientação do usuário. Nenhuma compra ou regra comercial foi ativada. As demais tasks da auditoria não recebem conclusão adicional nesta rodada.

## Evidência

### Continuação: edição e exclusão de pets

Tasks relacionadas: editar/excluir pet, cadastro com foto (A02) e isolamento por tutor (B02). Edição de dados, vínculo/remoção de foto e exclusão usam cliente com credencial capturada, com conferência da conta antes/depois. A exclusão exige o retorno do ID removido: zero linhas ou resposta incompleta não são apresentados como sucesso.

Edição, remoção de foto e exclusão tratam rejeição de rede e liberam o estado de salvamento em `finally`. Escritas concluídas invalidam consultas de lista iniciadas anteriormente. A limpeza opcional de documentos ocorre após confirmar a exclusão, em lotes de até mil caminhos restritos a `tutor/saude/pet/`; falha nessa limpeza não desfaz a exclusão confirmada. O envio binário da foto e a atomicidade entre Storage/banco continuam com o fluxo anterior e não são certificados por esta alteração.

Oito testes novos cobrem credencial, troca de conta, retorno ausente/ID errado, falhas de rede/servidor, exclusão sem linha removida e limpeza restrita/best effort. Homologação com contas descartáveis e aparelho continua pendente; nenhum pet real foi excluído nesta rodada.

Validação atual: **414 testes em 68 arquivos**, TypeScript e lint aprovados. Nenhuma migration ou dependência nova.

### Continuação: carregamento dos pets

Tasks relacionadas: cadastro com foto (A02), isolamento por tutor (B02) e lista Meus pets. A consulta agora captura a credencial, preserva o cache offline por titular e reconfere a conta ao terminar. O layout já reinicia os providers por conta; esse comportamento foi preservado. Apenas a busca mais recente pode publicar lista/etiquetas ou erro, e o cleanup invalida respostas pendentes.

Falhas de rede/servidor e respostas incompletas encerram o carregamento e oferecem nova tentativa. Não são apresentadas como “Nenhum pet ainda”. Dados já carregados da mesma conta são preservados numa falha de atualização; indisponibilidade das etiquetas sênior não apaga marcações atuais. A leitura de limites permanece sem cache offline.

Validação desta continuação: **406 testes em 67 arquivos**, TypeScript e lint aprovados. Nove casos novos cobrem titular, credencial, contrato, erro/retry, respostas fora de ordem e invalidação. A02/B02 continuam dependendo das verificações de ambiente/aparelho registradas na auditoria; esta entrega não certifica todo o RLS remoto.

- Tutor: 397 testes em 66 arquivos, TypeScript e lint aprovados.
- Backend: 18 testes Node; SQL isolado para LGPD (formatos legado/app), limites/Storage/quota e diagnóstico admin aprovado.
- Campanhas: cinco testes, TypeScript e ESLint do web aprovados.
- Builds JS/Hermes Android/iOS, introspecção Apple, autolinking e build web Webpack foram aprovados na entrega acumulada, conforme o [registro detalhado](../deploy/pendencias-codigo-2026-10-26.md). Não equivalem a compilação nativa ou QA em aparelho.

Implantação: cinco migrations novas, funções `lgpd-delete` e `integracoes-verificar`, web e novos binários ainda precisam ser publicados/homologados. Push do Git não aplica migrations nem distribui automaticamente um binário nesta entrega.
