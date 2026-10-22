# QA: anexos de saúde (P-B7CbI)

Roteiro manual para o critério 13. Faça uma vez no **Android** e outra no **iOS**, com um development build (`pnpm tutor:android` / `pnpm tutor:ios`) ou um build do EAS, sempre contra o Supabase local com o seed (`demo@petlive.dev` / `petlive123`). Em cada plataforma, marque cada passo e anexe ao PR um print ou vídeo curto dos passos 3, 6 e 8.

Antes, rode `pnpm verify:supabase` e anexe `docs/qa/verify-saida.txt` (critérios A e C). Sem shell, baixe o artefato `verify-saida` do workflow **verify** do PR no GitHub Actions. Ele roda `supabase start` e `pnpm verify:supabase`, então o teste do bucket não sai como PULADO. O `verify-saida.txt` não é versionado na branch: ele é gerado a cada execução, já que uma cópia commitada ficaria desatualizada no commit seguinte. Por isso, ele fica no artefato do run ou anexado ao PR, e não no repositório. A primeira linha do arquivo traz o commit verificado, e ele precisa ser o último commit do PR.

Caminho dos arquivos (critério 5): o texto do critério diz `anexos/{uid}/...`. Na prática, os arquivos ficam no bucket `anexos`, no caminho `{uid}/anexos/{pet}/...`. O código, as policies de RLS, a limpeza de órfãos e o `testar-anexos.mjs` seguem esse mesmo padrão. O primeiro segmento do caminho é o `uid`, e é nele que a RLS se apoia. Falta o autor do critério confirmar.

Restrição de tipo no bucket inteiro (critério C): o bucket `anexos` também guarda os recibos de despesas (`{uid}/despesas/...`) e as fotos da linha do tempo (`{uid}/marcos/...`). Esses envios usam a mesma regra (`mimeAceito`): HEIC/HEIF do iPhone sobe como `image/heic`, e WebP, GIF ou outro formato é recusado no app, antes do envio, com a mensagem "Só dá para enviar fotos em JPG, PNG ou HEIC." Ou seja, o storage nunca chega a devolver erro. O app não converte para JPEG, porque isso exigiria uma dependência nativa nova (`expo-image-manipulator`) e um novo development build. O `src/__testes__/fotosBucketAnexos.test.ts` cobre esse comportamento, e o passo 14 confere no aparelho.

Pendente de decisão do PO (critério 6): durante o envio, o progresso aparece como um indicador com "Enviando a foto…", sem percentual.

| # | Passo | Esperado | Android | iOS |
| --- | --- | --- | --- | --- |
| 1 | Pet › Saúde › Anexos sem nenhum anexo | Estado vazio com o botão para anexar o primeiro | | |
| 2 | Anexar › Câmera (primeiro uso) | O app pede permissão da câmera | | |
| 3 | Negar a permissão | Mensagem com o motivo e atalho para as Configurações; o app não trava | | |
| 4 | Anexar › Galeria | O app pede permissão da galeria (no iOS 14+, também com acesso limitado) e abre o seletor | | |
| 5 | Escolher uma foto | Prévia com Confirmar e Trocar foto; tipo Cartão de vacina ou Exame; data de hoje em DD/MM/AAAA | | |
| 6 | Salvar | Indicador de envio e botão Salvar desativado; o anexo aparece no topo da lista | | |
| 7 | Modo avião › Salvar | Erro com "Tentar novamente"; nenhum anexo pela metade na lista | | |
| 8 | Tocar no anexo | Tela cheia com zoom de pinça | | |
| 9 | Filtro por tipo | Mostra só o tipo escolhido, do mais recente para o mais antigo | | |
| 10 | Editar título, tipo e data | As alterações aparecem na lista | | |
| 11 | Excluir e confirmar | Some da lista; no Studio, o arquivo some de `anexos/{uid}/anexos/{pet}` | | |
| 12 | Foto HEIC do iPhone / foto grande (> 10 MB) | HEIC entra; a foto grande é comprimida ou recusada com uma mensagem clara | | |
| 13 | Carteirinha pública do pet | Nenhum anexo aparece | | |
| 14 | Despesa com recibo e marco da linha do tempo com foto (JPG e HEIC; no Android, também uma imagem WebP baixada) | JPG e HEIC salvam e abrem; o WebP é recusado com "Só dá para enviar fotos em JPG, PNG ou HEIC." e nada é salvo pela metade | | |
