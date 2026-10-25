# Avisos de abertura e intenções de envio — 25/10/2026

faf835e / 20261219000000_aviso_abertura_ficha.sql: abertura válida gera aviso
no histórico privado do tutor, no máximo um por link/hora. Não inclui código
ou identidade presumida de clínica; avisa que pode ter sido o próprio tutor.
Vencido/cancelado/memorial e consultas sem abertura válida não geram aviso.
Permissões de notification_log reconciliadas: leitura própria e UPDATE somente
de read_at; outro tutor/anon não leem, cliente não insere/apaga/edita o conteúdo.
PGlite verificou isolamento mesmo com policy permissiva legada, intervalo e
reaplicação. Este aviso fica no histórico; push não foi integrado/certificado.

07dee60 / 20261220000000_historico_envios_fichas.sql: cada geração/reuso cria
metadados privados em carteirinha_envios (link_id, tipo, ação, lugar_id, canal,
data), sem código, conteúdo médico, IP ou telefone. Representa intenção, não
confirma entrega por WhatsApp ou envio externo. Abertura não conta como envio.
Quota de 30 intenções/24h, dez de emergência, inclui reusos; bloqueio de perfil
serializa por conta. Exportação composta inclui os registros próprios e FKs
removem em cascata com a conta/link. Não houve backfill de eventos inventados.

O primeiro ROLLBACK detectou places.id UUID, enquanto o teste anterior usava
texto. Corrigidos FK/tipo do histórico e a comparação id::text=p_lugar da RPC
existente. Teste integrado agora usa UUID como produção; teste antigo de texto
é mantido separadamente. Migration reinspeciona o corpo conhecido antes de
reparar, sem sobrescrever silenciosamente uma versão inesperada.

Ambas migrations passaram em transação ROLLBACK antes de COMMIT em produção
qurdqbhjtgapyksrilyk, depois dos commits na main. Pós-checks: dois triggers
ativos, comparação UUID reparada, cliente lê aviso/marca read_at, não altera
body, anon não lê histórico de envio e cliente não insere nele. Não foram
criados links, avisos ou eventos fictícios em produção nem enviadas mensagens.
Sem novo APK necessário para SQL; app/site usam os contratos existentes.

Verificação: testar-aviso-abertura.mjs; testar-carteirinha-reconciliacao.mjs
normal e com TESTAR_FICHAS_INTEGRADAS=1, usando PGLITE_MODULE. Integração cobre
quota diária na reutilização da mesma ficha, um link/dez eventos, exportação,
RLS e funcionamento conjunto dos avisos. Avisos de push e homologação real no
Android continuam pendentes, sem alegação de entrega no aparelho.
