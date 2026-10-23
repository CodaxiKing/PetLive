# Lugares de dados abertos

O mapa do PetLive funciona **sem Google e sem custo**: o mapa é MapLibre com os
desenhos do OpenFreeMap, e os lugares ficam na tabela `places`, importados de
fontes abertas por `scripts/importar-lugares.py`.

| Fonte | Licença | O que traz |
| --- | --- | --- |
| OpenStreetMap (Overpass) | ODbL | clínicas, petshops, banho e tosa, hotelzinhos, parques e áreas para cães, e o que tiver `dog=yes` |
| Overture Maps (places) | CDLA-Permissive-2.0 (com Foursquare, Apache-2.0) | clínicas, petshops, banho e tosa, creches, hotelzinhos, parques para cães |

Os créditos que as licenças pedem estão no mapa ("© OpenStreetMap"), na ficha do
lugar (fonte) e na página `https://petlive.app/creditos` (com o aviso da
Foursquare na íntegra), aberta em Perfil › Privacidade e dados.

## Atualizar os dados (a cada release do Overture, mais ou menos por mês)

```bash
pip install duckdb
python scripts/importar-lugares.py          # Rio de Janeiro; --bbox=sul,oeste,norte,leste para outra região
npx supabase db query --local -f supabase/seeds/places-rio.sql   # ou no banco de produção
```

O script lê só a região pedida direto do S3 público do Overture (sem baixar o
arquivo inteiro), descarta lugares com confiança abaixo de 0,5 ou com endereço
de outra cidade, classifica pelo tipo e pelo nome e junta os repetidos (mesma
categoria, até 100 m e nome parecido; o OpenStreetMap ganha e recebe telefone,
site e endereço que faltarem). O upsert é por `(fonte, fonte_id)`, então os
favoritos continuam apontando para o mesmo lugar.

## Limites conhecidos

- **Pet friendly:** nenhuma fonte aberta marca restaurantes, hotéis e praias que
  aceitam pets no Rio (no OpenStreetMap ninguém usou `dog=yes` neles). Hoje só
  aparecem parques; o app avisa nos outros filtros. Quem marcar `dog=yes` no
  OpenStreetMap faz o lugar aparecer na próxima importação.
- Sem fotos, notas nem horário na maior parte dos lugares (o Overture não tem;
  o OpenStreetMap tem horário em poucos).
- O Foursquare OS Places mais novo está no Hugging Face com acesso controlado
  (precisa aceitar os termos com uma conta); o Overture já inclui parte dele.
- O Google continua disponível como fonte opcional (`EXPO_PUBLIC_LUGARES_FONTE=google`,
  ver `docs/google-maps-platform.md`).
