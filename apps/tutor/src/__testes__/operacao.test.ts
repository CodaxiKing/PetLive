import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) } }))

const { conferirOperacao, consultarOperacao, reiniciarOperacao, textoPrevisao } = await import('../lib/operacao')

type Regra = { status?: number; corpo?: unknown; falha?: boolean }
function servidor(api: Regra, internet: Regra = { status: 204 }) {
  return (async (url: string) => {
    const r = url.includes('generate_204') ? internet : api
    if (r.falha) throw new TypeError('Network request failed')
    return new Response(r.corpo === undefined ? null : JSON.stringify(r.corpo), { status: r.status ?? 200 })
  }) as unknown as typeof fetch
}

beforeEach(() => reiniciarOperacao())

describe('operação da API', () => {
  it('no ar, em manutenção planejada, fora do ar ou sem internet', async () => {
    expect(await consultarOperacao(servidor({ corpo: { banco: 'ok', manutencao: { ativa: false } } }))).toBe('ok')
    expect(await consultarOperacao(servidor({ corpo: { manutencao: { ativa: true, mensagem: 'Troca de servidor', previsao: null } } }))).toEqual({
      planejada: { mensagem: 'Troca de servidor', previsao: null },
    })
    expect(await consultarOperacao(servidor({ status: 503 }))).toBe('fora')
    expect(await consultarOperacao(servidor({ falha: true }))).toBe('fora')
    expect(await consultarOperacao(servidor({ falha: true }, { falha: true }))).toBe('sem_internet')
    // 404 (função ainda não publicada) não é queda.
    expect(await consultarOperacao(servidor({ status: 404 }))).toBe('ok')
  })

  it('só mostra manutenção depois de duas falhas seguidas e volta sozinho', async () => {
    const fora = servidor({ status: 502 })
    expect((await conferirOperacao(fora)).tipo).toBe('ok')
    expect(await conferirOperacao(fora)).toEqual({ tipo: 'manutencao', planejada: false, detalhes: { mensagem: null, previsao: null } })
    expect((await conferirOperacao(servidor({ corpo: { banco: 'ok' } }))).tipo).toBe('ok')
  })

  it('manutenção planejada aparece na primeira consulta; sem internet não é manutenção', async () => {
    const planejada = await conferirOperacao(servidor({ corpo: { manutencao: { ativa: true, mensagem: null, previsao: '2026-10-30T18:30:00Z' } } }))
    expect(planejada.tipo).toBe('manutencao')
    expect((await conferirOperacao(servidor({ falha: true }, { falha: true }))).tipo).toBe('sem_internet')
  })

  it('texto da previsão de volta', () => {
    const agora = new Date('2026-10-30T12:00:00')
    expect(textoPrevisao(new Date('2026-10-30T15:30:00').toISOString(), agora)).toBe('Previsão de volta: hoje às 15:30')
    expect(textoPrevisao(new Date('2026-11-02T09:00:00').toISOString(), agora)).toBe('Previsão de volta: 02/11 às 09:00')
    expect(textoPrevisao(null, agora)).toBeNull()
  })
})
