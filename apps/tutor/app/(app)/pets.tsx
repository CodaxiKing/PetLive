import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { Mascote } from '../../src/components/Mascote';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';

/**
 * Lista "Meus pets" (board: [APP-CLIENTE] Pets).
 * Por enquanto mostra o estado vazio: a próxima task é ligar no Supabase.
 */
export default function MeusPets() {
  const router = useRouter();

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
      <Text style={estilos.titulo}>Meus pets</Text>
      <Text style={estilos.subtitulo}>Cadastre o primeiro e acompanhe vacinas, peso e lembretes dele.</Text>

      <View style={estilos.estadoVazio}>
        <View style={estilos.avatares}>
          <View style={[estilos.avatar, { backgroundColor: colors.primary }]}>
            <Mascote especie="cao" size={72} recorte />
          </View>
          <View style={[estilos.avatar, { backgroundColor: colors.premiumSurface }]}>
            <Mascote especie="gato" size={72} recorte />
          </View>
        </View>

        <Text style={estilos.vazioTitulo}>Nenhum pet por aqui ainda</Text>
        <Text style={estilos.vazioTexto}>
          Em poucos toques você cadastra nome, espécie, raça e nascimento, e o PetLive monta a carteira de saúde.
        </Text>
      </View>

      <BotaoPrimario titulo="Cadastrar pet" variante="pata" onPress={() => {}} />

      <Text style={estilos.rodape}>Limite do plano grátis: 1 pet. Vários pets entram no Premium.</Text>

      {/* Mantém o menu inferior flutuante livre de sobreposição. */}
      <View style={estilos.respiro} />
      <Text style={estilos.atalho} onPress={() => router.push('/inicio')}>
        ← Voltar ao Início
      </Text>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  conteudo: {
    paddingHorizontal: 24,
    paddingTop: 54,
    gap: spacing.lg,
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
  estadoVazio: {
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  avatares: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.xs,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: 'hidden',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  vazioTitulo: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.black,
    textAlign: 'center',
  },
  vazioTexto: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  rodape: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  atalho: {
    ...typography.captionMedium,
    color: colors.primaryDeep,
    textAlign: 'center',
  },
  respiro: {
    height: 60,
  },
});
