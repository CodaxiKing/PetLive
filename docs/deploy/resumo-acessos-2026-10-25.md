# Resumo privado dos acessos — 25/10/2026

A tela de privacidade não afirma mais Só você/Nenhuma ficha ativa com textos
fixos. Consulta privacidade_compartilhamentos(uuid), com conta esperada e
contagens próprias, sem códigos de acesso, nomes ou contatos. Cuidadores
consideram início/fim/revogação; fichas consideram validade/cancelamento;
QR considera ativação/pet ativo e fora do memorial; família considera o
plano Premium do dono. Vínculos familiares são contados por pet/membro.

Tabelas não implantadas retornam null e a tela informa consulta indisponível;
zero só é mostrado quando a consulta foi possível. Falha não significa ausência
de compartilhamento. Totais representam o instante da consulta e renovam no foco.
Não representam número de destinatários: um link pode ser repassado.

Auditoria de colunas em produção confirmou somente pet_qr_settings entre
pet_members, cuidador_acessos, carteirinha_links e pet_qr_settings. As funções
e tabelas de cuidador/carteirinha precisam de reconciliação e implantação antes
de certificar os fluxos como operacionais. Não aplica automaticamente migrations
antigas com pressupostos de schema nem inventa que não há pessoas com acesso.

Teste SQL isolado cobre tabela ausente/null, contagens, período/revogação,
isolamento, Premium, memorial, projeção mínima e reaplicação. Três testes
cliente cobrem contrato/falhas/troca de conta. TypeScript/lint aprovados.
Nenhum link, contato ou documento real foi aberto; nenhum dado de teste remoto.

Roteiro nativo pendente: abrir Privacidade com e sem rede; comparar contagens
com os acessos do próprio pet; revogar/desativar e retornar; trocar de conta;
confirmar que indisponibilidade não vira zero. A implantação do resumo não
implanta os serviços de compartilhamento ausentes.

### Cuidador reparado — 25/10/2026 — f4bf8b7
Migration 20261217000000 testada isoladamente, validada em produção com ROLLBACK e aplicada COMMIT. Tabelas/RLS/RPCs de criação, revogação, visão e confirmação de dose disponíveis. Conferidos grants: anon não cria/não lê tabela, cliente não insere direto; endpoint web /cuidador/código-inexistente HTTP200. Sem acessos/doses fictícios em produção. Teste PGlite cobre plano/pets/permissões, fuso, prazo/revogação, horário prescrito, retry, confirmação anterior do tutor, dose pulada e exportação sem tokens. Integração de avisos/push e homologação real permanecem pendentes; não foram enviados avisos de teste. Detalhes supabase/tests/cuidador-reconciliacao.md. A ausência histórica de tabelas foi resolvida para cuidador, não para carteirinha. Mantido Em andamento até validação do fluxo completo e integrações pendentes.
