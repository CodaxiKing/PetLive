# Carteirinha e ficha — reconciliação

Migration 20261218000000 recompõe carteirinha_links e as três RPCs existentes
do app/site: criar_link_carteirinha, cancelar_link_carteirinha e carteirinha_publica.
Preserva o contrato, tipo de ficha, contatos escolhidos e snapshot. Não depende
de campos veterinario/observacoes ausentes no schema antigo; retorna null quando
escolhidos e não disponíveis. Selecionar dados/telefone continua explícito.

Somente dono cria para pet ativo fora do memorial. Quota de 30 links em 24h,
10 de emergência, serializada por conta. Token novo de 32 bytes aleatórios.
Prazo de 1–72h (atalhos do app 6/24/72); emergência com mesmas seções pode ser
reaproveitada se durar mais de 2h, sem ultrapassar o novo prazo solicitado.
Canal validado e lugar somente por ID existente de places; não aceita número
arbitrário de clínica nesse campo. O registro é da última origem do link;
histórico completo de cada envio/reuso continua pendente na task própria.

Tabela privada com SELECT por coluna/RLS, sem leitura direta de conteudo.
Publicação pelo código retorna somente snapshot/seções/datas; inexistente,
vencido, cancelado, pet em memória/inativo ou transferido não retorna dados.
Cancelamento remove imediatamente o snapshot e preserva metadados. Rate limit
atômico: 60 consultas por hash de IP/hora e 100 aberturas por link. Considera
x-forwarded-for disponibilizado pelo gateway; sem header, usa grupo sem-ip.
Não guarda IP bruto. Proteção por IP depende da configuração confiável do proxy.

Limpeza diária às 04:17 UTC quando pg_cron existe: apaga snapshot vencido há mais
de um dia e contadores de IP com mais de sete dias. Invalidar link por prazo
independe do cron. Exportação composta inclui próprios registros sem códigos;
preserva exportação anterior, incluindo ONG e cuidador. Nenhum push é enviado
por esta migration; aviso de abertura ao tutor continua pendente de integração.

PGlite: `node supabase/tests/testar-carteirinha-reconciliacao.mjs` com PGLITE_MODULE.
Cobre reaplicação, dono/anon/RLS/colunas, seções, contatos, snapshot, prazo/reuso,
cancelamento, memorial, quotas de acesso, limpeza e exportação mínima. Funções
criptográficas são simuladas apenas no teste; produção usa pgcrypto/32 bytes.
Nenhum dado fictício remoto, mensagem de WhatsApp ou notificação real usada.

Homologação pendente: gerar ficha real autorizada no app, comparar seções,
exportar/ler QR, abrir no navegador sem login e confirmar cancelamento/prazo.
Não compartilhar dados reais com clínica como teste fictício. Verificar o
comportamento de limite e renovação do link. Publicar backend não certifica
essa experiência nem os avisos ainda não integrados.
