# PetLive

A carteira de saúde do seu pet, com lembretes e mapa, que também conecta tutores a clínicas, petshops e prestadores de serviço pet.

> **Status:** em planejamento. O protótipo e o plano estão prontos, e ainda não há código. O escopo e os fluxos completos está em [BUSINESS.md](BUSINESS.md).

## O que é o PetLive

- **Para o tutor (Fases 1 e 2):** vacinas, vermífugo, peso e consultas em um só lugar, lembretes de remédios e um mapa de clínicas, petshops, creches e hotelzinhos por perto, com telefone, fotos e rota (dados do Google Maps).
- **Para o lojista (Fase 3, parte separada e futura):** vitrine de produtos, agenda de serviços, entrega, solicitações e recebimento por Pix.
- **Lançamento:** Rio de Janeiro, para cães e gatos.

## Produtos do projeto

| Produto | Tecnologia | Quem usa |
| --- | --- | --- |
| App do tutor | React Native com Expo | Tutor |
| App do lojista (celular) | PWA ou nativo, a decidir | Lojista e passeador |
| Painel do lojista (computador) | Web | Lojista |
| Site e página pública do QR | Web | Tutores, lojistas e quem acha um pet |
| Backend | Supabase | Todos |

## Documentação

| Documento | Para quê |
| --- | --- |
| [BUSINESS.md](BUSINESS.md) | Escopo, regras, papéis, mapa de telas e rotas, fluxos, estados, dados, notificações, backend e ordem de construção |
| [Protótipo](https://claude.ai/artifact/UFhxFUGwCYokbjPKCXDqKK) | 134 telas e páginas navegáveis: app do tutor, app e painel do lojista, painel admin, site |
| [prototipo/](prototipo/README.md) | Código-fonte das telas do protótipo, como referência de layout |
| [docs/backlog/](docs/backlog) | As 149 tasks em arquivo, e o script que cria os itens no GitHub Project |
| [Plano de criação](https://claude.ai/code/artifact/871f3a23-4e21-4456-861f-b630c089235f) | Arquitetura, modelo de dados, roadmap e backlog |
| [Board de tarefas](https://github.com/users/CodaxiKing/projects/5) | 194 tasks com tag, módulo e prioridade |

## Tags e prioridades das tarefas

Cada tarefa do board tem uma tag no título e um valor no campo **Priority**.

| Tag | Cobre |
| --- | --- |
| `[APP-CLIENTE]` | App do tutor |
| `[APP-LOJISTA]` | App do lojista no celular |
| `[WEB]` | Site, página pública do QR e painel do lojista no computador |
| `[BACKEND]` | Supabase, regras de acesso, funções, pagamentos e integrações |

| Prioridade | Significado |
| --- | --- |
| P0 | Máxima: caminho crítico do MVP |
| P1 | Resto do MVP |
| P2 | Premium, marketplace etapa 1, app e painel do lojista |
| P3 | Marketplace etapas 2 e 3 |

## Stack

- **App:** React Native, Expo, TypeScript, Expo Router
- **Mapa e lugares:** Google Maps e Places API
- **Backend:** Supabase (Auth, Postgres, Storage, Edge Functions)
- **Notificações:** expo-notifications
- **Build:** EAS Build e EAS Update
- **Erros:** Sentry

Os detalhes e as decisões ainda em aberto estão em [BUSINESS.md](BUSINESS.md#8-stack).

## Estrutura do repositório

```text
PetLive/
  apps/
    tutor/        App do tutor (Expo)
    lojista/      App do lojista no celular
    web/          Site, página pública do QR e painel do lojista
  supabase/       Migrações, regras de acesso e funções
  docs/backlog/   Tasks em arquivo e script de importação
  prototipo/      Código-fonte das telas do protótipo
  BUSINESS.md     Escopo do negócio
```

Cada pasta de `apps/` e `supabase/` tem um README com o que ela cobre. Ainda não há código.

## Como começar

Ainda não há código para rodar. Os primeiros passos do desenvolvimento, em ordem:

1. Criar o repositório e o projeto Expo com autenticação.
2. Criar o projeto Supabase e o schema inicial (tarefas `[BACKEND] Base`).
3. Implementar a Fase 1: saúde do pet, lembretes e lugares por perto com o Google (prioridades P0 e P1 no board). Criar antes o projeto no Google Cloud, com chave restrita e orçamento com alerta.

Quando o código existir, esta seção ganhará os comandos de instalação, variáveis de ambiente e como rodar cada app.

## Roadmap resumido

| Fase | Entrega | Situação |
| --- | --- | --- |
| **1** | **MVP: conta, pets, saúde, lembretes, remédios, rotina, lugares pet por perto (Google), SOS com primeiros socorros sem internet, calculadoras e botão Dei na notificação** | **Agora** |
| 2 | Premium, ler cartão de vacina por foto, adoção, cuidador temporário, linha do tempo, checklist de viagem, selos, passeios com GPS, despesas, fogos e trovão, widget, cartão do pet, eventos pet no mapa, QR da coleira, site e painel admin básico | Depois |
| 3 | Marketplace: lojas, pedidos, serviços, entrega, pagamentos e painéis do lojista | Futuro, parte separada |
| 4 | Rede social: comunidade e perfil público do pet | Futuro |
| 5 | Pet perdido com alerta por perto e plano e seguro pet com parceiros | Futuro |

## Aviso

O PetLive organiza informações de saúde e não substitui o atendimento veterinário.

## Licença

Todos os direitos reservados. Veja [LICENSE](LICENSE).
