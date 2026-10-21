import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Map, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import Svg, { Path } from 'react-native-svg';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { ligarPara } from '../../src/mapa/acoes';
import { Deslizar } from '../../src/components/Animacoes';
import { Icone } from '../../src/components/Icone';
import { lugaresSalvos } from '../../src/mapa/favoritos';
import { FolhaRota } from '../../src/mapa/FolhaRota';
import { IlustracaoLugar } from '../../src/mapa/IlustracaoLugar';
import {
  buscarLugares,
  buscarPetFriendly,
  CENTRO_PADRAO,
  FONTE_LUGARES,
  formatarDistancia,
  resumoStatus,
  ROTULO_CATEGORIA,
  type CategoriaLugar,
  type Lugar,
} from '../../src/mapa/lugares';
import { PinLugar } from '../../src/mapa/PinLugar';
import { useLocalizacao } from '../../src/mapa/useLocalizacao';
import { colors } from '../../src/theme/colors';
import { radius, shadow, spacing } from '../../src/theme/tokens';
import { fontFamily, typography } from '../../src/theme/typography';

/** Estilo de mapa gratuito (OpenFreeMap: tiles OSM, sem chave). */
const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/liberty';

/** 'pet_friendly' chega da tela Pet friendly ("Ver no mapa"). */
type Filtro = 'todos' | CategoriaLugar | '24h' | 'salvos' | 'pet_friendly';

// Ordem do protótipo Mapa; o chip Pet friendly abre a tela própria (5.19).
const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'clinica', rotulo: 'Clínicas' },
  { valor: 'petshop', rotulo: 'Petshops' },
  // Creches e hotelzinhos só existem nos dados do Google (busca por texto, 5.15).
  ...(FONTE_LUGARES === 'google'
    ? ([
        { valor: 'creche', rotulo: 'Creches' },
        { valor: 'hotelzinho', rotulo: 'Hotelzinhos' },
      ] as const)
    : []),
  { valor: 'banho_tosa', rotulo: 'Banho e tosa' },
  { valor: '24h', rotulo: '24 h' },
  { valor: 'salvos', rotulo: 'Salvos' },
];

const FILTROS_DE_ATALHO: Filtro[] = [...FILTROS.map((f) => f.valor), 'pet_friendly'];

/**
 * Mapa (board: [APP-CLIENTE] Mapa, P1): MapLibre com tiles gratuitos,
 * permissão de localização, busca e filtros, pins por categoria e o
 * card do lugar selecionado com ligar, rota e atalho para a ficha.
 */
export default function Mapa() {
  // Atalhos do Início chegam como ?filtro=clinica|banho_tosa|petshop|24h; a escolha manual
  // dos chips passa a valer assim que o toque um.
  const { filtro } = useLocalSearchParams<{ filtro?: string }>();
  const [categoriaManual, setCategoriaManual] = useState<Filtro | null>(null);
  const filtroDoAtalho = FILTROS_DE_ATALHO.find((valor) => valor === filtro) ?? 'todos';
  const categoria: Filtro = categoriaManual ?? filtroDoAtalho;

  const { permissao, posicao, localizar } = useLocalizacao();

  const [busca, setBusca] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState('');
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState<Lugar | null>(null);
  const [rotaAberta, setRotaAberta] = useState(false);
  const cameraRef = useRef<CameraRef>(null);
  // O toque no pin também chega ao mapa logo depois; sem isto o cartão
  // do lugar abria e fechava no mesmo toque.
  const tocouPin = useRef(false);

  const centro = posicao ?? CENTRO_PADRAO;
  const so24h = categoria === '24h';

  // Consulta por perto muda com a posição, o filtro e a busca.
  useEffect(() => {
    let vivo = true;
    const consulta =
      categoria === 'salvos'
        ? lugaresSalvos()
        : categoria === 'pet_friendly'
          ? buscarPetFriendly({ lat: centro.lat, lng: centro.lng }).then((lista) => lista ?? [])
          : buscarLugares({
              lat: centro.lat,
              lng: centro.lng,
              categoria: so24h || categoria === 'todos' ? null : categoria,
              busca: buscaAtiva,
              aberto24h: so24h ? true : null,
            });
    consulta
      .then((lista) => {
        if (!vivo) return;
        setLugares(lista);
        setSelecionado(null);
        setCarregando(false);
      })
      .catch(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [centro.lat, centro.lng, categoria, buscaAtiva, so24h]);

  // Chegou a localização real: centraliza o mapa nela.
  useEffect(() => {
    if (posicao) {
      cameraRef.current?.easeTo({
        center: [posicao.lng, posicao.lat],
        zoom: 14,
        duration: 600,
      });
    }
  }, [posicao]);

  function escolherFiltro(valor: Filtro) {
    setCategoriaManual(valor);
    setSelecionado(null);
    setCarregando(true);
  }

  function aplicarBusca() {
    setBuscaAtiva(busca.trim());
    setSelecionado(null);
    setCarregando(true);
  }

  function selecionar(lugar: Lugar) {
    tocouPin.current = true;
    setTimeout(() => {
      tocouPin.current = false;
    }, 500);
    setSelecionado(lugar);
    cameraRef.current?.easeTo({
      center: [lugar.lng, lugar.lat],
      zoom: 15,
      duration: 350,
    });
  }

  function meuLocal() {
    if (posicao) {
      cameraRef.current?.easeTo({
        center: [posicao.lng, posicao.lat],
        zoom: 14,
        duration: 350,
      });
    } else {
      localizar();
    }
  }

  const lugar = selecionado;

  return (
    <View style={estilos.tela}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={ESTILO_MAPA}
        logo={false}
        attribution={false}
        compass={false}
        onPress={() => {
          if (tocouPin.current) return;
          setSelecionado(null);
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: [CENTRO_PADRAO.lng, CENTRO_PADRAO.lat], zoom: 13 }}
        />
        {lugares.map((registro) => (
          <Marker
            key={registro.id}
            id={registro.id}
            lngLat={[registro.lng, registro.lat]}
            anchor="bottom"
            onPress={() => selecionar(registro)}
          >
            <PinLugar
              categoria={registro.categoria}
              selecionado={lugar?.id === registro.id}
            />
          </Marker>
        ))}
      </Map>

      {/* Topo: busca e filtros flutuando sobre o mapa (protótipo Mapa). */}
      <View style={estilos.topo} pointerEvents="box-none">
        <View style={estilos.linhaBusca}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={8}
          onPress={() => (router.canGoBack() ? router.back() : router.navigate('/inicio'))}
          style={({ pressed }) => [estilos.voltar, pressed && { opacity: 0.6 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.black} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <Path d="M15 5l-7 7 7 7" />
          </Svg>
        </Pressable>
        <View style={estilos.busca}>
          <Svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.textMuted}
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden
          >
            <Path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14z" />
            <Path d="M16.5 16.5L21 21" />
          </Svg>
          <TextInput
            style={estilos.buscaEntrada}
            placeholder="Buscar lugares pet"
            placeholderTextColor={colors.textMuted}
            value={busca}
            onChangeText={setBusca}
            onSubmitEditing={aplicarBusca}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Buscar lugares no mapa"
          />
        </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={estilos.filtrosRolagem}
          contentContainerStyle={estilos.filtros}
        >
          {FILTROS.map((opcao) => {
            const ativo = categoria === opcao.valor;
            return (
              <Pressable
                key={opcao.valor}
                onPress={() => escolherFiltro(opcao.valor)}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
                style={[estilos.pilula, ativo && estilos.pilulaAtiva]}
              >
                <Text style={[estilos.pilulaTexto, ativo && estilos.pilulaTextoAtiva]}>
                  {opcao.rotulo}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => router.push('/mapa/pet-friendly')}
            accessibilityRole="button"
            accessibilityState={{ selected: categoria === 'pet_friendly' }}
            style={[estilos.pilula, categoria === 'pet_friendly' && estilos.pilulaAtiva]}
          >
            <Text style={[estilos.pilulaTexto, categoria === 'pet_friendly' && estilos.pilulaTextoAtiva]}>
              Pet friendly
            </Text>
          </Pressable>
          {/* SOS no fim dos filtros, em rosa (protótipo Mapa, BUSINESS 5.17). */}
          <Pressable
            onPress={() => router.push('/sos')}
            accessibilityRole="button"
            accessibilityLabel="SOS: emergência"
            style={[estilos.pilula, estilos.pilulaSos]}
          >
            <Text style={[estilos.pilulaTexto, estilos.pilulaTextoSos]}>SOS</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Localização negada: explica e leva às configurações do aparelho. */}
      {permissao === 'negada' && (
        <View style={estilos.permissaoCartao}>
          <Text style={estilos.permissaoTitulo}>Sua localização está desligada</Text>
          <Text style={estilos.permissaoTexto}>
            Ative para ver clínicas, petshops e banho e tosa perto de você. Enquanto isso, o mapa
            mostra o Rio de Janeiro.
          </Text>
          <BotaoPrimario
            titulo="Abrir configurações"
            onPress={() => {
              Linking.openSettings().catch(() => undefined);
            }}
          />
          <Pressable onPress={localizar} hitSlop={8} accessibilityRole="button">
            <Text style={estilos.permissaoRepetir}>Tentar de novo</Text>
          </Pressable>
        </View>
      )}

      {carregando && (
        <ActivityIndicator
          style={estilos.indicador}
          size="large"
          color={colors.primaryDeep}
          accessibilityLabel="Carregando lugares"
        />
      )}

      {!carregando && lugares.length === 0 && (
        <View style={estilos.vazio} pointerEvents="none">
          <Text style={estilos.vazioTitulo}>
            {categoria === 'salvos' ? 'Nenhum lugar salvo' : 'Nenhum lugar por perto'}
          </Text>
          <Text style={estilos.vazioTexto}>
            {categoria === 'salvos'
              ? 'Toque no coração na ficha de um lugar para salvar.'
              : 'Tente outro filtro ou uma busca diferente.'}
          </Text>
        </View>
      )}

      {/* Botão "meu local" (some enquanto o card do lugar está aberto). */}
      {!lugar && (
        <Pressable
          style={estilos.fab}
          onPress={meuLocal}
          accessibilityRole="button"
          accessibilityLabel="Centralizar na minha localização"
        >
          <Svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.black}
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden
          >
            <Path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
            <Path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
          </Svg>
        </Pressable>
      )}

      {/* Card do lugar selecionado: resumo + ligar, rota e ficha. */}
      {lugar && (
        <Deslizar key={lugar.id} style={estilos.ficha}>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/lugar', params: { id: lugar.id, categoria: lugar.categoria } })
            }
            accessibilityRole="button"
            accessibilityLabel={`Abrir ficha de ${lugar.nome}`}
          >
            <View style={estilos.fichaTopo}>
              <View style={estilos.fichaFoto}>
                <View style={estilos.fichaFotoMiolo}>
                  <IlustracaoLugar categoria={lugar.categoria} tamanho={50} />
                </View>
              </View>
              <View style={estilos.fichaTexto}>
                <Text style={estilos.fichaNome} numberOfLines={1}>
                  {lugar.nome}
                </Text>
                <Text style={estilos.fichaLinha} numberOfLines={1}>
                  {[
                    ROTULO_CATEGORIA[lugar.categoria],
                    formatarDistancia(lugar.distancia_km),
                    lugar.nota ? `${lugar.nota.toFixed(1).replace('.', ',')} ★` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Icone nome="seta" size={20} espessura={2} />
            </View>

            <View style={estilos.fichaSelinhas}>
              {lugar.aberto_24h || lugar.aberto_agora ? (
                <View style={[estilos.selinha, { backgroundColor: colors.successSurface }]}>
                  <Text style={[estilos.selinhaTexto, { color: colors.successText }]}>{resumoStatus(lugar)}</Text>
                </View>
              ) : null}
              <View style={[estilos.selinha, { backgroundColor: colors.premiumSurface }]}>
                <Text style={[estilos.selinhaTexto, { color: colors.premiumText }]}>
                  {ROTULO_CATEGORIA[lugar.categoria]}
                </Text>
              </View>
            </View>
          </Pressable>

          <View style={estilos.fichaAcoes}>
            {lugar.telefone && (
              <Pressable
                onPress={() => {
                  ligarPara(lugar.telefone ?? '').catch(() => undefined);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Ligar para ${lugar.nome}`}
                style={estilos.ligar}
              >
                <Svg
                  width={22}
                  height={22}
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
              </Pressable>
            )}

            <Pressable
              onPress={() => setRotaAberta(true)}
              accessibilityRole="button"
              accessibilityLabel={`Traçar rota até ${lugar.nome}`}
              style={estilos.rota}
            >
              <View style={estilos.rotaCirculo}>
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
              </View>
              <Text style={estilos.rotaTexto}>Traçar rota</Text>
            </Pressable>
          </View>
        </Deslizar>
      )}

      <FolhaRota
        destino={
          rotaAberta && lugar
            ? {
                ...lugar,
                placeId: lugar.fonte === 'google' ? lugar.id : null,
                distanciaKm: lugar.distancia_km,
              }
            : null
        }
        onFechar={() => setRotaAberta(false)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xxl,
    paddingTop: 54,
    gap: spacing.sm,
  },
  linhaBusca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voltar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  busca: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 54,
    ...shadow.card,
  },
  buscaEntrada: {
    flex: 1,
    ...typography.bodyMedium,
    color: colors.black,
    padding: 0,
  },
  filtrosRolagem: {
    marginHorizontal: -spacing.xxl,
  },
  filtros: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
    paddingBottom: 6,
  },
  pilula: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  pilulaSos: {
    backgroundColor: '#FDE0E6',
  },
  pilulaTextoSos: {
    color: '#A3324F',
  },
  pilulaAtiva: {
    backgroundColor: colors.black,
  },
  pilulaTexto: {
    ...typography.captionMedium,
    color: colors.text,
  },
  pilulaTextoAtiva: {
    color: colors.white,
  },
  permissaoCartao: {
    position: 'absolute',
    top: 190,
    left: spacing.xxl,
    right: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  permissaoTitulo: {
    ...typography.bodyMedium,
    fontFamily: fontFamily.bold,
    color: colors.black,
  },
  permissaoTexto: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  permissaoRepetir: {
    ...typography.captionMedium,
    color: colors.primaryDeep,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  indicador: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
  },
  vazio: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    ...shadow.card,
  },
  vazioTitulo: {
    ...typography.bodyMedium,
    fontFamily: fontFamily.bold,
    color: colors.black,
  },
  vazioTexto: {
    ...typography.caption,
    color: colors.textMuted,
  },
  fab: {
    position: 'absolute',
    right: spacing.xxl,
    bottom: 100,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  ficha: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 100,
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  fichaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexShrink: 0,
  },
  fichaFoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    padding: 3,
    backgroundColor: colors.primary,
    flexShrink: 0,
  },
  fichaFotoMiolo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  fichaTexto: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  fichaNome: {
    ...typography.h3,
    fontFamily: fontFamily.bold,
    color: colors.black,
  },
  fichaLinha: {
    ...typography.caption,
    color: colors.textMuted,
  },
  fichaSelinhas: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  selinha: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  selinhaTexto: {
    ...typography.captionMedium,
    fontSize: 12,
  },
  fichaAcoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ligar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rota: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.black,
    borderRadius: radius.pill,
    height: 56,
    paddingLeft: 6,
  },
  rotaCirculo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotaTexto: {
    ...typography.bodyMedium,
    fontFamily: fontFamily.bold,
    color: colors.white,
    flex: 1,
    textAlign: 'center',
    marginRight: 50,
  },
});
