# Atalhos do ícone — Android

Tarefa: `[APP-CLIENTE] Widget: Atalhos do ícone do app: SOS, registrar peso e iniciar passeio`.

Entrega Android: ao pressionar o ícone, o launcher compatível oferece SOS, Registrar peso e Iniciar passeio. São atalhos estáticos com ícones vetoriais locais, gerados no prebuild por `plugins/atalhos-android.js`. Não dependem de abrir o app primeiro nem levam nomes/IDs de tutor ou pet para o launcher. Não adicionam permissões.

A rota pública `/acao-rapida` aceita somente três ações conhecidas. Sem sessão, pede login pela tela existente em modo Entrar e retoma a intenção após o acesso. Essa intenção contém somente o nome da ação, fica em memória por até dez minutos e é consumida uma vez. A troca de conta recria o contexto de pets, evitando reaproveitar a lista anterior.

- SOS abre a tela existente de emergência.
- Registrar peso pede o pet ativo e pertencente à conta. Não oferece pets de outro tutor ou em memória. Abre o formulário existente sem gravar nada automaticamente; sem pet, oferece cadastro. Falhas de carregamento permitem tentar novamente.
- Iniciar passeio abre a tela existente para escolher o pet e confirmar o início. Não solicita localização nem inicia GPS só por tocar no atalho.

O plugin gera recursos no projeto Android durante o prebuild. Não editar `android/` manualmente. Não usa a biblioteca comunitária `expo-quick-actions`: a versão publicada consultada usa um script Gradle removido do SDK 58. Não foi adicionada dependência ao projeto.

## Validação

- Testes de allowlist, intenção de login com expiração/consumo único, três intents explícitos com recursos locais e reaplicação do plugin sem duplicar metadados ou remover entradas anteriores.
- Rodar testes, TypeScript e lint do tutor; validar o prebuild e a compilação Android em uma cópia limpa do commit.
- Exige novo APK: o APK anterior não tem os recursos de atalhos. OTA sozinha não acrescenta entradas no launcher.

## Conferir no aparelho

1. Instalar o APK e pressionar o ícone antes de abrir o app. Conferir os três rótulos e ícones.
2. Abrir cada atalho com o app fechado, já aberto e em segundo plano. Voltar deve continuar utilizável.
3. Sair da conta, tocar em Registrar peso, entrar e conferir que abre a seleção de pets da conta atual. Sem pet, conferir convite ao cadastro. Repetir trocando de conta.
4. Registrar um peso e conferir o histórico. Em Iniciar passeio, conferir que o GPS só começa após a confirmação habitual.
5. Conferir em outro launcher compatível, inclusive atalho fixado na tela inicial. A disponibilidade/ordem de atalhos é controlada pelo launcher.

Não foi validado no Android físico nesta entrega. iOS permanece pendente: configurar `UIApplicationShortcutItems` sem um handler nativo não entrega atalhos funcionais. A tarefa continua em andamento até suporte iOS e validação dos fluxos nativos.
