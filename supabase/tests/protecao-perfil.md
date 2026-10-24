# Proteção do plano e papel do perfil

## Alteração

Migration: `supabase/migrations/20261202000000_proteger_plano_e_papel_perfil.sql`.

O schema anterior permitia UPDATE da própria linha inteira. Com grants amplos,
um pedido direto podia alterar plano, papel e outros campos reservados.
A correção remove grants de tabela e coluna para PUBLIC/anon/authenticated e
reconcede UPDATE somente dos campos de dados pessoais conhecidos e presentes.
INSERT direto e privilégios de TRUNCATE, TRIGGER e REFERENCES também são removidos
dessas roles. SELECT do próprio perfil continua disponível. Colunas novas não
recebem edição automática pelo cliente.

A lista editável inclui nome, telefone, avatar, cidade, WhatsApp, contatos de
emergência, preferências de notificação/fuso e aceite de termos. E-mail, provedor,
identificador, plano e papel ficam reservados ao servidor. Uma policy restritiva
mantém o isolamento por conta mesmo se existir uma policy permissiva antiga.

As permissões do servidor confiável e do dono da tabela são preservadas. O
cadastro do Auth continua pelo trigger SECURITY DEFINER; as alterações de plano
devem vir de transações validadas no backend. Isso não implementa a compra,
webhooks ou homologação de assinaturas ainda pendentes.

## Verificação local

Executado em 24/10/2026 com PGlite 0.5.11 (PostgreSQL em memória), usando roles e
fixtures de teste. Não conectou ao banco remoto. O Docker local não respondeu;
não foi usado como evidência de teste nesta entrega.

O runner reproduz a vulnerabilidade, aplica a migration duas vezes em cada um
dos dois schemas de perfil (completo e mínimo), e verifica:

- edição de dados pessoais e leitura somente da própria conta;
- bloqueio de plano, papel, identidade, provedor, e-mail e data de criação;
- rejeição de INSERT/UPSERT direto e de alteração parcial com campo reservado;
- remoção de grants de coluna herdados de PUBLIC e impedimento de TRUNCATE;
- proteção de colunas adicionadas depois da migration;
- bloqueio do anônimo e preservação dos dados da outra conta;
- concessão/retirada de Premium pelo servidor confiável e cadastro por trigger;
- compatibilidade com colunas opcionais ausentes e reaplicação sem erro.

Reprodução em PowerShell, a partir da raiz do repositório:

```powershell
$pgTeste = Join-Path $env:TEMP 'petlive-perfil-pgtest'
npm install --ignore-scripts --no-audit --no-fund --prefix $pgTeste @electric-sql/pglite@0.5.11
$env:PGLITE_MODULE = Join-Path $pgTeste 'node_modules/@electric-sql/pglite/dist/index.js'
try { node supabase/tests/testar-protecao-perfil.mjs }
finally { Remove-Item Env:PGLITE_MODULE }
```

Fixtures e scripts de teste são apenas para banco descartável. O único arquivo
destinado à produção é a migration identificada acima.

## Aplicação e conferência em produção

Executar a migration inteira no SQL Editor do Supabase. Ela é transacional,
reaplicável e não altera valores de perfis existentes. Não exige novo APK.
A proteção só estará implantada depois dessa aplicação; esta entrega foi
validada localmente, não executada no Supabase de produção.

Consulta de conferência, sem alterações:

```sql
select
  has_column_privilege('authenticated','public.profiles','nome','UPDATE') as pode_editar_nome,
  has_column_privilege('authenticated','public.profiles','plano','UPDATE') as pode_editar_plano,
  has_any_column_privilege('authenticated','public.profiles','INSERT') as pode_inserir_perfil,
  has_table_privilege('authenticated','public.profiles','TRUNCATE') as pode_esvaziar_perfis;
```

Esperado: `true`, `false`, `false`, `false`. Depois, confirmar no app a edição de
nome/telefone e o cadastro normal. Registrar o resultado no board; integração de
cobrança e produção continuam em andamento até suas próprias validações.

Referências: [privilégios por coluna](https://www.postgresql.org/docs/current/sql-grant.html)
e [políticas restritivas de RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).
