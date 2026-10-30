import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { Surgir, Tocavel } from '../../src/components/Animacoes';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone, type NomeIcone } from '../../src/components/Icone';
import { carregarAvisos, marcarLido, type Aviso } from '../../src/notificacoes/caixa';
import { colors } from '../../src/theme/colors';
import { fontFamily } from '../../src/theme/typography';

const VISUAL: Record<Aviso['type'], { icone: NomeIcone; fundo: string }> = {
  // Cores com significado (prototipo/paleta.json): rosa saúde, lilás rotina, azul o resto.
  vacina: { icone: 'vacina', fundo: colors.healthSurface },
  lembrete: { icone: 'sino', fundo: colors.premiumSurface },
  dose: { icone: 'capsula', fundo: colors.healthSurface },
  peso: { icone: 'balanca', fundo: colors.healthSurface },
  sistema: { icone: 'escudo', fundo: colors.background },
  campanha: { icone: 'sino', fundo: colors.primarySurface },
  guarda: { icone: 'pessoas', fundo: colors.primarySurface },
  perdido: { icone: 'local', fundo: colors.healthSurface },
  comunidade: { icone: 'coracao', fundo: colors.premiumSurface },
  pedido: { icone: 'sacola', fundo: colors.primarySurface },
};

function grupo(iso: string): string {
  const data = new Date(iso);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  if (data >= hoje) return 'Hoje';
  if (data >= ontem) return 'Ontem';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

function hora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Caixa de avisos (protótipo CaixaAvisos, BUSINESS.md 5.43): o histórico dos
 * últimos 30 dias, em Hoje, Ontem e datas, com ponto vermelho nos não lidos.
 * Tocar abre a tela do aviso e marca como lido; a engrenagem leva às
 * preferências (tela Avisos).
 */
export default function CaixaAvisos() {
  const { user } = useAuth();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dono, setDono] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const versao = useRef(0);
  const ocupado = useRef(false);

  const recarregar = useCallback(() => {
      const token = ++versao.current;
      setAvisos([]); setDono(null); setErro(null); setCarregando(true); setAbrindo(false); ocupado.current=false;
      if (!user) { setCarregando(false); return; }
      carregarAvisos(user.id).then(
        (lista) => {
          if (token !== versao.current) return;
          setAvisos(lista);
          setDono(user.id);
        },
        (e) => { if (token === versao.current) setErro(e instanceof Error ? e.message : String(e)); },
      ).finally(() => { if (token === versao.current) setCarregando(false); });
    }, [user]);
  useFocusEffect(useCallback(() => { recarregar(); return () => { versao.current++; }; }, [recarregar]));

  const listaAtual = dono === user?.id ? avisos : [];
  const naoLidos = listaAtual.filter((a) => !a.read_at).length;

  async function handleAbrir(aviso: Aviso) {
    if (ocupado.current || !user || dono !== user.id) return;
    const token = versao.current;
    ocupado.current=true; setAbrindo(true);
    try {
      if (!aviso.read_at) await marcarLido(aviso.id, user.id);
      if (token !== versao.current) return;
      setAvisos((atual) => atual.map((a) => a.id === aviso.id ? { ...a, read_at: a.read_at ?? new Date().toISOString() } : a));
      if (aviso.deep_link) router.push(aviso.deep_link as Href);
    } catch (e) {
      if (token === versao.current) Alert.alert('Não foi possível abrir o aviso', e instanceof Error ? e.message : String(e));
    } finally {
      if (token === versao.current) { ocupado.current=false; setAbrindo(false); }
    }
  }

  const grupos: { titulo: string; itens: Aviso[] }[] = [];
  for (const aviso of listaAtual) {
    const titulo = grupo(aviso.sent_at);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.titulo === titulo) ultimo.itens.push(aviso);
    else grupos.push({ titulo, itens: [aviso] });
  }

  return (
    <View style={estilos.tela}>
      <HeroiOnda
        subtitulo={carregando ? 'Consultando avisos' : erro ? 'Consulta indisponível' : naoLidos === 0 ? 'Tudo lido' : naoLidos === 1 ? '1 novo' : `${naoLidos} novos`}
        titulo="Avisos"
        altura={196}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Escolher quais avisos receber"
          onPress={() => router.push('/avisos')}
          hitSlop={8}
          style={({ pressed }) => [estilos.engrenagem, pressed && { opacity: 0.6 }]}
        >
          <Icone nome="engrenagem" size={22} espessura={1.9} />
        </Pressable>
      </HeroiOnda>

      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {carregando ? (
          <ActivityIndicator color={colors.primaryDeep} style={estilos.carregando} />
        ) : erro ? (
          <View><Text accessibilityRole="alert" style={estilos.vazio}>Não foi possível carregar seus avisos. {erro}</Text><Pressable accessibilityRole="button" onPress={recarregar} style={estilos.preferencias}><Text style={estilos.preferenciasTexto}>Tentar novamente</Text></Pressable></View>
        ) : listaAtual.length === 0 ? (
          <Text style={estilos.vazio}>Nenhum aviso nos últimos 30 dias. Os lembretes e as doses aparecem aqui.</Text>
        ) : (
          grupos.map((g) => (
            <View key={g.titulo} style={estilos.grupo}>
              <Text style={estilos.grupoTitulo}>{g.titulo}</Text>
              {g.itens.map((aviso, i) => <ItemAviso key={aviso.id} aviso={aviso} indice={i} abrindo={abrindo} onAbrir={handleAbrir} />)}
            </View>
          ))
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/avisos')}
          style={({ pressed }) => [estilos.preferencias, pressed && { opacity: 0.7 }]}
        >
          <Text style={estilos.preferenciasTexto}>Escolher quais avisos receber</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function ItemAviso({ aviso, indice, abrindo, onAbrir }: { aviso: Aviso; indice: number; abrindo: boolean; onAbrir: (aviso: Aviso) => Promise<void> }) {
  const visual = VISUAL[aviso.type];
  const novo = !aviso.read_at;
  return (
    <Surgir indice={Math.min(indice, 4)}>
      <Tocavel accessibilityRole="button" accessibilityLabel={`${novo ? 'Novo. ' : ''}${aviso.title}. ${aviso.body ?? ''}`}
        onPress={() => { void onAbrir(aviso); }} disabled={abrindo} accessibilityState={{ disabled: abrindo, busy: abrindo }} escala={0.98}
        style={[estilos.aviso, novo ? estilos.avisoNovo : estilos.avisoLido]}>
        <View style={[estilos.icone, { backgroundColor: visual.fundo }]}><Icone nome={visual.icone} size={20} /></View>
        <View style={estilos.flex}>
          <Text style={estilos.titulo} numberOfLines={1}>{aviso.title}</Text>
          {aviso.body ? <Text style={estilos.corpo} numberOfLines={2}>{aviso.body}</Text> : null}
        </View>
        <View style={estilos.lado}><Text style={estilos.hora}>{hora(aviso.sent_at)}</Text>{novo ? <View style={estilos.ponto} /> : null}</View>
      </Tocavel>
    </Surgir>
  );
}
const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  engrenagem: {
    position: 'absolute',
    right: 24,
    top: 56,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conteudo: { paddingHorizontal: 24, paddingBottom: 40, gap: 14 },
  carregando: { marginTop: 32 },
  vazio: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21, color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  grupo: { gap: 8 },
  grupoTitulo: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.textMuted },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 24, padding: 12 },
  avisoNovo: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border },
  avisoLido: { backgroundColor: colors.surface },
  icone: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  corpo: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted },
  lado: { alignItems: 'flex-end', gap: 8, alignSelf: 'stretch', justifyContent: 'center' },
  hora: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.textMuted },
  ponto: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D93B5A' },
  preferencias: {
    marginTop: 8,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferenciasTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
});
