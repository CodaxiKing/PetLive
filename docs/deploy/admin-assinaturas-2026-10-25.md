# Painel admin de Assinaturas

Rota `/admin/assinaturas`, ligada ao menu para super, financeiro e leitura. Consulta os contratos de `subscriptions`: busca literal por nome/e-mail, filtro de status/ciclo/provedor, paginação de 25 contratos, resumo global e detalhes de período, pagamento, valor e acesso atual do tutor.

Segue a estrutura de `prototipo/AdminAssinaturas.dc.html`, usando os componentes existentes de cabeçalho e indicadores. Sem números fictícios, estimativa de receita, taxa de conversão ou churn. O resumo conta contratos registrados, não tutores únicos. Não exibe referência privada do provedor nem informações de cartão. Sem exportação ou ações de cobrança.

RPC `admin_assinaturas` exige `admin_exigir(['financeiro','leitura'])`, incluindo super, papel ativo e AAL2. Não concede SELECT direto nem escrita em subscriptions. Status registrado é preservado no detalhe; contratos abertos com período encerrado são apresentados como expirados. Autorização não depende do menu ou da proteção de rota. Busca limitada a 120 caracteres e parâmetros validados no servidor. Ordenação determinística por criação e ID.

Respostas atrasadas são descartadas quando filtros/página mudam ou a tela desmonta; dados anteriores não aparecem como resultado do filtro novo. Estados de carregamento, erro com nova tentativa e lista vazia. A integração de cobrança e os webhooks continuam pendentes; esta entrega permite consultar os dados disponíveis sem gerar cobranças ou alterar benefício.

Teste `supabase/tests/testar-admin-assinaturas.mjs`: usa as funções reais admin_papel/admin_exigir e verifica acesso por papel, AAL1 negado, membro inativo negado, acesso anônimo negado, filtros literais, duas páginas sem repetição, expiração, referências omitidas e impossibilidade de escrita direta. Migration reaplicável e validada no schema real com rollback.

Publicação web exige Redeploy no Coolify da main. Homologação visual e uso com sessão administrativa real e 2FA permanecem pendentes após publicação. Não há alteração no APK do tutor, nos limites de plano ou no Firebase.

Verificações locais concluídas: ESLint sem erros, geração de tipos Next, tsc sem erros e build de produção bem-sucedido com a rota `/admin/assinaturas` incluída.

Migration aplicada em produção após `4c5c22e`. Metadados confirmaram RPC disponível a authenticated, negada a anon, chamada interna de admin_exigir, SELECT/UPDATE diretos em subscriptions negados e limites de plano ainda desligados. Nenhum contrato, cobrança, usuário de teste ou acesso administrativo foi criado em produção. Board atualizado para Em andamento, aguardando publicação web e homologação com 2FA.
