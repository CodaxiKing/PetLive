import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { File } from 'expo-file-system';
import { Tocavel } from '../../src/components/Animacoes';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone } from '../../src/components/Icone';
import { Mascote } from '../../src/components/Mascote';
import { buscarPorFoto, haQuanto, posicaoAtual, TEXTO_NIVEL, textoDistancia, type Candidato, type NivelSemelhanca } from '../../src/perdido/perdido';
import { escolherFoto, type AtivoFoto } from '../../src/pets/CampoFoto';
import { colors } from '../../src/theme/colors';
import { fontFamily } from '../../src/theme/typography';

const COR_NIVEL: Record<NivelSemelhanca, { fundo: string; texto: string }> = {
  muito_parecido: { fundo: colors.successSurface, texto: colors.successText },
  parecido: { fundo: colors.warningSurface, texto: colors.warningText },
  pouco_parecido: { fundo: colors.background, texto: colors.textMuted },
};

/** Achei um pet (protótipos AcheiFoto e AcheiResultado; BUSINESS.md 5.38). */
export default function AcheiUmPet() {
  const [foto, setFoto] = useState<AtivoFoto | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function fotografar(origem: 'camera' | 'galeria') {
    // Quadrado: dá para recortar só o rosto do pet, sem pessoas.
    const f = await escolherFoto(origem, true);
    if (!f) return;
    setFoto(f);
    setCandidatos(null);
    setErro(null);
  }

  async function buscar() {
    if (!foto) return;
    setBuscando(true);
    setErro(null);
    try {
      const { lat, lng } = await posicaoAtual();
      const base64 = await new File(foto.uri).base64();
      setCandidatos(await buscarPorFoto(base64, foto.mimeType ?? 'image/jpeg', lat, lng));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBuscando(false);
    }
  }

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo="Achei um pet" titulo={candidatos ? 'Pode ser um destes' : 'Fotografe o rosto ou o focinho'} altura={196} />
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {candidatos === null ? (
          <>
            <Tocavel accessibilityRole="button" accessibilityLabel="Tirar foto do pet" onPress={() => fotografar('camera')} style={estilos.moldura}>
              {foto ? (
                <Image source={{ uri: foto.uri }} style={estilos.previa} />
              ) : (
                <>
                  <Icone nome="camera" size={34} espessura={1.8} cor={colors.primaryDeep} />
                  <Text style={estilos.molduraTexto}>Toque para fotografar</Text>
                </>
              )}
            </Tocavel>
            <Tocavel accessibilityRole="button" onPress={() => fotografar('galeria')} style={estilos.galeria}>
              <Text style={estilos.galeriaTexto}>{foto ? 'Trocar a foto' : 'Escolher da galeria'}</Text>
            </Tocavel>
            <Text style={estilos.nota}>
              Comparamos só com alertas de pets perdidos perto de você. A foto não fica guardada; a busca é apagada em 24 horas.
            </Text>
          </>
        ) : candidatos.length === 0 ? (
          <View style={estilos.vazio}>
            <Text style={estilos.vazioTitulo}>Nenhum alerta parecido por perto</Text>
            <Text style={estilos.vazioTexto}>
              Pode ser que o tutor ainda não tenha criado o alerta. Se o pet tiver coleira com QR, escaneie com a câmera. Você também pode levá-lo a uma clínica para ler o microchip.
            </Text>
          </View>
        ) : (
          <>
            {candidatos.map((c) => (
              <Tocavel key={c.alert_id} accessibilityRole="button" accessibilityLabel={`${c.nome}, ${TEXTO_NIVEL[c.nivel]}`} onPress={() => router.push(`/alerta/${c.alert_id}`)} style={estilos.candidato}>
                {c.foto_url ? <Image source={{ uri: c.foto_url }} style={estilos.fotoCandidato} /> : <Mascote especie={c.especie} size={56} />}
                <View style={estilos.flex}>
                  <Text style={estilos.nome}>{c.nome}</Text>
                  <Text style={[estilos.nivel, { backgroundColor: COR_NIVEL[c.nivel].fundo, color: COR_NIVEL[c.nivel].texto }]}>{TEXTO_NIVEL[c.nivel]}</Text>
                  <Text style={estilos.sub}>Sumiu {haQuanto(c.visto_em)} · {textoDistancia(c.distancia_km)}</Text>
                </View>
                <Text style={estilos.ver}>Ver</Text>
              </Tocavel>
            ))}
            <View style={estilos.aviso}>
              <Text style={estilos.avisoTitulo}>Pode estar errado.</Text>
              <Text style={estilos.avisoTexto}>O app só sugere. Fale com o tutor pelo alerta antes de entregar o pet a alguém.</Text>
            </View>
          </>
        )}
        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
      </ScrollView>
      <View style={estilos.rodape}>
        {candidatos === null ? (
          <BotaoPrimario titulo="Buscar alertas parecidos" carregando={buscando} desabilitado={!foto} onPress={buscar} />
        ) : candidatos.length > 0 ? (
          <BotaoPrimario titulo={`Ver o alerta do ${candidatos[0].nome}`} onPress={() => router.push(`/alerta/${candidatos[0].alert_id}`)} />
        ) : (
          <BotaoPrimario titulo="Tentar outra foto" onPress={() => { setCandidatos(null); setFoto(null); }} />
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  moldura: {
    aspectRatio: 1, borderRadius: 32, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.borderStrong,
    backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden',
  },
  previa: { width: '100%', height: '100%' },
  molduraTexto: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.primaryDeep },
  galeria: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  galeriaTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.primaryDeep },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 8 },
  vazio: { backgroundColor: colors.surface, borderRadius: 24, padding: 18, gap: 6 },
  vazioTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  vazioTexto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  candidato: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 24, padding: 12 },
  fotoCandidato: { width: 64, height: 64, borderRadius: 20 },
  nome: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  nivel: { alignSelf: 'flex-start', fontFamily: fontFamily.bold, fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  sub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  ver: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.primaryDeep },
  aviso: { backgroundColor: colors.warningSurface, borderRadius: 22, padding: 14, gap: 2 },
  avisoTitulo: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.warningText },
  avisoTexto: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: colors.black },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
});
