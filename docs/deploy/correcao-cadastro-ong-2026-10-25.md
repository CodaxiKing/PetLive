# Solicitação de correções no cadastro de ONG

Escopo atual: continuar app do tutor, backend e web/admin; app do lojista fica por último, conforme orientação do usuário.

Admin Adoção e ONGs agora oferece Pedir correções para cadastros pendentes e recusados. Exige moderação/super com AAL2, revisão atual, confirmação e motivo de 5 a 500 caracteres. O motivo será visto pelo responsável. A transação reabre o cadastro como rascunho e mantém a ONG recusada, sem publicar anúncios; não reabre ONG aprovada ou suspensa. Auditoria atômica `ong_pedir_correcao`.

O app mostra Correções solicitadas com o motivo. O responsável pode editar os dados e substituir documentos privados, salvando e reenviando com nova concordância. Versão antiga é rejeitada. No reenvio validado, a mesma ONG retorna a pendente, a revisão aumenta, nome/localização são sincronizados e o motivo de correção é limpo. Não duplica o CNPJ nem elimina os documentos antigos. A aprovação continua exigindo nova decisão administrativa. O formulário antigo permanece compatível, mas a explicação do motivo requer a atualização do app.

Backend: migration `20270101000000_correcao_cadastro_ong.sql`. Preserva validações de CNPJ, campos permitidos, proprietário, documentos existentes, versão e idempotência do cadastro. Serialização usa o mesmo advisory lock do cadastro, seguido de trava do cadastro e da ONG. Documentos em correção não são disponibilizados ao admin até o novo envio; URLs de 60 segundos previamente emitidas podem permanecer válidas até expirar.

Testes SQL estendem o fluxo real de cadastro/moderação: papéis negados, ONG aprovada não reaberta, versão antiga negada, outro responsável negado, motivo lido pelo titular, substituição de documento, reenvio pendente, revisão antiga da aprovação negada e nova aprovação válida. Testes anteriores de cadastro passaram. Tutor: 334 testes (54 arquivos).

Pendências de entrega: publicação web por Redeploy no Coolify e teste no aparelho. Não altera o app do lojista, limites, compra do Premium nem Firebase. Mantém a task de Adoção e ONGs em andamento até homologação.

Entrega concluída: migration aplicada em produção após `e08c3e1`; motivo instalado, RPC anônima negada, guarda de admin e auditoria verificadas e limites desligados. Não foram criadas solicitações reais de correção pelo agente. TypeScript/lint do tutor e web e build web passaram. OTA Android preview publicada: grupo `a267ffde-7e34-4c30-b9c0-3e048729f05e`, update `01a174ef-d50a-701b-97a8-d3381ee8ef8e`, runtime `2f48ad7475375d8681d4d351319e7c210a1993cf`, igual ao APK atual. Fonte `e08c3e1`; sem forçar runtime. Bundle Android exportado com sucesso.
