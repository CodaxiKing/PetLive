import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';

/**
 * Mapa (board: [APP-CLIENTE] Mapa, P1). A task de MapLibre entra na
 * sequência; aqui fica a estrutura e o aviso de construção.
 */
export default function Mapa() {
  return (
    <View style={estilos.tela}>
      <View style={estilos.topo}>
        <Text style={estilos.titulo}>Mapa</Text>
        <Text style={estilos.subtitulo}>
          Clínicas, petshops, banho e tosa e veterinários 24h por perto.
        </Text>
      </View>

      <View style={estilos.areaMapa}>
        <View style={estilos.filtros}>
          {['Clínicas', 'Banho', 'Petshop', '24h'].map((rotulo) => (
            <View key={rotulo} style={estilos.pilula}>
              <Text style={estilos.pilulaTexto}>{rotulo}</Text>
            </View>
          ))}
        </View>

        <Text style={estilos.construcao}>Mapa com MapLibre em breve</Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  topo: {
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  titulo: {
    ...typography.h1,
    fontWeight: '500',
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.1,
    color: colors.black,
  },
  subtitulo: {
    ...typography.caption,
    color: colors.textMuted,
  },
  areaMapa: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 24,
    gap: spacing.lg,
  },
  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pilula: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pilulaTexto: {
    ...typography.captionMedium,
    color: colors.text,
  },
  construcao: {
    ...typography.h3,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
});
