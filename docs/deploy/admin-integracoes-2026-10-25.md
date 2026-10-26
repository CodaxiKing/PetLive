# Integrações no admin — 2026-10-25

Código: `7002842`, publicado na main. Rota: `/admin/integracoes`.

A RPC `admin_integracoes` consulta a presença de contratos, rascunhos de planos e cupons, fila e processador de push e consulta de lugares próximos. Retorna somente booleanos e horário da consulta. Exige super ou leitura ativo com AAL2, usando a guarda administrativa existente. Não consulta Vault, credenciais ou dados pessoais.

As contas externas aparecem em um roteiro de validação manual, explicitamente sem estado de conexão confirmado. A presença de componentes no banco não confirma operação. Não foram adicionadas chamadas a provedores, envio de mensagens, processamento de cobranças ou ativação de Premium e limites.

## Validação

- `supabase/tests/testar-admin-integracoes.mjs` com PGlite e guarda real: papéis, AAL1, inativo, anon, inventário ausente/presente, nenhuma exposição de dados privados.
- Web: lint, Next typegen, TypeScript e build passaram (33 rotas).
- Migration `20270104000000_admin_integracoes.sql`: validada com rollback e aplicada em produção no projeto `qurdqbhjtgapyksrilyk`.
- Metadados de produção: anon sem EXECUTE, authenticated com RPC protegida por `admin_exigir`, assinatura atual da função do mapa encontrada.

## Próximos passos

Acionar Redeploy da main no Coolify. Validar a tela com super e leitura com 2FA, incluindo erro/repetição e atualização. O item permanece Em andamento: integração automática e validação das contas de Play Console, App Store Connect, Asaas/Pix, FCM, Google Places e SMTP ainda precisam de desenvolvimento/configuração e testes. Não foi gerado APK, pois as alterações são no admin web e no banco.
