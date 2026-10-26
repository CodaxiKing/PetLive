import { useEffect, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { Interruptor } from '../components/Interruptor'
import { colors } from '../theme/colors'
import { typography } from '../theme/typography'
import { definirOcultarRemedio, ocultarRemedio } from './proximo'
import { atualizarWidget } from './tarefaWidget'

/** Widget da tela inicial (BUSINESS.md 5.34): esconder o nome do remédio, que aparece na tela bloqueada. */
export function ConfigurarWidget() {
  const [ocultar, setOcultar] = useState<boolean | null>(null)
  useEffect(() => {
    ocultarRemedio().then(setOcultar, () => setOcultar(false))
  }, [])
  if (Platform.OS !== 'android' || ocultar === null) return null
  return (
    <View style={s.card}>
      <View style={s.flex}>
        <Text accessibilityRole="header" style={s.titulo}>Widget da tela inicial</Text>
        <Text style={s.texto}>Mostra a próxima dose ou vacina com o botão Feito. Segure a tela inicial do celular e escolha Widgets para adicionar.</Text>
      </View>
      <View style={s.linha}>
        <Text style={[s.texto, s.flex]}>Esconder o nome do remédio no widget</Text>
        <Interruptor
          ligado={ocultar}
          rotulo="Esconder o nome do remédio no widget"
          onToggle={() => {
            const novo = !ocultar
            setOcultar(novo)
            definirOcultarRemedio(novo).then(() => atualizarWidget(), () => setOcultar(!novo))
          }}
        />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.background, padding: 18, borderRadius: 24, gap: 12 },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titulo: { ...typography.h3, color: colors.black },
  texto: { ...typography.body, color: colors.textMuted },
})
