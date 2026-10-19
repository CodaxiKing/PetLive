# PetLive: escopo do negócio

Este documento é a fonte única do escopo do PetLive. Ele reúne a visão, o que será construído, as regras de negócio e a ordem de entrega. Detalhes de tela estão no protótipo e as tarefas estão no board.

| Recurso | Link |
| --- | --- |
| Protótipo (68 telas e páginas) | https://claude.ai/artifact/UFhxFUGwCYokbjPKCXDqKK |
| Plano de criação | https://claude.ai/code/artifact/871f3a23-4e21-4456-861f-b630c089235f |
| Board de tarefas (149 tasks) | https://github.com/users/CodaxiKing/projects/5 |

Itens entre colchetes, como `[valor]` ou `[x]%`, ainda não foram decididos.

---

## 1. Visão

**PetLive** é um aplicativo que organiza a saúde do pet e conecta o tutor a clínicas, petshops e prestadores de serviço da sua região.

Em uma frase: a carteira de saúde do pet, com lembretes e mapa, que vira um marketplace de produtos e serviços pet.

### Problema

- Tutores perdem datas de vacina, vermífugo e remédio e não têm o histórico à mão na consulta.
- Não é simples saber onde há clínica 24h, banho e tosa ou petshop por perto.
- Lojas e clínicas pequenas não têm uma forma simples de receber pedidos e agendamentos.

### Proposta de valor

- **Tutor:** saúde do pet em um só lugar, lembretes que avisam, serviços e produtos a poucos toques.
- **Lojista:** vitrine, agenda e recebimento sem montar sistema próprio.
- **Diferencial:** o app sabe o que o pet precisa. Vacina vencendo leva à clínica, ração acabando leva ao petshop.

### Escopo geográfico e idioma

- Lançamento no **Rio de Janeiro**.
- Português do Brasil.
- Cães e gatos no MVP. Outras espécies ficam para depois.

---

## 2. Públicos

| Público | Quem é | O que precisa |
| --- | --- | --- |
| Tutor | Dono de cão ou gato | Carteira de saúde, lembretes, mapa, reservas e pedidos |
| Lojista | Petshop, clínica veterinária, banho e tosa, creche, hotel, passeador | Vitrine, agenda, solicitações, recebimentos |
| Quem acha um pet | Qualquer pessoa que escaneia o QR da coleira | Contato rápido com o tutor, sem instalar o app |

---

## 3. Produtos

| Produto | Plataforma | Quem usa |
| --- | --- | --- |
| App do tutor | React Native com Expo (celular) | Tutor |
| App do lojista | Celular (PWA ou nativo, a decidir) | Lojista e passeador |
| Painel do lojista | Web, no computador | Lojista |
| Site do PetLive | Web | Tutores e lojistas novos |
| Página pública do QR | Web | Quem encontra um pet |
| Backend | Supabase | Todos |

---

## 4. Funcionalidades por módulo

### 4.1 App do tutor

**Conta e perfil**
- Boas-vindas, criar conta e entrar (e-mail e Google), aceite de termos e LGPD.
- Perfil do tutor, excluir conta e exportar dados.

**Pets**
- Cadastro com foto, espécie, raça e nascimento. Lista Meus pets e tela do pet.
- Vários pets (limite no plano grátis).

**Saúde**
- Registrar vacinas com data aplicada e próxima dose, com calendário sugerido por espécie e idade.
- Peso com gráfico, consultas e anexos (foto do cartão e exames, no Premium).

**Lembretes e remédios**
- Lembretes de vacina, vermífugo, consulta, banho e tosa e outros personalizados.
- Remédios com dose, frequência, horários e duração, com confirmação a cada dose.
- Notificações push e tela de Avisos (por tipo, horário e Não perturbe).

**Mapa**
- Clínicas, petshops, banho e tosa e veterinários 24h por perto, com filtros, ficha do lugar, ligar, WhatsApp e rota.
- Atalho: vacina vencendo leva às clínicas próximas.

**Compartilhar e segurança (Premium)**
- Carteira em PDF para o veterinário, QR Code da coleira, acesso compartilhado com a família.

**Loja e serviços (marketplace)**
- Vitrine de produtos, detalhe do produto, solicitação e acompanhamento do pedido.
- Produtos com receita: aparecem só para consulta, sem solicitação nem pagamento no app.
- Serviços: banho e tosa, passeio, creche e hotelzinho, cada um com a sua reserva (seção 6).
- Pagamento por Pix no app ou pagar na loja.
- Passeio ao vivo: trajeto, fotos e resumo com avaliação.

### 4.2 App do lojista (celular)

- Cadastro da loja em 5 passos: dados, endereço e contato, o que oferece, serviços, publicar.
- Painel com indicadores, solicitações e agenda de hoje.
- Solicitações: aceitar, recusar, responder, marcar pronto e concluir.
- Catálogo e cadastro de produto (foto, código de barras, preço, estoque, tipo de venda).
- Configuração de cada serviço, horários de atendimento, folgas e confirmação automática ou manual.
- Agenda do dia e da semana.
- Visão do passeador: iniciar e encerrar passeio, GPS, fotos e registros.
- Configurações da loja.

### 4.3 Painel do lojista (computador)

- Solicitações com lista e detalhe, aceite e resposta.
- Catálogo em tabela, cadastro e edição de produto, importação por planilha.
- Aba de serviços, agenda semanal, recebimentos e configurações.

### 4.4 Site e página pública

- Site para tutores e página para lojistas.
- Página pública do QR: nome do pet, contato do tutor e envio de localização, só com o que o tutor permitiu.

---

## 5. Regras de negócio

### 5.1 O que a loja oferece

A loja escolhe **produtos**, **serviços** ou **os dois**. Isso define o que aparece na vitrine e na agenda.

### 5.2 Produtos

- Tipos de venda por produto:
  - **Pelo app:** o tutor solicita e paga por Pix ou na loja.
  - **Só no local, com receita:** aparece com preço e estoque, mas não pode ser solicitado nem pago pelo app. A loja define a mensagem ao tutor e se pede a receita na retirada.
  - **Oculto:** só para controle da loja.
- Medicamentos veterinários seguem regras próprias de venda. No início, a vitrine começa por ração, acessórios e serviços.

### 5.3 Solicitações

- Fluxo de status: enviada, confirmada, pronta, concluída, recusada ou cancelada.
- A loja tem um prazo de resposta configurável. Sem resposta, o tutor é avisado.
- Retirada na loja ou entrega feita pela própria loja.

### 5.4 Pagamentos

| Etapa | Pagamento |
| --- | --- |
| Etapa 1 | Na loja, fora do app |
| Etapa 2 | Pix pelo app com confirmação automática, repasse à loja e comissão `[x]%` |
| Etapa 3 | Entrega integrada e assinatura recorrente de ração |

A comissão incide só sobre pagamentos feitos pelo app. Vitrine e agenda são gratuitas.

### 5.5 Cancelamento e confirmação

- Cancelamento grátis até um prazo definido pela loja (exemplo: 2 horas antes).
- A loja escolhe entre confirmação automática e manual dos agendamentos.

### 5.6 QR da coleira

- O tutor escolhe o que aparece ao escanear: nome e foto, telefone e alergias.
- Quem acha o pet pode enviar a localização, só se tocar no botão.

### 5.7 Aviso de saúde

O PetLive organiza informações e não substitui o atendimento veterinário. Esse aviso aparece no app e no site.

---

## 6. Modelos de reserva por serviço

Cada serviço usa uma forma de reserva, configurada pela loja.

| Serviço | Modelo | A loja configura | O tutor escolhe |
| --- | --- | --- | --- |
| Banho e tosa, consulta, vacinação | Por horário | Duração, vagas por horário, profissionais, intervalo | Dia e horário livre |
| Passeador | Passeio | Preço de 30 e 60 min, raio, pets por passeio, dias e janela, trajeto e fotos | Duração, dia, horário e endereço |
| Creche pet | Por dia | Dia inteiro e meio período, entrada e retirada, vagas por dia, pacotes mensais | Dias, período e pacote |
| Hotelzinho pet | Diárias | Preço por porte, vagas por dia, check-in e check-out, extras, vacinas em dia | Entrada, saída e extras |

**Horários livres** são calculados no servidor: horários da loja, menos folgas, menos reservas já feitas até o limite de vagas, respeitando a duração e o intervalo do serviço.

---

## 7. Dados (modelo inicial)

**Tutor e pets:** `profiles`, `pets`, `vaccinations`, `dewormings`, `weights`, `visits`, `medications`, `reminders`, `push_tokens`.

**Mapa:** `places` (importado do OpenStreetMap para o Rio de Janeiro).

**Marketplace:**
- `stores`, `store_members`, `products`, `services`
- `store_hours`, `time_off`
- `requests`, `request_items`, `request_events`
- `payments` (etapa 2)
- Por modelo de serviço: `lodging_rates`, `daycare_plans`, `walk_rules`

Campos de destaque:
- `stores.oferece`: produtos, serviços ou ambos.
- `services.modelo`: por horário, passeio, por dia ou diárias.
- `products.venda`: `app`, `local_com_receita` ou `oculto`. Produtos `local_com_receita` não aceitam `requests` nem `payments`.
- `requests`: `starts_at`, `ends_at` e, nas diárias, `checkin` e `checkout`.

Acesso protegido por regras de linha (RLS) no Supabase: cada tutor só vê os dados dos seus pets.

---

## 8. Stack

| Camada | Tecnologia |
| --- | --- |
| App do tutor | React Native, Expo, TypeScript, Expo Router |
| Mapa | MapLibre com tiles gratuitos (OpenFreeMap ou Protomaps) |
| Dados de lugares | OpenStreetMap via Overpass, com cadastro colaborativo; Google Places só como complemento pago |
| Backend | Supabase: Auth, Postgres, Storage, Edge Functions e cron |
| Notificações | expo-notifications (FCM e APNs) |
| Build e deploy | EAS Build e EAS Update |
| Erros | Sentry |
| Pagamentos (etapa 2) | Provedor de Pix `[a definir]`, com repasse |
| Painel e site | Web em React `[framework a definir]` |

---

## 9. Roadmap

| Fase | Entrega | Prioridade no board |
| --- | --- | --- |
| 0 | Descoberta: wireframes, stack, cidade | Concluída |
| 1 | **MVP**: conta, pets, saúde, lembretes, remédios, mapa, Início | P0 e P1 |
| 2 | Beta e Premium: carteira em PDF, QR da coleira, anexos, família | P2 |
| 3 | Rede social: perfil público, posts, feed (depois de validar a retenção) | Fora do board por enquanto |
| 4 | Social e mapa: check-ins, avaliações, selo de vacina, pets perdidos | Fora do board por enquanto |
| 5 | **Marketplace**: etapa 1 (vitrine, solicitação, agenda), etapa 2 (Pix, passeio ao vivo), etapa 3 (entrega, assinatura) | P2 e P3 |

**Gate:** a rede social só começa depois que o beta provar retenção.

### Prioridades (campo Priority do board)

| Prioridade | Significado |
| --- | --- |
| P0 | Máxima: caminho crítico do MVP |
| P1 | Resto do MVP |
| P2 | Premium, marketplace etapa 1, app e painel do lojista |
| P3 | Marketplace etapas 2 e 3 |

---

## 10. Monetização

- **Grátis:** 1 pet, lembretes básicos, mapa, solicitações e reservas.
- **Premium (tutor):** vários pets, PDF para o veterinário, anexos, acesso para a família, QR da coleira. Preço `[valor]`.
- **Lojista:** vitrine e agenda gratuitas. Comissão `[x]%` sobre pagamentos pelo app.
- **Depois:** destaque no mapa, cupons e afiliados (ração, antipulgas).

---

## 11. Riscos e como tratar

| Risco | Mitigação |
| --- | --- |
| Baixa retenção (app de lembrete é usado em picos) | Notificações úteis, mapa e serviços como motivo extra, rede social depois |
| Poucas lojas no começo | Convidar 3 a 5 lojas e clínicas do Rio direto; solicitação também por WhatsApp |
| Loja não responde e o tutor desiste | Prazo de resposta visível e sugestão de outra loja |
| Dados do mapa incompletos | Começar pelo Rio, aceitar cadastro e correção de lugares, assumir perfil pelo dono |
| LGPD (dados do tutor, localização, fotos de exames) | Consentimento explícito, exclusão e exportação de dados, RLS no banco |
| Responsabilidade médica | Aviso fixo de que o app não substitui o veterinário |
| Produtos regulados | Não listar medicamentos controlados no início; produtos com receita só para consulta |
| Pagamento, repasse e nota fiscal | Provedor com Pix e repasse; definir o responsável fiscal antes da etapa 2 |
| Suporte e disputas | Histórico de status, conversa com a loja e política de cancelamento |
| Escopo crescer demais | Entregar por fases e validar antes de avançar |

---

## 12. LGPD e privacidade

- Aceite de termos e consentimento no cadastro.
- Localização só com permissão e, no QR, só se a pessoa tocar no botão.
- O tutor controla o que aparece na página pública do QR.
- Exclusão de conta e exportação de dados.
- Fotos de exames e dados de saúde com acesso restrito ao tutor e a quem ele compartilhar.

---

## 13. Fora do escopo por enquanto

- Outras espécies além de cães e gatos.
- Telemedicina e triagem por IA.
- Venda de medicamentos veterinários controlados pelo app.
- Entrega integrada com logística própria (só na etapa 3).
- App nativo do lojista (começa como PWA ou celular simples; a decidir).
- Telas de Equipe e Avisos da loja (ainda sem desenho).

---

## 14. Métricas de sucesso

- Retenção do tutor no beta (gate da rede social).
- Tutores ativos por semana e lembretes confirmados.
- Lojas ativas e tempo médio de resposta a solicitações.
- Reservas e solicitações por loja.
- Participação do Pix no total de pedidos (etapa 2).

---

## 15. Decisões em aberto

- Nome do domínio e endereço da página pública do QR.
- Provedor de Pix e percentual de comissão `[x]%`.
- Preço do Premium `[valor]`.
- App do lojista como PWA ou nativo.
- Framework web do painel e do site.
- Quem é o responsável fiscal nas vendas pelo app.

---

## 16. Glossário

| Termo | Significado |
| --- | --- |
| Tutor | Dono do pet, usuário do app |
| Lojista | Loja, clínica ou prestador que vende ou atende pelo PetLive |
| Solicitação | Pedido de produto ou reserva de serviço feito pelo tutor |
| Venda com receita | Produto listado só para consulta, com compra apenas na loja |
| RLS | Regras de acesso por linha no banco de dados |
| E1, E2, E3 | Etapas 1, 2 e 3 do marketplace |
