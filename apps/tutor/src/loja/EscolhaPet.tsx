import { ScrollView, StyleSheet, Text } from 'react-native'
import { Tocavel } from '../components/Animacoes'
import { AvatarPet } from '../pets/AvatarPet'
import type { Pet } from '../pets/types'
import { colors } from '../theme/colors'
import { fontFamily } from '../theme/typography'

/** Fileira de pets para escolher em quem vai a reserva. */
export function EscolhaPet({ pets, selecionado, onEscolher }: { pets: Pet[]; selecionado: string | null; onEscolher: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.linha}>
      {pets.map((p) => (
        <Tocavel key={p.id} accessibilityRole="radio" accessibilityState={{ selected: p.id === selecionado }} onPress={() => onEscolher(p.id)} style={[estilos.pet, p.id === selecionado && estilos.ativo]}>
          <AvatarPet especie={p.especie} foto={p.foto_url} size={30} />
          <Text style={[estilos.texto, p.id === selecionado && estilos.claro]}>{p.nome}</Text>
        </Tocavel>
      ))}
    </ScrollView>
  )
}

const estilos = StyleSheet.create({
  linha: { gap: 8 },
  pet: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: 14, height: 40, borderRadius: 20, backgroundColor: colors.background },
  ativo: { backgroundColor: colors.black },
  texto: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.black },
  claro: { color: colors.white },
})
