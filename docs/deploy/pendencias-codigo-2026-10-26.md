# Pendências tratadas no código — 26/10/2026

Escopo confirmado pelo usuário: todos os itens de desenvolvimento apresentados na conversa. Em seguida, o usuário pediu para **deixar a integração de cobrança para depois**. Compra/restauração, webhooks de pagamento e consumo comercial de cupons não foram implementados ou ativados nesta rodada.

## Entregas

| Frente | Implementação | Limite desta entrega |
|---|---|---|
| Widget Android | Consultas com credencial capturada; cache por conta com validade de 15 minutos; reconferência antes da exibição; erro de consulta de doses propagado; Feito não esconde erro; cache anterior invalidado após confirmação; atualizações serializadas e limpeza no logout/troca de conta | Confirmação exige rede. Cópia offline oferece abrir o app, sem simular dose confirmada. Homologar no launcher/aparelho |
| Exclusão de conta | Fila própria compatível com os pedidos legados; prazo de 30 dias; solicitação idempotente vinculada à conta; cancelamento antes da execução; reservas com lease de cinco minutos; renovação e retomada; limpeza de todos os buckets encontrados; conferência final do Storage; bloqueio de uploads/movimentação e de uploads assinados tardios | Nasce desligada. Não importa nem executa pedidos históricos. Não foi aplicada em produção |
| Agendamento da exclusão | Preparação de job a cada cinco minutos, criado pausado somente por função administrativa de serviço; URL hosted Supabase restrita e credencial do Vault; heartbeat do worker | Novos pedidos só ficam disponíveis com flag ativa e heartbeat nos últimos 15 minutos. Exige implantação e configuração pelo operador |
| Limites por plano | Consulta atual dos limites na lista/detalhe dos pets; aviso e identificação dos pets em leitura; botão principal e edição do detalhe desabilitados quando confirmado; complemento do bloqueio de fotos/documentos de saúde no Storage, verificando vínculo antigo e novo | Configuração comercial continua desligada. A autorização final permanece no banco; nenhum plano/preço foi ativado |
| Integrações admin | RPC com estado dos jobs e última execução, agregados da fila de push e estado do worker; Edge Function protegida pela guarda real de papel/2FA; sonda OPTIONS no gateway Expo; presença de configuração de Places/leitura de fotos sem revelar valores; UI com erro/repetição | Resposta HTTP não confirma credenciais FCM/APNs ou recebimento. As contas Play/App Store/SMTP continuam com conferência externa. Não envia notificações nem cobra |
| Reconhecimento por foto | Avaliação por espécie com amostra positiva/negativa; falhas/recusas mantidas no denominador; empates não contam como top 1; falso positivo considera “parecido” e “muito parecido”; candidatos embaralhados com semente estável; critérios explícitos obrigatórios; relatório JSON com modelo e hash do código | Nenhuma foto foi enviada ao provedor nesta entrega. Precisão real não foi medida. O script nunca ativa o recurso |
| iOS | Widget oficial Expo Widgets com SwiftUI e timeline de expiração; opção de esconder medicamento; botão abre confirmação explícita no app sem credenciais no widget; módulo local de atalhos com subscriber de AppDelegate/Scene e intenção inicial consumível; GPS em segundo plano com precisão completa e indicador; push opt-in configurável para APNs | Exige novo build assinado, App Group e credenciais. Não há compilação Swift/Xcode nem homologação de iPhone nesta máquina Windows |

## Arquivos centrais

- `apps/tutor/src/widget/`: cache, tarefas Android/iOS, apresentação e widget SwiftUI.
- `apps/tutor/app/widget-dose.tsx`: confirma explicitamente a dose, vinculada à conta e ao medicamento, descartando callbacks de outra tela.
- `apps/tutor/modules/petlive-shortcuts/`: módulo Expo local e fontes Swift próprias. A pasta `ios` deste módulo é fonte, não o projeto gerado do aplicativo; foi incluída explicitamente no Git.
- `apps/tutor/plugins/atalhos-ios.js`: os três atalhos estáticos, sem informação de conta/pet, reaplicáveis sem duplicação.
- `apps/tutor/src/premium/`: contrato, consulta e aviso de limites do servidor.
- `supabase/functions/lgpd-delete/`: worker com reservas e limpeza inventariada/retomável.
- `supabase/functions/integracoes-verificar/`: diagnóstico protegido e sonda sem payload.
- Migrations novas: `20270109000000_lgpd_worker_seguro.sql`, `20270109010000_diagnostico_integracoes.sql`, `20270109020000_limites_storage.sql`, `20270109030000_lgpd_agendamento.sql` e `20270109040000_limites_cadastro_pet.sql`.

## Implantação posterior

### Banco e funções

1. Em homologação, conferir dependências existentes: pedidos LGPD, guardas admin, limites por plano, Storage e Auth. Aplicar as cinco migrations na ordem acima. Reconciliar o schema real antes de aplicar em produção; testes em memória não substituem essa conferência.
2. Publicar `lgpd-delete` e `integracoes-verificar`. A versão nova do worker usa as RPCs de reserva; a migration revoga a execução das rotinas antigas pelo serviço para impedir contorno da fila. A flag nasce falsa, portanto nenhuma conta é excluída durante a preparação.
3. Configurar no Vault `project_url` e `service_role_key` do **mesmo projeto**. O disparador preparado aceita somente origem HTTPS hosted `*.supabase.co`, sem caminho. Para instalação self-hosted, adaptar e revisar explicitamente essa regra antes de configurar o destino.
4. Habilitar `pg_cron`/`pg_net` se necessário. Como operador/serviço, chamar `lgpd_worker_agendar()`; o job `petlive-lgpd-delete-v2` nasce pausado. Não é criado automaticamente pela instalação da migration. Desativar o job legado antes de adotar o novo.
5. Homologar duas sessões concorrentes, lease vencida, falta de rede, cancelamento antes da execução, retomada e uploads em andamento. Usar somente contas descartáveis de homologação. Conferir os objetos de todos os buckets antes e depois, inclusive perfis/eventos/avistamentos/comunidade.
6. Somente após homologação, o operador habilita o job e a flag `lgpd_worker_config.ativo`. A primeira chamada autorizada a `lgpd_exclusao_reivindicar()` registra heartbeat mesmo com fila vazia; sem heartbeat recente o app mantém novos pedidos indisponíveis. Pedidos históricos não são importados automaticamente para a fila operacional: precisam de revisão própria.
7. Limites de plano permanecem desligados. Não habilitar junto com LGPD: a compra de Premium continua adiada. O bloqueio de Storage não ativa quotas novas nem inventa limites para uploads gerais ou recursos sem regra definida.
8. Redeploy do web e QA de `/admin/integracoes` com super/leitura e 2FA; papéis restantes e sessão AAL1 devem continuar negados.

### Builds nativos

Gerar novos binários Android/iOS com o fingerprint calculado. Esta alteração adiciona Expo Widgets/Expo UI e configuração nativa; não forçar OTA no APK antigo. O módulo de atalhos foi reconhecido pelo autolinking Apple; a introspecção confirmou os três atalhos, `UIBackgroundModes=location`, App Group e descrição correta da localização.

No iOS, conferir App Group `group.app.petlive.tutor` no app e extensão. `PETLIVE_IOS_PUSH=false` é o padrão. Habilitar somente no ambiente de build com APNs configurado no EAS; a opção faz o plugin gerar o entitlement. Não adiciona chave privada ao app. Em Expo Go/binário sem Expo Widgets, a atualização iOS do widget retorna sem impedir abrir o app.

Homologar atalhos antes/depois do login, widget em tamanhos pequeno/médio, logout/troca de conta, ocultação do medicamento e expiração. O botão de dose iOS **abre o app** e exige confirmação; não grava uma dose no runtime isolado do widget. A tela identifica pet, medicamento, dose e horário. Para GPS, testar precisão reduzida/total, permissão de segundo plano, tela apagada, pausa/fim e interrupção pelo sistema; não há promessa de gravação após forçar parada.

### Avaliação por foto

Copiar `supabase/tests/criterios-reconhecimento.modelo.json` e preencher critérios aprovados pela equipe. O modelo contém `null` deliberadamente: não há limiares comerciais aprovados implicitamente. Mínimos de amostra são inteiros positivos; limites de taxa ficam entre 0 e 1.

Cada caso deve ter `achado.jpg/png/webp`, no máximo um `mesmo.*`, ao menos um candidato no total e `especie.txt` com `cao` ou `gato`. Casos negativos não têm `mesmo.*`. Usar fotos consentidas de animais diferentes e parecidos, separação entre desenvolvimento e avaliação e nomes de caso sem dados pessoais. O script envia imagens ao provedor configurado e tem custo por chamada; esta rodada executou apenas os testes sintéticos das métricas.

```text
deno run --allow-read --allow-write --allow-env --allow-net supabase/tests/achei-precisao.ts PASTA CRITERIOS.json RELATORIO.json SEMENTE
```

Falha de critério retorna código 2. Amostra vazia, espécie ausente, recusa, erro de serviço e empate não melhoram a pontuação. A semente torna a ordem dos candidatos reproduzível; não torna as respostas do provedor determinísticas. Aprovação é apenas pelos critérios fornecidos; revisão humana e decisão de lançamento continuam necessárias.

## Verificação local

### Continuação: quota de cadastro

A RPC de limites informa também `pets_ativos` e `pode_cadastrar_pet`, usando apenas pets do titular fora do memorial, como a regra de gravação existente. Não conta pets compartilhados nem inventa uma quota local. O parser mantém compatibilidade com o contrato antigo e rejeita quota parcial ou contraditória.

A lista e o formulário desabilitam o cadastro somente quando o servidor confirma a quota atingida; o banco continua sendo a autorização final, inclusive para links diretos e concorrência. A consulta usa credencial capturada, confere a conta antes/depois e trata rejeição de rede. Nenhuma flag comercial foi ativada.

Verificação atual: **397 testes em 66 arquivos**, typecheck e lint do tutor aprovados; 18 testes Node do backend, SQL isolado de limites/LGPD/admin e cinco testes de campanhas aprovados. TypeScript e ESLint do web aprovados. Ver [resumo por task](../backlog/atualizacao-manual-2026-10-26.md).

### Continuação: consistência do widget

- A janela de duas horas de atraso inclui o dia anterior, mesmo quando o tratamento terminou ontem. A consulta também considera esse intervalo, evitando perder a dose perto da meia-noite.
- Uma confirmação aceita pelo servidor permanece bem-sucedida se a remoção do cache local falhar. O processo bloqueia a leitura dessa cópia até uma nova consulta concluída; o cache persistido continua sujeito à validade de 15 minutos.
- Consultas iniciadas antes de uma confirmação são descartadas, inclusive quando a confirmação acontece durante a gravação do cache.
- Falha ao ler a preferência de privacidade esconde medicamento e dose.
- Verificação desta continuação: 391 testes em 65 arquivos aprovados. Nenhuma dependência ou API nativa alterada.

- Tutor: 387 testes em 65 arquivos aprovados; typecheck e lint aprovados (incluindo a correção do aviso de dependências da tela de confirmação).
- Backend: 18 testes Node para worker/limpeza, diagnóstico e métricas, sem chamadas reais de provedor; PGlite com os formatos legado/app da LGPD, lease/retry, cancelamento, bloqueio de uploads, cascata, cron e HTTP simulados; testes de limites/Storage e guardas reais do admin aprovados.
- Deno 2.5.6: check dos tipos de `lgpd-delete`, `integracoes-verificar` e do runner `achei-precisao.ts` aprovado; não executa os handlers ou a comparação de fotos.
- Web: tipos de rota, TypeScript, ESLint e build de produção via Webpack aprovados. Turbopack permanece com a limitação já registrada neste Windows.
- Autolinking/introspecção Apple e bundles iOS e Android/Hermes aprovados. Isso não certifica compilação Swift/Gradle, assinatura ou funcionamento no aparelho.

Os testes isolados foram adicionados ao CI com PGlite fixado em `0.3.14`. Nenhuma migration, Edge Function, build ou alteração comercial foi publicada nesta rodada. As alterações anteriores de campanhas continuam no workspace e não foram removidas.
