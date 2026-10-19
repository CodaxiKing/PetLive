# PetLive

A carteira de saúde do seu pet, com lembretes e mapa, que também conecta tutores a clínicas, petshops e prestadores de serviço pet.

> **Status:** em planejamento. O protótipo e o plano estão prontos, e ainda não há código. O escopo completo está em [BUSINESS.md](BUSINESS.md).

## O que é o PetLive

- **Para o tutor:** vacinas, vermífugo, peso e consultas em um só lugar, com lembretes de remédios, mapa de clínicas e lojas por perto, e reserva de banho e tosa, passeio, creche e hotelzinho.
- **Para o lojista:** vitrine de produtos, agenda de serviços, solicitações e recebimento por Pix.
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
| [BUSINESS.md](BUSINESS.md) | Escopo do negócio, regras, fases e riscos |
| [Protótipo](https://claude.ai/artifact/UFhxFUGwCYokbjPKCXDqKK) | 68 telas e páginas navegáveis: app do tutor, app e painel do lojista, site |
| [prototipo/](prototipo/README.md) | Código-fonte das telas do protótipo, como referência de layout |
| [docs/backlog/](docs/backlog) | As 149 tasks em arquivo, e o script que cria os itens no GitHub Project |
| [Plano de criação](https://claude.ai/code/artifact/871f3a23-4e21-4456-861f-b630c089235f) | Arquitetura, modelo de dados, roadmap e backlog |
| [Board de tarefas](https://github.com/users/CodaxiKing/projects/5) | 149 tasks com tag, módulo e prioridade |

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
- **Mapa:** MapLibre com dados do OpenStreetMap
- **Backend:** Supabase (Auth, Postgres, Storage, Edge Functions)
- **Notificações:** expo-notifications
- **Build:** EAS Build e EAS Update
- **Erros:** Sentry

Os detalhes e as decisões ainda em aberto estão em [BUSINESS.md](BUSINESS.md#8-stack).

## Estrutura prevista do repositório

A estrutura abaixo é uma proposta e deve ser ajustada quando o código começar.

```text
petlive/
  apps/
    tutor/        App do tutor (Expo)
    lojista/      App do lojista no celular
    web/          Site e painel do lojista
  supabase/       Migrações, regras de acesso e funções
  docs/           Documentação e decisões
  BUSINESS.md
  README.md
```

## Como começar

Ainda não há código para rodar. Os primeiros passos do desenvolvimento, em ordem:

1. Criar o repositório e o projeto Expo com autenticação.
2. Criar o projeto Supabase e o schema inicial (tarefas `[BACKEND] Base`).
3. Implementar o MVP de saúde e mapa (prioridades P0 e P1 no board).

Quando o código existir, esta seção ganhará os comandos de instalação, variáveis de ambiente e como rodar cada app.

## Roadmap resumido

| Fase | Entrega |
| --- | --- |
| 1 | MVP: conta, pets, saúde, lembretes, remédios, mapa |
| 2 | Premium: carteira em PDF, QR da coleira, anexos, família |
| 3 e 4 | Rede social e check-ins (depois de validar a retenção) |
| 5 | Marketplace: vitrine e agenda, depois Pix, passeio ao vivo e entrega |

## Aviso

O PetLive organiza informações de saúde e não substitui o atendimento veterinário.

## Licença

A definir.
