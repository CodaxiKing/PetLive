# Cadastro de ONG — produção em 25/10/2026

Fonte `9436a23`, enviada à main antes da implantação. Aplicada `20261214000000_cadastro_ong_documentos.sql` em `qurdqbhjtgapyksrilyk`: primeiro transação ROLLBACK aprovada, depois COMMIT. Lock timeout 5 s e statement timeout 60 s. Não foi usado db push nem fabricado histórico de migrations.

Pós-aplicação: bucket ong-documentos privado, limite 10485760 bytes, RLS da tabela ativa, INSERT direto pelo cliente e envio anônimo bloqueados. Zero cadastros/documentos de teste inseridos em produção. Rascunho/submissão/RLS e todos os casos fictícios foram testados somente no PGlite isolado.

## Dependência encontrada na auditoria

Produção não possui solicitar_exclusao_conta(), cancelar_exclusao_conta(), registrar_exportacao(), lgpd_exclusoes_vencidas() ou lgpd_concluir_exclusao(uuid). Sem cron LGPD e sem Edge Function lgpd-delete instalada (listagem contém somente discover-places). A exportação principal existe e recebe os dados do cadastro de ONG por wrapper privado.

Reabertas as tasks [BACKEND] Conta e privacidade: Funções de exportar os dados e excluir a conta com prazo e [APP-CLIENTE] Base e conta: Excluir conta e exportar meus dados. Código da limpeza passa a incluir o novo bucket, mas o worker não foi implantado/ativado nesta entrega. Não foram lidos dados pessoais nem processados pedidos de exclusão. Antes de ativar, conciliar schema, testar fila/estados, configurar execução confiável e revisar pedidos existentes. A remoção automática de arquivos em produção permanece pendente.

## Validação e entrega nativa

258 testes/43 arquivos do tutor, TypeScript e lint aprovados; SQL isolado cobre CNPJ numérico/alfa, rascunho/versão/retry, privacidade/imutabilidade inclusive com policy permissiva antiga, submissão pendente sem autoaprovação, exportação e cascata. expo-document-picker ~58.0.4 foi instalado pelo Expo para o SDK 58 e exige novo APK. Moderação/aprovação e homologação Android/iOS seguem pendentes na task própria e no roteiro apps/tutor/lojas/validacao-cadastro-ong.md.

## APK de preview

Build Android em compilação no EAS: https://expo.dev/accounts/codaxi/projects/petlive-tutor/builds/74634fba-1899-4717-ab63-d54033078a75 . Fonte 9436a23999e7089d757005f6770b2f8cd93d91cd, runtime 782d3618069253d333bb21ef58e609d7ef25e74e. Novo APK obrigatório pelo módulo nativo de documentos; não foi publicada OTA para o runtime anterior. Acompanhar o build e instalar quando disponibilizado. Homologação no dispositivo permanece pendente.
