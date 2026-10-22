import { describe, expect, it } from 'vitest'
import {
  diasDoPeriodo,
  diasIso,
  economiaAnual,
  ehMotivo,
  mostraTeste,
  primeiraCobranca,
  resultadoDoErro,
  situacao,
  type Assinatura,
  type PlanoLoja,
} from '../premium/planos'

const mensal: PlanoLoja = { periodo: 'mensal', produto: 'petlive_premium_mensal', preco: 'R$ 19,90', valor: 19.9, diasTeste: 7 }
const anual: PlanoLoja = { periodo: 'anual', produto: 'petlive_premium_anual', preco: 'R$ 159,90', valor: 159.9, diasTeste: 7 }

describe('teste grátis', () => {
  it('aparece só para quem nunca assinou e quando a loja oferece', () => {
    expect(mostraTeste(mensal, false)).toBe(true)
    expect(mostraTeste(mensal, true)).toBe(false)
    expect(mostraTeste({ ...mensal, diasTeste: 0 }, false)).toBe(false)
    expect(mostraTeste(null, false)).toBe(false)
  })

  it('a primeira cobrança é depois dos dias do teste', () => {
    expect(primeiraCobranca(7, new Date(2026, 9, 22, 10)).toDateString()).toBe(new Date(2026, 9, 29).toDateString())
  })

  it('lê o período do teste das duas lojas', () => {
    expect(diasDoPeriodo({ unit: 'week', value: 1 })).toBe(7)
    expect(diasDoPeriodo({ unit: 'day', value: 7 })).toBe(7)
    expect(diasDoPeriodo(null)).toBe(0)
    expect(diasIso('P7D')).toBe(7)
    expect(diasIso('P1W')).toBe(7)
    expect(diasIso('P1M')).toBe(30)
    expect(diasIso('xyz')).toBe(0)
  })
})

describe('planos', () => {
  it('economia do anual vem dos preços da loja', () => {
    expect(economiaAnual(mensal, anual)).toBe(33)
    expect(economiaAnual(mensal, { ...anual, valor: null })).toBeNull()
    expect(economiaAnual(mensal, { ...anual, valor: 300 })).toBeNull()
  })

  it('reconhece os motivos dos convites', () => {
    expect(ehMotivo('cartao_vacina')).toBe(true)
    expect(ehMotivo('pdf_linha_do_tempo')).toBe(true)
    expect(ehMotivo('outro')).toBe(false)
  })
})

describe('resultado da compra', () => {
  it('desistir na folha da loja não é erro', () => {
    expect(resultadoDoErro({ code: 'user-cancelled' })).toEqual({ tipo: 'cancelada' })
  })

  it('pagamento pendente e falhas viram mensagens claras', () => {
    expect(resultadoDoErro({ code: 'deferred-payment' })).toEqual({ tipo: 'pendente' })
    expect(resultadoDoErro({ code: 'network-error' })).toMatchObject({ tipo: 'erro' })
    const r = resultadoDoErro({ code: 'qualquer' })
    expect(r.tipo === 'erro' && r.mensagem).toContain('nada foi cobrado')
  })
})

describe('Minha assinatura', () => {
  const base: Assinatura = {
    loja: 'app_store',
    produto: 'petlive_premium_anual',
    periodo: 'anual',
    status: 'ativa',
    renova_auto: true,
    renews_at: '2027-10-22T12:00:00Z',
    trial_ends_at: null,
    cancel_at: null,
    vale: true,
  }

  it('descreve renovação, cancelamento e falha', () => {
    expect(situacao(base)).toBe('Renova automaticamente em 22/10/2027.')
    expect(situacao({ ...base, status: 'cancelando' })).toContain('vale até 22/10/2027')
    expect(situacao({ ...base, status: 'pagamento_falhou' })).toContain('não conseguiu cobrar')
    expect(situacao({ ...base, status: 'em_teste' })).toContain('Teste grátis até 22/10/2027')
    expect(situacao({ ...base, status: 'expirada', vale: false })).toContain('plano Grátis')
  })
})
