# Campanhas: agendamento e ações — 26/10/2026

Item do [GitHub Project 5](https://github.com/users/CodaxiKing/projects/5):
`[WEB] Painel admin: Campanhas e notificações: público, canal e agendamento`.

## Entrega local

- Datas inválidas, horários inexistentes na mudança de horário de verão e horários passados mostram erro no formulário antes da RPC. Uma falha preserva os campos para correção.
- A edição usa o fuso da data agendada, preservando a hora mesmo quando o horário de verão difere do dia em que o administrador edita a campanha.
- O padrão de amanhã às 9h avança um dia de calendário, inclusive nas mudanças de horário de verão.
- Salvar, agendar, testar e cancelar compartilham uma trava durante a requisição; cliques repetidos não iniciam uma segunda operação na mesma tela. Os campos e a troca de campanha ficam desabilitados até a conclusão. Isso não substitui idempotência no servidor entre abas ou após perda de conexão.
- Respostas de alcance de um público anterior são descartadas. Uma falha de consulta mostra indisponibilidade em vez de ficar em “Calculando” indefinidamente.
- Mensagens de erro, sucesso e processamento têm identificação acessível.

## Verificação

`pnpm --filter web test:campanhas` executa cinco testes: datas em São Paulo, Nova York e Lisboa, concorrência de ações e liberação da trava após erro. Cobre virada de ano, ano bissexto, transições de horário de verão, datas inválidas e conversão de ida e volta entre horário local e UTC. Também foi incluído no job web do CI.

Validação local aprovada: os cinco testes, ESLint do web e dos arquivos alterados, `next typegen`, `tsc --noEmit`, `git diff --check` e `next build --webpack` (34 páginas). O build padrão com Turbopack não concluiu: houve primeiro bloqueio de rede ao buscar a fonte Google e, na execução com rede, erro interno ao iniciar o processo de CSS. O build alternativo com Webpack concluiu com código zero; a falha do Turbopack continua sendo uma limitação da validação neste Windows.

## Continuação a partir do Todo: revisão entre abas

Em nova consulta pública ao board, `status:Todo` retornou 129 itens e o card **[WEB] Painel admin: Campanhas e notificações: público, canal e agendamento** continuava em Todo. Esta continuação implementa revisão de edição/cancelamento no servidor, sem ampliar o escopo para pagamento ou marketplace.

- A migration `20270109050000_campanhas_revisao.sql` acrescenta revisão à campanha, inclusive às existentes, e a incrementa em atualizações do admin ou do processamento de envio.
- As RPCs v2 travam a linha antes de conferir revisão e estado. Edição/cancelamento com versão antiga retornam conflito e não alteram a campanha. Campanhas enviadas/canceladas continuam encerradas.
- O painel usa a revisão recebida na lista, preserva o formulário em erro e oferece “Atualizar lista”. Para usar a revisão atual, o administrador reabre o card após atualizar e revisa o texto antes de salvar.
- Agendar exige data futura também no servidor, preservando a validação de fuso/datas já existente no formulário. Papéis, 2FA, métricas e auditoria existentes foram mantidos.
- As RPCs antigas de escrita perdem execução direta por clientes para impedir contornar a revisão. O painel antigo deixa de salvar/cancelar após aplicar a migration; planejar a aplicação e o redeploy do web juntos. Leituras e job existentes permanecem disponíveis. A migration não dispara envios.
- Criação de campanhas novas ainda não tem chave idempotente entre abas/repetições após perda de resposta. A trava de duplo clique é local à tela. Esta entrega protege alterações de uma campanha existente e não promete eliminar duplicidades de criação.

Validação: `supabase/tests/testar-campanhas-revisao.mjs` aplica a migration duas vezes em PostgreSQL isolado/PGlite e verifica revisões antigas, cancelamento, estado final, horário passado, auditoria, revogação das RPCs antigas e guardas reais de papel/2FA. Usa stubs locais para cron/HTTP e confirma zero chamadas de push. O teste está no CI. As tentativas obsoletas são sequenciais, representando abas com a mesma revisão; bloqueios entre conexões simultâneas ainda precisam de homologação em PostgreSQL completo.

O card pode ir de **Todo para In Progress**. E-mail/provedor, implantação e entrega real continuam pendentes; o usuário fará a atualização manual do board.

Verificação final desta continuação: SQL isolado, cinco testes de campanhas, TypeScript, ESLint e build de produção `next build --webpack` (34 páginas) aprovados. Nenhuma publicação ou aplicação de migration foi executada.

## Pendências operacionais

O item continua parcial: a tela existente oferece push; e-mail depende da definição e integração do provedor. É necessário homologar com uma sessão admin autenticada com 2FA, confirmar as migrations/jobs no ambiente de destino e verificar a entrega real em aparelho. Esta alteração não aplica SQL, não dispara campanhas e não publica o site. O token local do GitHub CLI está inválido; o board foi consultado publicamente pelo navegador e não foi alterado.
