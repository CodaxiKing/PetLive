# Correção de mapa e cadastro de pet

Diagnóstico confirmado no ambiente remoto: tabela `places` vazia,
RPC `lugares_por_perto` ausente e nenhuma policy de INSERT/SELECT em `pets`.
No app, falhas de consulta viravam estado vazio e o cadastro ocultava o erro.

## Aplicação no Supabase

No SQL Editor do projeto usado pelo preview, executar nesta ordem:

1. `supabase/migrations/20261201000000_reparar_cadastro_e_mapa.sql`.
   Restaura acesso do tutor aos próprios pets, prepara as colunas do
   importador e a consulta de lugares. A consulta exige autenticação.
2. `supabase/seeds/places-nova-iguacu.sql`.
   Importa 694 lugares de Nova Iguaçu e arredores, recortados do conjunto
   OpenStreetMap/Overture já versionado no projeto. É um upsert: repetir
   não duplica os lugares. A cobertura não representa todos os locais da cidade.

Ambos foram validados em banco descartável com o schema incompleto;
o reparo foi reaplicado e os testes verificaram isolamento entre tutores,
cadastro com leitura da linha, atualização de foto e filtros por raio e tipo.

## Correções do app

- Busca, abas e filtros respeitam a área segura, sem o espaçamento de 62 px
  entre a busca e as abas. Rolagens horizontais não crescem para o meio da tela.
- Painel de eventos e cartões respeitam o menu inferior. Cartões longos rolam.
- Todos reúne serviços e pet friendly, remove pins repetidos e ordena por distância.
  O chip Pet friendly filtra o mapa e usa o mesmo raio escolhido pelo tutor.
- Falha de consulta oferece nova tentativa, em vez de afirmar que não há lugares.
  Cache inválido é ignorado. Recentralizar também atualiza a região consultada.
- Cadastro mostra o erro, valida nome/data/peso e evita envio repetido.
  Exceções de cadastro ou foto liberam o estado de carregamento.

## Validação no Android

Após aplicar os SQLs e receber a atualização do preview, entrar na conta,
abrir o mapa com localização permitida e testar Todos, Clínicas, Petshops
e Pet friendly em Nova Iguaçu. O retorno deve corresponder aos dados importados.
Testar também busca por bairro, centralização, alternância Lugares/Eventos
e uma falha de rede. Criar um pet sem foto e outro com foto; conferir que
aparecem na lista e que uma data inválida é rejeitada com mensagem.
