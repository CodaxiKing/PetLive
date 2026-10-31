import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAPA_GOOGLE, MapaLugares, type ControleMapa } from './MapaLugares';
import { buscarLugares, type Lugar } from './lugares';
import { acharEndereco } from './geocodificar';
import { AtribuicaoGoogle } from './AtribuicaoGoogle';
import { colors } from '../theme/colors';
import { components, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { textoDeErro } from '../lib/erros';

type Ponto = { lat: number; lng: number };
export type LocalEvento = { modo: 'ponto'; ponto: Ponto } | { modo: 'google'; placeId: string };

/** Montado ao abrir: fechar descarta o rascunho sem alterar o formulário. */
export function SeletorLocalEvento({ inicial, onEscolher, onFechar }: {
  inicial: Ponto | null; onEscolher: (local: LocalEvento) => void; onFechar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [ponto, setPonto] = useState<Ponto | null>(inicial);
  const [endereco, setEndereco] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const mapa = useRef<ControleMapa>(null);
  const ocupado = useRef(false);
  const consulta = useRef(0);
  const centro = inicial ?? { lat: -22.9068, lng: -43.1729 };
  const texto = { ...typography.body, color: colors.text };
  const acao = { ...typography.bodyMedium, color: colors.primaryDeep, paddingVertical: spacing.md };
  function fechar() { consulta.current++; onFechar(); }

  async function buscar(google: boolean) {
    if (ocupado.current) return;
    ocupado.current = true;
    const numero = ++consulta.current;
    setBuscando(true); setErro(null); setLugares([]);
    try {
      if (google) {
        const encontrados = await buscarLugares({ ...(ponto ?? centro), raioKm: 5 });
        if (numero !== consulta.current) return;
        const resultados = encontrados.filter((l) => l.fonte === 'google');
        setLugares(resultados);
        if (!resultados.length) setErro('Nenhum lugar do Google disponível nesta região. Você pode marcar um ponto no mapa.');
      } else {
        const encontrado = await acharEndereco(endereco, ponto ?? centro);
        if (numero !== consulta.current) return;
        if (!encontrado) throw new Error('Endereço não encontrado. Tente informar bairro e cidade.');
        mapa.current?.irPara(encontrado, 16);
        setPonto(encontrado);
      }
    } catch (e) { if (numero === consulta.current) setErro(textoDeErro(e, 'Não foi possível buscar o local.')); }
    finally { if (numero === consulta.current) { setBuscando(false); ocupado.current = false; } }
  }

  return <Modal animationType="slide" onRequestClose={fechar}>
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ padding: spacing.lg }}>
        <Pressable accessibilityRole="button" onPress={fechar}><Text style={acao}>Cancelar seleção</Text></Pressable>
        <Text accessibilityRole="header" style={typography.h2}>Onde será o evento?</Text>
        <Text style={texto}>Busque um endereço e toque no mapa para marcar o local público.</Text>
        <TextInput accessibilityLabel="Endereço, bairro e cidade" value={endereco} onChangeText={setEndereco} style={components.input} placeholder="Endereço, bairro e cidade" />
        <Pressable accessibilityRole="button" disabled={buscando || !endereco.trim()} onPress={() => void buscar(false)}><Text style={acao}>Buscar endereço</Text></Pressable>
        {erro ? <Text accessibilityRole="alert" style={texto}>{erro}</Text> : null}
      </View>
      <View style={{ flex: 1, minHeight: 220 }}>
        <MapaLugares ref={mapa} centro={centro} zoom={14} pins={ponto ? [{ id: 'evento', ...ponto, categoria: 'parque' }] : []} selecionado="evento" onSelecionarPonto={(p) => { consulta.current++; ocupado.current = false; setBuscando(false); setPonto(p); setLugares([]); }} />
      </View>
      <ScrollView style={{ maxHeight: 200 }} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
        {buscando ? <ActivityIndicator accessibilityLabel="Buscando local" /> : null}
        {MAPA_GOOGLE ? <><Pressable accessibilityRole="button" disabled={buscando} onPress={() => void buscar(true)}><Text style={acao}>Lugares do Google perto do ponto</Text></Pressable><AtribuicaoGoogle /></> : null}
        {lugares.map((l) => <Pressable accessibilityRole="button" key={l.id} onPress={() => { consulta.current++; onEscolher({ modo: 'google', placeId: l.id }); }}><Text style={acao}>{l.nome}</Text><Text style={texto}>{l.endereco}</Text></Pressable>)}
        <Pressable accessibilityRole="button" disabled={!ponto || buscando} onPress={() => { if (ponto) { consulta.current++; onEscolher({ modo: 'ponto', ponto }); } }}><Text style={[acao, !ponto && { opacity: 0.4 }]}>Usar ponto marcado</Text></Pressable>
      </ScrollView>
    </View>
  </Modal>;
}
