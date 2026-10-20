import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import Svg, { Path } from 'react-native-svg';
import { abrirWhatsApp, ligarPara, tracarRota } from '../src/mapa/acoes';
import { GlifoLugar } from '../src/mapa/GlifoLugar';
import {
  COR_CATEGORIA,
  lugarPorId,
  ROTULO_CATEGORIA,
  type Lugar as LugarRegistro,
} from '../src/mapa/lugares';
import { PinLugar } from '../src/mapa/PinLugar';
import { colors } from '../src/theme/colors';
import { radius, shadow, spacing } from '../src/theme/tokens';
import { typography } from '../src/theme/typography';

/** Mesmo estilo de mapa gratuito da tela Mapa (OpenFreeMap). */
const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/liberty';

function CardInfo({
  icone,
  rotulo,
  valor,
}: {
  icone: ReactNode;
  rotulo: string;
  valor: string;
}) {
  return (
    <View style={estilos.cardInfo}>
      <View style={estilos.cardInfoIcone}>{icone}</View>
      <View style={estilos.cardInfoTexto}>
        <Text style={estilos.cardInfoRotulo}>{rotulo}</Text>
        <Text style={estilos.cardInfoValor}>{valor}</Text>
      </View>
    </View>
  );
}

/**
 * Ficha do lugar (board: [APP-CLIENTE] "Mapa: Ficha do lugar" e
 * "Ligar, WhatsApp e traçar rota"): mapa fixo no topo, endereço,
 * horário e contato, com a barra de ações embaixo.
 */
export default function Lugar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lugar, setLugar] = useState<LugarRegistro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falha, setFalha] = useState(false);

  useEffect(() => {
    let vivo = true;
    (id ? lugarPorId(id) : Promise.resolve(null))
      .then((registro) => {
        if (!vivo) return;
        setLugar(registro);
        if (!registro) setFalha(true);
        setCarregando(false);
      })
      .catch(() => {
        if (!vivo) return;
        setFalha(true);
        setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [id]);

  if (carregando || falha || !lugar) {
    return (
      <View style={estilos.centro}>
        {carregando ? (
          <ActivityIndicator size="large" color={colors.primaryDeep} />
        ) : (
          <>
            <Text style={estilos.centroTitulo}>Lugar não encontrado</Text>
            <Text style={estilos.centroTexto}>Os dados do mapa podem ter mudado.</Text>
            <Pressable onPress={() => router.back()} accessibilityRole="button">
              <Text style={estilos.centroVoltar}>Voltar</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  const telefone = lugar.telefone;

  return (
    <View style={estilos.tela}>
      <View style={estilos.hero}>
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={ESTILO_MAPA}
          logo={false}
          attribution={false}
          compass={false}
          dragPan={false}
          touchZoom={false}
          doubleTapZoom={false}
          doubleTapHoldZoom={false}
          touchRotate={false}
          touchPitch={false}
        >
          <Camera center={[lugar.lng, lugar.lat]} zoom={15.5} />
          <Marker lngLat={[lugar.lng, lugar.lat]}>
            <PinLugar categoria={lugar.categoria} selecionado />
          </Marker>
        </Map>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [estilos.voltar, pressed && estilos.voltarPressionado]}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 5l-7 7 7 7"
              stroke={colors.black}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Text style={estilos.nome} numberOfLines={2}>
          {lugar.nome}
        </Text>

        <View style={estilos.selinhas}>
          <View
            style={[estilos.selinha, { backgroundColor: COR_CATEGORIA[lugar.categoria] }]}
          >
            <GlifoLugar categoria={lugar.categoria} tamanho={13} />
            <Text style={estilos.selinhaTexto}>{ROTULO_CATEGORIA[lugar.categoria]}</Text>
          </View>
          {lugar.aberto_24h && (
            <View style={[estilos.selinha, { backgroundColor: colors.successSurface }]}>
              <Text style={[estilos.selinhaTexto, { color: colors.successText }]}>
                Aberto 24h
              </Text>
            </View>
          )}
        </View>

        <View style={estilos.cartoes}>
          {lugar.endereco && (
            <CardInfo
              rotulo="Endereço"
              valor={lugar.endereco}
              icone={
                <Svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.black}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <Path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" />
                  <Path d="M14.2 9.2a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0z" />
                </Svg>
              }
            />
          )}

          {lugar.horario && (
            <CardInfo
              rotulo="Horário"
              valor={lugar.horario}
              icone={
                <Svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.black}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <Path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z" />
                  <Path d="M12 7.5V12l3 2" />
                </Svg>
              }
            />
          )}

          {telefone && (
            <CardInfo
              rotulo="Telefone"
              valor={telefone}
              icone={
                <Svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.black}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <Path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
                </Svg>
              }
            />
          )}

          {lugar.website && (
            <CardInfo
              rotulo="Site"
              valor={lugar.website}
              icone={
                <Svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.black}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <Path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z" />
                  <Path d="M3 12h18" />
                  <Path d="M12 3c2.4 2.7 2.4 15.3 0 18" />
                </Svg>
              }
            />
          )}

          {!lugar.endereco && !telefone && !lugar.horario && !lugar.website && (
            <Text style={estilos.poucasInfo}>
              Este lugar tem poucas informações no mapa. Vale ligar ou ir até lá.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Barra de ações (protótipo Ficha do lugar). */}
      <View style={estilos.barra}>
        {telefone && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ligar para ${lugar.nome}`}
              onPress={() => {
                ligarPara(telefone).catch(() => undefined);
              }}
              style={estilos.acaoCircular}
            >
              <Svg
                width={24}
                height={24}
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.black}
                strokeWidth={1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <Path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
              </Svg>
              <Text style={estilos.acaoCircularTexto}>Ligar</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Conversar no WhatsApp com ${lugar.nome}`}
              onPress={() => {
                abrirWhatsApp(telefone).catch(() => undefined);
              }}
              style={estilos.acaoCircular}
            >
              <Svg
                width={24}
                height={24}
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.black}
                strokeWidth={1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <Path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L4 20.5l1.7-4.2A8.5 8.5 0 1 1 21 11.5z" />
                <Path d="M9 9.5c.4 2.6 2.4 4.6 5 5l1-1.4 1.7.8-.4 1.5c-3.8.6-7.8-3.4-7.2-7.2l1.5-.4.8 1.7L9 9.5z" />
              </Svg>
              <Text style={estilos.acaoCircularTexto}>WhatsApp</Text>
            </Pressable>
          </>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Traçar rota até ${lugar.nome}`}
          onPress={() => {
            tracarRota(lugar).catch(() => undefined);
          }}
          style={estilos.rotaBotao}
        >
          <Svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.black}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <Path d="M21 3L10 21l-1.5-7.5L1 12l20-9z" />
          </Svg>
          <Text style={estilos.rotaBotaoTexto}>Traçar rota</Text>
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  hero: {
    height: 280,
    backgroundColor: '#CFE8FB',
  },
  voltar: {
    position: 'absolute',
    top: 54,
    left: spacing.xxl,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  voltarPressionado: {
    opacity: 0.6,
  },
  conteudo: {
    padding: spacing.xxl,
    gap: spacing.lg,
    paddingBottom: spacing.huge,
  },
  nome: {
    ...typography.h1,
    fontWeight: '500',
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: colors.black,
  },
  selinhas: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  selinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  selinhaTexto: {
    ...typography.captionMedium,
    fontSize: 12,
    color: colors.text,
  },
  cartoes: {
    gap: spacing.sm,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 22,
    padding: spacing.md,
    paddingRight: spacing.lg,
  },
  cardInfoIcone: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfoTexto: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardInfoRotulo: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  cardInfoValor: {
    ...typography.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
    color: colors.black,
  },
  poucasInfo: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xxl,
    backgroundColor: colors.surface,
  },
  centroTitulo: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.black,
  },
  centroTexto: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  centroVoltar: {
    ...typography.bodyMedium,
    fontWeight: '700',
    color: colors.primaryDeep,
    paddingVertical: spacing.sm,
  },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  acaoCircular: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.background,
    flexShrink: 0,
  },
  acaoCircularTexto: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
  },
  rotaBotao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  rotaBotaoTexto: {
    ...typography.bodyMedium,
    fontWeight: '700',
    color: colors.black,
  },
});
