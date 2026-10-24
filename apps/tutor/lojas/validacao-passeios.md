# Passeios com GPS em primeiro plano

Task: `[APP-CLIENTE] Passeios: Iniciar, pausar e finalizar passeio com gravação do trajeto por GPS`.

Entrega de 24/10/2026: Início → Ver todos → Passeios. Seleciona um pet ativo
da conta, solicita localização precisa e inicia um passeio. Pausar, retomar e
finalizar mantêm um único passeio em aberto por conta. Exibe tempo ativo,
distância e desenho dos pontos salvos, com trechos separados nas pausas.
O desenho funciona sem mapa de ruas e não precisa buscar tiles da internet.

O observador Expo Location usa alta precisão, intervalo de 5 s e deslocamento
de 3 m. Pontos sem precisão conhecida/acima de 35 m, duplicados, fora da ordem,
antigos, inválidos e saltos acima de 12 m/s não entram. Lacunas maiores que 45 s
abrem outro trecho e não somam uma linha entre os dois pontos. A distância é
aproximada pelo GPS, não uma medição certificada. Há um limite de 10 mil pontos
por sessão; ao alcançá-lo a gravação pausa e pede para finalizar.

O app grava cada ponto aceito e faz checkpoint a cada 10 s. Ao sair da tela,
bloquear o aparelho, atender uma interrupção ou trocar de app, remove o observador
e pausa. Retomar cria um novo trecho, sem contabilizar o deslocamento da pausa.
Se o processo for encerrado sem aviso, a recuperação considera somente o tempo
até o último checkpoint salvo e exige retomada explícita. Os segundos posteriores
ao último salvamento podem não ser recuperados em encerramento abrupto.

Uma fila de escrita e uma sessão compartilhada por conta evitam que telas
duplicadas ou callbacks atrasados sobrescrevam uma finalização. Cancelar enquanto
a assinatura GPS ainda é criada remove também a assinatura tardia. Falhas de
armazenamento pausam a gravação e deixam nova tentativa disponível, sem anunciar
sucesso. Dados ilegíveis não são substituídos por uma lista vazia.

Os passeios ficam no AsyncStorage deste aparelho, em chave por tutor. Sair da
conta pausa; outra conta não carrega esses trajetos. Exportar meus dados inclui
os passeios locais da conta autenticada e confere a conta novamente antes de
abrir o compartilhamento. A tela permite apagar os trajetos locais da conta
após confirmação e com a gravação pausada. Não há upload automático.

## Escopo ainda pendente

Esta entrega não implementa as outras tasks: gravação com tela apagada,
sincronização/tabelas no backend, resumo com foto/anotação/ritmo/mapa de ruas,
histórico com totais e metas, selo Passeios em dia ou compartilhamento social.
Por enquanto cada passeio é de um pet; seleção simultânea de vários pets,
política de descarte de passeio curto e encerramento automático precisam ser
definidos/implementados nas próximas entregas. A tela informa a gravação local
e a necessidade de permanecer aberta. Nenhuma dessas tasks foi marcada Done.

## Validação automatizada

149 testes em 25 arquivos passaram na implementação, incluindo 18 novos testes
de distância/tempo, pausas, amostras inválidas, retomada, falha de persistência,
recuperação no checkpoint, cancelamento durante criação do GPS, isolamento entre
contas, corrupção preservada, desenho sem ligar pausas, permissão negada/aproximada,
GPS desligado e exportação com troca de conta. Rodar `npm test`, `npm run typecheck`
e `npm run lint` em apps/tutor. Os testes usam GPS/armazenamento controlados;
não comprovam a precisão nem o comportamento real do sistema operacional.

## Roteiro no Android — pendente

1. Abrir Passeios, escolher pet, iniciar e negar GPS: mostrar erro sem criar passeio.
2. Ativar localização precisa, iniciar e caminhar em local aberto por alguns minutos.
   Conferir pontos, desenho, tempo e distância aproximada.
3. Pausar, andar sem gravar e retomar. O tempo pausado e a distância entre trechos
   não devem entrar. Finalizar e reabrir: o último passeio deve continuar salvo.
4. Trocar de app, bloquear tela e voltar: exigir retomada, sem gravar em segundo plano.
5. Sem internet, gravar e finalizar. Encerrar o processo durante gravação e reabrir:
   recuperar pausado no último checkpoint salvo, sem contar horas com o app fechado.
6. Trocar de conta e verificar ausência dos trajetos da outra conta. Em Meus dados,
   conferir `passeios_locais` no JSON. Apagar trajetos pela tela e confirmar remoção.
7. Simular GPS desligado/permissão revogada e conferir interrupção com aviso.
   Verificar o layout em tela pequena e com fonte ampliada.

Não exige migration, nova dependência nem mudança da configuração nativa.
Status In Progress até homologar no aparelho. Backend e tela apagada continuam
nas respectivas tasks a fazer.

## Preview publicado — 24/10/2026

Commit 1d48967 enviado para main e exportado/publicado a partir de cópia limpa,
com 149 testes, TypeScript e lint aprovados.
[Atualização Android preview b8251e78](https://expo.dev/accounts/codaxi/projects/petlive-tutor/updates/b8251e78-5f22-4ee2-8f7b-34f47603c503).
Runtime 1264fb8e8b1374172a594db4c6ebbf26fe172e0c, confirmado com
`npx eas-cli@latest fingerprint:generate --build-profile preview --platform android --json --non-interactive`
e na publicação. Compatível com o
[APK a387fe10](https://expo.dev/accounts/codaxi/projects/petlive-tutor/builds/a387fe10-ae05-406a-aeba-5e372b75689a).
No APK compatível, abrir com internet para baixar a atualização e reabrir
após o download. Depois seguir o roteiro acima. Nenhum teste nativo foi
confirmado nesta entrega e não houve publicação nas lojas.

Referências: [Expo Location SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/location/),
[Expo Crypto SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/crypto/),
[AppState](https://reactnative.dev/docs/appstate).
