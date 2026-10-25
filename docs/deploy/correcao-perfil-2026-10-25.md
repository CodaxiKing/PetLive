# Correção do perfil no Android

Relato: descendente do nome cortada (Diego), topo do avatar cortado em Editar perfil e falha ao enviar foto.

Causas verificadas: nome com lineHeight 36 para fonte 32; bloco de foto com margem superior -8 dentro do ScrollView; produção sem bucket `perfis` e sem as três policies de foto. Permissão de UPDATE em profiles.avatar_url já existia.

Correções: altura natural da fonte e respiro inferior no nome; padding positivo no bloco da foto; erros do seletor passam pelo tratamento da tela; bucket privado com limite 5MB e MIME JPEG/PNG/WebP e políticas restritas à pasta auth.uid. A migration de reparo não limpa nem altera avatars de perfis existentes. Mensagem distingue bucket ausente de falha de conexão.

Validação: suíte tutor 330 testes antes do teste adicional; teste de perfil 9 casos após adicionar regressão de bucket ausente, sem remover foto antiga. TypeScript e lint. PGlite testa reaplicação, privacidade do bucket, upload próprio e isolamento de leitura/exclusão. Migration validada no schema real com rollback.

Visualização final e envio real pelo Android precisam ser conferidos no aparelho; não há emulador Android nesta execução.
