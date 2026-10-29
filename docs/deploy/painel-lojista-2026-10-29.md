# Painel web do lojista — login e estrutura inicial

Cards conferidos no [Project 5](https://github.com/users/CodaxiKing/projects/5): **[WEB] Painel do lojista: Login e sessão do lojista na web** e **[WEB] Painel do lojista: Estrutura do painel: menu lateral e cabeçalho**. Continuação baseada na main que já contém a base do marketplace, cadastro/moderação das lojas e RPC `minhas_lojas`.

## Entrega

- `/lojista/entrar`: login por e-mail/senha, restauração da sessão, trava de envio repetido, mensagens de erro e bloqueio claro em ambiente sem configuração.
- `/lojista`: moldura responsiva, menu, cabeçalho, seleção entre lojas vinculadas e saída da sessão local. As demais áreas ficam identificadas como futuras, sem links para páginas inexistentes ou números simulados.
- Visão geral com status, papel do vínculo, retorno da análise, vínculo de lugar pendente e checklist real de cadastro. Conta sem vínculo recebe orientação e nova tentativa; uma falha de RPC não é tratada como lista vazia.
- Cliente Supabase do lojista usa `petlive-lojista`, separado de `petlive-admin`. Não usa service role, não cria usuário administrativo e não concede vínculos.
- Acesso é obtido por `minhas_lojas`, que filtra membros ativos da conta. Contrato valida papéis, estados e os sete itens do checklist, rejeita IDs repetidos e projeta somente os campos usados.
- Confere sessão antes/depois da consulta. O componente invalida respostas pendentes a cada mudança de Auth, desmontagem ou nova conferência. Esconde os dados ao trocar de sessão e consulta fora do callback de Auth. Reconfere ao voltar à aba e pela ação manual.
- Saída usa escopo local desta sessão. Nenhum fluxo de pagamento, compra ou repasse foi ativado.
- Layout do lojista define `noindex,nofollow`. Isso não substitui autorização: as RPCs do backend permanecem a guarda final para cada operação.

## Dependências e pendências

Ambiente web precisa de `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`, Auth configurado e migrations de marketplace/cadastro de loja no mesmo projeto. Não foram aplicadas migrations nem criadas contas/lojas reais nesta rodada.

Cadastro completo da loja na web, edição de catálogo, solicitações, agenda e configurações pertencem a outros cards. O checklist aqui é uma consulta, não um formulário de edição ou aprovação. Revogação de vínculo sem mudança de Auth é percebida na próxima conferência; operações futuras devem validar a autorização novamente no servidor.

Falta homologar login/restauração/logout reais, ausência de vínculo, responsável/gerente/equipe, múltiplas lojas e revogação usando contas autorizadas em homologação. Credenciais reais não foram solicitadas nem usadas nesta implementação. Board continua com atualização manual pelo usuário; os dois cards podem passar para **In Progress**.

## Verificação

Sete testes de contrato/acesso cobrem conta, ausência de sessão, troca/logout durante leitura, papéis/estados, resposta inválida, falhas e projeção dos dados. O CI web executa `pnpm test:lojista`, além dos testes de campanhas existentes.

Validação final: sete testes de acesso do lojista e cinco de campanhas aprovados; TypeScript, ESLint e build de produção Next/Webpack (37 páginas) aprovados. Inspeção visual da entrada em desktop e celular, sem overflow horizontal. O ambiente local não tem Supabase configurado; foi conferido o estado desabilitado e a ausência de dados privados, não um login real.
