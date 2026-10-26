import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CodigoQR } from '../components/CodigoQR';
import { Icone } from '../components/Icone';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';

/** A mesma composição aparece na prévia e no PNG da coleira. */
export function EtiquetaColeira({ nome, url }: { nome: string; url: string }) {
  const [largura, setLargura] = useState(0);
  const tamanhoQr = Math.min(230, Math.max(0, largura - 50));

  return (
    <View style={s.cartao} onLayout={({ nativeEvent }) => setLargura(nativeEvent.layout.width)}>
      <View style={s.cabecalho}>
        <View style={s.selo}>
          <Icone nome="pata" size={14} cor={colors.primaryDeep} />
          <Text style={s.seloTexto}>TENHO UMA FAMÍLIA</Text>
        </View>
        <Text style={s.nome}>{nome}</Text>
        <Svg width="100%" height={22} viewBox="0 0 320 22" preserveAspectRatio="none" style={s.onda}>
          <Path d="M0 12C40 0 60 0 100 12S160 24 200 12 280 0 320 12V22H0Z" fill={colors.white} />
        </Svg>
      </View>

      <View style={s.corpo}>
        <View style={s.moldura}>
          {tamanhoQr > 0 ? <CodigoQR valor={url} tamanho={tamanhoQr} rotulo={`Escaneie para ajudar ${nome} a voltar para casa`} /> : null}
        </View>
        <Text style={s.chamada}>Me ajuda a voltar pra casa?</Text>
        <Text style={s.instrucao}>Aponte a câmera para o QR e{ '\n' }veja como falar com a minha família.</Text>
      </View>

      <View style={s.rodape}>
        <View style={s.marca}>
          <View style={s.iconeMarca}><Icone nome="pata" size={18} cor={colors.primaryDeep} /></View>
          <Text style={s.marcaTexto}>PetLive</Text>
        </View>
        <Text style={s.assinatura}>Sempre perto de quem ama.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  cartao: { width: '100%', maxWidth: 360, alignSelf: 'center', borderRadius: 28, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primarySurface },
  cabecalho: { backgroundColor: colors.primary, alignItems: 'center', paddingTop: 22, paddingHorizontal: 20, paddingBottom: 34 },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primarySurface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  seloTexto: { fontFamily: fontFamily.bold, fontSize: 9, letterSpacing: 1, color: colors.primaryDeep },
  nome: { fontFamily: fontFamily.bold, fontSize: 32, lineHeight: 40, color: colors.black, textAlign: 'center', marginTop: 10 },
  onda: { position: 'absolute', bottom: -1, left: 0 },
  corpo: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 22 },
  // O branco de proteção e os módulos do QR permanecem intactos, sem desenhos sobrepostos.
  moldura: { padding: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 22, backgroundColor: colors.white },
  chamada: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 24, textAlign: 'center', color: colors.black, marginTop: 18 },
  instrucao: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 18, textAlign: 'center', color: colors.textMuted, marginTop: 6 },
  rodape: { alignItems: 'center', backgroundColor: colors.primarySurface, paddingVertical: 16, paddingHorizontal: 16, gap: 5 },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  iconeMarca: { backgroundColor: colors.white, width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  marcaTexto: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.primaryDeep, letterSpacing: -0.7 },
  assinatura: { fontFamily: fontFamily.medium, fontSize: 10, color: colors.primaryDeep },
});
