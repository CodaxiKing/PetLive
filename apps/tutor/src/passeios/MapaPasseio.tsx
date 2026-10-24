import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import type { PontoPasseio } from './passeio';
import { geometriaPasseio, limitesMapaPasseio } from './resumo';
import { TrajetoPasseio } from './TrajetoPasseio';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export function MapaPasseio({ pontos }: { pontos: PontoPasseio[] }) {
  const [falhou, setFalhou] = useState(false), [desenho, setDesenho] = useState(false);
  const geometria = useMemo(() => geometriaPasseio(pontos), [pontos]);
  const limites = useMemo(() => limitesMapaPasseio(pontos), [pontos]);
  if (!limites) return <Text style={s.texto}>Este passeio não tem pontos GPS para mostrar no mapa.</Text>;
  const primeiro = pontos[0], ultimo = pontos.at(-1)!;
  return <View style={{ gap: 8 }}>
    <Text style={s.texto}>O mapa de ruas usa internet. O desenho do trajeto salvo também funciona sem conexão.</Text>
    {Platform.OS === 'web' || falhou || desenho ? <>
      {falhou ? <Text style={s.texto}>O mapa não carregou. Seu trajeto continua salvo.</Text> : null}
      <TrajetoPasseio pontos={pontos} />
    </> : <View style={s.mapa}>
      <Map style={StyleSheet.absoluteFill} mapStyle="https://tiles.openfreemap.org/styles/liberty" logo={false} attribution compass={false} touchPitch={false} touchRotate={false} onDidFailLoadingMap={() => setFalhou(true)}>
        <Camera initialViewState={{ bounds: limites, padding: { top: 30, right: 30, bottom: 30, left: 30 } }} maxZoom={18} />
        {geometria.geometry.coordinates.length ? <GeoJSONSource id="trajeto-passeio" data={geometria}>
          <Layer id="linha-passeio" type="line" paint={{ 'line-color': colors.primaryDeep, 'line-width': 4 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
        </GeoJSONSource> : null}
        <Marker id="inicio-passeio" lngLat={[primeiro.lng, primeiro.lat]}><View style={s.marcador}><Text style={s.rotulo}>Início</Text></View></Marker>
        {pontos.length > 1 ? <Marker id="fim-passeio" lngLat={[ultimo.lng, ultimo.lat]}><View style={s.marcador}><Text style={s.rotulo}>Fim</Text></View></Marker> : null}
      </Map>
    </View>}
    {Platform.OS !== 'web' ? <Pressable accessibilityRole="button" style={s.acao} onPress={() => { if (falhou) { setFalhou(false); setDesenho(false); } else setDesenho(!desenho); }}><Text style={s.link}>{falhou ? 'Tentar carregar mapa novamente' : desenho ? 'Ver mapa de ruas' : 'Ver desenho sem mapa de ruas'}</Text></Pressable> : null}
  </View>;
}
const s = StyleSheet.create({
  mapa: { height: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface },
  texto: { ...typography.body, color: colors.textMuted }, acao: { minHeight: 48, justifyContent: 'center' },
  link: { ...typography.bodyMedium, color: colors.primaryDeep },
  marcador: { backgroundColor: colors.primaryDeep, borderRadius: 16, padding: 6 },
  rotulo: { ...typography.captionMedium, color: colors.white },
});
