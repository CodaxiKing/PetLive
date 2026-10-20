import { Pressable, StyleSheet, View } from 'react-native'
import { colors } from '../theme/colors'

type Props = {
  ligado: boolean
  onToggle: () => void
  rotulo: string
  desabilitado?: boolean
}

/**
 * Interruptor da tela Avisos (protótipo Notificacoes.dc.html):
 * pílula preta quando ligado com knob azul à direita, cinza quando desligado.
 */
export function Interruptor({ ligado, onToggle, rotulo, desabilitado }: Props) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={rotulo}
      accessibilityState={{ checked: ligado, disabled: desabilitado ?? false }}
      disabled={desabilitado}
      hitSlop={8}
      onPress={onToggle}
      style={({ pressed }) => [
        estilos.trilho,
        ligado ? estilos.trilhoLigado : estilos.trilhoDesligado,
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[estilos.knob, ligado ? estilos.knobLigado : estilos.knobDesligado]} />
    </Pressable>
  )
}

const estilos = StyleSheet.create({
  trilho: {
    width: 52,
    height: 30,
    borderRadius: 15,
    padding: 3,
    flexShrink: 0,
    justifyContent: 'center',
  },
  trilhoLigado: { backgroundColor: colors.black, alignItems: 'flex-end' },
  trilhoDesligado: { backgroundColor: '#D5DBE3', alignItems: 'flex-start' },
  knob: { width: 24, height: 24, borderRadius: 12 },
  knobLigado: { backgroundColor: colors.primary },
  knobDesligado: { backgroundColor: colors.white },
})
