# Push de abertura de ficha — 25/10/2026

## Backend

Migration `20261221000000_push_abertura_ficha.sql`: registro de tokens por RPC autenticada, fila privada por dispositivo e abertura, processamento com pg_net/pg_cron, tickets e recibos Expo. Respeita conta atual, aviso lido, validade do link, preferências, consentimento e Não perturbe. Token inválido é desativado. Resposta incerta de envio não dispara reenvio automático. Nenhum histórico anterior é reenviado.

O estado `aceito` significa aceitação pelo provedor, não entrega ou leitura no celular. Transporte dos testes inteiramente simulado; nenhum push real de teste foi enviado.

Verificação: teste PGlite aplica a migration duas vezes e cobre permissões, troca de conta, idempotência, fila, tickets/recibos, DeviceNotRegistered, preferências, consentimento, horários, aviso lido, HTTP 503 e transporte incerto. A migration também foi executada no esquema de produção em transação com rollback antes da aplicação.

## Dependências para Android

O responsável confirmou que ainda não há Firebase configurado. O app atual só agenda notificações locais e ainda não registra Expo Push Tokens. Não considerar push concluído nem validar por OTA do APK existente.

1. Criar projeto no Firebase Console e adicionar aplicativo Android com package `app.petlive.tutor`.
2. Obter `google-services.json` para esse aplicativo. Ele é configuração do cliente; a chave de conta de serviço FCM é separada e privada.
3. Configurar credencial FCM v1 nas credenciais Android do projeto EAS `petlive-tutor`, conta `codaxi`. Não inserir chave de conta de serviço no repositório ou no app.
4. Implementar registro/renovação do token via `push_token_registrar` após permissão e autenticação, e desativação via `push_token_desativar` antes do logout. As RPCs exigem o UUID da conta atual. Não pedir permissão automaticamente na inicialização.
5. Configurar `expo-notifications` no app config e `android.googleServicesFile`; gerar um novo APK com a configuração nativa. Não forçar compatibilidade com runtime anterior.
6. Instalar e validar recebimento, toque no aviso, preferências, Não perturbe, troca de conta, logout e token revogado no Android físico. Só então concluir os itens do board.

Referências oficiais: https://docs.expo.dev/push-notifications/fcm-credentials/ e https://docs.expo.dev/versions/v58.0.0/sdk/notifications/.
