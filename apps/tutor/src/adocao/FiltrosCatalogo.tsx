import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BotaoPrimario } from '../components/BotaoPrimario';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { FILTROS_ADOCAO, type FiltrosAdocao } from './modelo';
export function FiltrosCatalogo({ valor, alterar, aplicar }: { valor: FiltrosAdocao; alterar: (v: FiltrosAdocao) => void; aplicar: () => void }) {
  function grupo(campo: 'especie' | 'porte' | 'sexo', titulo: string, opcoes: [string, string][]) {
    return <View style={s.grupo}><Text style={s.titulo}>{titulo}</Text><View style={s.opcoes}>{opcoes.map(([id, rotulo]) =>
      <Pressable key={id} accessibilityRole="radio" accessibilityLabel={`${titulo}: ${rotulo}`} accessibilityState={{ checked: valor[campo] === id }}
        onPress={() => alterar({ ...valor, [campo]: id })} style={[s.opcao, valor[campo] === id && s.ativo]}><Text style={s.texto}>{rotulo}</Text></Pressable>)}</View></View>;
  }
  return <View style={s.card}>
    {grupo('especie', 'Espécie', [['', 'Todas'], ['cao', 'Cães'], ['gato', 'Gatos']])}
    {grupo('porte', 'Porte', [['', 'Todos'], ['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']])}
    {grupo('sexo', 'Sexo', [['', 'Todos'], ['macho', 'Macho'], ['femea', 'Fêmea']])}
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: valor.filhote }} onPress={() => alterar({ ...valor, filhote: !valor.filhote })} style={[s.opcao, valor.filhote && s.ativo]}><Text style={s.texto}>{valor.filhote ? '✓ ' : ''}Filhotes (até 1 ano)</Text></Pressable>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: valor.favoritos }} onPress={() => alterar({ ...valor, favoritos: !valor.favoritos })} style={[s.opcao, valor.favoritos && s.ativo]}><Text style={s.texto}>{valor.favoritos ? '✓ ' : ''}Somente meus favoritos</Text></Pressable>
    <Text style={s.titulo}>Cidade</Text><TextInput accessibilityLabel="Cidade dos pets para adoção" placeholder="Todas as cidades" placeholderTextColor={colors.textMuted} value={valor.cidade} maxLength={80} onChangeText={(cidade) => alterar({ ...valor, cidade })} style={s.campo} autoCapitalize="words" returnKeyType="search" onSubmitEditing={aplicar} />
    <Text style={s.texto}>A idade usa o nascimento informado pela ONG. Pets sem essa data não entram no filtro de filhotes.</Text>
    <BotaoPrimario titulo="Aplicar filtros" onPress={aplicar} /><Pressable accessibilityRole="button" style={s.opcao} onPress={() => alterar({ ...FILTROS_ADOCAO })}><Text style={s.texto}>Limpar seleção</Text></Pressable>
  </View>;
}
const s = StyleSheet.create({ card: { borderRadius: 24, backgroundColor: colors.background, padding: 18, gap: 14 },
  grupo: { gap: 8 }, titulo: { ...typography.body, fontWeight: '700', color: colors.black }, texto: { ...typography.body, color: colors.textMuted },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, opcao: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 20, justifyContent: 'center' },
  ativo: { backgroundColor: colors.hero, borderColor: colors.primaryDeep }, campo: { ...typography.body, color: colors.black, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, minHeight: 48 } });
