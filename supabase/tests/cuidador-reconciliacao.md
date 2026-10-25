# Cuidador: reconciliação com produção

Migration 20261217000000 recompõe tabelas/RLS e RPCs já usadas pelo app/site:
criar_acesso_cuidador, revogar_acesso_cuidador, cuidador_visao e
cuidador_marcar_dose. Somente o dono cria acessos para 1–10 pets próprios ativos
fora do memorial. Sem pets repetidos/null, nome de 2–80 caracteres e até 60 dias.
Um acesso ativo no grátis; bloqueio de perfil serializa a verificação do limite.
Tokens novos possuem 32 bytes aleatórios, sem mudança do contrato dos clientes.

Consulta pelo código verifica prazo/revogação e limita pets à propriedade atual.
Vacinas, remédios e contatos só aparecem nas seções autorizadas. Campos opcionais
ausentes no schema antigo são tratados como indisponíveis, sem inventar dados.
Fuso inválido usa Brasília. Aberturas ficam registradas; resumo de privacidade
passa a contar cuidadores automaticamente assim que a tabela existir.

Dose exige remédio ativo do pet autorizado, dia local atual e instante exato de
um horário prescrito dentro do período do acesso. Bloqueia horários arbitrários,
medicamentos encerrados e pets de outra conta/memorial. Revogação e confirmação
usam bloqueio do acesso. Repetição não duplica registro nem sobrescreve a
confirmação do tutor; dose pulada exige contato com tutor, não é convertida.
Não interpreta código de cuidador como permissão para outras tabelas.

Exportação composta preservada, inclui acessos/registros próprios sem códigos
de acesso. FK de profiles remove acessos/registros em cascata; nenhuma execução
de exclusão de conta é ativada pela migration. Não recria/exporta tabelas de
carteirinha ainda ausentes. Não configura cron/push nem promete entrega de aviso
ao tutor nesta reconciliação; lembretes de expiração/notificações dependem de
integração e homologação próprias.

Teste em PGlite: definir PGLITE_MODULE com caminho do módulo e rodar
`node supabase/tests/testar-cuidador-reconciliacao.mjs`. Cobre conta/anon, dono,
null/repetição de pet, limite grátis, permissões, prazo/revogação, fuso inválido,
horário inexistente, retry, confirmação anterior, dose pulada, exportação mínima
e reaplicação. Dados fictícios somente no banco em memória, sem mensagens reais.

Homologar no Android/site com acesso real consentido: criar, abrir link,
comparar permissões, conferir agenda de doses, registrar apenas dose realmente
administrada, revogar e confirmar bloqueio. Não usar medicação real como teste
fictício. Verificar acesso sem contatos, vencido, troca de conta e memorial.
Deploy SQL não substitui essa homologação; tarefas permanecem Em andamento.
