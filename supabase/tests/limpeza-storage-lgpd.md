# Limpeza de arquivos na exclusão de conta

Executar `node --test supabase/tests/limpar-storage.test.mjs` na raiz.

A rotina anterior enviava pastas virtuais para remove e voltava a listar a
mesma pasta. Documentos de saúde usam `<uid>/saude/<pet>/<arquivo>`, portanto
não eram alcançados. Agora o worker inventaria arquivos e subpastas por conta,
com paginação ordenada, antes de remover em lotes de até mil. Confere novamente
o bucket antes de prosseguir. Fotos, anexos e documentos privados de ONG entram
na limpeza. Falha de lista, remoção ou conferência impede a chamada posterior
a lgpd_concluir_exclusao; o pedido pode ser retomado.

Seis testes isolados cobrem subpastas reais de saúde, três buckets, outra conta
preservada, 2.002 arquivos (incluindo 1.001 pastas), repetição, erros, remoção
sem efeito, resposta incompleta, UID/caminho inválido e profundidade excessiva.
Nenhum teste acessa Storage ou contas de produção.

Limites defensivos por bucket: 100 mil entradas e 20 níveis de subpastas.
Excesso interrompe antes da remoção nesse bucket e exige revisão operacional.
Inventário não é snapshot transacional: antes da ativação definitiva, bloquear
novos uploads de contas em exclusão e conciliar a corrida entre a conferência
de Storage e a exclusão Auth. Também faltam reconciliar schema/RPCs de produção,
fila, permissões e agendamento; não houve deploy/ativação do worker nem exclusão
de conta nesta entrega. Esta correção não conclui a tarefa de privacidade.

Referências: [list](https://supabase.com/docs/reference/javascript/storage-from-list)
e [remove](https://supabase.com/docs/reference/javascript/storage-from-remove).
