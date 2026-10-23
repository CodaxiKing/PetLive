import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { useLocalizacao, type Posicao } from '../../src/mapa/useLocalizacao';
import { PinTutor } from '../../src/mapa/PinTutor';
import { CENTRO_PADRAO } from '../../src/mapa/lugares';
import { CartaoEstadoMapa, AcaoEstado } from '../../src/mapa/CartaoEstadoMapa';
import { colors } from '../../src/theme/colors';

/** Delta de latitude/longitude para o marcador do tutor ficar bem visível ao centralizar. */
const ZOOM_TUTOR = {
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

/** Tempo máximo para esperar pela posição inicial (GPS lento) antes de seguir sem marcador. */
const TEMPO_POSICAO_MS = 8000;

/**
 * Mapa do Google com a localização do tutor (P-CKbvE).
 *
 * - Pede permissão de localização ao abrir a tela.
 * - Exibe um marcador distinguível ("Você") na posição do tutor logado.
 * - Centraliza o mapa na posição do tutor quando ela chega, com zoom que deixa
 *   o marcador visível.
 * - Acompanha mudanças de posição do dispositivo enquanto a tela está aberta.
 * - Sem permissão ou localização indisponível: renderiza o mapa sem travar,
 *   com uma mensagem informativa e sem o marcador do tutor.
 */
export default function MapaTutor() {
  const { permissao, posicao: posicaoInicial, localizar } = useLocalizacao();
  const [posicaoAoVivo, setPosicaoAoVivo] = useState<Posicao | null>(null);
  const [tentandoNovamente, setTentandoNovamente] = useState(false);
  const posicao = posicaoAoVivo ?? posicaoInicial ?? null;
  const carregando = permissao === 'desconhecida' || (tentandoNovamente && permissao === 'negada');
  const mapa = useRef<MapView>(null);
  const primeiraCentralizacao = useRef(true);

  // Acompanha a posição ao vivo enquanto a tela está aberta e há permissão.
  useEffect(() => {
    if (permissao !== 'concedida') return;
    let ativo = true;
    let assinatura: Location.LocationSubscription | null = null;
    (async () => {
      assinatura = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 5000 },
        (p) => {
          if (!ativo) return;
          setPosicaoAoVivo({ lat: p.coords.latitude, lng: p.coords.longitude });
        },
      );
    })();
    return () => {
      ativo = false;
      assinatura?.remove();
    };
  }, [permissao]);

  // A inicialização já pede a permissão e captura a posição via useLocalizacao.
  // Quando a posição chega (inicial ou ao vivo), centraliza o mapa nela.
  useEffect(() => {
    if (!posicao) return;
    const centro: Region = {
      latitude: posicao.lat,
      longitude: posicao.lng,
      ...ZOOM_TUTOR,
    };
    // Pula a animação na primeira centralização: o initialCamera já posiciona.
    if (primeiraCentralizacao.current) {
      primeiraCentralizacao.current = false;
      return;
    }
    mapa.current?.animateToRegion(centro, 1000);
  }, [posicao]);

  function permitirLocalizacao() {
    setTentandoNovamente(true);
    localizar();
    // Se o sistema não responder à solicitação, libera o mapa após 8 segundos.
    setTimeout(() => setTentandoNovamente(false), TEMPO_POSICAO_MS);
  }

  const centro = posicao ?? CENTRO_PADRAO;
  const semPosicao = permissao !== 'desconhecida' && !posicao;
  const negada = permissao === 'negada';

  return (
    <View style={estilos.tela}>
      <MapView
        ref={mapa}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialCamera={{
          center: { latitude: centro.lat, longitude: centro.lng },
          ...ZOOM_TUTOR,
          heading: 0,
          pitch: 0,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsPointsOfInterests={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {posicao && permissao === 'concedida' && (
          <Marker
            coordinate={{ latitude: posicao.lat, longitude: posicao.lng }}
            accessible
            accessibilityLabel="Sua localização"
          >
            <PinTutor />
          </Marker>
        )}
      </MapView>

      {carregando && (
        <View style={estilos.overlayCentro}>
          <ActivityIndicator size="large" color={colors.primaryDeep} />
        </View>
      )}

      {semPosicao && (
        <CartaoEstadoMapa
          icone="local"
          fundoIcone={negada ? colors.primarySurface : colors.warningSurface}
          titulo={negada ? 'Localização desligada' : 'Localização indisponível'}
          sub={
            negada
              ? 'Para mostrar onde você está no mapa'
              : 'Não foi possível obter a sua posição no momento.'
          }
          texto={
            negada
              ? 'O PetLive usa a sua posição só enquanto o mapa está aberto, para mostrar onde você está e os lugares pet perto de você.'
              : 'Verifique se os serviços de localização estão ativados e tente novamente.'
          }
        >
          <AcaoEstado
            rotulo={negada ? 'Permitir localização' : 'Tentar novamente'}
            onPress={permitirLocalizacao}
          />
          {negada && (
            <AcaoEstado
              rotulo="Seguir sem localização"
              tipo="secundaria"
              onPress={() => setTentandoNovamente(false)}
            />
          )}
        </CartaoEstadoMapa>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overlayCentro: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(243, 245, 248, 0.9)',
  },
});
