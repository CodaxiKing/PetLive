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

## Pendências

O item continua parcial: a tela existente oferece push; e-mail depende da definição e integração do provedor. É necessário homologar com uma sessão admin autenticada com 2FA, confirmar as migrations/jobs no ambiente de destino e verificar a entrega real em aparelho. Esta alteração não aplica SQL, não dispara campanhas e não publica o site. O token local do GitHub CLI está inválido; o board foi consultado publicamente pelo navegador e não foi alterado.
