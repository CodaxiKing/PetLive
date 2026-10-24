# Lista de adoção, filtros e favoritos

Tarefas do Projects 5: lista do tutor (`PVTI_lAHOBmD9fc4BnyqVzhCLwXE`), base com RLS (`PVTI_lAHOBmD9fc4BnyqVzhCLwzg`) e ocultação por 60 dias (`PVTI_lAHOBmD9fc4BnyqVzhCLw8g`).

## Entrega

Entrada em Atalhos → Adoção. Lista autenticada com foto ou placeholder, idade civil, porte, sexo, ONG, bairro/cidade e informações fornecidas pela ONG. Filtros por espécie, filhotes até um ano, porte, sexo, cidade e somente favoritos. Filtros são aplicados explicitamente; cidade aceita busca parcial sem distinguir maiúsculas e acentos. Sem nascimento informado, o pet não entra no filtro de filhotes.

Paginação de 20 por cursor `(criado_em,id)`, sem offset, com desempate determinístico. Botão Carregar mais e atualização ao puxar/retomar a tela. Favoritar/desfavoritar aguarda confirmação do servidor, bloqueia repetição por pet e mostra falhas sem simular sucesso. Itens indisponíveis deixam de aparecer após atualizar a lista, inclusive nos favoritos. Estados de vazio, carregamento, falha e foto indisponível são distintos. Consultas antigas são ignoradas ao sair, trocar filtros ou trocar conta; o repositório confere a conta antes e depois das respostas.

O catálogo retorna somente pets `publicado`, de ONGs `aprovada`, com confirmação **há menos de 60 dias e não no futuro**. A regra é aplicada a cada consulta, sem depender de cron. Marcar como adotado, ocultar ou suspender a ONG remove o pet das consultas. `adocao_confirmar_pet` permite à ONG responsável e verificada renovar a confirmação de pet publicado, inclusive vencido. Não reativa pet adotado ou ocultado pela moderação.

## Banco e privacidade

Aplicar o arquivo completo `supabase/migrations/20261206000000_catalogo_adocao.sql` no SQL Editor de produção. Migration transacional e reaplicável; depende de `profiles` e da função existente `exportar_meus_dados()`.

- Tabelas de ONGs, pets de adoção, favoritos e contatos com RLS.
- Catálogo por RPC com projeção explícita; não publica IDs de responsáveis ou contatos. Cadastro da ONG e pets em rascunho ficam restritos à própria ONG.
- Favoritos privados, gravados pela RPC que verifica a conta e disponibilidade. Não permite editar favoritos alheios nem se autoaprovar como ONG.
- Contatos: estrutura privada para a futura tela Tenho interesse. Envio ainda não exposto; leitura só pelo tutor que enviou e pela ONG responsável. Não há chat ou envio de mensagens nesta entrega.
- Criação/aprovação/publicação de ONGs e pets somente por backend confiável/`service_role` ou SQL administrativo, após verificação real. Não foi criada interface de cadastro/moderação nesta entrega. Não publicar ONGs fictícias em produção para preencher a lista.
- Fotos: até seis URLs HTTPS sem credenciais na autoridade; usar somente imagens públicas aprovadas, nunca documentos privados ou URLs assinadas de documentos. O app mostra a primeira foto e trata falhas de carregamento.
- Favoritos, contatos enviados e dados da própria ONG acrescentados à exportação LGPD, preservando conteúdo anterior. Exclusão do perfil remove os favoritos/contatos próprios e, quando responsável de ONG, seus pets e contatos associados por cascata.

A lista ficará vazia enquanto não houver pets reais publicados de ONGs aprovadas. Ausência da migration é exibida como falha de carregamento, não como ausência de pets.

## Validação executada

- 230 testes em 39 arquivos; TypeScript e lint do tutor.
- `supabase/tests/testar-adocao.mjs`: PGlite em memória, sem acessar produção. Migration duas vezes; catálogo público controlado, corte de 60 dias, confirmação pela ONG, filtros combinados/cidade sem acentos, cursor com timestamps iguais, favoritos idempotentes/privados, negação de autoaprovação/escrita direta, RLS de contatos, LGPD, cascata e limites de fotos.
- Testes do app: validação de respostas/imagens, idade, deduplicação de páginas, parâmetros de filtros/cursor, troca de conta antes/depois da consulta e confirmação real do favorito.

## Pendências

Preview Android publicado: [OTA b9650397](https://expo.dev/accounts/codaxi/projects/petlive-tutor/updates/b9650397-c886-404d-94ef-9ff20a3027f0), código `5f14585`, runtime `dff916ce37166d489949d7b3020e4ed90d1755dd`. Compatível com o APK dos atalhos `efb3cb3b-a260-427c-b501-21dde90e5dd0`; abrir com internet e reabrir o app para carregar. A OTA não aplica a migration.

Aplicar migration, publicar dados reais verificados e testar no Android os filtros, paginação, atualização, erro de rede, persistência de favoritos e troca de conta. O preview usa o runtime do APK dos atalhos (`dff916ce37166d489949d7b3020e4ed90d1755dd`); não requer dependência nativa nova.

Continuam em outras tarefas: cadastro de ONG/CNPJ/documentos, gestão e fotos pela ONG, painel de aprovação/moderação, ficha completa e Tenho interesse/contato com a ONG. Não há botão de contato fictício na lista. Essas tarefas não são encerradas por esta entrega.
