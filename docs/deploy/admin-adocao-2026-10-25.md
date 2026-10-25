# Adoção e ONGs no admin

Rota `/admin/adocao`, seguindo a estrutura de `prototipo/AdminAdocao.dc.html`, com abas ONGs e pets, filtros de status, paginação de 20 e ficha de análise. Super/moderação podem consultar documentos e decidir; leitura pode consultar os registros sem abrir documentos ou alterar dados. Servidor exige papel ativo e AAL2, independentemente do menu.

Decisões de ONG: pendente → aprovada/recusada; aprovada → suspensa; suspensa → aprovada. Motivo entre 5 e 500 caracteres, confirmação explícita na interface e revisão otimista no banco. Aprovação exige cadastro enviado do mesmo responsável e três documentos confirmados no Storage. Cadastro legado sem documentos não é aprovado. Cada decisão gera auditoria atômica. Suspensão oculta os anúncios do catálogo sem apagar pets ou contatos.

Documentos continuam privados e imutáveis. Caminhos não são retornados na lista. Consulta de documento passa por RPC com autorização e auditoria, sem conteúdo ou caminho na auditoria; o navegador gera link assinado de 60 segundos. O helper de Storage preserva a leitura do responsável e permite leitura administrativa apenas de arquivos do cadastro enviado, sem liberar upload, alteração ou exclusão para o admin. Assinaturas temporárias já emitidas expiram após 60 segundos.

Moderação de anúncio: leitura de descrição e fotos do próprio Storage, ocultação de publicado com motivo e versão. Foto de outro domínio não é carregada automaticamente. Oculto não pode ser republicado pelo tutor com a API existente. Não há exclusão definitiva, edição de saúde ou contato com interessados. Reabertura de cadastro recusado e republicação após revisão de anúncio oculto não fazem parte desta entrega.

Testes SQL usam as funções reais admin_papel/admin_exigir/admin_registrar e APIs de cadastro/pet existentes. Cobrem papéis/2FA/inativo, privacidade dos documentos, bloqueio de escrita, exigência de documentos na aprovação, revisões antigas, transições, efeito da suspensão no catálogo, ocultação e auditoria. Cadastro de ONG anterior também passou nos testes de regressão. Migration validada no schema real com rollback. Sem usuários ou decisões de teste em produção.

Pendente após implantação: Redeploy da main no Coolify e homologação com sessão real de moderação e 2FA, download dos documentos, decisão e atualização do app. O APK não muda nesta entrega. Limites de plano e cobrança continuam inalterados.

Implantação: migration aplicada em produção após o commit `0357708`. Verificação de metadados confirmou RPC autenticada disponível, anônima negada, guarda administrativa e auditoria da decisão presentes, UPDATE direto da ONG negado, bucket de documentos privado e limites de plano desligados. Nenhuma ONG ou anúncio real foi aprovado, recusado, suspenso ou ocultado pelo agente. ESLint, geração de tipos, TypeScript e build web passaram. Board Em andamento aguardando publicação e homologação.
