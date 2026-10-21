import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { Camera, Map, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import type MapView from 'react-native-maps';
import { FONTE_LUGARES, type CategoriaLugar } from './lugares';
import { PinLugar } from './PinLugar';

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
};

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
  ref,
}: Props) {
  const camera = useRef<CameraRef>(null);
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
    </Map>
  );
}
