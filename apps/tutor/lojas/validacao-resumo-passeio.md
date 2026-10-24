# Resumo do passeio

Task: `[APP-CLIENTE] Passeios: Resumo do passeio: distância, tempo, ritmo, mapa, foto e anotação`.

Entrega de 24/10/2026: Finalizar e revisar passeio pausa o GPS e abre o resumo.
O trajeto pausado continua guardado até tocar em Salvar passeio. A revisão mostra
distância, tempo ativo, ritmo médio em min/km e mapa com início, fim e linhas por
trecho. Pausas não são ligadas por linhas artificiais. Sem pontos suficientes,
o ritmo informa a falta de distância em vez de dividir por zero.

O mapa de ruas usa MapLibre/OpenFreeMap com a atribuição nativa habilitada;
falha de carregamento permite nova tentativa e usa o desenho local. Há também
um botão para escolher o desenho sem ruas quando estiver offline. Nenhum ponto
do trajeto é enviado para uma API de rotas; o mapa busca seu estilo e tiles.

Foto opcional pela câmera ou galeria, com prévia e remoção. A seleção usa o
seletor do sistema, sem pedir acesso amplo à galeria. Câmera exige autorização.
Fotos têm limite de 5 MB; anotação tem até 1.000 caracteres. Ambos são salvos
somente na confirmação. A foto é copiada da área temporária para a pasta de
documentos da conta. Cancelar/voltar antes de salvar não altera a foto ou nota
anterior; o trajeto continua pausado. Reiniciar o app não preserva escolhas de
foto/texto ainda não confirmadas.

O resumo mantém a hora da pausa como finalização, sem somar o tempo gasto na
revisão. Fotos são copiadas antes da atualização do registro; se a escrita
falhar, a cópia nova é removida e o passeio não aparece como concluído. A foto
antiga só é removida após confirmar a substituição. A exclusão de passeios da
conta também remove suas fotos persistentes. Editar um passeio antigo não muda
a ordem dos demais registros. Campos opcionais preservam a leitura dos registros
anteriores, sem migração de banco.

No histórico, Ver resumo, foto e anotação permite consultar/editar concluídos
visíveis no plano atual. O limite grátis de 30 dias também é aplicado na rota
de resumo; não basta abrir uma URL antiga para exibir o passeio. Dados ficam
neste aparelho, sem sincronização de nuvem nesta entrega.

Meus dados passa a compartilhar um arquivo JSON, em vez de texto no menu do
sistema. Inclui anotações, referências e conteúdo base64 das fotos, com detecção
do tipo pelos bytes. Escreve uma foto por vez para não acumular todas em memória.
A conta é conferida novamente depois de preparar o arquivo e antes de compartilhar.
Fotos ausentes geram erro explícito; a exportação não finge conter o arquivo.
Exportações concluídas ficam no cache temporário do app para o destinatário poder
ler; erros removem a cópia incompleta. O sistema pode limpar esse cache depois.

expo-file-system 58.0.10 foi declarado diretamente, usando `expo install`, na
mesma versão que já existia como dependência do Expo. Conferir o fingerprint do
perfil preview antes de afirmar compatibilidade com o APK existente.

## Validação automatizada

171 testes em 29 arquivos passaram na implementação. Incluem ritmo, anotação,
geometria sem unir pausas, enquadramento na linha de data/polos, salvar depois da
revisão, tempo sem acréscimo na revisão, rollback de cópia nova, falha de escrita,
edição sem apagar foto antiga, remoção, permissão/cancelamento/limite da foto,
cópia persistente por conta e exportação JSON com fotos/conta correta.
Rodar `npm test`, `npm run typecheck` e `npm run lint` em apps/tutor.
Mocks de câmera/arquivos/mapa não substituem a homologação nativa.

## Conferência no Android — pendente

1. Gravar e pausar um passeio, tocar em Finalizar e revisar. GPS deve parar e o
   passeio não deve entrar nos totais de concluídos até Salvar passeio.
2. Conferir distância, tempo, ritmo e linhas do mapa. Pausar/retomar durante o
   trajeto não deve desenhar uma linha pela pausa. Testar também sem pontos.
3. Negar câmera, cancelar seletor e escolher foto da galeria. Conferir os avisos,
   prévia, anotação e confirmação. Fechar/reabrir após salvar e verificar a foto.
4. Revisar sem internet: escolher desenho do trajeto e salvar nota/foto local.
5. Editar a foto/anotação de um concluído, removê-la e conferir o histórico.
   Revisar não pode aumentar o tempo ativo ou mudar a data do passeio original.
6. Exportar Meus dados e abrir o JSON; conferir fotos_passeios e anotações.
   Trocar de conta não deve mostrar os dados da outra. Apagar os passeios pelo
   botão do gravador deve remover os registros e fotos persistentes da conta.
7. Conferir teclado, fonte ampliada, mapa e câmera em tela pequena.

Status In Progress até conferir mapa, câmera e persistência real no aparelho.
Não exige SQL. Segundo plano, sincronização e política de descarte/encerramento
automático continuam em tarefas separadas; não foram implementados aqui.

## Preview publicado — 24/10/2026

Commit b1254ca enviado para main. Cópia limpa aprovada em 171 testes,
TypeScript, lint e export Metro Android.
[Atualização Android preview 0424c021](https://expo.dev/accounts/codaxi/projects/petlive-tutor/updates/0424c021-177d-4c7a-9e5e-2204bf6a1272).
Runtime 1264fb8e8b1374172a594db4c6ebbf26fe172e0c, confirmado pelo fingerprint
do perfil preview e pela publicação. Compatível com o
[APK a387fe10](https://expo.dev/accounts/codaxi/projects/petlive-tutor/builds/a387fe10-ae05-406a-aeba-5e372b75689a).
Não exige SQL nem novo APK. Abrir com internet para baixar a atualização e
reabrir após o download. Acesso por Passeios → Finalizar e revisar ou pelo
histórico. Câmera, mapa e persistência das fotos ainda aguardam o roteiro
nativo acima; a publicação não comprova recebimento no aparelho.

Referências: [ImagePicker SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/),
[FileSystem SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/),
[MapLibre Camera](https://maplibre.org/maplibre-react-native/docs/components/camera/),
[GeoJSONSource](https://maplibre.org/maplibre-react-native/docs/components/sources/geo-json-source/)
e [Layer](https://maplibre.org/maplibre-react-native/docs/components/layer/).
