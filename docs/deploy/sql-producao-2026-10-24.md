# Atualização SQL de produção — 24/10/2026

## Correção do cadastro de pet: perfil ausente

Erro reportado no Android: `pets_tutor_id_fkey`. Auditoria encontrou uma conta Auth sem registro correspondente em profiles, embora o trigger de novos cadastros estivesse ativo. Migration `20261210000000_reparar_perfis_ausentes.sql` (commit `27bc2e2`) aplicada em produção: insere apenas perfis ausentes a partir do Auth, preserva existentes e defaults de plano/papel, não inventa aceite. Revoga DELETE direto de profiles pelo cliente para não deixar sessões válidas sem perfil; exclusão de conta pelo backend/Auth continua em cascata.

Pós-aplicação: zero contas sem perfil, DELETE direto bloqueado e trigger de cadastro ativo. Teste PGlite `testar-perfis-ausentes.mjs` reproduziu a FK, confirmou cadastro após reparo, reaplicação, defaults sem promoção, preservação de perfil existente e cascata de exclusão. Nenhum pet fictício foi criado em produção. Não exige APK/OTA; usuário pode tentar Salvar pet novamente. Confirmação no aparelho permanece pendente.

## Entrega adicional: ficha e interesse de adoção

Após o pacote abaixo, aplicada separadamente a migration `20261209000000_interesse_adocao.sql`, fonte commit `54fd2eb`. Validação na produção com ROLLBACK aprovada; em seguida COMMIT aprovado. Lock timeout 5 s e statement timeout 60 s. Nenhum contato, e-mail, ONG ou pet de teste foi inserido em produção.

Verificação pós-aplicação: `adocao_detalhe` e `adocao_enviar_interesse` instaladas; anon sem EXECUTE no envio, authenticated sem INSERT direto na tabela e RLS dos contatos ativa. Consulta autenticada com UUID inexistente retornou pet indisponível, em transação revertida. Testes isolados PGlite cobriram consentimento, idempotência/limite, propriedade, disponibilidade, LGPD e cascata. Homologação com ONG real e aparelho continua pendente. Roteiro em `apps/tutor/lojas/validacao-interesse-adocao.md`.

## Pacote inicial

Aplicada no projeto Supabase `qurdqbhjtgapyksrilyk` (nome petlive-dev, utilizado pelo app publicado), via CLI autenticada e Management API. Fonte: commit 8236ff4, enviado à main antes da implantação.

O banco tinha schema antigo criado manualmente e não tinha histórico de migrations. Não foi usado db push nem fabricado histórico. As 15 migrations abaixo foram executadas na ordem explícita indicada, em uma única transação, primeiro com ROLLBACK (validação bem-sucedida), depois com COMMIT. Lock timeout 5 s, statement timeout 120 s. As transações externas BEGIN/COMMIT dos arquivos foram removidas somente no pacote de execução.

## Resultado verificado em produção

- Tabelas despesas, documentos_saude, passeios_tutor, eventos_regioes e todas as quatro tabelas de adoção com RLS habilitada.
- authenticated não pode atualizar profiles.plano ou profiles.role; edição de nome continua permitida.
- Buckets pets/eventos públicos e anexos privado, com policies por pasta do tutor para escrita e acesso privado aos anexos.
- Cinco jobs ativos: petlive-eventos-lembretes, petlive-eventos-encerrar, petlive-eventos-proximos, petlive-resumo-despesas e passeios-encerrar-inativos.
- Função de eventos corrigida para places.id UUID e events.place_id text.
- Exportação LGPD executada como authenticated com UUID inexistente, sem inserir usuários ou dados: 30 chaves, incluindo despesas, documentos, passeios, região e favoritos de adoção. Consulta retornou somente nomes das chaves.
- anon sem EXECUTE na exportação; authenticated sem EXECUTE no wrapper interno de adoção.

Nenhum seed, pet fictício ou contato de ONG foi criado. Não foram chamados jobs de envio para testar mensagens. Os jobs passaram a operar normalmente após o commit; preferências opcionais novas iniciam desativadas. Não houve Redeploy, novo APK ou OTA nesta entrega SQL.

## Validação isolada

supabase/tests/testar-dependencias-producao.mjs reproduziu somente os metadados do schema antigo em PGlite, com dados fictícios exclusivamente em memória. Passaram upgrade, reaplicação, exportação composta, proteção de plano e regressão UUID/text. A reaplicação da fundação preserva wrappers LGPD posteriores.

## Pendências funcionais

Homologar no Android: cadastro/edição e fotos, sincronização entre aparelhos, avisos/push e compartilhamento CSV/PDF. Adoção ainda precisa de ONGs verificadas e pets reais; envio de contatos e interfaces de gestão continuam nas tasks próprias. Esta implantação não certifica esses fluxos no aparelho.

## Manifesto em ordem de execução

SHA256 dos arquivos locais versionados (inclui finais de linha do checkout).

| Migration | SHA256 |
| --- | --- |
| 20261207000000_dependencias_tutor_producao.sql | f47b78c88108b2fd2840acdd8837f298c6365a15320ffd0f50b05e3b65ddd5bf |
| 20261122000000_eventos_pet.sql | 17e190e7c8122da5277add03238c4135c5d3fecdc72f45efb0e1eb5c8adcd2a2 |
| 20261123000000_eventos_jobs.sql | 879fbb68bb0917a68de58b11927973f0c39c9961566347ea52e67a7be0e81fd6 |
| 20261124000000_evento_detalhe.sql | d348274e52a96c00fbf2c272e896c79af1792d52bcad0365b95cf88afdcd37b2 |
| 20261125000000_evento_presenca.sql | f9e51f9ca9090d387adeb644f91422ba803d96116ad9d6e05ab914e413170248 |
| 20261126000000_evento_edicao.sql | cc521f0fc9ee53d1653b4315b7d70327143df83a77278dcf6f931e4b2b8b1c8d |
| 20261127000000_evento_foto.sql | 758dbefad22912968ab23d01f408cd826c1c3d5a04dfefc22545f2376dca8e87 |
| 20261128000000_evento_denuncias.sql | aed9586b9a5969789a490ca8177147e1a4d743c5cf92ccb7f67fa8635bf2e95c |
| 20261129000000_eventos_filtros.sql | 7b28bbe40a2dae8b25504adaf8084a3b76ac84978da160fb330aa22d5c093500 |
| 20261202000000_proteger_plano_e_papel_perfil.sql | 65b0adf1b84169e08ba35071850bc99d7dcb1d86b56bf25e4b37f64b7e392fb7 |
| 20261203000000_passeios_tutor.sql | 7a5d9b1613407c800c0711598ff0029d358d60cf96136ec04b7c30a9a9f89530 |
| 20261204000000_eventos_por_regiao.sql | faf6ba15f13bdfa3b37d9735e393758de9c2f9817ff2189a3e8a1e84f4d2df10 |
| 20261205000000_exportar_despesas.sql | ac379b1c89e90e206747fdba4be7c9584de8aff065db277cb7f4ab16fbf2fbff |
| 20261206000000_catalogo_adocao.sql | 087f99b919f7e3df86a02bdbdd058659b539e8055887fc2e24c95bc66a437dac |
| 20261208000000_eventos_places_uuid.sql | 32fc859b14694fb5889cea19b89a5f0c1a32fce45effbcb939cfe1bce04337c3 |
