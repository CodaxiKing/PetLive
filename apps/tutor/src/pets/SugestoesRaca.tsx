import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../theme/colors'
import { fontFamily } from '../theme/typography'
import type { Especie } from './types'

type Sugestao = { id: string; nome: string }

/** Consulta opcional: indisponibilidade do catálogo nunca bloqueia o formulário. */
export function SugestoesRaca({ especie, busca, onSelecionar }: {
  especie: Especie; busca: string; onSelecionar: (nome: string) => void
}) {
  const [consulta, setConsulta] = useState<{ chave: string; itens: Sugestao[] }>()
  const chave = JSON.stringify([especie, busca.trim()])
  useEffect(() => {
    let atual = true
    const timer = setTimeout(() => {
      void supabase.rpc('racas_sugerir', { p_especie: especie, p_busca: busca.trim().slice(0, 80) })
        .then(({ data, error }) => {
          if (atual) setConsulta({ chave, itens: !error && Array.isArray(data) ? data : [] })
        }, () => { if (atual) setConsulta({ chave, itens: [] }) })
    }, 300)
    return () => { atual = false; clearTimeout(timer) }
  }, [especie, busca, chave])
  const itens = consulta?.chave === chave ? consulta.itens : []
  if (!itens.length || itens.some(i => i.nome.toLocaleLowerCase() === busca.trim().toLocaleLowerCase())) return null
  return <View style={estilos.caixa}>
    <Text style={estilos.ajuda}>Sugestões de raça · você também pode digitar outra</Text>
    <View style={estilos.lista}>{itens.map(i => <Pressable key={i.id}
      accessibilityRole="button" accessibilityLabel={`Selecionar raça ${i.nome}`}
      onPress={() => onSelecionar(i.nome)} style={estilos.chip}>
      <Text style={estilos.nome}>{i.nome}</Text>
    </Pressable>)}</View>
  </View>
}

const estilos = StyleSheet.create({
  caixa: { marginBottom: 16, gap: 8 },
  ajuda: { fontFamily: fontFamily.regular, color: colors.text, fontSize: 12 },
  lista: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.primarySurface, borderRadius: 22, minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center' },
  nome: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.black },
})
