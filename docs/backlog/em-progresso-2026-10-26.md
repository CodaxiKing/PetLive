# O que falta nos itens em progresso — 26/10/2026

> Auditoria histórica, anterior à implementação desta rodada. As lacunas de código do widget, iOS, exclusão, diagnóstico e limites descritas abaixo receberam alterações posteriores. Consulte a [atualização para o board](atualizacao-manual-2026-10-26.md) e o [registro de entrega](../deploy/pendencias-codigo-2026-10-26.md) para o estado mais recente. Este documento preserva o diagnóstico original; não deve ser usado sozinho para atualizar status.

Board consultado pelo navegador: [PetLive, Project 5](https://github.com/users/CodaxiKing/projects/5). Filtro `status:"In Progress"`: **52 itens**, sendo **32 APP-CLIENTE, 13 BACKEND e 7 WEB**. Base de código: `4a9cba0`, com alterações locais de campanhas ainda sem commit.

Esta é uma conferência do código e dos registros versionados de entrega. Não foi feita nova consulta ao banco remoto, aos consoles de provedores ou a um aparelho. “Implantado conforme registro” significa que há evidência histórica no repositório; não certifica o estado remoto de hoje. Não alterei o board, não publiquei builds e não executei operações de produção.

Verificação atual: **369 testes do tutor passaram em 61 arquivos**. Os testes não comprovam funcionamento de câmera, GPS, push, captura PNG ou interfaces publicadas.

## Bloqueios prioritários

1. **Privacidade/exclusão:** o SQL de compatibilidade retorna `pode_solicitar=false`. Homologar/reconciliar o worker, fila, bloqueio de uploads durante exclusão e agendamento antes de liberar o pedido no app.
2. **Cobrança Premium:** compra/restauração e gestão de assinatura ainda não existem no fluxo operacional. Isso bloqueia também ativação de limites, aplicação de cupons e destaques pagos.
3. **Push:** falta confirmar Firebase/FCM v1, build configurado e entrega real Android; iOS/APNs tem integração pendente. A presença de fila/job não comprova recebimento.
4. **Widget:** além do build e QA, existem pendências de código de isolamento de cache e tratamento de falhas; não classificar como “só falta testar”.
5. **Entrega/homologação:** várias migrations têm aplicação documentada e várias telas já foram publicadas em preview, mas faltam verificações finais. As últimas mudanças nativas exigem APK compatível; a main não equivale ao APK instalado.

## App tutor — 32 itens

Os nomes abaixo correspondem aos títulos do board, abreviados apenas para leitura.

| # | Item | O que falta para encerrar |
|---|---|---|
| A01 | Base e conta: Excluir conta e exportar meus dados | Exportação tem implementação e implantação registradas. Exclusão continua desabilitada: reconciliar e homologar worker/estados/Storage/cron, depois testar solicitação, cancelamento, prazo e conclusão com conta de homologação. Ver [privacidade](../deploy/privacidade-compatibilidade-2026-10-25.md). |
| A02 | Pets: Cadastro do pet com foto | Reparo de RLS/cadastro já tem aplicação registrada. Confirmar no aparelho cadastro sem/com foto, falha/retry, persistência e isolamento. Ver [cadastro e mapa](../../apps/tutor/lojas/correcao-mapa-cadastro.md). |
| A03 | Notificações locais e push com permissão | Configurar/confirmar Firebase, arquivo do build e credencial FCM v1; novo APK; testar permissão, recebimento/toque com app fechado, dose, Não perturbe, logout e troca de conta. Completar APNs/iOS. Ver [push](../deploy/push-fichas-2026-10-25.md). |
| A04 | Premium: tela e assinatura pela loja | Produtos/preços nas lojas, SDK/fluxo de compra e restauração, validação no backend, webhooks e cenários de renovação/falha/cancelamento. `app/premium.tsx` ainda informa indisponibilidade. |
| A05 | QR da coleira: gerar, permissões e baixar etiqueta | Nova etiqueta está no commit local `4a9cba0`, ainda sem publicação nesta conversa. Homologar geração autenticada, alterações/desativação, PNG/compartilhamento, nomes longos e leitura por outro aparelho/etiqueta impressa. A imagem enviada pelo usuário evidencia um QR anterior, mas não certifica a versão nova nem todas as permissões. |
| A06 | Publicar nas lojas de apps | Builds de produção compatíveis, submissão/aprovação e evidência de publicação Android/iOS; revisão dos formulários de privacidade/permissões e conteúdo da loja conforme os recursos atuais. Preview/OTA não encerram esta task. O [roteiro de lojas](../../apps/tutor/lojas/README.md) contém descrições antigas que precisam ser reconciliadas com GPS em segundo plano e recursos atuais. |
| A07 | Mapa do Google com localização | Decidir se o Google será usado: o padrão documentado é OSM. Se Google: chaves/SDK/fonte e teste real. Em qualquer fonte, validar GPS, região, retomada e offline no aparelho. Ver [mapa](../deploy/mapa-resultados-2026-10-25.md). |
| A08 | Mapa: busca e filtros/24 h | Validar no aparelho troca rápida de filtros/região, busca, favoritos no retorno e resultados progressivos; conferir descoberta externa real. Não confundir cobertura da fonte com falha do filtro. |
| A09 | Eventos próximos com raio escolhido em Avisos | Confirmar implantação da migration/job regional e testar região/raio/expiração, preferências, deduplicação, caixa e push. Não encontrei confirmação posterior de implantação neste conjunto de registros. Ver [roteiro](../../apps/tutor/lojas/validacao-eventos-proximos.md). |
| A10 | Cartão por foto: captura com guia | Homologar câmera no APK compatível: negar/retornar das permissões, orientação, nitidez, lanterna, refazer, salvar e troca de conta. Captura não depende de concluir OCR. O serviço OCR já existe agora no código, ao contrário do que dizem registros antigos; sua implantação/credencial e validação são uma etapa separada. Ver [captura](../../apps/tutor/lojas/validacao-foto-cartao.md). |
| A11 | Adoção: lista, filtros e favoritos | Validar catálogo no aparelho com ONG aprovada, filtros/paginação, favoritos, rede indisponível e retirada de anúncio adotado/suspenso. Há implantação registrada; falta confirmação funcional. Ver [catálogo](../../apps/tutor/lojas/validacao-catalogo-adocao.md). |
| A12 | Adoção: ficha e Tenho interesse | Testar fotos, indisponibilidade, consentimento, recibo/retry, ausência de duplicidade e visibilidade restrita à ONG; Android/iOS. Ver [interesse](../../apps/tutor/lojas/validacao-interesse-adocao.md). |
| A13 | Modo ONG: cadastrar e atualizar pets | Homologar com responsável/ONG aprovada: criar/editar/fotos, versões concorrentes, moderação e indisponibilidade de ONG suspensa. Ver [cadastro de pet](../../apps/tutor/lojas/validacao-cadastro-pet-ong.md). |
| A14 | Cuidador: criar acesso temporário | Backend foi reconciliado e tem implantação registrada; a ausência histórica de tabelas foi resolvida. Testar criação, prazo, permissões, revogação e link real no app/site. Ver [reconciliação](../deploy/links-reconciliados-2026-10-25.md). |
| A15 | Cuidador: visão por link/código e dose dada | Testar acesso sem sessão de tutor, validade/revogação, dose/retry e sincronização com tutor. Não basta obter HTTP 200 na página com código inexistente. |
| A16 | Passeios: iniciar, pausar e finalizar com GPS | Teste físico de precisão/permissão, pausa/retomada, encerramento, modo offline e recuperação após fechar. Ver [passeios](../../apps/tutor/lojas/validacao-passeios.md). |
| A17 | Passeios: resumo, mapa, foto e anotação | Conferir distância/tempo/ritmo, trechos no mapa, foto/anotação, permissões e falhas no dispositivo. Ver [resumo](../../apps/tutor/lojas/validacao-resumo-passeio.md). |
| A18 | Passeios: gravar com tela apagada | Android implementado, mas exige APK com configuração nativa e caminhada real com tela apagada/economia de bateria; testar parada e recuperação. iOS em segundo plano não está implementado no modo atual. Ver [entrega](../deploy/passeio-segundo-plano-2026-10-25.md). |
| A19 | Widget: próxima dose/vacina e botão Dei | Corrigir cache sem identidade/guarda da conta, tratar falha na consulta de doses confirmadas e no Feito, e testar atualização/offline/expiração/logout. Gerar APK com módulo e homologar launcher; suporte iOS continua ausente. Detalhes abaixo. |
| A20 | Atalhos do ícone: SOS, peso e passeio | Android já tem plugin e build registrados; testar com app fechado/aberto, login, conta sem pet e outro launcher. Implementar handler/atalhos iOS para concluir o escopo multiplataforma. Ver [atalhos](../../apps/tutor/lojas/validacao-atalhos-android.md). |
| A21 | Cartão: cores, Stories/Post e convite | Implementado; falta conferir PNG/resolução/foto, nomes longos, temas por plano e QR/convite em aparelho, nos dois formatos. Ver [cartão](../../apps/tutor/lojas/validacao-cartao-pet.md). |
| A22 | Ficha de emergência: dados, validade, link e QR | Backend de links foi reconciliado. Homologar escolha de dados, validade/revogação, abertura externa e compartilhamento/QR no dispositivo. Push de abertura tem dependência própria, não substitui testar a ficha. |
| A23 | Álbum anual: montagem e prévia | Montagem digital implementada. Testar seleção/ano/60 páginas, fotos expiradas, offline, memorial e acessibilidade. PDF, gráfica, frete e pagamento são outras tasks e não devem bloquear esta prévia. Ver [álbum](../../apps/tutor/lojas/validacao-album-anual.md). |
| A24 | Privacidade e dados: consentimentos, acessos, exportar/excluir | Testar consentimentos e resumo real dos compartilhamentos; concluir exclusão operacional conforme A01. As tabelas de cuidador/ficha antes ausentes já foram reconciliadas segundo os registros mais recentes. |
| A25 | Minha assinatura: plano, renovação, mensal e pagamento | Consulta já existe, com implantação registrada. Faltam gestão real de ciclo/pagamento e integração do provedor/webhooks; testar contrato e período pago no app. Ver [assinatura](../deploy/minha-assinatura-2026-10-25.md). |
| A26 | Cadastro de ONG: CNPJ, responsável e documentos | Implantação registrada; homologar seleção/upload privado dos documentos, rascunho/reenvio e ida ao admin com APK que contenha document-picker. Ver [implantação](../deploy/sql-producao-2026-10-25.md). |
| A27 | Modo ONG: novo pet com fotos e dados | Homologar formulário/upload, confirmação de salvamento, edição/retry, propriedade e atualização no catálogo. Não criar anúncio fictício no catálogo de produção. |
| A28 | Modo ONG: pets/interessados, responder e adotado | Homologar paginação, acesso aos contatos, abertura do cliente de e-mail e transição para adotado removendo do catálogo. Abrir e-mail não comprova envio. Ver [painel ONG](../../apps/tutor/lojas/validacao-painel-ong.md). |
| A29 | Cuidador por link: remédios, Dei, vacinas, alergias e contatos | Testar cada permissão/dado selecionado e o estado após expiração/revogação; testar dose idempotente e atualização no tutor. Backend disponível conforme a reconciliação, mas falta validação ponta a ponta. |
| A30 | Mapa: coroa de destaque pago | Visual e tabela existem. Falta integração confiável com pagamento/checkout/webhook, cancelamento/reembolso/expiração e desempenho/animação/acessibilidade no mapa nativo. Ver [destaques](../../apps/tutor/lojas/validacao-coroa-destaque.md). |
| A31 | Perfil no aparelho: foto, cidade por localização e senha | Reparo do bucket e confirmação de salvamento têm entregas registradas. Testar upload/remoção, persistência, cidade com permissão negada/concedida, senha e layout no aparelho. Ver [perfil](../deploy/perfil-salvamento-confirmado-2026-10-25.md). |
| A32 | Trocar e-mail pelo app | Trigger tem aplicação registrada. Falta fluxo real de confirmação conforme configuração atual do Auth/SMTP, retorno ao app, consulta da confirmação e novo login. Ver [troca de e-mail](../deploy/troca-email-2026-10-25.md). |

## Backend — 13 itens

| # | Item | O que falta para encerrar |
|---|---|---|
| B01 | Projeto Supabase e ambientes dev/produção | Produção existe segundo entregas. Confirmar segregação efetiva de desenvolvimento/homologação/produção, variáveis, funções e migrations em cada destino; reconciliar histórico/schema. Código e um projeto produtivo não provam os dois ambientes completos. |
| B02 | RLS por tutor | Há policies e testes de isolamento. Falta uma conferência atual no schema implantado incluindo novas tabelas/RPCs/Storage e guarda compartilhada. Não foi certificada a totalidade de RLS remoto nesta auditoria. |
| B03 | Autenticação e-mail e Google | Fluxos existem. Confirmar provedores/OAuth e redirects do ambiente, e testar cadastro/confirmação, Google, recuperação, logout/troca de conta no binário; SMTP e entrega real não são certificados pelo código. |
| B04 | Assinaturas: lojas e webhooks | Implementar recebimento e validação das transações, idempotência/eventos fora de ordem, atualização confiável de contrato/benefício, restauração, renovação, falha, cancelamento/reembolso e homologação nas lojas. Não existe Edge Function de cobrança no conjunto atual. |
| B05 | Limites por plano | Preparação implantada conforme registro, deliberadamente `ativo=false`. Falta cobrança real, UI para pets em leitura, Storage/jobs, concorrência PostgreSQL e comunicação do limite. Não ativar só porque os triggers existem. Ver [limites](../deploy/limites-plano-2026-10-25.md). |
| B06 | Google Cloud/APIs/chaves restritas/orçamento | Confirmar configuração real no console/EAS/Supabase, restrições por plataforma/API e alertas. Depende da decisão de usar Google; o padrão OSM não encerra automaticamente o título atual. Ver [roteiro Google Cloud](../google-cloud-mapa.md). |
| B07 | Termos e preços Google Maps antes do lançamento | Há análise antiga versionada; reconferir fontes/condições vigentes e decisão de campos/custos antes de ativar Google. Não houve nova análise jurídica/comercial nem aceite nesta auditoria. Ver [registro anterior](../google-maps-platform.md). |
| B08 | Passeios: tabelas, offline e encerramento automático | Código/migration e roteiro existem; confirmar implantação e job, sincronizar entre aparelhos e testar retry/idempotência/conflitos/encerramento. Ver [sincronização](../../apps/tutor/lojas/validacao-sincronizacao-passeios.md). |
| B09 | Exportar despesas CSV/PDF e resumo mensal opcional | Implementado com testes documentados. Confirmar migration/job ativo e testar CSV/PDF nativos e resumo em homologação, com opt-out, fuso e deduplicação. Não executar o job com data futura em produção. Ver [despesas](../../apps/tutor/lojas/validacao-exportacao-despesas.md). |
| B10 | Abertura de ficha e aviso ao tutor | Registro/caixa/fila/job de push têm implantação registrada. Falta entrega real configurada no celular, toque/deep link, preferências e confirmação do comportamento de abertura/reuso. Ver [push de fichas](../deploy/push-fichas-2026-10-25.md). |
| B11 | Precisão do reconhecimento de pet por foto | Existe runner `supabase/tests/achei-precisao.ts`, mas não encontrei resultados versionados, conjunto validado ou critério de aprovação documentado. Definir amostra consentida/representativa e limites, executar medição e revisar falsos positivos antes de ligar `achei_foto`; confirmar implantação/credencial do serviço. |
| B12 | Exportar dados e excluir conta com prazo | Exportação composta tem entrega registrada; worker/fila/concorrência/Storage e cron da exclusão continuam pendentes de reconciliação/homologação/ativação. Código da Edge Function por si só não prova implantação. |
| B13 | Guarda compartilhada: vários pets, aceite/recusa e 7 dias | Migration e teste SQL existem; confirmar sua implantação e a do push recente, testar isolamento, aceitação/recusa/revogação, expiração e efeitos nas doses entre duas contas. Não há certificação remota atual. |

## Web/admin — 7 itens

| # | Item | O que falta para encerrar |
|---|---|---|
| W01 | Assinaturas: lista/status/falhas/cancelamentos | Consulta e RPC têm implantação registrada. Confirmar redeploy e QA com financeiro/leitura/super e 2FA. Dados operacionais reais de falha/cancelamento dependem de B04; a tela não efetua cancelamentos. Ver [assinaturas admin](../deploy/admin-assinaturas-2026-10-25.md). |
| W02 | Planos/preços/teste grátis/cupons Premium | Hoje são rascunhos, `venda_disponivel=false`. Faltam publicação comercial, integração no checkout, uso/reserva de cupom, elegibilidade do teste e B04, além de redeploy/QA. Ver [planos](../deploy/planos-cupons-rascunho-2026-10-25.md). |
| W03 | Moderação: denúncias/anúncios/pet encontrado | Há telas e SQL, inclusive pets perdidos e comunidade recentes. Confirmar migrations correspondentes/redeploy; testar papéis/2FA e ciclo de denúncia/decisão/efeito no app. Não há registro de implantação dos últimos módulos equivalente aos registros de adoção. |
| W04 | Conteúdo mestre: vacinas/raças/categorias | Raças e categorias já foram implementadas e têm implantação registrada; não são mais desenvolvimento ausente. Falta redeploy/QA administrativo e consumo no app; confirmar implantação/revisão dos conteúdos recentes de luto/sênior/escala. Ver [raças](../deploy/catalogo-racas-2026-10-25.md) e [categorias](../deploy/categorias-mapa-2026-10-25.md). |
| W05 | Integrações: Play/App Store/Pix/outros | Hoje é inventário de componentes e roteiro manual, não monitora credenciais/provedores. Falta integração/verificação efetiva do escopo desejado e QA com 2FA. Ver [integrações](../deploy/admin-integracoes-2026-10-25.md). |
| W06 | Cadastrar evento PetLive e verificar organizadores | RPC/migration implantadas conforme registro. Confirmar redeploy e testar publicação/retry/datas/fuso, verificação/revogação e conflito entre revisores em homologação. Ver [eventos](../deploy/admin-eventos-organizadores-2026-10-25.md). |
| W07 | Adoção/ONGs: documentos, aprovação e moderação | SQL, correções e republicação têm implantação registrada. Falta redeploy e fluxo completo com moderação/2FA + responsável no app: documento privado, correção/reenvio, aprovação/suspensão e ocultação/republicação. Ver [adoção admin](../deploy/admin-adocao-2026-10-25.md) e [republicação](../deploy/republicacao-adocao-2026-10-25.md). |

## Achados concretos do widget

- `apps/tutor/src/widget/proximo.ts`: `CHAVE_WIDGET` é global; o objeto persistido não inclui identidade da conta. Não há reconferência da conta entre a leitura da sessão, as consultas e a gravação do cache. `ultimoProximo()` devolve esse cache sem checar titular. Em troca de conta seguida de falha de consulta, o fallback pode reaproveitar dados antigos. Precisa de cache por conta/validação da sessão e limpeza/atualização segura no logout.
- Na consulta de `medication_doses`, a função usa somente `data: confirmadas` e ignora `error`. Uma falha pode ser interpretada como nenhuma dose confirmada e recolocar uma dose já dada como pendente.
- `apps/tutor/src/widget/tarefaWidget.tsx`: `confirmarDoseWidget(...).catch(() => undefined)` descarta falha do botão Feito. Não há fila de confirmação offline nem estado claro de erro. Corrigir o comportamento antes de prometer confirmação pelo widget sem rede.
- O registro e a configuração estão limitados ao Android. Não há implementação equivalente de widget iOS no código auditado.

Os testes atuais passaram, mas esses caminhos não estão certificados pelos casos existentes. São achados de leitura do código; não foram reproduzidos em aparelho nesta auditoria.

## Ordem prática para reduzir os itens em progresso

1. Corrigir os problemas do widget e resolver a exclusão de conta em ambiente isolado.
2. Preparar um APK de homologação atual compatível com widget/GPS/documentos/câmera e configuração de push; reunir os roteiros nativos num ciclo de QA. Para iOS, tratar explicitamente as lacunas de widget/atalhos/background/push.
3. Confirmar o inventário de migrations/jobs/funções no destino, sem presumir que as migrations recentes já foram aplicadas.
4. Publicar o web atual e homologar admin com os papéis/2FA. Isso pode destravar os itens de eventos, adoção e conteúdo sem esperar cobrança.
5. Integrar cobrança Premium; só depois ativar limites, venda/cupons e destaques pagos.
6. Registrar resultados por task e mover para Done somente o requisito efetivamente confirmado. Recursos opcionais Google e reconhecimento por foto precisam de decisão/validação própria.

Campanhas não aparece entre estes 52: está Todo no board consultado, embora já tenha implementação e correções locais. Não incluí esse item na contagem de In Progress.
