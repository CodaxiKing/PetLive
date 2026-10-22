import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { Camera, Map, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import type MapView from 'react-native-maps';
import { FONTE_LUGARES, type CategoriaLugar } from './lugares';
import { PinLugar } from './PinLugar';
import { PontoUsuario } from './PontoUsuario';

/** Estilo de mapa gratuito (OpenFreeMap: tiles OSM, sem chave). */
const ESTILO_OSM = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * Mapa do Google só com os lugares do Google (termos do Google Maps
 * Platform: conteúdo do Places aparece sobre o mapa do Google) e com a
 * chave do Maps SDK no build (app.config.js). Fora isso, OpenStreetMap.
 */
const chaves = Constants.expoConfig?.extra?.mapaGoogle as { android?: boolean; ios?: boolean } | undefined;
export const MAPA_GOOGLE =
  FONTE_LUGARES === 'google' && Boolean(Platform.OS === 'ios' ? chaves?.ios : chaves?.android);

// Só carrega o react-native-maps com o mapa do Google ligado: o import já
// procura o módulo nativo, e binários sem ele (OTA para builds antigos) quebrariam.
const Google = MAPA_GOOGLE
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('react-native-maps') as typeof import('react-native-maps'))
  : null;

export type PinMapa = { id: string; lat: number; lng: number; categoria: CategoriaLugar };

export type ControleMapa = {
  /** Move a câmera até o ponto, com animação. */
  irPara: (ponto: { lat: number; lng: number }, zoom: number, duracaoMs?: number) => void;
  /** Onde o GPS diz que a pessoa está agora (o ponto azul), se já chegou. */
  posicaoUsuario: () => { lat: number; lng: number } | null;
};

/**
 * Posição ao vivo para o ponto azul: acompanha o GPS enquanto o mapa está
 * na tela (só com a permissão já dada; quem pede é a tela do mapa).
 */
function usePosicaoAoVivo(ativo: boolean) {
  const [ponto, setPonto] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    let assinatura: Location.LocationSubscription | null = null;
    Location.getForegroundPermissionsAsync()
      .then(({ granted }) =>
        granted && vivo
          ? Location.watchPositionAsync(
              { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 2000 },
              (p) => setPonto({ lat: p.coords.latitude, lng: p.coords.longitude }),
            )
          : null,
      )
      .then((s) => {
        if (vivo) assinatura = s;
        else s?.remove();
      })
      // GPS desligado: o mapa segue sem o ponto.
      .catch(() => undefined);
    return () => {
      vivo = false;
      assinatura?.remove();
    };
  }, [ativo]);

  return ativo ? ponto : null;
}

type Props = {
  centro: { lat: number; lng: number };
  zoom: number;
  pins: PinMapa[];
  selecionado?: string | null;
  onPin?: (id: string) => void;
  /** Toque no mapa fora dos pins. */
  onToqueMapa?: () => void;
  /** Falso na ficha do lugar: mapa parado, só para mostrar o ponto. */
  interativo?: boolean;
  mostrarUsuario?: boolean;
  /** Onde fica o crédito "© OpenStreetMap" (padrão: canto de baixo à esquerda). */
  posicaoCredito?: StyleProp<ViewStyle>;
  ref?: Ref<ControleMapa>;
};

/** Zoom do MapLibre e do Google seguem a mesma escala (níveis de tile). */
export function MapaLugares({
  centro,
  zoom,
  pins,
  selecionado,
  onPin,
  onToqueMapa,
  interativo = true,
  mostrarUsuario = false,
  posicaoCredito,
  ref,
}: Props) {
  const camera = useRef<CameraRef>(null);
  // No Google o ponto azul é o nativo (showsUserLocation).
  const usuario = usePosicaoAoVivo(mostrarUsuario);
  const google = useRef<MapView>(null);
  // Google no Android desenha o pin como imagem: acompanha as mudanças só
  // logo depois de os pins chegarem (com o desenho pronto), depois congela.
  const [redesenhar, setRedesenhar] = useState(true);
  const assinaturaPins = pins.map((p) => p.id).join(',');

  useEffect(() => {
    if (!MAPA_GOOGLE) return;
    const religar = setTimeout(() => setRedesenhar(true), 0);
    const congelar = setTimeout(() => setRedesenhar(false), 800);
    return () => {
      clearTimeout(religar);
      clearTimeout(congelar);
    };
  }, [assinaturaPins]);

  useImperativeHandle(ref, () => ({
    irPara(ponto, zoomAlvo, duracaoMs = 350) {
      if (MAPA_GOOGLE) {
        google.current?.animateCamera(
          { center: { latitude: ponto.lat, longitude: ponto.lng }, zoom: zoomAlvo },
          { duration: duracaoMs },
        );
      } else {
        camera.current?.easeTo({ center: [ponto.lng, ponto.lat], zoom: zoomAlvo, duration: duracaoMs });
      }
    },
    posicaoUsuario: () => usuario,
  }));

  if (Google) {
    const { default: MapaGoogle, Marker: MarcadorGoogle, PROVIDER_GOOGLE } = Google;
    return (
      <MapaGoogle
        ref={google}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialCamera={{ center: { latitude: centro.lat, longitude: centro.lng }, zoom, heading: 0, pitch: 0 }}
        onPress={(e) => {
          // No Google o toque no pin também chega ao mapa, marcado.
          if (e.nativeEvent.action === 'marker-press') return;
          onToqueMapa?.();
        }}
        scrollEnabled={interativo}
        zoomEnabled={interativo}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsUserLocation={mostrarUsuario}
        showsMyLocationButton={false}
        showsPointsOfInterests={false}
      >
        {pins.map((pin) => {
          const ativo = pin.id === selecionado;
          return (
            <MarcadorGoogle
              key={pin.id}
              identifier={pin.id}
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => onPin?.(pin.id)}
              tracksViewChanges={redesenhar || ativo}
              zIndex={ativo ? 2 : 1}
            >
              <PinLugar categoria={pin.categoria} selecionado={ativo} />
            </MarcadorGoogle>
          );
        })}
      </MapaGoogle>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={ESTILO_OSM}
        logo={false}
        attribution={false}
        compass={false}
        dragPan={interativo}
        touchZoom={interativo}
        doubleTapZoom={interativo}
        doubleTapHoldZoom={interativo}
        touchRotate={false}
        touchPitch={false}
        onPress={() => onToqueMapa?.()}
      >
        <Camera ref={camera} initialViewState={{ center: [centro.lng, centro.lat], zoom }} />
        {pins.map((pin) => (
          <Marker key={pin.id} id={pin.id} lngLat={[pin.lng, pin.lat]} anchor="bottom" onPress={() => onPin?.(pin.id)}>
            <PinLugar categoria={pin.categoria} selecionado={pin.id === selecionado} />
          </Marker>
        ))}
        {/* O MapLibre empilha na ordem em que os marcadores entram: a chave
            muda com os pins para o ponto azul entrar de novo, por cima. */}
        {usuario && !MAPA_GOOGLE ? (
          <Marker key={`usuario-${assinaturaPins}`} id="usuario" lngLat={[usuario.lng, usuario.lat]} anchor="center">
            <PontoUsuario />
          </Marker>
        ) : null}
      </Map>
      {/* ODbL: o crédito do OpenStreetMap precisa ficar visível no mapa. */}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Dados do mapa: OpenStreetMap"
        onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => undefined)}
        hitSlop={6}
        style={[estilos.credito, posicaoCredito ?? estilos.creditoPadrao]}
      >
        <Text style={estilos.creditoTexto} allowFontScaling={false}>
          © OpenStreetMap
        </Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  credito: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  creditoPadrao: { left: 8, bottom: 8 },
  creditoTexto: { fontSize: 10, color: '#333333' },
});
