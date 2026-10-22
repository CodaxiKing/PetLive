import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Supabase falso em memória: storage com data de criação e tabela `anexos`.
// As falhas de rede de cada etapa ligam e desligam por flag.
const arquivos = new Map<string, string>()
const registros: { arquivo_path: string }[] = []
const pets = [{ id: 'p1' }]
const falhas = { insert: false, remove: false }

function listar(prefixo: string) {
  const nomes = new Map<string, { name: string; id: string | null; created_at?: string }>()
  for (const [caminho, criado] of arquivos) {
    if (!caminho.startsWith(`${prefixo}/`)) continue
    const [nome, ...resto] = caminho.slice(prefixo.length + 1).split('/')
    nomes.set(nome, resto.length ? { name: nome, id: null } : { name: nome, id: caminho, created_at: criado })
  }
  return [...nomes.values()]
}

const bucket = {
  upload: async (caminho: string) => {
    arquivos.set(caminho, new Date().toISOString())
    return { data: { path: caminho }, error: null }
  },
  remove: async (caminhos: string[]) => {
    if (falhas.remove) throw new TypeError('Network request failed')
    for (const c of caminhos) arquivos.delete(c)
    return { data: [], error: null }
  },
  list: async (prefixo: string) => ({ data: listar(prefixo), error: null }),
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: { from: () => bucket },
    from: (tabela: string) => ({
      select: async () => ({ data: tabela === 'pets' ? pets : registros, error: null }),
      insert: () => ({
        select: () => ({
          single: async () => (falhas.insert ? { data: null, error: { message: 'TypeError: Network request failed' } } : { data: {}, error: null }),
        }),
      }),
    }),
  },
}))

const { enviarAnexo, limparAnexosOrfaos } = await import('../saude/anexos')
const { FOLGA_ARQUIVO_SEM_REGISTRO } = await import('../saude/anexosRegras')

const foto = { uri: 'file:///cartao.jpg', mimeType: 'image/jpeg', tamanho: 3 }
const dados = { tipo: 'vacina' as const, titulo: null, data: '2026-10-22' }

describe('foto órfã no storage', () => {
  beforeEach(() => {
    arquivos.clear()
    registros.length = 0
    falhas.insert = false
    falhas.remove = false
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-22T12:00:00Z'))
    vi.stubGlobal('fetch', async () => ({ arrayBuffer: async () => new ArrayBuffer(3) }))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('o insert falha, a remoção falha e o arquivo some na limpeza depois de 24 h, com o pet ainda existindo', async () => {
    falhas.insert = true
    falhas.remove = true
    await expect(enviarAnexo('u', 'p1', foto, dados)).rejects.toMatchObject({ tentarDeNovo: true })
    expect([...arquivos.keys()]).toEqual([`u/anexos/p1/${Date.now()}.jpg`])

    // A rede volta. Antes da folga, a limpeza poupa o arquivo (pode ser envio em andamento).
    falhas.remove = false
    vi.setSystemTime(Date.now() + FOLGA_ARQUIVO_SEM_REGISTRO - 60_000)
    await limparAnexosOrfaos('u')
    expect(arquivos.size).toBe(1)

    vi.setSystemTime(Date.now() + 2 * 60_000)
    await limparAnexosOrfaos('u')
    expect(arquivos.size).toBe(0)
  })

  it('não apaga o arquivo que tem registro, mesmo antigo', async () => {
    await enviarAnexo('u', 'p1', foto, dados)
    registros.push({ arquivo_path: [...arquivos.keys()][0] })
    vi.setSystemTime(Date.now() + 2 * FOLGA_ARQUIVO_SEM_REGISTRO)
    await limparAnexosOrfaos('u')
    expect(arquivos.size).toBe(1)
  })
})
