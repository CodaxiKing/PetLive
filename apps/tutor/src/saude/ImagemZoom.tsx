import { useMemo, useState } from 'react'
import { Animated, PanResponder, StyleSheet, type GestureResponderEvent } from 'react-native'

const ESCALA_MAXIMA = 4
const TOQUE_DUPLO_MS = 280

function distancia(e: GestureResponderEvent): number {
  const [a, b] = e.nativeEvent.touches
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)
}

/**
 * Imagem que ocupa o espaço e aceita zoom: pinça com dois dedos, arrastar
 * quando ampliada e toque duplo para ampliar ou voltar. Só PanResponder,
 * igual no Android e no iOS.
 */
export function ImagemZoom({ uri, rotulo }: { uri: string; rotulo: string }) {
  const [{ escala, x, y }] = useState(() => ({ escala: new Animated.Value(1), x: new Animated.Value(0), y: new Animated.Value(0) }))

  const respondedor = useMemo(() => {
    // Estado do gesto: vive no closure do respondedor, criado uma vez.
    const estado = { escala: 1, x: 0, y: 0, distanciaInicial: 0, ultimoToque: 0 }
    function aplicar(novaEscala: number, novoX: number, novoY: number, animado = false) {
      estado.escala = novaEscala
      estado.x = novoX
      estado.y = novoY
      if (animado) {
        Animated.parallel([
          Animated.spring(escala, { toValue: novaEscala, useNativeDriver: true }),
          Animated.spring(x, { toValue: novoX, useNativeDriver: true }),
          Animated.spring(y, { toValue: novoY, useNativeDriver: true }),
        ]).start()
      } else {
        escala.setValue(novaEscala)
        x.setValue(novoX)
        y.setValue(novoY)
      }
    }
    let base = { escala: 1, x: 0, y: 0 }

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        base = { escala: estado.escala, x: estado.x, y: estado.y }
        estado.distanciaInicial = e.nativeEvent.touches.length === 2 ? distancia(e) : 0
        const agora = Date.now()
        if (e.nativeEvent.touches.length === 1 && agora - estado.ultimoToque < TOQUE_DUPLO_MS) {
          aplicar(estado.escala > 1 ? 1 : 2.5, 0, 0, true)
          estado.ultimoToque = 0
          return
        }
        estado.ultimoToque = agora
      },
      onPanResponderMove: (e, g) => {
        if (e.nativeEvent.touches.length === 2) {
          // O segundo dedo pode chegar depois do primeiro.
          if (!estado.distanciaInicial) {
            estado.distanciaInicial = distancia(e)
            base = { escala: estado.escala, x: estado.x, y: estado.y }
            return
          }
          const nova = Math.min(ESCALA_MAXIMA, Math.max(1, (base.escala * distancia(e)) / estado.distanciaInicial))
          aplicar(nova, base.x, base.y)
        } else if (estado.escala > 1) {
          aplicar(estado.escala, base.x + g.dx / estado.escala, base.y + g.dy / estado.escala)
        }
      },
      onPanResponderRelease: () => {
        estado.distanciaInicial = 0
        if (estado.escala <= 1) aplicar(1, 0, 0, true)
      },
    })
  }, [escala, x, y])

  return (
    <Animated.Image
      {...respondedor.panHandlers}
      source={{ uri }}
      accessibilityLabel={rotulo}
      accessibilityHint="Use dois dedos ou toque duas vezes para ampliar"
      resizeMode="contain"
      style={[estilos.imagem, { transform: [{ scale: escala }, { translateX: x }, { translateY: y }] }]}
    />
  )
}

const estilos = StyleSheet.create({
  imagem: { flex: 1, width: '100%' },
})
