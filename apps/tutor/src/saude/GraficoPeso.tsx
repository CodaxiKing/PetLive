import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Line, Polygon, Polyline, Text as TextoSvg } from 'react-native-svg'
import { colors } from '../theme/colors'
import { typography } from '../theme/typography'
import { spacing } from '../theme/tokens'
import { formatarKg, type RegistroPeso } from './peso'

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const ALTURA = 128
const TOPO = 34 // y do ponto mais alto (peso máximo)
const BASE = 106 // y da linha de base
const MARGEM_X = 20

type Ponto = { x: number; y: number; peso: number; medido_em: string }

function calcularPontos(registros: RegistroPeso[], largura: number): Ponto[] {
  const n = registros.length
  const pesos = registros.map((r) => r.peso)
  const min = Math.min(...pesos)
  const max = Math.max(...pesos)
  const util = largura - MARGEM_X * 2

  return registros.map((r, i) => {
    const x = n === 1 ? largura / 2 : MARGEM_X + (i * util) / (n - 1)
    const y =
      max === min ? (TOPO + BASE) / 2 : BASE - ((r.peso - min) / (max - min)) * (BASE - TOPO)
    return { x, y, peso: r.peso, medido_em: r.medido_em }
  })
}

function mesCurto(iso: string): string {
  const [, m] = iso.split('-')
  return MESES_CURTOS[Number(m) - 1] ?? ''
}

function Desenho({ registros, largura }: { registros: RegistroPeso[]; largura: number }) {
  const pontos = calcularPontos(registros, largura)
  const pesos = registros.map((r) => r.peso)
  const min = Math.min(...pesos)
  const max = Math.max(...pesos)
  const primeiro = registros[0]
  const ultimo = registros[registros.length - 1]

  const linha = pontos.map((p) => `${p.x},${p.y}`).join(' ')
  const area =
    pontos.length > 1
      ? `${pontos[0].x},${BASE} ${linha} ${pontos[pontos.length - 1].x},${BASE}`
      : null

  // Rótulos: todos quando são poucos, só as pontas quando é muita gente.
  const rotulos = new Set<number>()
  if (pontos.length <= 6) {
    pontos.forEach((_, i) => rotulos.add(i))
  } else {
    rotulos.add(0)
    rotulos.add(pontos.length - 1)
  }

  const descricao = `Peso de ${formatarKg(min)} a ${formatarKg(max)} quilos, de ${mesCurto(
    primeiro.medido_em,
  )} a ${mesCurto(ultimo.medido_em)}`

  return (
    <Svg
      width={largura}
      height={ALTURA}
      viewBox={`0 0 ${largura} ${ALTURA}`}
      accessibilityLabel={descricao}
    >
      {[20, 54, 88].map((y) => (
        <Line
          key={y}
          x1={10}
          y1={y}
          x2={largura - 10}
          y2={y}
          stroke={colors.border}
          strokeWidth={1}
        />
      ))}

      {area ? <Polygon points={area} fill={colors.hero} fillOpacity={0.5} /> : null}
      {pontos.length > 1 ? (
        <Polyline
          points={linha}
          fill="none"
          stroke={colors.black}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      <Circle
        cx={pontos[pontos.length - 1].x}
        cy={pontos[pontos.length - 1].y}
        r={6}
        fill={colors.primary}
        stroke={colors.black}
        strokeWidth={2.5}
      />

      {pontos.map((p, i) =>
        rotulos.has(i) ? (
          <TextoSvg
            key={`${p.medido_em}-${i}`}
            x={p.x}
            y={123}
            fontSize={11}
            fill={colors.textMuted}
            textAnchor={i === 0 ? 'start' : i === pontos.length - 1 ? 'end' : 'middle'}
          >
            {mesCurto(p.medido_em)}
          </TextoSvg>
        ) : null,
      )}
    </Svg>
  )
}

/** Gráfico de evolução do peso (área + linha), estilo protótipo Peso.dc.html. */
export function GraficoPeso({ registros }: { registros: RegistroPeso[] }) {
  const [largura, setLargura] = useState(0)

  if (registros.length === 0) {
    return (
      <View style={estilos.card}>
        <Text style={estilos.vazio}>Ainda sem histórico de peso.</Text>
      </View>
    )
  }

  return (
    <View
      style={estilos.card}
      onLayout={(e) => setLargura(Math.round(e.nativeEvent.layout.width))}
    >
      {largura > 0 ? (
        <Desenho registros={registros} largura={largura} />
      ) : (
        <View style={estilos.respiro} />
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: 28,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 8,
    alignItems: 'center',
  },
  respiro: { height: ALTURA },
  vazio: {
    ...typography.body,
    color: colors.textMuted,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
})
