import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { components, spacing } from '../theme/tokens';
import { usePets } from './PetsProvider';
import { dataParaExibicao, idadeEmAnos } from './types';

/** Aba "Geral": ficha cadastral do pet selecionado. */
export function AbaGeral() {
  const { petAtivo } = usePets();
  if (!petAtivo) return null;

  const linhas: { rotulo: string; valor: string; idRota?: string }[] = [
    { rotulo: 'Espécie', valor: petAtivo.especie },
    { rotulo: 'Raça', valor: petAtivo.raca ?? '—' },
    { rotulo: 'Sexo', valor: petAtivo.sexo === 'macho' ? 'Macho' : 'Fêmea' },
    { rotulo: 'Nascimento', valor: dataParaExibicao(petAtivo.nascimento) || '—' },
    { rotulo: 'Idade', valor: idadeEmAnos(petAtivo.nascimento) ?? '—' },
    {
      rotulo: 'Peso',
      valor: petAtivo.peso_atual != null ? `${petAtivo.peso_atual} kg` : '—',
      idRota: petAtivo.id,
    },
    { rotulo: 'Castrado', valor: petAtivo.castrado ? 'Sim' : 'Não' },
  ];

  return (
    <ScrollView
      contentContainerStyle={estilos.conteudo}
      showsVerticalScrollIndicator={false}
    >
      <View style={components.card}>
        {linhas.map((linha, i) => {
          const conteudo = (
            <>
              <Text style={estilos.rotulo}>{linha.rotulo}</Text>
              <Text style={estilos.valor}>{linha.valor}</Text>
            </>
          );
          const estiloLinha = [estilos.linha, i === linhas.length - 1 && estilos.ultima];

          // A linha do peso abre a tela de peso (gráfico e histórico).
          if (linha.idRota) {
            return (
              <Pressable
                key={linha.rotulo}
                accessibilityRole="button"
                accessibilityLabel={`Peso: ${linha.valor}. Ver gráfico e histórico.`}
                onPress={() =>
                  router.push({ pathname: '/pet/[id]/peso', params: { id: linha.idRota! } })
                }
                style={({ pressed }) => [...estiloLinha, pressed && { opacity: 0.6 }]}
              >
                <Text style={estilos.rotulo}>{linha.rotulo}</Text>
                <View style={estilos.valorDireita}>
                  <Text style={estilos.valor}>{linha.valor}</Text>
                  <Text style={estilos.seta}>›</Text>
                </View>
              </Pressable>
            );
          }

          return (
            <View key={linha.rotulo} style={estiloLinha}>
              {conteudo}
            </View>
          );
        })}
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
  valorDireita: { flexDirection: 'row', alignItems: 'center', maxWidth: '70%' },
  seta: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.xs },
  rotulo: { ...typography.body, color: colors.textMuted },
  valor: {
    ...typography.bodyMedium,
    color: colors.text,
    textTransform: 'capitalize',
    maxWidth: '60%',
    textAlign: 'right',
  },
});
