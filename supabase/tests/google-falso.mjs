// Imita a Places API (New) para testar as Edge Functions sem chave real.
import http from 'node:http';

const lugar = (id, nome, lat, lng, extra = {}) => ({
  id,
  displayName: { text: nome, languageCode: 'pt-BR' },
  location: { latitude: lat, longitude: lng },
  types: ['veterinary_care'],
  rating: 4.6,
  currentOpeningHours: { openNow: true },
  ...extra,
});

http
  .createServer((req, res) => {
    let corpo = '';
    req.on('data', (c) => (corpo += c));
    req.on('end', () => {
      console.log(JSON.stringify({
        metodo: req.method,
        url: req.url,
        chave: req.headers['x-goog-api-key'],
        campos: req.headers['x-goog-fieldmask'] ?? null,
        corpo: corpo ? JSON.parse(corpo) : null,
      }));
      const json = (obj, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      if (req.headers['x-goog-api-key'] !== 'chave-teste') return json({ error: { message: 'API key not valid' } }, 403);

      if (req.url.startsWith('/v1/places:searchNearby')) {
        if (JSON.parse(corpo).includedTypes.includes('dog_park')) {
          return json({
            places: [
              lugar('ChIJparquecao001', 'Parcão do Aterro', -22.952, -43.183, { types: ['dog_park', 'park'] }),
              lugar('ChIJparqueno0001', 'Parque sem cães', -22.953, -43.184, { types: ['park'], allowsDogs: false }),
            ],
          });
        }
        return json({
          places: [
            lugar('ChIJperto0000001', 'Clínica Perto', -22.952, -43.183),
            lugar('ChIJlonge000001', 'Clínica Longe', -22.99, -43.25, { currentOpeningHours: { openNow: false } }),
          ],
        });
      }
      if (req.url.startsWith('/v1/places:searchText')) {
        const q = JSON.parse(corpo).textQuery;
        if (q.includes('24 horas')) return json({ places: [lugar('ChIJ24horas00001', 'Hospital Vet 24h', -22.955, -43.19)] });
        return json({
          places: [
            lugar('ChIJtexto000001', `Resultado: ${q}`, -22.953, -43.184, { allowsDogs: true }),
            lugar('ChIJforadoraio1', 'Fora do raio', -23.5, -46.6),
          ],
        });
      }
      if (/^\/v1\/places\/[^/]+\/photos\/[^/]+\/media/.test(req.url)) {
        return json({ name: 'x', photoUri: 'https://lh3.googleusercontent.com/foto-teste' });
      }
      if (req.url.startsWith('/v1/places/')) {
        return json({
          id: 'ChIJperto0000001',
          displayName: { text: 'Clínica Perto' },
          location: { latitude: -22.952, longitude: -43.183 },
          formattedAddress: 'Rua Teste, 10 - Botafogo, Rio de Janeiro',
          nationalPhoneNumber: '(21) 99999-0000',
          internationalPhoneNumber: '+55 21 99999-0000',
          regularOpeningHours: { weekdayDescriptions: ['segunda-feira: Atendimento 24 horas'] },
          currentOpeningHours: { openNow: true },
          websiteUri: 'https://clinica.example',
          rating: 4.6,
          userRatingCount: 321,
          googleMapsUri: 'https://maps.google.com/?cid=1',
          photos: Array.from({ length: 7 }, (_, i) => ({
            name: `places/ChIJperto0000001/photos/foto${i}`,
            authorAttributions: [{ displayName: 'Fulano', uri: 'https://maps.google.com/u/1' }],
          })),
        });
      }
      json({ error: 'rota desconhecida' }, 404);
    });
  })
  .listen(8787, () => console.log('google-falso na porta 8787'));
