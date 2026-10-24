# Exportação de despesas e resumo mensal

Tarefa do Projects 5: `[BACKEND] Despesas: Exportar despesas em CSV ou PDF e resumo mensal opcional`.

## Entrega

- Na tela Despesas, CSV e PDF do mês e filtro de pet selecionados, incluindo registros de todos os pets. Premium confirmado no servidor em cada exportação. Sem imagens, caminhos ou URLs de recibos no arquivo.
- Relatório consultado de novo no servidor, em uma fotografia consistente; não usa a lista possivelmente incompleta do app. Até 5.000 registros por relatório; acima disso, erro explícito orienta filtrar por pet ou usar a exportação LGPD. Não trunca no limite de mil linhas do PostgREST.
- CSV UTF-8 com BOM, ponto e vírgula, valor decimal brasileiro, escapes de aspas/quebras de linha e neutralização de fórmulas em nomes/anotações. PDF A4 com total, categorias e tabela com cabeçalho repetido; textos escapados, sem recursos externos.
- Arquivo local temporário, removido depois do compartilhamento ou da falha. Confere conta e permanência na tela antes de compartilhar; nova conta não reaproveita a lista anterior. Falhas de carregamento deixam de parecer uma lista vazia.
- Resumo mensal opcional, desligado inicialmente, independente da compra do Premium. Preferência privada alterada somente por RPC autenticada. Primeiro resumo no fechamento do mês seguinte à adesão; sem envio retroativo. Na caixa de avisos, total do mês anterior e link para o período. Sem email/push com valores financeiros.
- Job horário respeita notificações gerais, fuso válido (fallback São Paulo) e horário escolhido. Deduplicação por tutor/mês mais trava transacional; sem despesas, não gera aviso. Opt-out impede novos avisos. Não apaga avisos já recebidos.
- Preferências e recibos de envio incluídos na exportação LGPD existente; tabelas removidas por cascata ao apagar o perfil. A migration preserva o conteúdo anterior da exportação.

## Implantação necessária

1. Aplicar as migrations anteriores do projeto, incluindo a proteção de `profiles.plano` em `20261202000000_proteger_plano_e_papel_perfil.sql`. O aplicativo não pode conceder Premium a si mesmo.
2. Aplicar `supabase/migrations/20261205000000_exportar_despesas.sql` no SQL Editor do projeto de produção. Pode ser reaplicada. Não altera registros de despesas.
3. Se `pg_cron` já estiver habilitado, a migration instala `petlive-resumo-despesas` (`15 * * * *`). Caso contrário, habilitar a extensão e reaplicar a migration. Sem cron o resumo não é enviado automaticamente.
4. Verificar como administrador:

```sql
select jobname, schedule, active from cron.job where jobname='petlive-resumo-despesas';
select to_regprocedure('public.despesas_exportar(uuid,date,uuid)'),
       to_regprocedure('public.despesas_enviar_resumos(timestamp with time zone)');
```

Não executar o job com datas futuras em produção: isso criaria avisos e recibos reais antes do fechamento do mês.

## Verificação realizada

- App: 220 testes em 37 arquivos, TypeScript e lint sem erros.
- `supabase/tests/testar-exportacao-despesas.mjs`: PostgreSQL PGlite isolado, migration aplicada duas vezes; Premium, anonimato, outra conta/pet, mês inválido, filtro com compartilhadas, 1.001 registros, bloqueio acima de 5.000, opt-in/out, horário/fuso, deduplicação, meses vazios, exportação LGPD e exclusão em cascata. Não conecta à produção.
- Testes de arquivo: CSV, PDF, falha de compartilhamento, troca de conta durante geração e saída da tela. Arquivos temporários limpos.

## Validação pendente no Android e na produção

- Com Premium, exportar mês vazio e mês com despesas de um pet e de todos; abrir CSV em planilha e PDF em visualizador, conferir centavos, acentos, total e paginação.
- Confirmar que conta grátis vê convite e que o servidor rejeita exportação sem Premium. Testar falta de conexão e tentar novamente.
- Trocar conta ou sair durante a preparação; nenhum relatório anterior deve ser compartilhado.
- Ativar/desativar resumo, fechar e abrir o app; conferir persistência. Conferir job ativo e, após o fechamento mensal, um aviso com o mês correto e link para Despesas. Reexecução não deve duplicar.
- Não foi executado envio de resumo real, aplicação de SQL de produção ou compartilhamento em aparelho nesta entrega. A tarefa permanece em andamento até essas verificações.
