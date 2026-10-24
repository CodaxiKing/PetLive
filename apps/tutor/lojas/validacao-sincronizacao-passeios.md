# Sincronização privada de passeios

Task: `[BACKEND] Passeios: Tabelas de passeios do tutor, sincronização offline e encerramento automático`.

Entrega: persistência offline existente passa a funcionar como fila durável.
Na tela Passeios, pausar e tocar em **Sincronizar trajetos e anotações** envia
os registros locais e recupera os registros da conta na nuvem. O envio é
explícito: não começa GPS nem envia posições durante gravação. Fotos e meta
semanal continuam locais. O histórico e os selos usam os registros recuperados.

## Aplicação no Supabase

Aplicar no SQL Editor o conteúdo completo de
`supabase/migrations/20261203000000_passeios_tutor.sql`.
Não precisa reenviar seeds de lugares. A migration é transacional e reaplicável.
Depende das tabelas existentes auth.users/pets e da função exportar_meus_dados.
Não depende de is_pet_owner ou colunas opcionais do cadastro do pet.

Cria passeios_tutor (chave composta conta/ID), RLS de leitura própria e RPCs
autenticadas para envio, preparação e exclusão. Escritas diretas são revogadas.
O servidor valida conta, propriedade de pets existentes, campos, estados, datas, quantidade,
precisão e ordem dos pontos. Não aceita caminhos/IDs de fotos locais. Pet removido
não apaga a história: FK pet_id vira null. Excluir a conta apaga seus trajetos
em cascata. A exportação LGPD existente inclui passeios_nuvem.

## Conflitos e falhas

Versão crescente e trava por conta/ID protegem concorrência. Envio repetido do
mesmo conteúdo é idempotente mesmo com resposta perdida. Conflitos entre dois
aparelhos preservam o registro local, sem substituição silenciosa. Se só a nuvem
mudou, ela é recuperada. Se ambos mudaram, exportar os dados antes de decidir;
para recuperar a versão da nuvem, apagar apenas deste aparelho e sincronizar.
Dois passeios pausados em aparelhos distintos bloqueiam a operação antes dos
envios; finalizar o local permite tentar novamente.

O controle de versões é separado por conta. Resultados só são gravados depois
de conferir a conta novamente e validar os registros no repositório local.
A base de confirmação só avança depois da escrita local bem-sucedida. Falha de
rede ou migration ausente não apaga a fila. Falhas após envio parcial permitem
repetição. Alterações locais durante sincronização ficam bloqueadas na fila.
Paginação recupera todo o histórico, sem o truncamento padrão da API.

Apagar deste aparelho remove também o controle local de sincronização, fotos e
notas, mantendo a cópia remota, que volta na próxima sincronização. Apagar locais
e da nuvem exige internet e confirmação; remove só dados da conta esperada no
servidor. Se a etapa remota falhar, registros/fotos locais permanecem. Falha local
depois da exclusão remota exige nova tentativa. Outros aparelhos podem reter
cópias offline; apagar essas cópias também evita reenvio posterior.

## Encerramento automático

Passeios pausados sem atualização há oito horas são concluídos na hora do
último registro, mantendo tempo ativo, distância e trajeto. O tempo de espera
não entra na duração. Não reabre passeio concluído. O job executa a cada hora
quando pg_cron já está instalado; sem a extensão, a preparação da sincronização
executa a regra da conta. Não instala extensões nem exige segredo de produção.
Gravação com tela apagada continua em task separada.

Conferência do job após aplicar (se pg_cron estiver disponível):
```sql
select jobname, schedule, active from cron.job
where jobname = 'passeios-encerrar-inativos';
```

## Verificação

`node supabase/tests/testar-passeios.mjs`, com PGLITE_MODULE apontando ao
dist/index.js do PGlite, testa PostgreSQL em memória: reaplicação, RLS entre
tutores, permissões, propriedade de pet, entrada inválida, idempotência,
conflito de versão, encerramento, exportação, exclusão e cascata da conta.
Não conecta à produção. Testes do tutor cobrem planejamento dos envios,
ordem JSONB, falha parcial, duas sessões pausadas, fotos mantidas no aparelho,
troca de conta, paginação, confirmação após persistir e exclusão com falha.
Rodar também testes completos, TypeScript e lint antes de publicar.

## Conferência após implantação — pendente

1. Gravar sem internet, pausar/finalizar e conferir persistência ao reabrir.
2. Com internet, sincronizar. Recuperar na mesma conta em outro aparelho e
   comparar mapa, anotação, tempo/distância e isolamento entre contas.
3. Confirmar que fotos não são recuperadas em outro aparelho.
4. Editar a mesma anotação offline em dois aparelhos: o segundo envio deve
   mostrar conflito e preservar dados locais. Exportar antes de recuperar nuvem.
5. Testar rede indisponível, sincronização repetida, exclusão local e da nuvem.
6. Conferir passeios_nuvem no JSON de Meus dados. Verificar job/encerramento no
   último checkpoint, sem somar a espera. Conferir fonte ampliada/tela pequena.

Task permanece In Progress até aplicar a migration e conferir a integração real.

## Preview publicado — 24/10/2026

Implementação f1c5bae enviada à main. Cópia limpa aprovada em 194 testes
(33 arquivos), TypeScript, lint, teste SQL em PostgreSQL/PGlite e export Android.
[Atualização Android preview 169263e2](https://expo.dev/accounts/codaxi/projects/petlive-tutor/updates/169263e2-194a-4af1-8b95-3835afff1325).
Runtime 1264fb8e8b1374172a594db4c6ebbf26fe172e0c confirmado na publicação,
compatível com o [APK a387fe10](https://expo.dev/accounts/codaxi/projects/petlive-tutor/builds/a387fe10-ae05-406a-aeba-5e372b75689a).
Não exige novo APK ou Redeploy do site. Abrir com internet e reabrir após baixar.
A função depende de aplicar a
[migration de passeios](https://raw.githubusercontent.com/CodaxiKing/PetLive/main/supabase/migrations/20261203000000_passeios_tutor.sql)
no SQL Editor. Aplicação em produção e homologação entre aparelhos ainda não
confirmadas. Publicação preview não encerra essas pendências.
