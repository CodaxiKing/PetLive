// Provedor determinístico apenas para os testes locais de integração.
// OVERPASS_URL=http://host.docker.internal:18452 no env-file do functions serve.
import { createServer } from 'node:http';
createServer(async (req, res) => {
  let corpo = '';
  for await (const parte of req) corpo += parte;
  const consulta = new URLSearchParams(corpo).get('data') || '';
  const ponto = consulta.match(/around:\d+,(-?[\d.]+),(-?[\d.]+)/);
  if (!ponto) { res.writeHead(400).end(); return; }
  const lat = Number(ponto[1]); const lon = Number(ponto[2]);
  const base = lat < -24 ? 9900000010 : 9900000020;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ elements: [
    { type: 'node', id: base, lat, lon, tags: { name: 'Clínica do teste local', amenity: 'veterinary', opening_hours: '24/7' } },
    { type: 'way', id: base + 1, center: { lat: lat + 0.001, lon }, tags: { name: 'Petshop do teste local', shop: 'pet' } },
    { type: 'node', id: base + 2, lat: lat - 0.001, lon, tags: { name: 'Banho e tosa do teste local', shop: 'pet_grooming' } },
  ] }));
}).listen(18452, '0.0.0.0', () => console.log('Provedor de teste local: 18452'));
