# Categorias do mapa — 2026-10-25

Código na main: `920fc35`.

Admin → Conteúdo mestre → Categorias do mapa permite editar singular e plural dos nove tipos suportados. Somente super ativo com AAL2 edita; equipe ativa com AAL2 consulta. Escritas usam versão esperada e auditoria antes/depois na mesma transação. Os códigos, ícones, cores e a classificação de lugares permanecem estáveis. A interface não oferece criar ou excluir tipos incompatíveis com as fontes do mapa.

O tutor consulta o catálogo ao focar o mapa, Pet friendly e ficha do lugar. Nomes atualizam filtros, cartões, mensagens vazias e detalhes. Uma consulta atende a lista Pet friendly inteira. Respostas de telas desfocadas são descartadas. Sem catálogo/rede, os nove nomes originais continuam disponíveis; respostas inválidas não removem categorias nem alteram os padrões. Busca, favoritos e descoberta de lugares não dependem da consulta de nomes. Os novos nomes não são persistidos offline; em falhas de consulta usa-se o padrão embarcado.

## Verificações

- Migration `20270106000000_catalogo_categorias_mapa.sql`: validada com rollback e aplicada em produção (`qurdqbhjtgapyksrilyk`). Metadados: nove entradas, cliente sem UPDATE direto, anon sem RPC e guarda administrativa presente.
- PGlite com guardas reais: papéis, 2FA, inativo, acesso tutor/anon, validação de nomes, códigos fixos, versões concorrentes, auditoria, permissões diretas e reaplicação preservando edições.
- Tutor: 339 testes passaram; corrigida tipagem do parser apontada pelo primeiro typecheck. Após a correção, typecheck e lint passaram e os três testes do parser foram reexecutados com sucesso.
- Web: lint, Next typegen, tsc e build passaram.

## Pendências

OTA Android publicada no preview: grupo `3feb7213-72ac-4d8a-beda-8da6cb09ac8b`, update `01a175c5-3acd-71c0-9a2f-3158267ef54d`, runtime `2f48ad7475375d8681d4d351319e7c210a1993cf`, commit `920fc35`. Exportação e publicação concluídas, compatível com o APK preview existente. Houve avisos conhecidos sobre exports do expo-router e configuração Sentry; o bundle foi gerado e aceito pelo Expo. QA no aparelho continua pendente.

Redeploy manual da main no Coolify e QA com equipe autenticada por 2FA. No Android, conferir filtros, ficha, Pet friendly, texto longo e funcionamento sem rede. Conteúdo mestre permanece Em andamento até validação da interface publicada. Esta entrega não altera conteúdo clínico nem implementa o lojista.
