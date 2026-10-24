# Atalhos do ícone — Android

Tarefa: `[APP-CLIENTE] Widget: Atalhos do ícone do app: SOS, registrar peso e iniciar passeio`.

Entrega Android: ao pressionar o ícone, o launcher compatível oferece SOS, Registrar peso e Iniciar passeio. São atalhos estáticos com ícones vetoriais locais, gerados no prebuild por `plugins/atalhos-android.js`. Não dependem de abrir o app primeiro nem levam nomes/IDs de tutor ou pet para o launcher. Não adicionam permissões.

A rota pública `/acao-rapida` aceita somente três ações conhecidas. Sem sessão, pede login pela tela existente em modo Entrar e retoma a intenção após o acesso. Essa intenção contém somente o nome da ação, fica em memória por até dez minutos e é consumida uma vez. A troca de conta recria o contexto de pets, evitando reaproveitar a lista anterior.

- SOS abre a tela existente de emergência.
- Registrar peso pede o pet ativo e pertencente à conta. Não oferece pets de outro tutor ou em memória. Abre o formulário existente sem gravar nada automaticamente; sem pet, oferece cadastro. Falhas de carregamento permitem tentar novamente.
- Iniciar passeio abre a tela existente para escolher o pet e confirmar o início. Não solicita localização nem inicia GPS só por tocar no atalho.

Os cabeçalhos compartilhados retornam à rota inicial quando não existe histórico de navegação, cobrindo a abertura direta com o app fechado. Com histórico, mantêm a navegação Voltar habitual.

O plugin gera recursos no projeto Android durante o prebuild. Não editar `android/` manualmente. Não usa a biblioteca comunitária `expo-quick-actions`: a versão publicada consultada usa um script Gradle removido do SDK 58. Não foi adicionada dependência ao projeto.

## Validação

- Testes de allowlist, intenção de login com expiração/consumo único, três intents explícitos com recursos locais e reaplicação do plugin sem duplicar metadados ou remover entradas anteriores.
- 224 testes em 38 arquivos, TypeScript e lint sem avisos, tanto no workspace quanto na cópia limpa da entrega. Os cinco XMLs gerados foram lidos por um parser XML.
- Build Android SDK 58 concluído com sucesso no EAS: prebuild, recursos, compilação e assinatura do APK a partir de `adc2b9d`. A correção JavaScript de Voltar (`c983a82`) foi exportada e publicada por OTA no mesmo runtime.
- Exige novo APK: o APK anterior não tem os recursos de atalhos. OTA sozinha não acrescenta entradas no launcher.

## Conferir no aparelho

[Baixar APK dos atalhos](https://expo.dev/artifacts/eas/dY0AmdntQYN4CQjNhP5l8MzZvYyhsDufhoPIDGr4nw0.apk). [Build efb3cb3b](https://expo.dev/accounts/codaxi/projects/petlive-tutor/builds/efb3cb3b-a260-427c-b501-21dde90e5dd0), status **FINISHED** em 24/10/2026. Mesmo pacote e assinatura do preview anterior; instalar como atualização do app.

Atualização Android publicada em 24/10/2026: [OTA 62c34a06](https://expo.dev/accounts/codaxi/projects/petlive-tutor/updates/62c34a06-61cd-4e52-b38a-6df5d381dfd3), código `c983a82`, runtime `dff916ce37166d489949d7b3020e4ed90d1755dd`. Inclui o ajuste de Voltar ao início. Abrir o novo APK com internet e reabrir o app para garantir a atualização. O runtime anterior `b71630dbeb6ccaf42188e65c5351268044bbb4f9` não tem os atalhos nativos.

1. Instalar o APK e pressionar o ícone antes de abrir o app. Conferir os três rótulos e ícones.
2. Abrir cada atalho com o app fechado, já aberto e em segundo plano. Voltar deve continuar utilizável.
3. Sair da conta, tocar em Registrar peso, entrar e conferir que abre a seleção de pets da conta atual. Sem pet, conferir convite ao cadastro. Repetir trocando de conta.
4. Registrar um peso e conferir o histórico. Em Iniciar passeio, conferir que o GPS só começa após a confirmação habitual.
5. Conferir em outro launcher compatível, inclusive atalho fixado na tela inicial. A disponibilidade/ordem de atalhos é controlada pelo launcher.

Não foi validado no Android físico nesta entrega. iOS permanece pendente: configurar `UIApplicationShortcutItems` sem um handler nativo não entrega atalhos funcionais. A tarefa continua em andamento até suporte iOS e validação dos fluxos nativos.
