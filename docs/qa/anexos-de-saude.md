# QA: anexos de saúde (P-B7CbI)

Roteiro manual para o critério 13. Faça uma vez no **Android** e outra no **iOS**, com um development build (`pnpm tutor:android` / `pnpm tutor:ios`) ou um build do EAS, sempre contra o Supabase local com o seed (`demo@petlive.dev` / `petlive123`). Em cada plataforma, marque cada passo e anexe ao PR um print ou vídeo curto dos passos 3, 6 e 8.

## Verificação automática (critérios A e C), sem shell

Em cada push no PR, o workflow **verify** do GitHub Actions sobe o Supabase local (`supabase start`) e roda `pnpm verify:supabase`. Isso inclui install com lockfile congelado, typecheck, testes e o `supabase/tests/testar-anexos.mjs`, que testa o bucket e por isso nunca sai como PULADO nesse modo. O resultado aparece em três lugares:

1. **Comentário no PR** "pnpm verify:supabase: ✅ passou / ❌ falhou". Existe um só comentário, atualizado a cada push, com o commit verificado e a saída completa em "Saída completa".
2. **Resumo do run**, na aba Actions › verify › Summary.
3. **Artefato** `verify-saida`.

Para aprovar, o commit do comentário precisa ser o último commit do PR. O workflow faz o checkout do próprio commit do PR, e não do merge com a main, então o hash da primeira linha da saída é o mesmo da lista de commits do PR.

**Sem shell e sem acesso ao PR:** o `docs/qa/verify-saida.txt` também fica versionado no repositório, com a saída de um `pnpm verify:supabase` rodado no Windows pelo dev antes de mandar para o QA. A primeira linha registra o commit em que rodou. O arquivo vai no commit seguinte a esse, junto só com documentação (`.gitignore` e este roteiro), então o código verificado é o mesmo do PR. Se o PR tiver commits de código depois desse, vale o comentário do workflow. Com shell, `pnpm verify:supabase` local regenera o arquivo. Já o `pnpm verify` sem `:supabase` pula o teste do bucket quando o Supabase local está fora do ar, então **não** serve para comprovar o critério C.

## Decisões sobre os critérios

Caminho dos arquivos (critério 5): o caminho completo no Storage é `anexos/{uid}/anexos/{pet}/{arquivo}`, ou seja, bucket `anexos`, primeira pasta `{uid}`, depois a área `anexos` e a pasta do pet. Esse caminho começa com `anexos/{uid}/`, como o critério pede, e fica ligado ao pet pela pasta e pela coluna `pet_id`. A área intermediária `anexos/` existe porque o mesmo bucket guarda `{uid}/despesas/` e `{uid}/marcos/`. A RLS e o `lgpd-delete` usam o `{uid}` do primeiro segmento. O código, as policies, a limpeza de órfãos e o `testar-anexos.mjs` seguem esse padrão.

Progresso do envio (critério 6): durante o envio aparecem uma barra e o texto "Enviando a foto… NN%", com o percentual real de bytes enviados (`src/saude/envioComProgresso.ts`, coberto por `envioComProgresso.test.ts`). Quando a foto termina de subir, o texto muda para "Salvando o anexo…" enquanto o registro é criado. O botão Salvar fica desativado o tempo todo.

## Roteiro no aparelho

Restrição de tipo no bucket inteiro (critério C): o bucket `anexos` também guarda os recibos de despesas (`{uid}/despesas/...`) e as fotos da linha do tempo (`{uid}/marcos/...`). Esses envios usam a mesma regra (`mimeAceito`): HEIC/HEIF do iPhone sobe como `image/heic`, e WebP, GIF ou outro formato é recusado no app, antes do envio, com a mensagem "Só dá para enviar fotos em JPG, PNG ou HEIC." Ou seja, o storage nunca chega a devolver erro. O app não converte para JPEG, porque isso exigiria uma dependência nativa nova (`expo-image-manipulator`) e um novo development build. O `src/__testes__/fotosBucketAnexos.test.ts` cobre esse comportamento, e o passo 14 confere no aparelho.

| # | Passo | Esperado | Android | iOS |
| --- | --- | --- | --- | --- |
| 1 | Pet › Saúde › Anexos sem nenhum anexo | Estado vazio com o botão para anexar o primeiro | | |
| 2 | Anexar › Câmera (primeiro uso) | O app pede permissão da câmera | | |
| 3 | Negar a permissão | Mensagem com o motivo e atalho para as Configurações; o app não trava | | |
| 4 | Anexar › Galeria | O app pede permissão da galeria (no iOS 14+, também com acesso limitado) e abre o seletor | | |
| 5 | Escolher uma foto | Prévia com Confirmar e Trocar foto; tipo Cartão de vacina ou Exame; data de hoje em DD/MM/AAAA | | |
| 6 | Salvar | Barra com "Enviando a foto… NN%" subindo até "Salvando o anexo…" e botão Salvar desativado; o anexo aparece no topo da lista | | |
| 7 | Modo avião › Salvar | Erro com "Tentar novamente"; nenhum anexo pela metade na lista | | |
| 8 | Tocar no anexo | Tela cheia com zoom de pinça | | |
| 9 | Filtro por tipo | Mostra só o tipo escolhido, do mais recente para o mais antigo | | |
| 10 | Editar título, tipo e data | As alterações aparecem na lista | | |
| 11 | Excluir e confirmar | Some da lista; no Studio, o arquivo some de `anexos/{uid}/anexos/{pet}` | | |
| 12 | Foto HEIC do iPhone / foto grande (> 10 MB) | HEIC entra; a foto grande é comprimida ou recusada com uma mensagem clara | | |
| 13 | Carteirinha pública do pet | Nenhum anexo aparece | | |
| 14 | Despesa com recibo e marco da linha do tempo com foto (JPG e HEIC; no Android, também uma imagem WebP baixada) | JPG e HEIC salvam e abrem; o WebP é recusado com "Só dá para enviar fotos em JPG, PNG ou HEIC." e nada é salvo pela metade | | |
