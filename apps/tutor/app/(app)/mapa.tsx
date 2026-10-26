import { useCallback, useEffect, useRef, useState } from 'react';
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
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import Svg, { Path } from 'react-native-svg';
import { ligarPara } from '../../src/mapa/acoes';
import { Deslizar } from '../../src/components/Animacoes';
import { Icone } from '../../src/components/Icone';
import { ehErroDeRede } from '../../src/lib/cacheOffline';
import { useAuth } from '../../src/auth/AuthProvider';
import { guardarMapa, lerMapa } from '../../src/mapa/cacheMapa';
import { acharEndereco } from '../../src/mapa/geocodificar';
import { AcaoEstado, CartaoEstadoMapa } from '../../src/mapa/CartaoEstadoMapa';
import { lugaresSalvos } from '../../src/mapa/favoritos';
import { reunirLugares } from '../../src/mapa/descoberta';
import { FolhaRota } from '../../src/mapa/FolhaRota';
import { IlustracaoLugar } from '../../src/mapa/IlustracaoLugar';
import { MapaLugares, type ControleMapa } from '../../src/mapa/MapaLugares';
import {
  buscarLugares,
  buscarPetFriendly,
  CENTRO_PADRAO,
  formatarDistancia,
  resumoStatus,
  type CategoriaLugar,
  type Lugar,
} from '../../src/mapa/lugares';
import { useLocalizacao } from '../../src/mapa/useLocalizacao';
import { useCategoriasMapa } from '../../src/mapa/useCategoriasMapa';
import { ehCategoria } from '../../src/mapa/categorias';
import { dataHoraEvento, eventosPorPerto, TIPO_EVENTO, type EventoMapa } from '../../src/mapa/eventos';
import { colors } from '../../src/theme/colors';
import { radius, shadow, spacing } from '../../src/theme/tokens';
import { fontFamily, typography } from '../../src/theme/typography';

/** 'pet_friendly' chega da tela Pet friendly ("Ver no mapa"). */
type Filtro = 'todos' | CategoriaLugar | '24h' | 'salvos' | 'pet_friendly';

// Serviços mais usados primeiro; a faixa permite acessar os demais filtros.
const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'clinica', rotulo: 'Clínicas' },
  { valor: 'petshop', rotulo: 'Petshops' },
  { valor: 'banho_tosa', rotulo: 'Banho e tosa' },
  { valor: 'creche', rotulo: 'Creches' },
  { valor: 'hotelzinho', rotulo: 'Hotelzinhos' },
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
  const { nomes: rotulosCategoria, plurais } = useCategoriasMapa();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [alturaTopo, setAlturaTopo] = useState(200);
  const [alturaTela, setAlturaTela] = useState(700);
  const rodape = Math.max(insets.bottom, 20) + 64 + 12;
  const inicioEventos = Math.max(alturaTopo + 120, alturaTela * 0.48);
  // Atalhos do Início chegam como ?filtro=clinica|banho_tosa|petshop|24h; a escolha manual
  // dos chips passa a valer assim que o toque um.
  const { filtro, aba: abaInicial } = useLocalSearchParams<{ filtro?: string; aba?: string }>();
  const [categoriaManual, setCategoriaManual] = useState<Filtro | null>(null);
  const filtroDoAtalho = FILTROS_DE_ATALHO.find((valor) => valor === filtro) ?? 'todos';
  const categoria: Filtro = categoriaManual ?? filtroDoAtalho;

  const { permissao, posicao, localizar, localizando } = useLocalizacao();

  const [busca, setBusca] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState('');
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLugares, setErroLugares] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<Lugar | null>(null);
  const [rotaAberta, setRotaAberta] = useState(false);
  const [raioKm, setRaioKm] = useState(RAIO_PADRAO_KM);
  // Sem internet: mostra os últimos lugares vistos e quando foram atualizados.
  const [semRede, setSemRede] = useState<{ desde: Date | null } | null>(null);
  const [tentativa, setTentativa] = useState(0);
  // Busca por bairro (sem GPS): o campo passa a mover o mapa até a região.
  const [modoRegiao, setModoRegiao] = useState(false);
  const [regiao, setRegiao] = useState<{ lat: number; lng: number } | null>(null);
  const [aba, setAba] = useState<'lugares' | 'eventos'>(abaInicial === 'eventos' ? 'eventos' : 'lugares');
  const [eventos, setEventos] = useState<EventoMapa[]>([]);
  const [carregandoEventos, setCarregandoEventos] = useState(false);
  const [erroEventos, setErroEventos] = useState<string | null>(null);
  const [filtroEvento, setFiltroEvento] = useState<'hoje' | 'semana' | 'mes'>('mes');
  const [tipoEvento, setTipoEvento] = useState<EventoMapa['tipo'] | null>(null);
  const campoBusca = useRef<TextInputInstance>(null);
  const mapaRef = useRef<ControleMapa>(null);
  // O toque no pin também chega ao mapa logo depois; sem isto o cartão
  // do lugar abria e fechava no mesmo toque.
  const tocouPin = useRef(false);

  const centro = regiao ?? posicao ?? CENTRO_PADRAO;
  const so24h = categoria === '24h';

  const iniciarConsulta = useCallback(() => {
    setLugares([]);
    setSelecionado(null);
    setErroLugares(null);
    setSemRede(null);
    setCarregando(true);
  }, []);

  // Revalida também ao voltar da ficha: os favoritos podem ter mudado lá.
  useFocusEffect(useCallback(() => {
    if (aba !== 'lugares') return;
    if (!posicao && !regiao && categoria !== 'salvos') return;
    iniciarConsulta();
    let vivo = true;
    const consultaCache = { usuario: user?.id ?? '', lat: centro.lat, lng: centro.lng, raioKm, categoria, busca: buscaAtiva };
    let parciais: Lugar[] = [];
    const aoCarregar = (lista: Lugar[]) => {
      if (!vivo) return;
      parciais = reunirLugares([parciais, lista]);
      setLugares(parciais);
      setSelecionado(null);
      setErroLugares(null);
      setSemRede(null);
      setCarregando(false);
    };
    const consulta =
      categoria === 'salvos'
        ? lugaresSalvos()
        : categoria === 'pet_friendly'
          ? buscarPetFriendly({ lat: centro.lat, lng: centro.lng }, raioKm, aoCarregar)
          : buscarLugares({
              lat: centro.lat,
              lng: centro.lng,
              categoria: so24h || categoria === 'todos' ? null : categoria,
              busca: buscaAtiva,
              aberto24h: so24h ? true : null,
              raioKm,
              incluirPetFriendly: categoria === 'todos',
              aoCarregar,
            });
    consulta
      .then((lista) => {
        if (!vivo) return;
        setLugares(lista);
        setSelecionado(null);
        setSemRede(null);
        setErroLugares(null);
        setCarregando(false);
        void guardarMapa(consultaCache, lista);
      })
      .catch(async (e: Error) => {
        if (!vivo) return;
        setSelecionado(null);
        if (ehErroDeRede(e.message)) {
          const ultimos = await lerMapa(consultaCache);
          if (!vivo) return;
          setLugares(ultimos?.lugares ?? []);
          setSemRede({ desde: ultimos?.quando ?? null });
          setErroLugares(null);
        } else {
          setLugares([]);
          setSemRede(null);
          setErroLugares('Não foi possível consultar os lugares agora. Tente novamente em instantes.');
        }
        setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  // O contador força nova consulta mesmo sem mudança de região/filtro.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, centro.lat, centro.lng, posicao, regiao, categoria, buscaAtiva, so24h, raioKm, tentativa, user?.id, iniciarConsulta]));

  useFocusEffect(useCallback(() => {
    if (aba !== 'eventos') return;
    let vivo = true;
    setCarregandoEventos(true); setErroEventos(null); setEventos([]);
    eventosPorPerto({ lat: centro.lat, lng: centro.lng }, raioKm, filtroEvento, tipoEvento)
      .then((lista) => { if (vivo) setEventos(lista); })
      .catch((erro: unknown) => { if (vivo) setErroEventos(erro instanceof Error ? erro.message : 'Tente novamente.'); })
      .finally(() => { if (vivo) setCarregandoEventos(false); });
    return () => { vivo = false; };
  // Recria a consulta ao tocar em Tentar novamente.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, centro.lat, centro.lng, raioKm, tentativa, filtroEvento, tipoEvento]));

  // Chegou a localização real: centraliza o mapa nela.
  useEffect(() => {
    if (posicao && !regiao) {
      mapaRef.current?.irPara(posicao, 14, 600);
    }
  }, [posicao, regiao]);

  function escolherFiltro(valor: Filtro) {
    if (valor === categoria) return;
    setCategoriaManual(valor);
    setSelecionado(null);
    iniciarConsulta();
  }

  // O texto vem do próprio envio: o estado do campo pode ainda não ter chegado.
  async function aplicarBusca(enviado: string = busca) {
    if (modoRegiao || aba === 'eventos') {
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
      iniciarConsulta();
      return;
    }
    setBuscaAtiva(enviado.trim());
    if (enviado.trim() === buscaAtiva) setTentativa((n) => n + 1);
    setSelecionado(null);
    iniciarConsulta();
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
    iniciarConsulta();
    setTentativa((n) => n + 1);
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
    // O ponto azul anda com o GPS; a primeira posição fica de reserva.
    const agora = mapaRef.current?.posicaoUsuario() ?? posicao;
    if (agora) {
      iniciarConsulta();
      setRegiao(agora);
      setBusca('');
      setBuscaAtiva('');
      setTentativa((n) => n + 1);
      mapaRef.current?.irPara(agora, 15, 350);
    } else {
      localizar();
    }
  }

  const lugar = aba === 'lugares' ? selecionado : null;
  // Algum cartão de estado (sem internet, sem localização, sem resultados) na tela.
  const comEstado = aba === 'lugares' && !lugar && (Boolean(erroLugares) || Boolean(semRede) || (!posicao && !regiao && !localizando && categoria !== 'salvos') || (!carregando && lugares.length === 0));

  return (
    <View style={estilos.tela} onLayout={(e) => setAlturaTela(e.nativeEvent.layout.height)}>
      <View style={aba === 'eventos' ? [estilos.mapaEventos, { height: inicioEventos }] : StyleSheet.absoluteFill}>
        <MapaLugares ref={mapaRef} centro={centro} zoom={13}
          pins={aba === 'lugares' ? lugares : eventos.flatMap((e) => e.lat === null || e.lng === null ? [] : [{ id: e.id, lat: e.lat, lng: e.lng, categoria: 'parque' as const, evento: true }])}
          selecionado={aba === 'lugares' ? lugar?.id : null} mostrarUsuario={permissao === 'concedida'} posicaoCredito={[estilos.creditoMapa, { top: alturaTopo + 8 }]}
          onPin={(id) => {
            if (aba === 'eventos') { router.push({ pathname: '/eventos/[id]', params: { id } }); return; }
            const escolhido = lugares.find((l) => l.id === id);
            if (escolhido) selecionar(escolhido);
          }}
          onToqueMapa={() => { if (!tocouPin.current) setSelecionado(null); }}
        />
      </View>

      {/* Topo: busca e filtros flutuando sobre o mapa (protótipo Mapa). */}
      <View style={[estilos.topo, { paddingTop: insets.top + 12 }]} onLayout={(e) => setAlturaTopo(e.nativeEvent.layout.height)} pointerEvents="box-none">
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
            placeholder={modoRegiao || aba === 'eventos' ? 'Bairro ou região' : 'Buscar lugares pet'}
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

        <View style={estilos.linhaContexto}>
        <Pressable onPress={buscarPorRegiao} accessibilityRole="button" accessibilityLabel="Escolher bairro ou cidade" style={estilos.regiaoAtual}>
          <Icone nome="local" size={15} cor={colors.primaryDeep} />
          <Text numberOfLines={1} style={estilos.regiaoTexto}>{regiao ? 'Região escolhida' : posicao ? 'Perto de você' : 'Escolher região'} · {raioKm} km</Text>
        </Pressable>
        <View style={estilos.abasMapa}>
          {(['lugares', 'eventos'] as const).map((item) => {
            const ativo = aba === item;
            return (
              <Pressable key={item} onPress={() => { if (item === aba) return; setAba(item); setBusca(''); if (item === 'lugares') iniciarConsulta(); }} accessibilityRole="button"
                accessibilityState={{ selected: ativo }} style={[estilos.abaMapa, ativo && estilos.abaMapaAtiva]}>
                <Text style={[estilos.abaMapaTexto, ativo && estilos.abaMapaTextoAtiva]}>{item === 'lugares' ? 'Lugares' : 'Eventos'}</Text>
              </Pressable>
            );
          })}
        </View>
        </View>
        {aba === 'lugares' ? <ScrollView
          horizontal
          bounces={false}
          contentInsetAdjustmentBehavior="never"
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
                {ativo ? <Icone nome="check" size={15} cor={colors.white} /> : null}
                <Text style={[estilos.pilulaTexto, ativo && estilos.pilulaTextoAtiva]}>
                  {ehCategoria(opcao.valor) ? plurais[opcao.valor] : opcao.rotulo}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => escolherFiltro('pet_friendly')}
            accessibilityRole="button"
            accessibilityState={{ selected: categoria === 'pet_friendly' }}
            style={[estilos.pilula, categoria === 'pet_friendly' && estilos.pilulaAtiva]}
          >
            <Text style={[estilos.pilulaTexto, categoria === 'pet_friendly' && estilos.pilulaTextoAtiva]}>
              Pet friendly
            </Text>
          </Pressable>
          {/* SOS no fim dos filtros, em vermelho cheio (protótipo Mapa, BUSINESS 5.17). */}
          <Pressable
            onPress={() => router.push('/sos')}
            accessibilityRole="button"
            accessibilityLabel="SOS: emergência"
            style={[estilos.pilula, estilos.pilulaSos]}
          >
            <Text style={[estilos.pilulaTexto, estilos.pilulaTextoSos]}>SOS</Text>
          </Pressable>
        </ScrollView> : null}
      </View>

      {aba === 'eventos' ? (
        <View style={[estilos.listaEventos, { top: inicioEventos, bottom: rodape }]}>
          <View style={estilos.eventosCabecalho}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.eventosTitulo}>Eventos por perto</Text>
              {permissao !== 'concedida' && !regiao ? <Text style={estilos.eventosSub}>Rio de Janeiro · busque um bairro para mudar</Text> : null}
              <Text style={estilos.eventosSub}>{filtroEvento === 'hoje' ? 'Hoje' : filtroEvento === 'semana' ? 'Esta semana' : 'Próximos 30 dias'} · até {raioKm} km</Text>
            </View>
            <View style={estilos.acoesEventosTopo}>
              <Pressable accessibilityRole="button" onPress={() => router.push('/eventos/meus')} style={estilos.meusEventosBotao}>
                <Text style={estilos.meusEventosTexto}>Meus</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push('/eventos/novo')} style={estilos.criarEvento}>
                <Text style={estilos.criarEventoTexto}>Criar</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView horizontal style={{ flexGrow: 0, flexShrink: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.filtrosEvento}>
            {([{ valor: 'hoje', rotulo: 'Hoje' }, { valor: 'semana', rotulo: 'Esta semana' }, { valor: 'mes', rotulo: '30 dias' }] as const).map((item) => <Pressable key={item.valor} accessibilityRole="button" accessibilityState={{ selected: filtroEvento === item.valor }} onPress={() => setFiltroEvento(item.valor)} style={[estilos.filtroEvento, filtroEvento === item.valor && estilos.filtroEventoAtivo]}><Text style={[estilos.filtroEventoTexto, filtroEvento === item.valor && estilos.filtroEventoTextoAtivo]}>{item.rotulo}</Text></Pressable>)}
            <View style={estilos.separadorFiltro} />
            {([null, ...Object.keys(TIPO_EVENTO)] as (EventoMapa['tipo'] | null)[]).map((valor) => <Pressable key={valor ?? 'todos'} accessibilityRole="button" accessibilityState={{ selected: tipoEvento === valor }} onPress={() => setTipoEvento(valor)} style={[estilos.filtroEvento, (tipoEvento === valor) && estilos.filtroEventoAtivo]}><Text style={[estilos.filtroEventoTexto, tipoEvento === valor && estilos.filtroEventoTextoAtivo]}>{valor ? TIPO_EVENTO[valor] : 'Todos os tipos'}</Text></Pressable>)}
          </ScrollView>
          {carregandoEventos ? <ActivityIndicator accessibilityLabel="Carregando eventos" color={colors.primaryDeep} /> : erroEventos ? <View style={estilos.eventosVazio}><Text accessibilityRole="alert" style={estilos.eventosVazioTexto}>{erroEventos}</Text><Pressable accessibilityRole="button" onPress={() => setTentativa((n) => n + 1)}><Text style={estilos.eventosVazioAcao}>Tentar novamente</Text></Pressable></View> : eventos.length === 0 ? (
            <View style={estilos.eventosVazio}>
              <Text style={estilos.eventosVazioTitulo}>Nenhum evento por perto</Text>
              <Text style={estilos.eventosVazioTexto}>Você pode criar um evento pet. Ele passa por análise antes de aparecer no mapa.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/eventos/novo')}>
                <Text style={estilos.eventosVazioAcao}>Criar evento</Text>
              </Pressable>
            </View>
          ) : <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={estilos.eventosListaInterna}>
            {eventos.map((evento) => {
              return (
                <View key={evento.id} style={estilos.eventoCard}>
                  <View style={estilos.eventoEtiquetas}>
                    <Text style={estilos.eventoTipo}>{TIPO_EVENTO[evento.tipo]}</Text>
                    <Text style={estilos.eventoPreco}>{evento.gratuito ? 'Gratuito' : `R$ ${((evento.preco_centavos ?? 0) / 100).toFixed(2).replace('.', ',')}`}</Text>
                  </View>
                  <Text style={estilos.eventoTitulo}>{evento.titulo}</Text>
                  <Text style={estilos.eventoData}>{dataHoraEvento(evento.inicio_em, evento.fim_em)}</Text>
                  <Text style={estilos.eventoLocal}>{evento.local_nome}{evento.distancia_km === null ? '' : ` · ${evento.distancia_km.toFixed(1).replace('.', ',')} km`}</Text>
                  <Text style={estilos.eventoDescricao} numberOfLines={3}>{evento.descricao}</Text>
                  <View style={estilos.eventoRodape}>
                    <Text style={estilos.eventoConfirmados}>{evento.confirmados} confirmados{evento.vagas === null ? '' : ` · ${Math.max(0, evento.vagas - evento.confirmados)} vagas`}</Text>
                    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/eventos/[id]', params: { id: evento.id } })} style={estilos.presencaBotao}>
                      <Text style={estilos.presencaTexto}>Ver evento</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>}
        </View>
      ) : null}

      {aba === 'lugares' && (localizando || (carregando && (categoria === 'salvos' || Boolean(posicao || regiao)))) && (
        <ActivityIndicator
          style={estilos.indicador}
          size="large"
          color={colors.primaryDeep}
          accessibilityLabel="Carregando lugares"
        />
      )}

      {/* Estados do mapa (BUSINESS.md 5.43): sem internet, sem localização, sem resultados. */}
      {aba === 'lugares' && semRede ? (
        <View style={[estilos.faixaSemRede, { top: alturaTopo + 30 }]} pointerEvents="none">
          <Icone nome="semRede" size={18} cor={colors.warningText} espessura={2} />
          <Text style={estilos.faixaSemRedeTexto}>{semRede.desde ? 'Sem internet. Mostrando a cópia desta região.' : 'Sem internet. Nenhuma cópia desta consulta.'}</Text>
        </View>
      ) : null}

      {aba !== 'lugares' ? null : !lugar && !carregando && erroLugares ? (
        <CartaoEstadoMapa icone="local" fundoIcone={colors.primarySurface} titulo="Não foi possível carregar" sub="A consulta de lugares falhou" texto={erroLugares} topoMinimo={alturaTopo + 28}>
          <AcaoEstado rotulo="Tentar novamente" onPress={() => { iniciarConsulta(); setTentativa((n) => n + 1); }} />
          <AcaoEstado rotulo="Abrir o SOS" tipo="link" onPress={() => router.push('/sos')} />
        </CartaoEstadoMapa>
      ) : !lugar && !carregando && semRede ? (
        <CartaoEstadoMapa
          topoMinimo={alturaTopo + 80}
          icone="semRede"
          fundoIcone={colors.warningSurface}
          titulo="Você está sem internet"
          sub={semRede.desde ? `Atualizado ${haQuanto(semRede.desde)}` : 'Nenhum lugar guardado ainda'}
          texto={semRede.desde ? 'Exibindo a consulta guardada desta região e destes filtros. Os dados podem estar desatualizados. Busca e rotas precisam de internet.' : 'Ainda não há uma cópia desta região com estes filtros. Conecte-se à internet para carregar os lugares. Favoritos não são substituídos por outros resultados.'}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/sos/primeiros-socorros')}
            style={({ pressed }) => [estilos.atalhoSos, pressed && { opacity: 0.7 }]}
          >
            <View style={estilos.atalhoSosIcone}>
              <Icone nome="cruz" size={20} cor={colors.healthText} espessura={2.2} />
            </View>
            <View>
              <Text style={estilos.atalhoSosTitulo}>Primeiros socorros</Text>
              <Text style={estilos.atalhoSosSub}>Funciona sem internet</Text>
            </View>
          </Pressable>
          <AcaoEstado
            rotulo="Tentar de novo"
            onPress={() => {
              iniciarConsulta();
              setTentativa((t) => t + 1);
            }}
          />
        </CartaoEstadoMapa>
      ) : !lugar && !posicao && !regiao && !localizando && categoria !== 'salvos' ? (
        <CartaoEstadoMapa
          topoMinimo={alturaTopo + 28}
          icone="local"
          fundoIcone={colors.primarySurface}
          titulo={permissao === 'negada' ? 'Ative a localização' : 'Não encontramos sua posição'}
          sub="Para mostrar o que há por perto"
          texto="O PetLive usa a sua posição só enquanto o mapa está aberto, para achar clínicas, petshops e lugares pet friendly perto de você."
        >
          <AcaoEstado rotulo={permissao === 'negada' ? 'Permitir localização' : 'Tentar localizar novamente'} onPress={permitirLocalizacao} />
          <AcaoEstado rotulo="Buscar por bairro ou região" tipo="secundaria" onPress={buscarPorRegiao} />
          <AcaoEstado rotulo="Emergência? Abrir o SOS" tipo="link" cor={colors.emergency} onPress={() => router.push('/sos')} />
        </CartaoEstadoMapa>
      ) : !lugar && !carregando && lugares.length === 0 ? (
        categoria === 'salvos' ? (
          <CartaoEstadoMapa
            topoMinimo={alturaTopo + 28}
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
            topoMinimo={alturaTopo + 28}
            icone="lupaMenos"
            fundoIcone={colors.premiumSurface}
            titulo="Nada por perto"
            sub={`Com estes filtros, em ${raioKm} km`}
            texto={`Não achamos ${ehCategoria(categoria) ? plurais[categoria].toLocaleLowerCase('pt-BR') : NOME_NO_PLURAL[categoria]}${buscaAtiva ? ` com "${buscaAtiva}"` : ''} perto de você. Tente um destes caminhos.`}
          >
            {raioKm < RAIO_AMPLO_KM ? (
              <AcaoEstado
                rotulo={`Aumentar a busca para ${RAIO_AMPLO_KM} km`}
                onPress={() => {
                  iniciarConsulta();
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
      {aba === 'lugares' && !lugar && !comEstado && (
        <Pressable
          style={[estilos.fab, { bottom: rodape + 12 }]}
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
        <Deslizar key={lugar.id} style={[estilos.ficha, { bottom: rodape }]}>
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
                    rotulosCategoria[lugar.categoria],
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
                  {rotulosCategoria[lugar.categoria]}
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
  mapaEventos: { position: 'absolute', top: 0, left: 0, right: 0 },
  abasMapa: {
    flexDirection: 'row',
    marginTop: 0,
    alignSelf: 'center',
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
  },
  abaMapa: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  linhaContexto: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  regiaoAtual: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, minHeight: 44 },
  regiaoTexto: { ...typography.captionMedium, color: colors.textMuted, flexShrink: 1 },
  abaMapaAtiva: { backgroundColor: colors.black },
  abaMapaTexto: { ...typography.captionMedium, color: colors.textMuted },
  abaMapaTextoAtiva: { color: colors.white },
  listaEventos: {
    position: 'absolute',
    top: '53%',
    bottom: 96,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radius.xl, padding: spacing.sm,
  },
  filtrosEvento: { gap: spacing.sm, paddingBottom: spacing.md },
  filtroEvento: { borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  filtroEventoAtivo: { backgroundColor: colors.primarySurface },
  filtroEventoTexto: { ...typography.caption, color: colors.textMuted },
  filtroEventoTextoAtivo: { color: colors.primaryDeep, fontFamily: fontFamily.bold },
  separadorFiltro: { width: 1, height: 24, backgroundColor: colors.border, marginHorizontal: spacing.xs },
  eventosCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  eventosTitulo: { ...typography.h3, fontFamily: fontFamily.bold, color: colors.black },
  eventosSub: { ...typography.caption, color: colors.textMuted },
  criarEvento: { backgroundColor: colors.black, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  criarEventoTexto: { ...typography.captionMedium, color: colors.white },
  acoesEventosTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meusEventosBotao: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  meusEventosTexto: { ...typography.captionMedium, color: colors.text },
  eventosVazio: { backgroundColor: colors.surface, padding: spacing.xl, borderRadius: radius.xl, gap: spacing.sm, ...shadow.card },
  eventosVazioTitulo: { ...typography.bodyMedium, fontFamily: fontFamily.bold, color: colors.black },
  eventosVazioTexto: { ...typography.caption, color: colors.textMuted },
  eventosVazioAcao: { ...typography.captionMedium, color: colors.primaryDeep, paddingTop: spacing.xs },
  eventosListaInterna: { gap: spacing.md, paddingBottom: spacing.xxxl },
  eventoCard: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.xl, gap: spacing.sm, ...shadow.card },
  eventoEtiquetas: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventoTipo: { ...typography.captionMedium, color: colors.primaryDeep },
  eventoPreco: { ...typography.captionMedium, color: colors.successText },
  eventoTitulo: { ...typography.bodyMedium, fontFamily: fontFamily.bold, color: colors.black },
  eventoData: { ...typography.captionMedium, color: colors.text },
  eventoLocal: { ...typography.caption, color: colors.textMuted },
  eventoDescricao: { ...typography.caption, color: colors.text },
  eventoRodape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
  eventoConfirmados: { ...typography.caption, color: colors.textMuted, flex: 1 },
  presencaBotao: { backgroundColor: colors.black, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  presencaBotaoAtivo: { backgroundColor: colors.successSurface },
  presencaBotaoDesativado: { backgroundColor: colors.disabled },
  presencaTexto: { ...typography.captionMedium, color: colors.white },
  presencaTextoAtivo: { color: colors.successText },
  ingressoLink: { ...typography.captionMedium, color: colors.primaryDeep, paddingTop: spacing.xs },
  denunciarEvento: { alignSelf: 'flex-start', paddingTop: spacing.xs },
  denunciarEventoTexto: { ...typography.caption, color: colors.danger },
  topo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...shadow.card,
    gap: 6,
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
    height: 52,
    maxHeight: 52,
    flexGrow: 0,
    flexShrink: 0,
    marginHorizontal: -spacing.lg,
  },
  filtros: {
    gap: spacing.sm,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  pilula: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  pilulaSos: {
    backgroundColor: colors.emergency,
  },
  pilulaTextoSos: {
    color: colors.white,
    fontFamily: fontFamily.bold,
  },
  pilulaAtiva: {
    backgroundColor: colors.black,
    borderColor: colors.black,
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
    backgroundColor: colors.healthSurface,
    borderRadius: 22,
    padding: 10,
  },
  atalhoSosIcone: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  atalhoSosTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  atalhoSosSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.healthText },
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
