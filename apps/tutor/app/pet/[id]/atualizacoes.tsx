import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/auth/AuthProvider';
import { Tocavel } from '../../../src/components/Animacoes';
import { HeroiOnda } from '../../../src/components/HeroiOnda';
import { Icone, type NomeIcone } from '../../../src/components/Icone';
import {
  agruparPorDia,
  carregarAtividades,
  carregarCuidadores,
  nomeAutor,
  ouvirAtividades,
  type Atividade,
  type Cuidadores,
  type TipoAtividade,
} from '../../../src/guarda/guarda';
import { mensagemDeErro } from '../../../src/lib/cacheOffline';
import { usePets } from '../../../src/pets/PetsProvider';
import { colors } from '../../../src/theme/colors';
import { fontFamily } from '../../../src/theme/typography';
import { textoDeErro } from '../../../src/lib/erros';

// Saúde em rosa (prototipo/paleta.json).
const VISUAL: Record<TipoAtividade, NomeIcone> = {
  vacina: 'vacina',
  vermifugo: 'capsula',
  peso: 'balanca',
  consulta: 'cruz',
  remedio: 'capsula',
  dose: 'check',
};

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Atualizações do pet (protótipo GuardaAtividade, tela 104): quem fez cada registro, na hora. */
export default function AtualizacoesPet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { pets } = usePets();
  const pet = pets.find((p) => p.id === id);
  const [itens, setItens] = useState<Atividade[] | null>(null);
  const [cuidadores, setCuidadores] = useState<Cuidadores | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      Promise.all([carregarAtividades(id), carregarCuidadores(id)]).then(
        ([lista, quem]) => {
          setItens(lista);
          setCuidadores(quem);
          setErro(null);
        },
        (e: unknown) => setErro(mensagemDeErro(textoDeErro(e))),
      );
    }, [id]),
  );

  useEffect(() => {
    if (!id) return;
    const parar = ouvirAtividades(id, (nova) => setItens((atual) => (atual?.some((a) => a.id === nova.id) ? atual : [nova, ...(atual ?? [])])));
    return parar;
  }, [id]);

  // A lista fica ouvindo o Realtime enquanto a tela está aberta.
  const aoVivo = itens !== null;
  const nomePet = pet?.nome ?? 'pet';
  const pessoas = cuidadores ? [cuidadores.titular, ...cuidadores.pessoas] : [];

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo="Guarda compartilhada" titulo={`Atualizações do ${nomePet}`} altura={196} />
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <View style={estilos.topo}>
          <Text style={estilos.quem} numberOfLines={1}>
            {pessoas.map((p) => (p.voce ? 'Você' : p.nome)).join(' e ') || ' '}
          </Text>
          {aoVivo ? (
            <View style={estilos.vivo}>
              <View style={estilos.ponto} />
              <Text style={estilos.vivoTexto}>Atualizado agora</Text>
            </View>
          ) : null}
        </View>

        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
        {!itens && !erro ? <ActivityIndicator color={colors.primaryDeep} style={estilos.carregando} /> : null}
        {itens && itens.length === 0 ? (
          <Text style={estilos.vazio}>Nada registrado nos últimos 30 dias. Vacinas, doses, peso e consultas aparecem aqui com o nome de quem registrou.</Text>
        ) : null}

        {agruparPorDia(itens ?? []).map((grupo) => (
          <View key={grupo.dia} style={estilos.grupo}>
            <Text style={estilos.dia}>{grupo.dia}</Text>
            {grupo.itens.map((a) => {
              const autor = nomeAutor(a.autor_id, user?.id, cuidadores);
              return (
                <View key={a.id} style={estilos.item}>
                  <View>
                    <View style={estilos.inicial}>
                      <Text style={estilos.inicialTexto}>{autor.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={estilos.selo}>
                      <Icone nome={VISUAL[a.tipo]} size={11} cor={colors.healthText} espessura={2.6} />
                    </View>
                  </View>
                  <View style={estilos.flex}>
                    <Text style={estilos.frase}>
                      <Text style={estilos.autor}>{autor}</Text> {a.resumo}
                    </Text>
                    <Text style={estilos.hora}>{hora(a.criado_em)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        <Tocavel accessibilityRole="button" onPress={() => router.push('/guarda')} style={estilos.rodape}>
          <View style={estilos.flex}>
            <Text style={estilos.rodapeTitulo}>Quem cuida do {nomePet}</Text>
            <Text style={estilos.rodapeSub} numberOfLines={2}>
              {pessoas.map((p) => (p === cuidadores?.titular ? `${p.voce ? 'Você' : p.nome} (titular)` : p.voce ? 'Você' : p.nome)).join(' e ')}
            </Text>
          </View>
          <Icone nome="seta" size={18} espessura={2} />
        </Tocavel>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 32, gap: 8 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  quem: { flex: 1, fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.black },
  vivo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2E9E62' },
  vivoTexto: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.successText },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  carregando: { marginTop: 24 },
  vazio: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, backgroundColor: colors.surface, borderRadius: 20, padding: 16 },
  grupo: { gap: 2, marginTop: 6 },
  dia: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginBottom: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  inicial: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  inicialTexto: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.black },
  selo: {
    position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.healthSurface, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  frase: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 19, color: colors.black },
  autor: { fontFamily: fontFamily.bold },
  hora: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  rodape: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background, borderRadius: 24, padding: 16, marginTop: 12 },
  rodapeTitulo: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  rodapeSub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted, marginTop: 1 },
});
