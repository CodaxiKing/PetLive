// PetLive — importação de lugares pet do OpenStreetMap para a tabela places.
//
// Tarefa do board: [BACKEND] "Mapa: Importar lugares do OpenStreetMap
// (Overpass) para a tabela places, Rio de Janeiro".
//
// Uso:
//   node scripts/importar-lugares-osm.mjs                 # Rio de Janeiro (padrão)
//   node scripts/importar-lugares-osm.mjs -23.1,-43.8,-22.7,-43.1   # bbox qualquer
//
// O script só busca no Overpass e gera um arquivo SQL com um único
// upsert multi-row (supabase/seeds/places-rio.sql). Nada de credencial:
// aplique com
//   npx supabase db query --local -f supabase/seeds/places-rio.sql
// ou envie o arquivo para o banco de produção. O upsert é idempotente
// (on conflict em osm_type + osm_id), então dá para rodar sempre.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Bounding box do município do Rio de Janeiro (com folga).
const BBOX_PADRAO = '-23.10,-43.80,-22.74,-43.10'
const bbox = process.argv[2] || BBOX_PADRAO

// Tags OSM -> categoria do PetLive.
const CATEGORIAS = [
  { filtro: '["amenity"="veterinary"]', categoria: 'clinica' },
  { filtro: '["shop"="pet"]', categoria: 'petshop' },
  { filtro: '["shop"="pet_grooming"]', categoria: 'banho_tosa' },
  { filtro: '["amenity"="animal_boarding"]', categoria: 'banho_tosa' },
]

const consulta = `
[out:json][timeout:120];
(
${CATEGORIAS.map((c) => `  nwr${c.filtro}(${bbox});`).join('\n')}
);
out center tags;
`.trim()

// Endpoints públicos; se um estiver lotado, tenta o próximo e refaz com
// backoff exponencial (recomendação do próprio Overpass).
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms))

async function buscarNoOverpass() {
  let espera = 2000
  let ultimoErro = null
  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    for (const endpoint of ENDPOINTS) {
      try {
        const resposta = await fetch(endpoint, {
          method: 'POST',
          body: new URLSearchParams({ data: consulta }),
          headers: { 'User-Agent': 'PetLive/1.0 (import de lugares pet)' },
        })
        if (resposta.ok) return resposta.json()
        ultimoErro = `Overpass ${endpoint} respondeu ${resposta.status}`
      } catch (e) {
        ultimoErro = `Overpass ${endpoint}: ${e instanceof Error ? e.message : String(e)}`
      }
    }
    console.warn(`${ultimoErro}; tentando de novo em ${espera / 1000}s...`)
    await dormir(espera)
    espera *= 2
  }
  throw new Error(`Sem sucesso no Overpass após 4 tentativas. Último erro: ${ultimoErro}`)
}

function sqlTexto(valor) {
  if (valor === null || valor === undefined || valor === '') return 'null'
  return `'${String(valor).replace(/'/g, "''")}'`
}

function enderecoDe(tags) {
  if (tags['addr:full']) return tags['addr:full']
  if (!tags['addr:street']) return null
  const numero = tags['addr:housenumber'] ? `, ${tags['addr:housenumber']}` : ''
  const bairro = tags['addr:suburb'] ? ` — ${tags['addr:suburb']}` : ''
  return `${tags['addr:street']}${numero}${bairro}`
}

function categorizar(tags) {
  if (tags.amenity === 'veterinary') return 'clinica'
  if (tags.shop === 'pet') return 'petshop'
  if (tags.shop === 'pet_grooming' || tags.amenity === 'animal_boarding') return 'banho_tosa'
  return null
}

const dados = await buscarNoOverpass()
const linhas = []
const vistos = new Set()
const porCategoria = {}

for (const elemento of dados.elements ?? []) {
  const tags = elemento.tags ?? {}
  const nome = tags.name || tags['name:pt']
  const lat = elemento.lat ?? elemento.center?.lat
  const lng = elemento.lon ?? elemento.center?.lon
  const categoria = categorizar(tags)
  if (!nome || lat === undefined || lng === undefined || !categoria) continue

  const chave = `${elemento.type}/${elemento.id}`
  if (vistos.has(chave)) continue
  vistos.add(chave)

  const horario = tags.opening_hours ?? null
  const valores =
    `(${sqlTexto(elemento.type)}, ${elemento.id}, ${sqlTexto(nome)}, ` +
    `${sqlTexto(categoria)}, ${sqlTexto(enderecoDe(tags))}, ` +
    `${sqlTexto(tags.phone || tags['contact:phone'] || tags.mobile || null)}, ` +
    `${sqlTexto(horario)}, ${sqlTexto(tags.website || tags['contact:website'] || null)}, ` +
    `${lat}, ${lng}, ${horario !== null && horario.includes('24/7') ? 'true' : 'false'})`
  linhas.push(valores)
  porCategoria[categoria] = (porCategoria[categoria] ?? 0) + 1
}

const dirSaida = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'seeds')
mkdirSync(dirSaida, { recursive: true })
const arquivo = join(dirSaida, 'places-rio.sql')

if (linhas.length === 0) {
  throw new Error('Overpass não devolveu nenhum lugar; nada foi gravado.')
}

// Um único comando (o `db query -f` do Supabase CLI usa prepared statement
// e não aceita vários comandos no mesmo arquivo).
const cabecalho = [
  `-- Gerado por scripts/importar-lugares-osm.mjs (bbox ${bbox}).`,
  `-- ${linhas.length} lugares pet do OpenStreetMap. Upsert idempotente;`,
  '-- aplique com: npx supabase db query --local -f supabase/seeds/places-rio.sql',
  'insert into public.places',
  '  (osm_type, osm_id, nome, categoria, endereco, telefone, horario, website, lat, lng, aberto_24h)',
  'values',
].join('\n')

const rodape = [
  'on conflict (osm_type, osm_id) do update set',
  '  nome = excluded.nome, categoria = excluded.categoria, endereco = excluded.endereco,',
  '  telefone = excluded.telefone, horario = excluded.horario, website = excluded.website,',
  '  lat = excluded.lat, lng = excluded.lng, aberto_24h = excluded.aberto_24h;',
].join('\n')

writeFileSync(arquivo, `${cabecalho}\n${linhas.join(',\n')}\n${rodape}\n`, 'utf8')

console.log(`Total: ${linhas.length} lugares -> ${arquivo}`)
console.log('Por categoria:', porCategoria)
