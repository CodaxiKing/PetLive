# Passeio Android com tela apagada — 25/10/2026

Implementado em Passeios um modo opcional de gravação com tela apagada no Android. O usuário ativa o seletor após explicação, inicia/retoma o passeio e concede localização precisa em primeiro e segundo plano. Sem permissão o serviço não inicia. O modo com tela aberta permanece disponível; iOS e Expo Go não oferecem este novo seletor.

A tarefa GPS é definida no escopo global e importada pelo layout raiz antes da navegação. Serviço Android mostra aviso permanente e encerra com a destruição do processo. Pontos do lote são ordenados e cada persistência é aguardada antes de concluir a tarefa. O gravador mantém suas validações de precisão, horários, velocidade, trechos e limite de pontos. O envio à nuvem continua manual.

Pausar, finalizar ou sair da tela invalida os callbacks e aguarda a parada nativa. Falha da parada é exibida e sua função fica disponível para nova tentativa. Remover uma assinatura antiga não desliga a nova. A tarefa sem recebedor ativo encerra um serviço órfão, sem restaurar conta ou gravar implicitamente; após processo encerrado, o passeio é recuperado pausado no último registro salvo. Não há promessa de gravação após forçar parada/encerrar o app, nem em aparelhos que matem o serviço por economia de bateria.

Configuração nativa: expo-location habilita ACCESS_BACKGROUND_LOCATION, FOREGROUND_SERVICE e FOREGROUND_SERVICE_LOCATION no Android. Introspecção confirmou as três; iOS sem modo location em UIBackgroundModes. Nenhuma dependência nova ou migration SQL. Firebase não é necessário para GPS; push remoto continua desativado sem GOOGLE_SERVICES_JSON.

Validação automatizada: 305 testes/50 arquivos, TypeScript e lint. Casos novos: APIs nativas simuladas, permissões/precisão, serviço indisponível, lotes ordenados e persistidos, erro nativo, processo órfão, exclusividade, falha de início, remoção tardia de sessão antiga, parada assíncrona e retry de falha. Esses testes não comprovam o comportamento de bateria/GPS de um Android físico.

## Homologação no novo APK

- Instalar o preview que inclua este commit; não enviar OTA para o runtime anterior.
- Passeios → Gravar com a tela apagada → Ativar. Iniciar e conceder localização precisa/o tempo todo; voltar ao app e tentar iniciar novamente se o Android ainda estiver retornando das configurações.
- Caminhar em local aberto, apagar a tela por alguns minutos e retornar. Conferir aviso permanente, pontos, distância e tempo. Testar também sem rede; a gravação permanece local.
- Pausar, retomar e finalizar. Confirmar que não chegam novos pontos durante a pausa e que o aviso do serviço desaparece.
- Negar a permissão de segundo plano e confirmar erro claro; desligar o seletor e usar o modo com tela aberta.
- Sair da tela/trocar conta durante passeio, forçar parada/reabrir e conferir recuperação pausada, sem coleta ou pontos na outra conta.

Status: Em andamento até APK concluído e homologação física. Publicação de loja e iOS em segundo plano continuam pendentes.

Preview solicitado ao EAS a partir do checkout limpo do commit 2c0612064315b169d03463a22c0d1c7df9f4e723: build 60863423-8d78-481c-98e8-87af4f406164, inicialmente NEW. Acompanhar: https://expo.dev/accounts/codaxi/projects/petlive-tutor/builds/60863423-8d78-481c-98e8-87af4f406164 . Cópia limpa aprovada com 305 testes, TypeScript, lint e bundle Android. Contém também as correções da main de mapa, navegação por avisos e exportação privada. Sem Firebase configurado no ambiente preview; push remoto não será habilitado por este APK. A tarefa PVTI_lAHOBmD9fc4BnyqVzhCMN04 foi movida de Todo para In Progress.
