import { useEffect, useState } from 'react'
import { Animated, Pressable, StyleSheet } from 'react-native'
import { colors } from '../theme/colors'
import { useMovimentoReduzido } from './Animacoes'

type Props = {
  ligado: boolean
  onToggle: () => void
  rotulo: string
  desabilitado?: boolean
}

const TRILHO = 52
const KNOB = 24
const RESPIRO = 3
const CURSO = TRILHO - KNOB - RESPIRO * 2

/**
 * Interruptor (versão 2 do protótipo): pílula escura quando ligado, cinza
 * quando desligado, sempre com a bolinha branca. A bolinha desliza com mola
 * e a cor do trilho muda junto.
 */
export function Interruptor({ ligado, onToggle, rotulo, desabilitado }: Props) {
  const reduzido = useMovimentoReduzido()
  const valor = useState(() => new Animated.Value(ligado ? 1 : 0))[0]

  useEffect(() => {
    if (reduzido) {
      valor.setValue(ligado ? 1 : 0)
      return
    }
    const animacao = Animated.spring(valor, {
      toValue: ligado ? 1 : 0,
      useNativeDriver: false,
      speed: 20,
      bounciness: 6,
    })
    animacao.start()
    return () => animacao.stop()
  }, [ligado, reduzido, valor])

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={rotulo}
      accessibilityState={{ checked: ligado, disabled: desabilitado ?? false }}
      disabled={desabilitado}
      hitSlop={8}
      onPress={onToggle}
      style={({ pressed }) => [pressed && { opacity: 0.8 }]}
    >
      <Animated.View
        style={[
          estilos.trilho,
          { backgroundColor: valor.interpolate({ inputRange: [0, 1], outputRange: ['#D5DAE2', colors.black] }) },
        ]}
      >
        <Animated.View
          style={[
            estilos.knob,
            {
              backgroundColor: colors.white,
              transform: [{ translateX: valor.interpolate({ inputRange: [0, 1], outputRange: [0, CURSO] }) }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  )
}

const estilos = StyleSheet.create({
  trilho: {
    width: TRILHO,
    height: 30,
    borderRadius: 15,
    padding: RESPIRO,
    flexShrink: 0,
    justifyContent: 'center',
  },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2 },
})
