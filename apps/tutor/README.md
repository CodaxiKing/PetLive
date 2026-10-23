# App do tutor

Aplicativo do tutor, em React Native com Expo e TypeScript, com Expo Router.

Tarefas: `[APP-CLIENTE]` no [board](https://github.com/users/CodaxiKing/projects/5).
Referência de telas: `../../prototipo/` (Welcome, Login, Main, Inicio, MeusPets, Pet, Mapa, Lembretes, Loja e demais).

Status: em desenvolvimento.

## Carteirinha em PDF

Na carteirinha, **Salvar carteirinha em PDF** abre as opções de inclusão:
vacinas, remédios, alergias, nome do tutor, veterinário e observações.
Nome e dados básicos do pet permanecem no documento. Contatos e notas
ficam desmarcados inicialmente. A seleção controla tanto a prévia de impressão
quanto o arquivo enviado. O PDF é um recurso Premium.

**Prévia / imprimir** abre a impressão do sistema; **Gerar e enviar PDF**
gera um arquivo local com `expo-print` e abre o compartilhamento com
`expo-sharing`. Não é criado um link público. O arquivo enviado não expira.
Falha ao carregar vacinas ou remédios impede a exportação para evitar um
documento incompleto. Valide impressão e envio em aparelho Android e iOS
com os módulos nativos disponíveis.

## Ações na ficha de eventos

Em `/eventos/[id]`, o tutor pode enviar uma denúncia com motivo e detalhe
opcional, compartilhar título, datas, local e link pelo sistema, e abrir o
formulário da agenda do aparelho. O link `petlive://eventos/<id>` requer o
app instalado e uma sessão para acessar a ficha.

A agenda usa `expo-calendar/legacy`, compatível com o SDK 58, apenas para
abrir o formulário nativo. Não lê calendários nem pede permissões para
consultá-los. A pessoa revisa e salva no aplicativo da agenda. No Android,
o retorno não confirma se houve salvamento; a interface informa essa
limitação. A cópia na agenda não é sincronizada com alterações ou cancelamentos.

Builds próprios anteriores à inclusão de `expo-calendar` precisam ser
recompilados (development build ou EAS). Valide em aparelho os diálogos de
compartilhamento, confirmação de denúncia e inclusão na agenda.

Os testes de `src/__testes__/acoesEvento.test.ts` cobrem link, campos públicos,
horários em Brasília, duração e resultado do formulário da agenda.

## Eventos no mapa

A aba Eventos mostra pins próprios de calendário e uma lista com acesso à
ficha. Hoje e Esta semana usam o horário de Brasília; a semana termina no
domingo. Eventos em andamento continuam nos resultados. A busca por bairro
muda o centro da consulta. A lista é atualizada ao voltar à tela e distingue
falha de rede de ausência de resultados.

A consulta atual cobre eventos com ponto próprio. A resolução de locais
do Google por Place ID pertence à tarefa de backend de busca de eventos;
esses eventos ainda não entram nesta consulta. Valide o toque nos pins,
a alternância das abas e a disposição do painel em aparelho.

## Cartão do pet em imagem

Na carteirinha, **Gerar imagem do cartão do pet** abre a prévia de foto,
nome, espécie, raça e selos. O cartão é capturado em PNG e enviado ao menu
de compartilhamento do aparelho. A geração aguarda a foto e os selos;
erros de carregamento oferecem nova tentativa. Pets em memória usam uma
apresentação discreta, sem selos ou metas. Contatos do tutor, IDs e dados
de saúde não são incluídos no modelo da imagem.

Usa `react-native-view-shot` e `expo-sharing` nas versões do SDK 58. Builds
próprios anteriores à inclusão desses módulos precisam ser recompilados.
O compartilhamento é de saída; o plugin mantém desabilitadas as extensões
de recebimento. A geração de arquivo é para Android e iOS. Valide a imagem
final e o menu de compartilhamento em aparelho. Temas e formatos Stories
e Post permanecem em sua tarefa própria no board.
