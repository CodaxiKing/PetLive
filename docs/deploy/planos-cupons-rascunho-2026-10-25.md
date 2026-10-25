# Planos e cupons do Premium em rascunho

Rota `/admin/planos`, com preço mensal/anual em reais, dias de teste e cupons exclusivos do Premium: percentual, valor fixo ou dias grátis, início/fim em horário local, limite de usos, valor mínimo e arquivamento. Listagem paginada de 25. Valores em reais convertidos para centavos sem arredondamento silencioso. Preços começam indefinidos; teste proposto de 7 dias é somente configuração de rascunho.

Somente super/financeiro com AAL2 e membro ativo editam; leitura consulta. Todas as RPCs conferem o papel no servidor. Tabelas privadas com RLS e sem acesso direto do cliente. Atualização exige versão atual e gera auditoria atômica. Cupom normaliza código, impede duplicidade e permite arquivar sem apagar o histórico. IDs de criação são gerados no servidor, sem depender de crypto.randomUUID em navegador HTTP. Reaplicar migration preserva preços e cupons já preparados.

Esta entrega não publica preços, não aplica cupons, não conta usos, não cria testes/assinaturas/cobranças, não altera contratos existentes nem concede Premium. Não existe controle de ativação: a consulta retorna venda_disponivel=false. Checkout, reserva/consumo de cupom, webhook, elegibilidade de teste único e ativação futura precisam ser integrados antes da venda. Não há cupons de lojista ou entrega nesta etapa.

Validação: PGlite com admin_papel/admin_exigir/admin_registrar reais para testar papéis/2FA/inatividade, preços indefinidos, versão, duplicidade, tipos, arquivamento, auditoria, isolamento e reaplicação sem reset. `node --experimental-strip-types apps/web/scripts/testar-planos.mjs` testa dinheiro, inteiros e horário local. ESLint, Next typegen, TypeScript e build web passaram com a nova rota. Migration verificada com rollback no schema real antes de instalar.

Pendências: Redeploy da main no Coolify, homologação com 2FA e conclusão da integração comercial. Board permanece Em andamento. Nenhum cupom ou preço de teste foi criado em produção. App do lojista continua por último. Sem mudança no APK, no Firebase ou nos limites de plano.
