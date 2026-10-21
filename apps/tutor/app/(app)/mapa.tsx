import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Svg, { Path } from 'react-native-svg';
import { ligarPara } from '../../src/mapa/acoes';
import { Deslizar } from '../../src/components/Animacoes';
import { Icone } from '../../src/components/Icone';
import { ehErroDeRede } from '../../src/lib/cacheOffline';
import { acharEndereco } from '../../src/mapa/geocodificar';
import { AcaoEstado, CartaoEstadoMapa } from '../../src/mapa/CartaoEstadoMapa';
import { lugaresSalvos } from '../../src/mapa/favoritos';
import { FolhaRota } from '../../src/mapa/FolhaRota';
import { IlustracaoLugar } from '../../src/mapa/IlustracaoLugar';
import { MapaLugares, type ControleMapa } from '../../src/mapa/MapaLugares';
import {
  buscarLugares,
  buscarPetFriendly,
  CENTRO_PADRAO,
  formatarDistancia,
  resumoStatus,
  ROTULO_CATEGORIA,
  type CategoriaLugar,
  type Lugar,
} from '../../src/mapa/lugares';
import { useLocalizacao } from '../../src/mapa/useLocalizacao';
import { colors } from '../../src/theme/colors';
import { radius, shadow, spacing } from '../../src/theme/tokens';
import { fontFamily, typography } from '../../src/theme/typography';

/** 'pet_friendly' chega da tela Pet friendly ("Ver no mapa"). */
type Filtro = 'todos' | CategoriaLugar | '24h' | 'salvos' | 'pet_friendly';

// Ordem do protótipo Mapa; o chip Pet friendly abre a tela própria (5.19).
const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'clinica', rotulo: 'Clínicas' },
  { valor: 'petshop', rotulo: 'Petshops' },
  { valor: 'creche', rotulo: 'Creches' },
  { valor: 'hotelzinho', rotulo: 'Hotelzinhos' },
  { valor: 'banho_tosa', rotulo: 'Banho e tosa' },
  { valor: '24h', rotulo: '24 h' },
  { valor: 'salvos', rotulo: 'Salvos' },
];

const FILTROS_DE_ATALHO: Filtro[] = [...FILTROS.map((f) => f.valor), 'pet_friendly'];

/** Para o cartão "Nada por perto": "Não achamos creches perto de você." */
const NOME_NO_PLURAL: Record<Filtro, string> = {
  todos: 'lugares pet',
  clinica: 'clínicas',
  petshop: 'petshops',
  banho_tosa: 'lugares de banho e tosa',
  creche: 'creches',
  hotelzinho: 'hotelzinhos',
  '24h': 'clínicas abertas 24 h',
  salvos: 'lugares salvos',
  pet_friendly: 'lugares pet friendly',
  parque: 'parques',
  praia: 'praias',
  restaurante: 'restaurantes',
  hotel: 'hotéis',
};

/** Raio do mapa (protótipo: "em 3 km"); o cartão sem resultados oferece 10 km. */
const RAIO_PADRAO_KM = 3;
const RAIO_AMPLO_KM = 10;

/** Últimos lugares vistos, para o mapa sem internet (BUSINESS.md 5.43). */
const ULTIMOS_VISTOS = 'petlive-cache:mapa-ultimos';

/** "hoje", "ontem" ou "há 3 dias". */
function haQuanto(data: Date): string {
  const dias = Math.floor((Date.now() - data.getTime()) / 86_400_000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}

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
  const [raioKm, setRaioKm] = useState(RAIO_PADRAO_KM);
  // Sem internet: mostra os últimos lugares vistos e quando foram atualizados.
  const [semRede, setSemRede] = useState<{ desde: Date | null } | null>(null);
  const [tentativa, setTentativa] = useState(0);
  // Busca por bairro (sem GPS): o campo passa a mover o mapa até a região.
  const [modoRegiao, setModoRegiao] = useState(false);
  const [regiao, setRegiao] = useState<{ lat: number; lng: number } | null>(null);
  const campoBusca = useRef<TextInputInstance>(null);
  const mapaRef = useRef<ControleMapa>(null);
  // O toque no pin também chega ao mapa logo depois; sem isto o cartão
  // do lugar abria e fechava no mesmo toque.
  const tocouPin = useRef(false);

  const centro = regiao ?? posicao ?? CENTRO_PADRAO;
  const so24h = categoria === '24h';

  // Consulta por perto muda com a posição, o filtro e a busca.
  useEffect(() => {
    let vivo = true;
    const consulta =
      categoria === 'salvos'
        ? lugaresSalvos()
        : categoria === 'pet_friendly'
          ? buscarPetFriendly({ lat: centro.lat, lng: centro.lng })
          : buscarLugares({
              lat: centro.lat,
              lng: centro.lng,
              categoria: so24h || categoria === 'todos' ? null : categoria,
              busca: buscaAtiva,
              aberto24h: so24h ? true : null,
              raioKm,
            });
    consulta
      .then((lista) => {
        if (!vivo) return;
        setLugares(lista);
        setSelecionado(null);
        setSemRede(null);
        setCarregando(false);
        if (lista.length > 0) {
          AsyncStorage.setItem(ULTIMOS_VISTOS, JSON.stringify({ quando: new Date().toISOString(), lugares: lista })).catch(
            () => undefined,
          );
        }
      })
      .catch(async (e: Error) => {
        if (!vivo) return;
        if (ehErroDeRede(e.message)) {
          const guardado = await AsyncStorage.getItem(ULTIMOS_VISTOS).catch(() => null);
          const ultimos = guardado ? (JSON.parse(guardado) as { quando: string; lugares: Lugar[] }) : null;
          if (!vivo) return;
          setLugares(ultimos?.lugares ?? []);
          setSemRede({ desde: ultimos ? new Date(ultimos.quando) : null });
        }
        setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [centro.lat, centro.lng, categoria, buscaAtiva, so24h, raioKm, tentativa]);

  // Chegou a localização real: centraliza o mapa nela.
  useEffect(() => {
    if (posicao) {
      mapaRef.current?.irPara(posicao, 14, 600);
    }
  }, [posicao]);

  function escolherFiltro(valor: Filtro) {
    setCategoriaManual(valor);
    setSelecionado(null);
    setCarregando(true);
  }

  // O texto vem do próprio envio: o estado do campo pode ainda não ter chegado.
  async function aplicarBusca(enviado: string = busca) {
    if (modoRegiao) {
      // Bairro ou região: o mapa vai até lá e a busca por perto usa esse ponto.
      const texto = enviado.trim();
      if (!texto) return;
      const ponto = await acharEndereco(texto, centro);
      if (!ponto) {
        Alert.alert('Não achamos esse lugar', `Confira "${texto}" ou tente o nome do bairro e da cidade.`);
        return;
      }
      setRegiao(ponto);
      mapaRef.current?.irPara(ponto, 14, 600);
      setModoRegiao(false);
      setBusca('');
      setCarregando(true);
      return;
    }
    setBuscaAtiva(enviado.trim());
    setSelecionado(null);
    setCarregando(true);
  }

  function buscarPorRegiao() {
    setModoRegiao(true);
    setBusca('');
    campoBusca.current?.focus();
  }

  async function permitirLocalizacao() {
    const { canAskAgain } = await Location.getForegroundPermissionsAsync();
    if (canAskAgain) localizar();
    else Linking.openSettings().catch(() => undefined);
  }

  function limparFiltros() {
    setCategoriaManual('todos');
    setBusca('');
    setBuscaAtiva('');
    setCarregando(true);
  }

  function selecionar(lugar: Lugar) {
    tocouPin.current = true;
    setTimeout(() => {
      tocouPin.current = false;
    }, 500);
    setSelecionado(lugar);
    mapaRef.current?.irPara(lugar, 15, 350);
  }

  function meuLocal() {
    if (posicao) {
      mapaRef.current?.irPara(posicao, 14, 350);
    } else {
      localizar();
    }
  }

  const lugar = selecionado;
  // Algum cartão de estado (sem internet, sem localização, sem resultados) na tela.
  const comEstado = !lugar && (Boolean(semRede) || (permissao === 'negada' && !regiao) || (!carregando && lugares.length === 0));

  return (
    <View style={estilos.tela}>
      <MapaLugares
        ref={mapaRef}
        centro={CENTRO_PADRAO}
        zoom={13}
        pins={lugares}
        selecionado={lugar?.id}
        mostrarUsuario={permissao === 'concedida'}
        posicaoCredito={estilos.creditoMapa}
        onPin={(id) => {
          const escolhido = lugares.find((l) => l.id === id);
          if (escolhido) selecionar(escolhido);
        }}
        onToqueMapa={() => {
          if (tocouPin.current) return;
          setSelecionado(null);
        }}
      />

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
            ref={campoBusca}
            placeholder={modoRegiao ? 'Bairro ou região' : 'Buscar lugares pet'}
            placeholderTextColor={colors.textMuted}
            value={busca}
            onChangeText={setBusca}
            onSubmitEditing={(e) => aplicarBusca(e.nativeEvent.text)}
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

      {carregando && (
        <ActivityIndicator
          style={estilos.indicador}
          size="large"
          color={colors.primaryDeep}
          accessibilityLabel="Carregando lugares"
        />
      )}

      {/* Estados do mapa (BUSINESS.md 5.43): sem internet, sem localização, sem resultados. */}
      {semRede ? (
        <View style={estilos.faixaSemRede} pointerEvents="none">
          <Icone nome="semRede" size={18} cor={colors.warningText} espessura={2} />
          <Text style={estilos.faixaSemRedeTexto}>Sem internet. Mostrando os últimos lugares vistos.</Text>
        </View>
      ) : null}

      {!lugar && !carregando && semRede ? (
        <CartaoEstadoMapa
          icone="semRede"
          fundoIcone={colors.warningSurface}
          titulo="Você está sem internet"
          sub={semRede.desde ? `Atualizado ${haQuanto(semRede.desde)}` : 'Nenhum lugar guardado ainda'}
          texto="Os lugares salvos continuam na lista, mas telefone, horário e fotos podem estar desatualizados. A busca e a rota precisam de internet."
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/sos/primeiros-socorros')}
            style={({ pressed }) => [estilos.atalhoSos, pressed && { opacity: 0.7 }]}
          >
            <View style={estilos.atalhoSosIcone}>
              <Icone nome="cruz" size={20} cor="#B3173A" espessura={2.2} />
            </View>
            <View>
              <Text style={estilos.atalhoSosTitulo}>Primeiros socorros</Text>
              <Text style={estilos.atalhoSosSub}>Funciona sem internet</Text>
            </View>
          </Pressable>
          <AcaoEstado
            rotulo="Tentar de novo"
            onPress={() => {
              setCarregando(true);
              setTentativa((t) => t + 1);
            }}
          />
        </CartaoEstadoMapa>
      ) : !lugar && permissao === 'negada' && !regiao ? (
        <CartaoEstadoMapa
          icone="local"
          fundoIcone={colors.primarySurface}
          titulo="Ative a localização"
          sub="Para mostrar o que há por perto"
          texto="O PetLive usa a sua posição só enquanto o mapa está aberto, para achar clínicas, petshops e lugares pet friendly perto de você."
        >
          <AcaoEstado rotulo="Permitir localização" onPress={permitirLocalizacao} />
          <AcaoEstado rotulo="Buscar por bairro ou região" tipo="secundaria" onPress={buscarPorRegiao} />
          <AcaoEstado rotulo="Emergência? Abrir o SOS" tipo="link" cor="#B3173A" onPress={() => router.push('/sos')} />
        </CartaoEstadoMapa>
      ) : !lugar && !carregando && lugares.length === 0 ? (
        categoria === 'salvos' ? (
          <CartaoEstadoMapa
            icone="coracao"
            fundoIcone={colors.premiumSurface}
            titulo="Nenhum lugar salvo"
            sub="Seus favoritos aparecem aqui"
            texto="Toque no coração na ficha de um lugar para salvar."
          >
            <AcaoEstado rotulo="Ver lugares por perto" onPress={limparFiltros} />
          </CartaoEstadoMapa>
        ) : (
          <CartaoEstadoMapa
            icone="lupaMenos"
            fundoIcone={colors.premiumSurface}
            titulo="Nada por perto"
            sub={`Com estes filtros, em ${raioKm} km`}
            texto={`Não achamos ${NOME_NO_PLURAL[categoria]}${buscaAtiva ? ` com "${buscaAtiva}"` : ''} perto de você. Tente um destes caminhos.`}
          >
            {raioKm < RAIO_AMPLO_KM ? (
              <AcaoEstado
                rotulo={`Aumentar a busca para ${RAIO_AMPLO_KM} km`}
                onPress={() => {
                  setCarregando(true);
                  setRaioKm(RAIO_AMPLO_KM);
                }}
              />
            ) : null}
            {categoria !== 'todos' || buscaAtiva ? (
              <AcaoEstado rotulo="Limpar os filtros" tipo={raioKm < RAIO_AMPLO_KM ? 'secundaria' : 'principal'} onPress={limparFiltros} />
            ) : null}
            <AcaoEstado rotulo="Ver lugares pet friendly por perto" tipo="link" onPress={() => router.push('/mapa/pet-friendly')} />
          </CartaoEstadoMapa>
        )
      ) : null}

      {/* Botão "meu local" (some enquanto o card do lugar está aberto). */}
      {!lugar && !comEstado && (
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
  creditoMapa: {
    right: spacing.xxl,
    top: 168,
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
  faixaSemRede: {
    position: 'absolute',
    top: 168,
    left: spacing.xxl,
    right: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.warningSurface,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    ...shadow.card,
  },
  faixaSemRedeTexto: { flex: 1, fontFamily: fontFamily.bold, fontSize: 13, color: colors.warningText },
  atalhoSos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FBDADF',
    borderRadius: 22,
    padding: 10,
  },
  atalhoSosIcone: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  atalhoSosTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  atalhoSosSub: { fontFamily: fontFamily.regular, fontSize: 12, color: '#A3324F' },
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
