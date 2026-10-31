import { describe, expect, it } from 'vitest'
import { ANTECEDENCIAS_MIN, momentoAvisoDose, momentosDoAviso, textoAntecedencia, textoAntecedencias } from '../notificacoes/antecedencia'

describe('antecedência dos avisos', () => {
  it('vacina, vermífugo e consulta avisam 1 dia antes e 2 horas antes', () => {
    expect(textoAntecedencias(ANTECEDENCIAS_MIN.vacina)).toBe('1 dia antes e 2 horas antes')
    expect(textoAntecedencias(ANTECEDENCIAS_MIN.vermifugo)).toBe('1 dia antes e 2 horas antes')
    expect(textoAntecedencias(ANTECEDENCIAS_MIN.consulta)).toBe('1 dia antes e 2 horas antes')
    expect(textoAntecedencias(ANTECEDENCIAS_MIN.banho_tosa)).toBe('2 horas antes')
    expect(textoAntecedencia(10)).toBe('10 minutos antes')
    expect(textoAntecedencia(0)).toBe('Na hora')
  })

  it('os avisos saem antes da hora do próprio lembrete; só os que ainda vêm', () => {
    const agora = Date.parse('2026-10-30T12:00:00Z')
    expect(momentosDoAviso('vacina', '2026-11-05T14:30:00Z', agora).map((d) => d.toISOString())).toEqual([
      '2026-11-04T14:30:00.000Z',
      '2026-11-05T12:30:00.000Z',
    ])
    // A 1 dia já passou: fica só a de 2 horas antes.
    expect(momentosDoAviso('consulta', '2026-10-30T20:00:00Z', agora).map((d) => d.toISOString())).toEqual(['2026-10-30T18:00:00.000Z'])
  })

  it('lembrete em cima da hora avisa em 1 minuto; data inválida não agenda', () => {
    const agora = Date.parse('2026-10-30T12:00:00Z')
    expect(momentosDoAviso('vacina', '2026-10-30T13:00:00Z', agora).map((d) => d.getTime())).toEqual([agora + 60_000])
    expect(momentosDoAviso('outro', 'sem data', agora)).toEqual([])
  })

  it('remédio avisa 10 minutos antes da dose', () => {
    const agora = Date.parse('2026-10-30T12:00:00Z')
    expect(momentoAvisoDose(new Date('2026-10-30T14:00:00Z'), agora).toISOString()).toBe('2026-10-30T13:50:00.000Z')
    expect(momentoAvisoDose(new Date('2026-10-30T12:05:00Z'), agora).getTime()).toBe(agora + 5_000)
  })
})
