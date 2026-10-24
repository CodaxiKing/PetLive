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

## Publicação do preview — 23/10/2026

O usuário confirmou a aplicação dos dois SQLs em produção. Correção do app
publicada a partir de e502a2e no canal preview (Android), grupo EAS Update
0f88df94-8a5f-4b8a-8634-6266a8bc04b4, runtime
1264fb8e8b1374172a594db4c6ebbf26fe172e0c.
APK compatível: build a387fe10-ae05-406a-aeba-5e372b75689a.
Validação final no aparelho permanece pendente; cadastro e mapa estão
In Progress no board até confirmação dos fluxos acima.

## Descoberta automática e filtros — 23/10/2026

Os filtros agora ficam em um cabeçalho único junto à busca e à região.
A faixa horizontal tem altura limitada a 52 px e os botões ficam centralizados,
com seleção visível. Tocar no filtro ou na aba já selecionada não deixa o
carregamento preso. Banho e tosa aparece entre os primeiros filtros.

Com GPS permitido, a consulta aguarda a posição real; sem posição disponível,
oferece tentar novamente ou escolher um bairro/cidade. Não consulta lugares
do Rio como se fossem a região do tutor. O centro padrão é somente visual.

A função autenticada `discover-places` consulta serviços e lugares com indicação
explícita de aceitar cães no OpenStreetMap/Overpass, por região aproximada e
raio de até 10 km, e faz upsert em `places`. Nenhuma loja precisa criar conta
no PetLive. Os dados já importados do Overture e indicações continuam disponíveis.
Isso não garante todos os estabelecimentos: depende da cobertura das fontes.

As consultas são compartilhadas entre filtros, com cache de uma hora no app e
por worker no servidor, prazo de 22 segundos e limite por usuário por worker.
Somente coordenadas aproximadas e raio são enviados ao provedor; não são enviados
dados de conta. `OVERPASS_URL` permite configurar uma instância própria ou contratada.
O endpoint padrão é o histórico `overpass.kumi.systems` (Private.coffee).
Referência do provedor: https://overpass.private.coffee/ .
Os pins importados aparecem antes de terminar a atualização externa. Uma falha
da busca pet friendly não esconde os serviços retornados. Consultas sem dados e
com falha mostram erro, em vez de afirmar que não existem estabelecimentos.

Validação: testes unitários de classificação, duplicatas entre fontes, raio,
24h, cache, falha de provedor e carregamento parcial; integração autenticada
local de importação, reconsulta e ficha em duas regiões, com provedor controlado
(`supabase/tests/provedor-osm-local.mjs`). A fonte pública real apresentou timeout
nesta máquina; a descoberta externa em produção e o layout no Android ainda
dependem de validação no aparelho. Nenhum novo SQL é necessário após o reparo.

