import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Surgir, Tocavel } from '../../src/components/Animacoes';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone } from '../../src/components/Icone';
import { AtribuicaoGoogle } from '../../src/mapa/AtribuicaoGoogle';
import { acharEndereco } from '../../src/mapa/geocodificar';
import { IlustracaoLugar } from '../../src/mapa/IlustracaoLugar';
import {
  CENTRO_PADRAO,
  buscarPetFriendly,
  formatarDistancia,
  seloPetFriendly,
  type CategoriaPetFriendly,
  type CategoriaLugar,
  type Lugar,
} from '../../src/mapa/lugares';
import { useRecurso } from '../../src/lib/configApp';
import { useLocalizacao } from '../../src/mapa/useLocalizacao';
import { useCategoriasMapa } from '../../src/mapa/useCategoriasMapa';
import { colors } from '../../src/theme/colors';
import { fontFamily } from '../../src/theme/typography';

type Filtro = 'todos' | CategoriaPetFriendly;

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'parque', rotulo: 'Parques' },
  { valor: 'praia', rotulo: 'Praias' },
  { valor: 'restaurante', rotulo: 'Restaurantes' },
  { valor: 'hotel', rotulo: 'Hotéis' },
];

/**
 * Lista vazia: nos dados abertos, restaurantes, hotéis e praias quase nunca
 * vêm marcados como "aceita cães" — melhor dizer isso do que só "nada".
 */
function textoVazio(filtro: Filtro, google: boolean, plurais: Record<CategoriaLugar, string>): string {
  const nome = filtro === 'todos' ? 'lugares pet friendly' : `${plurais[filtro].toLocaleLowerCase('pt-BR')} pet friendly`;
  if (!google && (filtro === 'restaurante' || filtro === 'hotel' || filtro === 'praia')) {
    return `Ainda não temos ${nome} nesta região: os mapas abertos quase não marcam quem aceita pets. Conhece algum? Indique abaixo.`;
  }
  return `Não encontramos ${nome} por perto. Tente outro bairro.`;
}

/** Região buscada pelo tutor: nome e ponto (geocodificação do aparelho, sem custo). */
type Regiao = { nome: string; lat: number; lng: number };

/**
 * Pet friendly (BUSINESS.md 5.19, protótipo PetFriendly): parques, praias,
 * restaurantes e hotéis que aceitam pets, perto do tutor ou de um bairro.
 * Uma busca traz as quatro categorias; os filtros só recortam a lista.
 */
export default function TelaPetFriendly() {
  const { nomes, plurais } = useCategoriasMapa();
  const { posicao } = useLocalizacao();
  const podeIndicar = useRecurso('indicar_lugar');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [texto, setTexto] = useState('');
  const [regiao, setRegiao] = useState<Regiao | null>(null);
  const [cidade, setCidade] = useState<string | null>(null);
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const centro = regiao ?? posicao ?? CENTRO_PADRAO;

  useEffect(() => {
    let vivo = true;
    buscarPetFriendly({ lat: centro.lat, lng: centro.lng })
      .then((lista) => {
        if (!vivo) return;
        setLugares(lista);
        setErro(null);
        setCarregando(false);
      })
      .catch((e: Error & { codigo?: string }) => {
        if (!vivo) return;
        setErro(e.codigo === 'limite' ? 'Você chegou ao limite de buscas de hoje. Tente amanhã.' : 'Não deu para buscar agora. Tente de novo.');
        setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [centro.lat, centro.lng]);

  // "Perto de você · Rio de Janeiro": a cidade da posição real.
  useEffect(() => {
    if (!posicao) return;
    Location.reverseGeocodeAsync({ latitude: posicao.lat, longitude: posicao.lng })
      .then(([endereco]) => setCidade(endereco?.city ?? endereco?.subregion ?? null))
      .catch(() => undefined);
  }, [posicao]);

  // O texto vem do próprio envio: o estado do campo pode ainda não ter chegado.
  async function buscarRegiao(enviado: string = texto) {
    const termo = enviado.trim();
    if (!termo) return;
    setCarregando(true);
    try {
      const ponto = await acharEndereco(cidade ? `${termo}, ${cidade}` : termo, posicao);
      if (!ponto) {
        setErro(`Não encontramos "${termo}". Tente outro bairro.`);
        setCarregando(false);
        return;
      }
      setRegiao({ nome: termo, ...ponto });
    } catch {
      setErro('Não deu para achar essa região agora.');
      setCarregando(false);
    }
  }

  function pertoDeMim() {
    if (!regiao) return;
    setRegiao(null);
    setTexto('');
    setCarregando(true);
  }

  const visiveis = (lugares ?? []).filter((l) => filtro === 'todos' || l.categoria === filtro);

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo="Mapa" titulo="Pet friendly" altura={196}>
      </HeroiOnda>

      <View style={estilos.corpo}>
        <View style={estilos.busca}>
          <Icone nome="busca" size={20} />
          <TextInput
            value={texto}
            onChangeText={setTexto}
            onSubmitEditing={(e) => buscarRegiao(e.nativeEvent.text)}
            placeholder="Buscar por bairro ou região"
            placeholderTextColor="#566070"
            returnKeyType="search"
            accessibilityLabel="Buscar por bairro ou região"
            style={estilos.buscaCampo}
          />
          {regiao ? <Text style={estilos.buscaRegiao}>{regiao.nome}</Text> : null}
        </View>

        <View style={estilos.linhaResumo}>
          <Text style={estilos.resumo} numberOfLines={1}>
            {regiao ? `Perto de ${regiao.nome}` : `Perto de você${cidade ? ` · ${cidade}` : ''}`}
          </Text>
          <Text style={estilos.ordem}>Mais próximos primeiro</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.chipsRolagem} contentContainerStyle={estilos.chips}>
          <Tocavel
            accessibilityRole="button"
            accessibilityState={{ selected: !regiao }}
            onPress={pertoDeMim}
            style={[estilos.chip, !regiao ? estilos.chipAtivo : estilos.chipInativo, estilos.chipPerto]}
          >
            <Icone nome="local" size={14} cor={!regiao ? colors.primary : colors.black} espessura={2.2} />
            <Text style={[estilos.chipTexto, !regiao && estilos.chipTextoAtivo]}>Perto de mim</Text>
          </Tocavel>
          {FILTROS.map((opcao) => {
            const ativo = filtro === opcao.valor;
            return (
              <Tocavel
                key={opcao.valor}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
                onPress={() => setFiltro(opcao.valor)}
                style={[estilos.chip, ativo ? estilos.chipAtivo : estilos.chipInativo]}
              >
                <Text style={[estilos.chipTexto, ativo && estilos.chipTextoAtivo]}>{opcao.valor === 'todos' ? opcao.rotulo : plurais[opcao.valor]}</Text>
              </Tocavel>
            );
          })}
        </ScrollView>

        <ScrollView style={estilos.flex} contentContainerStyle={estilos.lista} showsVerticalScrollIndicator={false}>
          {carregando ? (
            <ActivityIndicator color={colors.primaryDeep} style={estilos.carregando} />
          ) : erro ? (
            <Text style={estilos.vazio}>{erro}</Text>
          ) : visiveis.length === 0 ? (
            <Text style={estilos.vazio}>{textoVazio(filtro, Boolean(lugares.some((l) => l.fonte === 'google')), plurais)}</Text>
          ) : (
            visiveis.map((lugar, i) => <CartaoLugar key={lugar.id} lugar={lugar} indice={i} nomes={nomes} />)
          )}

          <View style={estilos.rodapeLista}>
            {lugares.some((l) => l.fonte === 'google') ? (
              <AtribuicaoGoogle />
            ) : (
              <Text style={estilos.nota}>Dados abertos: © OpenStreetMap e Overture Maps.</Text>
            )}
            <Text style={estilos.nota}>Confirme com o local antes de ir.</Text>
          </View>

          {/* O painel pode pausar as indicações (área Sistema). */}
          {podeIndicar ? (
            <Tocavel
              accessibilityRole="button"
              onPress={() => router.push('/mapa/indicar')}
              escala={0.98}
              style={estilos.indicar}
            >
              <View style={estilos.indicarIcone}>
                <Icone nome="pata" size={20} />
              </View>
              <View style={estilos.flex}>
                <Text style={estilos.indicarTitulo}>Conhece um lugar que aceita pets?</Text>
                <Text style={estilos.indicarSub}>Indique e ajude outros tutores</Text>
              </View>
              <Icone nome="seta" size={18} espessura={2} />
            </Tocavel>
          ) : null}
        </ScrollView>
      </View>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Ver no mapa"
          icone={<Icone nome="local" size={22} espessura={2} />}
          onPress={() => router.navigate({ pathname: '/mapa', params: { filtro: 'pet_friendly' } })}
        />
      </View>
    </View>
  );
}

function CartaoLugar({ lugar, indice, nomes }: { lugar: Lugar; indice: number; nomes: Record<CategoriaLugar, string> }) {
  const selo = seloPetFriendly(lugar);
  const linha = [
    nomes[lugar.categoria],
    formatarDistancia(lugar.distancia_km),
    lugar.nota ? `${lugar.nota.toFixed(1).replace('.', ',')} ★` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Surgir indice={Math.min(indice, 5)}>
      <Tocavel
        accessibilityRole="button"
        accessibilityLabel={`${lugar.nome}, ${linha}${selo ? `, ${selo}` : ''}`}
        onPress={() => router.push({ pathname: '/lugar', params: { id: lugar.id, categoria: lugar.categoria } })}
        style={estilos.cartao}
      >
        <View style={estilos.miniatura}>
          <IlustracaoLugar categoria={lugar.categoria} tamanho={72} />
        </View>
        <View style={estilos.flex}>
          <Text style={estilos.nome} numberOfLines={1}>
            {lugar.nome}
          </Text>
          <Text style={estilos.detalhe} numberOfLines={1}>
            {linha}
          </Text>
          {selo ? (
            <View style={estilos.selo}>
              <Text style={estilos.seloTexto}>{selo}</Text>
            </View>
          ) : null}
        </View>
      </Tocavel>
    </Surgir>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  pata: { position: 'absolute', right: 30, top: 54 },
  corpo: { flex: 1, paddingHorizontal: 24, gap: 8 },
  busca: {
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  buscaCampo: { flex: 1, minWidth: 0, fontFamily: fontFamily.medium, fontSize: 14, color: colors.black, paddingVertical: 0 },
  buscaRegiao: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.primaryDeep },
  linhaResumo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  resumo: { flex: 1, fontFamily: fontFamily.bold, fontSize: 13, color: colors.black },
  ordem: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.textMuted },
  chipsRolagem: { flexGrow: 0, marginHorizontal: -24 },
  chips: { gap: 8, paddingHorizontal: 24 },
  chip: { height: 38, borderRadius: 19, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  chipPerto: { flexDirection: 'row', gap: 6, paddingHorizontal: 14 },
  chipAtivo: { backgroundColor: colors.black },
  chipInativo: { borderWidth: 1.5, borderColor: colors.border },
  chipTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.black },
  chipTextoAtivo: { color: colors.white },
  lista: { gap: 8, paddingTop: 4, paddingBottom: 16 },
  carregando: { marginTop: 32 },
  vazio: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21, color: colors.textMuted, textAlign: 'center', marginTop: 24, paddingHorizontal: 12 },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: '#EEF0F4',
    borderRadius: 22,
    padding: 8,
  },
  miniatura: { width: 72, height: 72, borderRadius: 16, overflow: 'hidden' },
  nome: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  detalhe: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  selo: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: '#D8F2E3', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  seloTexto: { fontFamily: fontFamily.bold, fontSize: 11, color: '#1F6B45' },
  indicar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFE3CC',
    borderRadius: 22,
    padding: 10,
    paddingRight: 16,
    marginTop: 8,
  },
  indicarIcone: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  indicarTitulo: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  indicarSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  rodapeLista: { alignItems: 'center', gap: 2, marginTop: 4 },
  nota: { fontFamily: fontFamily.regular, fontSize: 11, lineHeight: 16, color: '#566070', textAlign: 'center', paddingHorizontal: 6, marginTop: 4 },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
});
