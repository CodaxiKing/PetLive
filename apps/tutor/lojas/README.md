# Publicar o PetLive nas lojas (Fase 1)

Roteiro do item do board **"Publicar nas lojas de apps (EAS Build e EAS Update)"**
e os textos que as lojas pedem. O que depende de conta ou de dinheiro está marcado
com **[você]**.

## 1. Antes do primeiro build de produção

| Passo | Onde | Quem |
| --- | --- | --- |
| Projeto Supabase de **produção** (migrations + seeds de conteúdo, sem `tutor-demo.sql`) | supabase.com | **[você]** cria; `npx supabase db push` aplica |
| Segredos das funções: `GOOGLE_PLACES_KEY` | `npx supabase secrets set` | **[você]** (chave do Google Cloud) |
| Provedor Google no Auth (cliente OAuth "Web") e URLs `petlive://**` na lista de redirecionamento | painel do Supabase › Auth | **[você]** |
| Variáveis do build no EAS (ambiente `production`) | `eas env:create` | **[você]**, valores abaixo |
| Conta Google Play Console (US$ 25, uma vez) | play.google.com/console | **[você]** |
| Conta Apple Developer (US$ 99/ano) | developer.apple.com | **[você]** |

Variáveis do EAS (`production`):

| Variável | Valor |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | do projeto de produção |
| `EXPO_PUBLIC_LUGARES_FONTE` | `google` só junto com as chaves abaixo; senão deixe sem (OpenStreetMap) |
| `GOOGLE_MAPS_ANDROID_KEY` / `GOOGLE_MAPS_IOS_KEY` | Maps SDK, restritas a `app.petlive.tutor` (segredo) |
| `EXPO_PUBLIC_SENTRY_DSN` | DSN do projeto no Sentry |

## 2. Build, envio e atualizações

```bash
cd apps/tutor
eas build --platform ios --profile production     # .ipa para a App Store
eas build --platform android --profile production # .aab para o Google Play
eas submit --platform ios --latest                # envia o .ipa para o App Store Connect
eas submit --platform android --latest            # envia o .aab para o Google Play Console
```

- **Assinatura:** os builds de produção são assinados com o certificado de distribuição do Apple Developer (iOS) e com a chave de upload do Google Play Console (Android), configurados e gerenciados pelo EAS na primeira build (automaticamente ou com `eas credentials`). As credenciais ficam guardadas nos servidores do EAS; **nada de certificado, chave privada ou provisioning profile é commitado no repositório** (`.p12`, `.p8`, `.mobileprovision`, `.jks`, `.pem` já estão no `.gitignore`).
- **Variáveis de ambiente do build** (ambiente `production`): crie com `eas env:create` usando os valores da tabela da seção 1 (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, etc.). Chaves secretas (ex.: `GOOGLE_MAPS_ANDROID_KEY`, `GOOGLE_MAPS_IOS_KEY`) vão como segredos do EAS, lidas pelo `app.config.js` no build — nunca no repositório.
- O primeiro envio ao Play é manual (faixa **Teste interno**); depois o `eas submit` assume. Comece pela faixa de **teste fechado** do Play (exigência para contas novas: 12 testadores por 14 dias).

## 3. EAS Update: atualizações OTA e rollback

**Configuração:** `expo-updates` está instalado, `runtimeVersion` segue a política `appVersion` (a `version` do `app.json`) e o canal de produção é o branch `production` do projeto EAS (`updates.url` em `app.json`). O app busca e aplica a atualização na inicialização (`src/lib/atualizacao.ts`), sem necessidade de nova aprovação nas lojas para mudanças cobertas pelo expo-updates (JS, assets e fontes). Mudanças em módulos nativos exigem build novo nas lojas.

Publicar uma correção OTA (entregue apenas a builds com `runtimeVersion` compatível):

```bash
cd apps/tutor
eas update --branch production -m "Correção: lembretes de vacina"
```

**Rollback da atualização OTA:**

- **Expo Dashboard:** abra o projeto > Updates > selecione a atualização problemática do branch `production` > "Roll back". O branch volta para a atualização anterior imediatamente.
- **CLI:**

```bash
eas update:rollback --branch production   # veja `eas update:rollback --help`
```

Builds já instalados continuam na versão anterior até receberem a próxima atualização compatível.

## 3. Ficha da loja

**Nome:** PetLive: saúde do pet
**Subtítulo (App Store, 30):** Vacinas, remédios e SOS do pet
**Descrição curta (Play, 80):** Vacinas, remédios e lembretes do seu pet, clínicas 24 h e SOS sem internet.
**Categoria:** Estilo de vida (Play) · Estilo de vida (App Store)
**Palavras-chave (App Store, 100):** pet,cachorro,gato,vacina,veterinário,remédio,lembrete,clínica 24h,carteira de vacinação,saúde

**Descrição completa:**

> A carteira de saúde do seu pet, no celular.
>
> O PetLive guarda vacinas, vermífugos, remédios, peso e consultas do seu cão ou gato e
> avisa na hora certa. Na notificação da dose, toque em "Dei" e pronto.
>
> • Carteira de vacinação com a próxima dose sugerida e aviso de vacina vencendo
> • Remédios com horários, dias de tratamento e confirmação da dose
> • Lembretes de banho, antipulgas, vermífugo, consulta e aniversário
> • Peso com gráfico e histórico de consultas
> • Mapa de clínicas, petshops, banho e tosa e lugares pet friendly perto de você
> • SOS: a clínica 24 h mais perto, primeiros socorros e o que intoxica o pet, mesmo sem internet
> • Calculadoras de idade, ração e água
> • Carteirinha do pet para mostrar ou enviar ao veterinário
>
> Seus dados são seus: exporte ou apague a conta quando quiser, direto no app.
>
> O PetLive não substitui o atendimento veterinário. Em emergência, procure uma clínica.

**Capturas (1080 × 2400, nesta ordem):** Início · Tela do pet (vacinas) · Lembretes ·
Medicamentos · Mapa · SOS · Carteirinha · Pet friendly.

## 4. Segurança dos dados (Play) e Privacidade do app (Apple)

Respostas conforme o que o app faz hoje (conferir se algo mudar):

| Dado | Coletado | Para quê | Obrigatório | Compartilhado |
| --- | --- | --- | --- | --- |
| Nome e e-mail | Sim | Conta | Sim | Não |
| ID do usuário | Sim | Conta | Sim | Não |
| Fotos (do pet) | Sim | Funcionalidade | Não | Não |
| Localização aproximada e precisa | Sim, só na hora da busca (não fica guardada) | Mapa e SOS | Não | Não* |
| Dados dos pets (vacinas, remédios, peso, consultas) | Sim — declarar em "Outras informações do app" (não é saúde de pessoa) | Funcionalidade | Não | Não |
| Falhas e diagnóstico (Sentry, sem dados pessoais) | Sim | Análise de falhas | Não | Não |
| Anúncios, contatos, SMS, histórico de navegação | Não | — | — | — |

\* A posição vai ao Google só para buscar lugares, como prestador de serviço — no Play isso não conta como compartilhamento.

- **Criptografia em trânsito:** sim (HTTPS).
- **Exclusão da conta:** sim, no app (Perfil › Privacidade e dados) e pela web em
  `https://petlive.app.br/lgpd` (o Play exige o link da web).
- **Apple:** nenhum dado é usado para rastreamento (sem ATT); "Dados vinculados a você":
  contato, ID do usuário, fotos, conteúdo do usuário; "Não vinculados": diagnóstico.

## 5. Classificação e permissões

- **Classificação indicativa:** livre (sem violência, compras, chat ou conteúdo gerado
  público na Fase 1). Questionário IARC no Play; 4+ na App Store.
- **Permissões e por quê:**
  - Localização (só em uso): clínicas e lugares por perto e a clínica 24 h do SOS.
  - Notificações: lembretes de vacina, remédio e rotina.
  - Câmera e fotos: só quando o tutor escolhe a foto do pet.
- **Consultas de pacotes (Android):** Google Maps e Waze, para a folha "Traçar rota com"
  (justificativa no formulário de permissões do Play, se pedirem).

## 6. Revisão — pontos que costumam reprovar

- Conta de teste para o revisor (Apple pede): crie uma conta com um pet e lembretes e
  informe e-mail e senha em "Informações para revisão".
- O conteúdo de emergência precisa da **revisão veterinária** antes do lançamento
  (itens do board de SOS e Qualidade).
- "Entrar com Apple" já está no app (diretriz 4.8, exigida por causa do login
  do Google): falta só ligar o provedor no Supabase e a capacidade no Apple
  Developer (supabase/README.md › Entrar com Apple).
