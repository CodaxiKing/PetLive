import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { VERSAO_APP } from '../lib/configApp';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { BotaoPrimario } from './BotaoPrimario';
import { Mascote } from './Mascote';

const LOJA =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/br/search?term=petlive'
    : 'https://play.google.com/store/apps/details?id=app.petlive.tutor';

/**
 * Versão abaixo da mínima definida no painel (área Sistema): o app pede para
 * atualizar antes de seguir. Os dados do tutor ficam guardados na conta.
 */
export function TelaAtualizar() {
  return (
    <View style={estilos.tela}>
      <View style={estilos.centro}>
        <Mascote especie="cao" size={180} />
        <Text style={estilos.titulo}>Atualize o PetLive</Text>
        <Text style={estilos.texto}>
          Esta versão ({VERSAO_APP}) não é mais compatível. A atualização é rápida e seus pets, vacinas e lembretes continuam
          na sua conta.
        </Text>
      </View>
      <BotaoPrimario titulo="Atualizar agora" onPress={() => Linking.openURL(LOJA).catch(() => undefined)} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.hero, paddingHorizontal: 24, paddingTop: 80, paddingBottom: 32 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  titulo: { fontFamily: fontFamily.bold, fontSize: 30, letterSpacing: -0.8, color: colors.black, textAlign: 'center' },
  texto: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: '#2B3A4A', textAlign: 'center' },
});
