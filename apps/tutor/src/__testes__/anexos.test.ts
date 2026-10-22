import { describe, expect, it } from 'vitest'
import {
  caminhoAnexo,
  ehErroDeRede,
  filtrarAnexos,
  mimeAceito,
  ordenarAnexos,
  TAMANHO_MAXIMO,
  tituloAnexo,
  validarArquivo,
  type Anexo,
} from '../saude/anexosRegras'

function anexo(id: string, tipo: Anexo['tipo'], data: string, criado_em = `${data}T10:00:00Z`): Anexo {
  return { id, pet_id: 'p1', tipo, titulo: null, data, arquivo_path: `u/anexos/p1/${id}.jpg`, mime: 'image/jpeg', criado_em }
}

describe('mimeAceito', () => {
  it('aceita JPG, PNG e HEIC pelo mime', () => {
    expect(mimeAceito('image/jpeg', 'file:///a')).toBe('image/jpeg')
    expect(mimeAceito('image/jpg', 'file:///a')).toBe('image/jpeg')
    expect(mimeAceito('image/png', 'file:///a')).toBe('image/png')
    expect(mimeAceito('image/heic', 'file:///a')).toBe('image/heic')
    expect(mimeAceito('image/heif', 'file:///a')).toBe('image/heic')
  })
  it('sem mime, olha a extensão', () => {
    expect(mimeAceito(undefined, 'file:///foto.JPEG')).toBe('image/jpeg')
    expect(mimeAceito(undefined, 'file:///foto.heic?x=1')).toBe('image/heic')
    expect(mimeAceito(undefined, 'file:///foto.gif')).toBeNull()
  })
  it('recusa outros formatos', () => {
    expect(mimeAceito('image/webp', 'file:///foto.jpg')).toBeNull()
    expect(mimeAceito('application/pdf', 'file:///exame.pdf')).toBeNull()
  })
})

describe('validarArquivo', () => {
  it('recusa formato fora da lista com mensagem clara', () => {
    expect(validarArquivo(null, 100)).toMatch(/JPG, PNG ou HEIC/)
  })
  it('recusa acima de 10 MB e aceita no limite', () => {
    expect(validarArquivo('image/jpeg', TAMANHO_MAXIMO + 1)).toMatch(/10 MB/)
    expect(validarArquivo('image/jpeg', TAMANHO_MAXIMO)).toBeNull()
  })
  it('sem tamanho informado, deixa a checagem para os bytes', () => {
    expect(validarArquivo('image/png', undefined)).toBeNull()
  })
})

describe('caminhoAnexo', () => {
  it('começa pela pasta do tutor e fica na pasta do pet', () => {
    expect(caminhoAnexo('uid', 'pet', 'image/png', 123)).toBe('uid/anexos/pet/123.png')
    expect(caminhoAnexo('uid', 'pet', 'image/jpeg', 1)).toBe('uid/anexos/pet/1.jpg')
    expect(caminhoAnexo('uid', 'pet', 'image/heic', 1)).toBe('uid/anexos/pet/1.heic')
  })
})

describe('ordenarAnexos e filtrarAnexos', () => {
  const lista = [
    anexo('a', 'vacina', '2026-01-10'),
    anexo('b', 'exame', '2026-05-02'),
    anexo('c', 'exame', '2026-01-10', '2026-01-11T09:00:00Z'),
  ]
  it('do mais recente para o mais antigo, desempatando pelo envio', () => {
    expect(ordenarAnexos(lista).map((a) => a.id)).toEqual(['b', 'c', 'a'])
  })
  it('filtra por tipo e sem filtro devolve todos', () => {
    expect(filtrarAnexos(lista, 'vacina').map((a) => a.id)).toEqual(['a'])
    expect(filtrarAnexos(lista, null)).toHaveLength(3)
  })
})

describe('tituloAnexo', () => {
  it('usa o título ou, sem ele, o nome do tipo', () => {
    expect(tituloAnexo({ tipo: 'exame', titulo: 'Hemograma' })).toBe('Hemograma')
    expect(tituloAnexo({ tipo: 'vacina', titulo: '  ' })).toBe('Cartão de vacina')
    expect(tituloAnexo({ tipo: 'exame', titulo: null })).toBe('Exame')
  })
})

describe('ehErroDeRede', () => {
  it('reconhece queda de conexão', () => {
    expect(ehErroDeRede('TypeError: Network request failed')).toBe(true)
    expect(ehErroDeRede('Failed to fetch')).toBe(true)
    expect(ehErroDeRede('new row violates row-level security policy')).toBe(false)
  })
})
