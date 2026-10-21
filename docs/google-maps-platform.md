# Google Maps Platform: termos e preços (conferido em 21/10/2026)

> O padrão do app é **sem Google**: mapa e lugares de dados abertos
> (`docs/dados-abertos.md`). Este documento só vale se o Google for ligado.

Apoio ao item do board **"Conferir termos e preços do Google Maps Platform antes do
lançamento"**. A decisão final e o aceite dos termos são da conta do PetLive no
Google Cloud. Fontes: [políticas do Places API](https://developers.google.com/maps/documentation/places/web-service/policies),
[tabela de preços](https://developers.google.com/maps/billing-and-pricing/pricing),
[campos do Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search).

## Termos que o app precisa cumprir

| Regra | Como o PetLive cumpre |
| --- | --- |
| Conteúdo do Places num mapa só pode ir num **mapa do Google** | `MapaLugares` usa o Google quando a fonte é o Google; o OpenStreetMap só com dados do OpenStreetMap |
| Sem mapa do Google, mostrar o logo ou o texto **"Google Maps"** (sem traduzir, 12–16 sp, #5E5E5E/#1F1F1F) | `AtribuicaoGoogle` na lista Pet friendly, na ficha e na galeria de fotos |
| Fotos e avaliações: sempre creditar o autor, com link | Galeria mostra "Foto: autor", com link para o perfil |
| Oferecer o lugar no Google Maps (`googleMapsUri`) | "Ver no Google Maps ›" na ficha |
| Não guardar conteúdo do Places, só o `place_id` (pode guardar sem prazo) | Favoritos guardam só `google_place_id`; o resto é buscado na hora |

## Preços (por mil chamadas, depois da cota grátis mensal)

| SKU | Grátis por mês | Preço |
| --- | --- | --- |
| Nearby Search Pro | 5.000 | US$ 32 |
| Nearby / Text Search Enterprise | 1.000 | US$ 35 |
| Place Details Essentials | 10.000 | US$ 5 |
| Place Details Pro | 5.000 | US$ 17 |
| Place Details Enterprise | 1.000 | US$ 20 |
| Place Photos | 1.000 | US$ 7 |
| Maps SDK (Android e iOS) | sem limite | grátis |

A chamada paga pelo **SKU mais alto entre os campos pedidos**.

## Onde o PetLive está hoje

| Chamada | Campos que definem o SKU | SKU |
| --- | --- | --- |
| Busca por perto (clínicas, petshops, creches…) | `rating`, `currentOpeningHours.openNow` | **Enterprise** |
| Busca pet friendly | `allowsDogs` | **Enterprise + Atmosphere** |
| Ficha do lugar | telefone, horário, site, nota | **Enterprise** |
| Favorito (só nome e endereço) | `formattedAddress` | Essentials |
| Foto | — | Place Photos |

Com o limite diário por tutor (80 buscas, 40 fichas, 120 fotos) o custo por tutor
está contido, mas a cota grátis das buscas Enterprise (1.000/mês) acaba com poucas
dezenas de tutores ativos.

## Decisão pendente

1. **Manter** nota e "Aberto agora" no cartão do mapa (como no canvas): buscas em
   Enterprise, US$ 35 por mil depois de 1.000.
2. **Tirar** nota e "Aberto agora" da busca e mostrar só na ficha: buscas em Pro
   (5.000 grátis, US$ 32 por mil) e a ficha continua Enterprise. Muda o cartão do
   canvas ("Clínica · 0,8 km · 4,7 ★ · Aberto agora").
3. Ligar o **alerta de orçamento** no Google Cloud (item "Projeto no Google Cloud")
   com teto mensal, qualquer que seja a escolha.
