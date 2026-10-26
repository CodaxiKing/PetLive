# Eventos oficiais e organizadores — 2026-10-25

Código na main: `aaa70c4`. Rota: `/admin/eventos`.

## Entrega

- Super/moderação ativos com AAL2 podem publicar eventos do PetLive. O formulário exige revisão explícita, título, descrição, tipo, datas, local e coordenadas; aceita entrada gratuita ou preço/link externo HTTPS e vagas opcionais. Datas são informadas no fuso do navegador, identificado no formulário, e enviadas em UTC.
- A RPC reutiliza `evento_criar`, preservando as regras atuais de datas futuras, duração de até sete dias, local, preço e vagas. Eventos oficiais publicam diretamente. Não há cobrança de ingresso dentro do PetLive.
- Uma chave emitida pelo servidor e um recibo privado vinculam administrador e conteúdo. A repetição da mesma publicação retorna o evento existente, sem duplicar evento ou auditoria. Alterar os dados inicia outro pedido. Não há dependência de `crypto.randomUUID` no navegador HTTP.
- Lista de organizadores com busca e páginas de 25, nome público, situação, data da verificação e quantidade de eventos. Inclui contas com eventos enviados ou perfil de organizador existente; não expõe e-mails.
- Super/moderação com AAL2 podem verificar/revogar, com motivo de 5 a 500 caracteres, confirmação explícita, versão esperada e auditoria antes/depois. Leitura pode consultar. Verificar não aprova eventos antigos em análise; revogar não oculta eventos já publicados. A moderação de cada evento permanece disponível.

## Verificação e implantação

`supabase/tests/testar-admin-eventos-organizadores.mjs` usa PGlite com tabelas, guardas e criação de evento reais. Cobriu papéis, 2FA, inativo, anonimato, permissões diretas, validações de publicação, repetição idempotente, conflito de chave/conteúdo, auditoria e o fluxo de publicação antes/depois de verificar e revogar. Fixtures foram criadas somente no banco isolado.

Lint, Next typegen, tsc e build web passaram. A migration `20270107000000_admin_eventos_organizadores.sql` foi validada com rollback e aplicada no projeto de produção `qurdqbhjtgapyksrilyk`. Dependência `evento_criar` instalada com guarda administrativa confirmada. Metadados finais: anon sem publicação/verificação, cliente sem leitura dos recibos, guarda de verificação e coluna de versão presentes.

Não foram publicados eventos, verificados organizadores ou enviados avisos reais em produção durante os testes. Não houve alteração no app nativo nem nova OTA/APK.

## Pendente

Acionar Redeploy da main no Coolify e validar com equipe autenticada por 2FA: permissões de moderação/leitura, datas/fuso, coordenadas, erro/repetição da publicação e conflito entre revisores. Qualquer publicação e verificação real deve corresponder a um evento/organizador revisado pela equipe. Board mantido Em andamento até QA da interface publicada. Lojista permanece para depois.
