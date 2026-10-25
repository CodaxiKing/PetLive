# Limites do plano — preparação desativada — 25/10/2026

Migration 20261226000000_limites_plano_desativados.sql prepara o limite numericamente definido em BUSINESS.md 10: um pet no grátis. A configuração privada plano_limites_config nasce com ativo=false e pets_gratis=1. Authenticated/anon não leem nem alteram essa configuração; o cliente não consegue ativar/redefinir quota. Reaplicar a migration preserva uma configuração existente, sem reativar ou redefinir regras.

Com a configuração desligada, os novos triggers retornam sem impor limite: não muda o cadastro, a edição ou o acesso atual. A compra Premium ainda não está disponível, portanto NÃO ativar em produção.

Com a configuração ligada apenas nos testes, inserção e reativação respeitam quota; os pets não memoriais mais antigos (criado_em, id) permanecem editáveis até a quota e os demais ficam somente leitura. Pets inativos também contam, evitando ocultar/reativar como contorno. Memorial não conta; registrar a partida continua permitido sem assinatura. Mudança do plano não apaga registros nem saúde. O plano considerado é o do titular, preservando o acesso de guardiões a pets de titular Premium conforme as policies existentes.

Triggers cobrem pets e, quando presentes, vacinas, vermífugos, pesos, consultas, remédios/doses, lembretes, documentos de saúde, marcos, despesas, passeios, viagens e avaliações sênior. Verificam vínculo antigo e novo para evitar mover registros de um pet excedente. A exclusão em cascata da conta permanece possível. Não altera RLS/grants dos dados dos pets nem concede acesso a outra conta. O bloqueio da linha do perfil serializa a verificação da quota por titular; concorrência e integração dos jobs ainda precisam de homologação em PostgreSQL real antes de ativar.

RPC limites_meu_plano(p_tutor): valida a conta esperada e informa limites_ativos, plano, pets_limite e pets_somente_leitura. Com flag desligada, retorna sem limite/sem pets bloqueados. Funções internas não podem ser executadas pelo cliente.

Validação: PGlite com schemas/dados fictícios, reaplicação, configuração privada, quotas ligadas/desligadas, isolamento de conta, leitura preservada, bloqueio de edição/dose/movimentação, memorial/reativação, downgrade, titular Premium e cascata. Migration validada no esquema real em transação ROLLBACK antes da instalação. Nenhum pet real criado/editado/apagado e nenhuma restrição ativada nos testes de produção.

Pendente antes de ativar: compra/estado real de assinatura, escolha/exibição dos pets em leitura na UI, integração dos jobs e escrita no Storage (fotos/anexos), teste concorrente real e comunicação do limite ao tutor. Não foram inventadas quotas para fotos, OCR, cuidador ou recursos ainda marcados a definir. Histórico de passeios/despesas e demais restrições próprias continuam em tarefas separadas. Esta entrega não implementa cobrança, Asaas/Pix ou marketplace.
