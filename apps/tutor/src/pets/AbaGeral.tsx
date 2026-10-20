import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { components, spacing } from '../theme/tokens';
import { usePets } from './PetsProvider';
import { dataParaExibicao, idadeEmAnos } from './types';

/** Aba "Geral": ficha cadastral do pet selecionado. */
export function AbaGeral() {
  const { petAtivo } = usePets();
  if (!petAtivo) return null;

  const linhas: { rotulo: string; valor: string }[] = [
    { rotulo: 'Espécie', valor: petAtivo.especie },
    { rotulo: 'Raça', valor: petAtivo.raca ?? '—' },
    { rotulo: 'Sexo', valor: petAtivo.sexo === 'macho' ? 'Macho' : 'Fêmea' },
    { rotulo: 'Nascimento', valor: dataParaExibicao(petAtivo.nascimento) || '—' },
    { rotulo: 'Idade', valor: idadeEmAnos(petAtivo.nascimento) ?? '—' },
    { rotulo: 'Peso', valor: petAtivo.peso_atual != null ? `${petAtivo.peso_atual} kg` : '—' },
    { rotulo: 'Castrado', valor: petAtivo.castrado ? 'Sim' : 'Não' },
  ];

  return (
    <ScrollView
      contentContainerStyle={estilos.conteudo}
      showsVerticalScrollIndicator={false}
    >
      <View style={components.card}>
        {linhas.map((linha, i) => (
          <View
            key={linha.rotulo}
            style={[estilos.linha, i === linhas.length - 1 && estilos.ultima]}
          >
            <Text style={estilos.rotulo}>{linha.rotulo}</Text>
            <Text style={estilos.valor}>{linha.valor}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: spacing.xl, paddingBottom: 140, gap: spacing.lg },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ultima: { borderBottomWidth: 0 },
  rotulo: { ...typography.body, color: colors.textMuted },
  valor: {
    ...typography.bodyMedium,
    color: colors.text,
    textTransform: 'capitalize',
    maxWidth: '60%',
    textAlign: 'right',
  },
});
