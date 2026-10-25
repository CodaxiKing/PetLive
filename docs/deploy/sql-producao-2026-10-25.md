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

## Preview publicado — 25/10/2026

APK 74634fba-1899-4717-ab63-d54033078a75 concluído (fonte 9436a23): https://expo.dev/artifacts/eas/erbQTPVVu1VTGEQ4QliAit9WD0ZBjU_ehrHucR1JpyU.apk . Download local solicitado: build/apk/PetLive-preview-2026-10-25.apk, 178799507 bytes, SHA256 65EDEAF57AFF794C20F356C6AF903535172152A33574B79984ECF1DA3B88181B. Arquivo ignorado pelo Git; manifest/classes.dex conferidos. Usuário informou que conseguiu acessar/obter o arquivo, sem confirmação funcional dos fluxos ainda.

OTA Android preview adbdacbf-3c99-4aaa-9002-afead428dd37 publicada a partir de bc152f387f2f020985950f76cc46e0e4b47ce485: https://expo.dev/accounts/codaxi/projects/petlive-tutor/updates/adbdacbf-3c99-4aaa-9002-afead428dd37 . Runtime 782d3618069253d333bb21ef58e609d7ef25e74e, igual ao APK e ao fingerprint calculado com perfil preview. Inclui compatibilidade de privacidade, resumo real de compartilhamentos e álbum anual. Abrir com internet e reabrir para receber; o APK antigo com runtime diferente não recebe essa OTA.

Cópia limpa: 274 testes/46 arquivos, TypeScript e lint aprovados, bundle Android gerado. Warnings transitivos do expo-router em export caíram para resolução de arquivos; bundle concluído. Homologação no aparelho continua pendente. Migrations 20261215000000 e 20261216000000 aplicadas em produção após ROLLBACK de validação; grants conferidos. Não ativada exclusão automática nem implantados serviços antigos de cuidador/carteirinha ausentes. RPCs cuidador_visao e cuidador_marcar_dose também confirmadas ausentes, além das rotinas de criação/revogação. Tasks afetadas reabertas. OCR depende de serviço de leitura ainda não implementado; tarefa de revisão não foi anunciada como concluída nem recebeu dados simulados.
