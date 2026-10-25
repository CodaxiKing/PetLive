# Cuidador e carteirinha em produção — 25/10/2026

f4bf8b7: 20261217000000_reconciliar_cuidador.sql.
1bd76a8: 20261218000000_reconciliar_carteirinha.sql.
Ambas enviadas à main antes da implantação em qurdqbhjtgapyksrilyk. Cada SQL
passou por ROLLBACK de validação antes do COMMIT, sem db push/histórico inventado.

Pós-implantação: funções de criação/visão/dose/cuidador e criação/visão da ficha
disponíveis; anon não cria/não lê tabelas, cliente não escreve diretamente e
não lê conteudo da ficha. Um job petlive-links-vencidos ativo. Totais remotos:
zero cuidadores e zero links; não foram inseridos usuários, acessos, links ou
doses fictícias na produção. Smoke como anon com códigos inexistentes retornou
valido=false para ambos, em transação revertida inclusive para o contador IP.
Página /cuidador/código-inexistente respondeu HTTP200, sem abrir link pessoal.

PGlite isolado aprovou reaplicação, conta/anon/RLS, permissões, prazo/revogação,
schema antigo, fuso, hora prescrita, idempotência, confirmação anterior do tutor,
dose pulada, snapshot, dados selecionados, reuso sem alongar prazo, quotas de
criação e acesso, limpeza e exportação composta sem tokens. Runners/limites:
supabase/tests/cuidador-reconciliacao.md e carteirinha-reconciliacao.md.

Concluído o escopo backend de tabelas/acessos/revogação e de geração/consulta
de ficha com validade/limites; limpeza agendada conferida. Homologação no app/
site com dados reais consentidos continua nas tasks APP/WEB. Notificação de
abertura ao tutor/push e histórico completo de cada envio/reuso não foram
implantados por estes reparos; tasks respectivas seguem Em andamento. Não se
afirma entrega de aviso ao tutor. Nenhuma mensagem real foi enviada em teste.

São alterações de backend compatíveis com os contratos existentes: o APK
74634fba e OTA adbdacbf já entregues não precisam ser reconstruídos por estas
migrations. O resumo de privacidade passa a consultar as tabelas implantadas
ao voltar à tela. A exclusão automática de conta continua desativada/pendente.
