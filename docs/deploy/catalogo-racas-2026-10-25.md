# Catálogo de raças — 2026-10-25

Código publicado na main: `5b6f933`.

## Entrega

- Admin → Conteúdo mestre → Raças: busca, páginas de 50 itens, criação, edição, desativação e reativação. Super ativo com AAL2 edita; equipe ativa com AAL2 consulta. Conflitos de versão exigem atualizar a lista e reabrir o cadastro.
- Tabela `catalogo_racas` privada, unicidade por espécie e nome sem diferenciar maiúsculas/espaços externos. Escritas administrativas auditam antes/depois na mesma transação. Não há exclusão ou alteração dos nomes já registrados em pets.
- Formulário compartilhado de criação/edição do pet consulta até oito sugestões por espécie/texto. Consulta com atraso de 300 ms e descarte de respostas antigas. O campo permanece livre; catálogo vazio ou indisponível não bloqueia salvar o pet.
- Nove sugestões iniciais. Nenhum dado clínico, faixa de peso ou regra veterinária foi adicionado ao catálogo.

## Banco e verificações

Migration `20270105000000_catalogo_racas.sql` validada com rollback e aplicada em produção (`qurdqbhjtgapyksrilyk`). Metadados confirmaram nove entradas ativas, ausência de INSERT direto para authenticated, RPC negada para anon e guarda administrativa presente.

Teste PGlite com guardas reais cobre papéis, AAL1, membro inativo, RLS, validação, unicidade, edição antiga, desativação/reativação, espécie, busca literal, limite de oito sugestões, paginação sem repetição, auditoria e reaplicação sem apagar alterações. Fixtures de teste foram criadas somente no banco isolado.

Web: lint, Next typegen, tsc e build passaram. Tutor: typecheck, lint e 336 testes existentes passaram.

## Atualização Android

OTA publicada no canal/branch preview, grupo `06a61ffa-4103-4f81-80a2-8615d2d55536`, update `01a1758f-9ac9-7cfb-bcdc-0b2acbf93e8e`, commit `5b6f933`. Runtime `2f48ad7475375d8681d4d351319e7c210a1993cf`, compatível com o APK preview existente. Exportação Android e publicação concluídas. O processo emitiu avisos de exports do expo-router e configuração de organização/projeto Sentry; a geração do bundle e o envio concluíram com sucesso. Entrega e layout no aparelho ainda aguardam QA.

## Pendências

Redeploy manual da main no Coolify. Validar no admin com super e leitura; testar no aparelho a escolha de sugestão, a digitação livre, a troca de espécie e o funcionamento sem rede. Gestão de categorias permanece pendente no item de Conteúdo mestre, mantido Em andamento. Lojista permanece para depois.
