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
eas build -p android --profile production   # .aab para o Play
eas build -p ios --profile production       # .ipa para a App Store
eas submit -p android --latest               # pede a chave da conta de serviço do Play
eas submit -p ios --latest                   # pede o login Apple / App Store Connect
eas update --channel production -m "..."     # correções só de JS, sem nova revisão das lojas
```

- `runtimeVersion` segue a versão nativa: mudou módulo nativo (ex.: react-native-maps),
  precisa de build novo; o resto vai por `eas update`.
- O primeiro envio ao Play é manual (faixa **Teste interno**); depois o `eas submit` assume.
- Comece pela faixa de **teste fechado** do Play (exigência para contas novas: 12 testadores por 14 dias).

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
- "Entrar com Google" no iPhone exige também "Entrar com Apple" (diretriz 4.8) —
  ou o botão do Google sai do build de iOS na primeira versão.
