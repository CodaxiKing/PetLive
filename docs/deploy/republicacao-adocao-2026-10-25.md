# Revisão e republicação de anúncios de adoção

Continuação da moderação em tutor/backend/admin; lojista permanece por último.

Admin: anúncios ocultos podem ser republicados por moderação/super com 2FA, motivo de 5 a 500 caracteres, confirmação e versão atual. A ONG precisa estar aprovada e o anúncio deve ter ao menos uma foto válida. Não restaura pets adotados nem rascunhos. O admin vê a última moderação e a confirmação de disponibilidade; o motivo é identificado na interface como visível ao responsável.

Backend: `20270102000000_republicar_adocao_moderacao.sql`, com auditoria atômica. Republicar preserva `confirmado_em`, fotos, descrição, interesses e favoritos. ONG travada antes do pet, seguindo a ordem da edição do responsável. Trava compartilhada da ONG impede que uma suspensão concorrente seja ignorada. Ocultar e republicar incrementam versão e registram último motivo/data.

Tutor: modo ONG mostra o motivo da última moderação nos próprios pets e oferece Confirmar disponível para anúncios publicados de ONG aprovada, com confirmação explícita e guarda de conta. Usa a RPC existente `adocao_confirmar_pet`; ocultos não podem ser liberados pelo tutor. Anúncios sem confirmação há 60 dias continuam fora do catálogo após republicação, até a ONG confirmar sua disponibilidade. A leitura da moderação continua restrita à conta responsável; não é incluída no catálogo público.

Testes SQL: republicação negada a tutor/leitura/AAL1, ONG suspensa bloqueada, foto ausente bloqueada, revisão antiga rejeitada, timestamp de disponibilidade preservado, catálogo antigo não reativado pelo admin, nova confirmação da ONG reativa catálogo e auditoria sem duplicação. Cobertura anterior de cadastro/correções/moderação preservada. Suite tutor 334 testes passou; após adicionar dois testes, os 8 casos de ong.test.ts passaram. TypeScript/lint tutor e web e build web verificados. Migration validada no schema real com rollback antes de instalar.

Homologação pendente: Redeploy web no Coolify e teste de revisão/ocultação/republicação e confirmação de disponibilidade no aparelho. Nenhuma moderação real foi efetuada pelo agente. Sem trabalho no app do lojista, sem ativação de limites, pagamentos ou Firebase.
