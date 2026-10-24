# Avisos de eventos próximos

Task: `[APP-CLIENTE] Eventos: Aviso de evento perto de você, com o raio escolhido em Avisos`.

Em Avisos, Eventos perto de você permite ativar uma região aproximada e escolher
2, 5, 10, 25 ou 50 km. Só Usar minha região/Atualizar minha região solicita uma
posição com permissão de localização ao usar o app. Coordenadas são arredondadas
a duas casas antes do envio e novamente no servidor. Uma precisão acima de 2 km,
posição antiga ou coordenada inválida não é aceita. Ler os ajustes, trocar raio
ou desligar não consulta GPS. Desativar apaga as coordenadas da região.

A região vale por sete dias. Trocar somente o raio preserva a data de expiração;
atualizar a posição renova a validade. O job remove coordenadas vencidas; consultar
a configuração também limpa a região vencida da conta. Cada conta tem sua própria
configuração, protegida por RLS. RPCs verificam a conta esperada e o cliente confere
a conta antes/depois das operações, inclusive após aguardar a leitura do GPS.

## Banco e job

Aplicar no SQL Editor o arquivo completo
`supabase/migrations/20261204000000_eventos_por_regiao.sql`.
A migration é transacional, reaplicável e acrescenta região/avisos à exportação
LGPD existente, preservando inclusive os passeios da entrega anterior.
Depende das tabelas existentes de eventos, lugares, perfis, preferências, caixa
de avisos e tokens, e da função exportar_meus_dados. Não exige a migration de
passeios para funcionar, mas a composição das duas foi testada.

Com pg_cron instalado, cria o job petlive-eventos-proximos a cada 15 minutos.
Conferir após a aplicação:

```sql
select extname from pg_extension where extname in ('pg_cron','pg_net');
select jobname, schedule, active from cron.job
where jobname = 'petlive-eventos-proximos';
```

Sem pg_cron ativo, agendar a função public.eventos_avisar_proximos() no servidor
é uma pendência de implantação. A função é restrita ao servidor/service_role,
nunca a clientes autenticados ou anônimos. Nenhum job é executado em produção
pelos testes desta entrega.

São elegíveis eventos publicados, atualizados nos últimos sete dias, que começam
nos próximos 30 dias e ficam dentro do raio da região salva. Eventos podem ter
coordenadas próprias ou usar as do lugar vinculado. Eventos do próprio tutor não
geram aviso. Distância é geográfica até a região aproximada, sem cálculo de rota.

O job respeita notificacoes_ativas, a preferência de Eventos, o Horário dos
avisos e o Não perturbe no fuso do perfil; fuso inválido usa America/Sao_Paulo.
Sem preferência salva, usa 9h e silêncio entre 22h e 7h. No máximo três eventos
por dia local, priorizando proximidade/data. Cada evento gera só um aviso por
conta; a trava do job e a chave única impedem duplicação em reexecuções.
Mudar o raio não reenvia um evento que já foi avisado.

## Caixa e push

Cada aviso entra em notification_log e aponta para /eventos/ID. A caixa funciona
sem token de push. Push depende dos tokens ativos existentes em push_tokens,
pg_net e credenciais válidas do aplicativo. A função enfileira a chamada HTTP
quando a infraestrutura está disponível. Registro de token e recebimento real
no APK precisam ser conferidos na homologação; enfileirar não confirma entrega.
Os testes usam HTTP falso e não enviam mensagens a dispositivos reais.

## Verificação

201 testes (34 arquivos) passaram no tutor. Os novos testes cobrem arredondamento,
permissão negada, GPS desligado, posição inválida/incerta/antiga, ausência de
consulta GPS na leitura/desativação/troca de raio, mudança de conta e falha de rede.
Rodar testes completos, TypeScript e lint antes de publicar.

`node supabase/tests/testar-eventos-proximos.mjs`, com PGLITE_MODULE apontando
ao dist/index.js do PGlite, testa PostgreSQL em memória: RLS, consentimento,
reaplicação, raio alterando elegibilidade, lugares, horário, dois formatos de
silêncio, fuso inválido, preferência global, expiração, deduplicação, limite
diário, caixa sem push, fila HTTP falsa, exportação composta e cascata da conta.

## Conferência após implantação — pendente

1. Abrir Avisos, escolher raio e ativar a região. Negar localização deve mostrar
   erro e manter desligado. Conferir telas pequenas, fonte ampliada e leitura.
2. Atualizar região, trocar apenas o raio e reabrir: conferir valores e validade.
   Desativar deve apagar coordenadas; trocar de conta não pode mostrar a região anterior.
3. Publicar evento elegível em ambiente de homologação, executar/aguardar job e
   conferir a caixa, deep link, limite diário, Eventos desligado e Não perturbe.
4. Repetir o job: não duplicar. Conferir exclusão de coordenadas após expiração.
5. Com token e credenciais válidos no dispositivo, conferir push com app aberto
   e fechado. Ausência de push deve ser investigada separadamente da caixa.
6. Em Meus dados, conferir regiao_eventos e avisos_eventos_proximos.

Task permanece In Progress até aplicação da migration, conferência do job e
validação da integração no Android. Sem novas dependências/configuração nativa.

Referências: [Expo Location SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/location/),
[Expo Notifications SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/)
e [pg_net](https://github.com/supabase/pg_net).

## Preview publicado — 24/10/2026

Commit 207dd33 enviado à main. Cópia limpa aprovada em 201 testes (34 arquivos),
TypeScript, lint, teste PostgreSQL/PGlite e export Metro Android.
[Atualização Android preview 88ae0569](https://expo.dev/accounts/codaxi/projects/petlive-tutor/updates/88ae0569-a2ac-46e6-b4d0-14b2f4ef2adb).
Runtime 1264fb8e8b1374172a594db4c6ebbf26fe172e0c confirmado na publicação,
compatível com o [APK a387fe10](https://expo.dev/accounts/codaxi/projects/petlive-tutor/builds/a387fe10-ae05-406a-aeba-5e372b75689a).
Abrir com internet e reabrir após baixar. Não exige novo APK ou Redeploy do site.
Para ativar, aplicar a
[migration de eventos por região](https://raw.githubusercontent.com/CodaxiKing/PetLive/main/supabase/migrations/20261204000000_eventos_por_regiao.sql)
e conferir o job conforme o roteiro acima. Implantação e entrega real de push
ainda não confirmadas. Task mantida In Progress.
