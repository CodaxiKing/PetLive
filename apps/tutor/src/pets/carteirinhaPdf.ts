import { escaparHtml } from '../lib/pdf'
import type { Remedio } from '../remedios/types'
import type { Vacina } from '../saude/types'
import { idadeEmAnos, type Pet } from './types'

function dataCurta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

function linha(rotulo: string, valor: string | null | undefined): string {
  return `<div class="linha"><span>${escaparHtml(rotulo)}</span><strong>${escaparHtml(valor?.trim() || '—')}</strong></div>`
}

/** Gera uma versão para impressão da carteirinha sem compartilhar campos vazios. */
export function htmlCarteirinha(pet: Pet, tutor: string | null, vacinas: Vacina[], remedios: Remedio[]): string {
  const especie = pet.especie === 'gato' ? 'Gato' : 'Cão'
  const identidade = [especie, pet.raca].filter(Boolean).join(' · ')
  const listaVacinas = vacinas.length
    ? vacinas.map((v) => `<tr><td>${escaparHtml(v.nome)}</td><td>${dataCurta(v.aplicada_em)}</td><td>${dataCurta(v.proxima_dose)}</td></tr>`).join('')
    : '<tr><td colspan="3">Nenhuma vacina registrada.</td></tr>'
  const listaRemedios = remedios.length
    ? remedios.map((r) => `<li><strong>${escaparHtml(r.nome)}</strong>${r.dose ? ` · ${escaparHtml(r.dose)}` : ''}${r.frequencia ? ` · ${escaparHtml(r.frequencia)}` : ''}</li>`).join('')
    : '<li>Nenhum remédio em uso.</li>'
  const dados = [
    linha('Idade', idadeEmAnos(pet.nascimento) ?? 'Não informada'),
    linha('Sexo', pet.sexo ? (pet.sexo === 'femea' ? 'Fêmea' : 'Macho') : null),
    linha('Peso', pet.peso_atual ? `${String(pet.peso_atual).replace('.', ',')} kg` : null),
    linha('Castrado', pet.castrado === null ? 'Não informado' : pet.castrado ? 'Sim' : 'Não'),
    linha('Tutor', tutor),
    linha('Veterinário', pet.veterinario),
    linha('Alergias e condições', pet.alergias),
    linha('Observações', pet.observacoes),
  ].join('')

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#202630;margin:32px;font-size:12px}
    header{border-bottom:3px solid #9ad6f8;padding-bottom:16px;margin-bottom:20px}h1{font-size:25px;margin:0 0 5px}
    h2{font-size:16px;margin:24px 0 10px;color:#28607f}.sub{color:#5e6878;font-size:13px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:7px 20px}.linha{padding:7px 0;border-bottom:1px solid #e1e6ee;display:flex;justify-content:space-between;gap:12px}
    .linha span{color:#5e6878}.linha strong{text-align:right;white-space:pre-wrap}
    table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px;border-bottom:1px solid #e1e6ee}th{background:#e3f3fc}
    ul{padding-left:18px}li{margin:8px 0}.aviso{margin-top:28px;color:#6a7484;font-size:10px}
    @media print{body{margin:16mm}}
  </style></head><body>
    <header><h1>${escaparHtml(pet.nome)}</h1><div class="sub">${escaparHtml(identidade)} · Carteirinha de saúde PetLive · ${dataCurta(new Date().toISOString().slice(0, 10))}</div></header>
    <h2>Dados do pet</h2><div class="grid">${dados}</div>
    <h2>Vacinas</h2><table><thead><tr><th>Vacina</th><th>Aplicada</th><th>Próxima dose</th></tr></thead><tbody>${listaVacinas}</tbody></table>
    <h2>Remédios em uso</h2><ul>${listaRemedios}</ul>
    <p class="aviso">Dados informados pelo tutor. Esta carteirinha não substitui orientação veterinária.</p>
  </body></html>`
}
