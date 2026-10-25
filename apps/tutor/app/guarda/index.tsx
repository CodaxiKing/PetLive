import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Tocavel } from '../../src/components/Animacoes';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone } from '../../src/components/Icone';
import {
  cancelarConvite,
  carregarPainel,
  nomesPets,
  removerPessoa,
  sairDaGuarda,
  type PainelGuarda,
  type PessoaGuarda,
  type PetResumo,
} from '../../src/guarda/guarda';
import { mensagemDeErro } from '../../src/lib/cacheOffline';
import { AvatarPet } from '../../src/pets/AvatarPet';
import { usePets } from '../../src/pets/PetsProvider';
import { colors } from '../../src/theme/colors';
import { fontFamily } from '../../src/theme/typography';

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function ChipsPets({ pets }: { pets: PetResumo[] }) {
  return (
    <View style={estilos.chips}>
      {pets.map((p) => (
        <View key={p.id} style={estilos.chip}>
          <AvatarPet especie={p.especie} foto={p.foto_url} size={22} />
          <Text style={estilos.chipTexto}>{p.nome}</Text>
        </View>
      ))}
    </View>
  );
}

function Inicial({ nome }: { nome: string }) {
  return (
    <View style={estilos.inicial}>
      <Text style={estilos.inicialTexto}>{nome.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}

/** Guarda compartilhada (protótipo GuardaCompartilhada, tela 101; BUSINESS.md 5.45). */
export default function GuardaCompartilhada() {
  const { recarregar } = usePets();
  const [painel, setPainel] = useState<PainelGuarda | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    carregarPainel().then(
      (p) => {
        setPainel(p);
        setErro(null);
      },
      (e: unknown) => setErro(mensagemDeErro(e instanceof Error ? e.message : String(e))),
    );
  }, []);
  useFocusEffect(carregar);

  const agir = (acao: () => Promise<void>) => () => {
    acao().then(
      () => {
        carregar();
        void recarregar();
      },
      (e: unknown) => Alert.alert('Não deu certo', mensagemDeErro(e instanceof Error ? e.message : String(e))),
    );
  };

  function opcoesPessoa(pessoa: PessoaGuarda) {
    const botoes = [
      { text: 'Cancelar', style: 'cancel' as const },
      ...(pessoa.pets.length > 1
        ? pessoa.pets.map((p) => ({ text: `Tirar de ${p.nome}`, onPress: agir(() => removerPessoa(pessoa.user_id, [p.id])) }))
        : []),
      { text: 'Remover de todos', style: 'destructive' as const, onPress: agir(() => removerPessoa(pessoa.user_id)) },
    ];
    Alert.alert(pessoa.nome, `Divide a guarda de ${nomesPets(pessoa.pets)}. O acesso acaba na hora e o histórico continua no pet.`, botoes);
  }

  function sair(titular: string, pets: PetResumo[]) {
    Alert.alert(`Sair da guarda de ${nomesPets(pets)}?`, `Você deixa de ver e atualizar ${pets.length > 1 ? 'esses pets' : 'esse pet'}. ${titular} é avisado.`, [
      { text: 'Ficar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: agir(() => sairDaGuarda(pets.map((p) => p.id))) },
    ]);
  }

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo="Divida os cuidados dos seus pets" titulo="Guarda compartilhada" altura={196} />
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <View style={estilos.info}>
          <Text style={estilos.infoTexto}>
            <Text style={estilos.infoForte}>Quem divide a guarda cuida junto: </Text>
            vê e atualiza vacinas, remédios, peso e lembretes. Tudo o que um registra aparece para todos na hora.
          </Text>
        </View>

        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
        {!painel && !erro ? <ActivityIndicator color={colors.primaryDeep} style={estilos.carregando} /> : null}

        {painel?.recebidos.length ? (
          <>
            <Text style={estilos.secao}>Convites para você</Text>
            {painel.recebidos.map((c) => (
              <Tocavel key={c.id} accessibilityRole="button" onPress={() => router.push(`/guarda/convite/${c.id}`)} style={[estilos.cartao, estilos.cartaoConvite]}>
                <View style={estilos.linha}>
                  <Inicial nome={c.titular} />
                  <View style={estilos.flex}>
                    <Text style={estilos.nome}>{c.titular} convidou você</Text>
                    <Text style={estilos.sub}>{nomesPets(c.pets)} · vale até {dataCurta(c.expira_em)}</Text>
                  </View>
                  <Icone nome="seta" size={18} espessura={2} />
                </View>
              </Tocavel>
            ))}
          </>
        ) : null}

        {painel?.comigo.length ? (
          <>
            <Text style={estilos.secao}>Pets que dividem com você</Text>
            {painel.comigo.map((g) => (
              <View key={g.titular_id} style={estilos.cartao}>
                <View style={estilos.linha}>
                  <Inicial nome={g.titular} />
                  <View style={estilos.flex}>
                    <Text style={estilos.nome}>{g.titular}</Text>
                    <Text style={estilos.sub}>{g.suspensa ? 'Pausada: o Premium de quem convidou acabou' : 'Titular dos pets'}</Text>
                  </View>
                  {g.suspensa ? <Text style={[estilos.etiqueta, estilos.etiquetaAtencao]}>Pausada</Text> : <Text style={[estilos.etiqueta, estilos.etiquetaOk]}>Ativa</Text>}
                </View>
                <View style={estilos.rodapeCartao}>
                  <ChipsPets pets={g.pets} />
                  <Tocavel accessibilityRole="button" onPress={() => sair(g.titular, g.pets)}>
                    <Text style={estilos.acaoPerigo}>Sair</Text>
                  </Tocavel>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {painel ? (
          <>
            <Text style={estilos.secao}>Pessoas</Text>
            {painel.pessoas.length === 0 && painel.convites.length === 0 ? (
              <Text style={estilos.vazio}>Ninguém divide a guarda dos seus pets ainda.</Text>
            ) : null}
            {painel.pessoas.map((p) => (
              <Tocavel key={p.user_id} accessibilityRole="button" accessibilityLabel={`Opções de ${p.nome}`} onPress={() => opcoesPessoa(p)} style={estilos.cartao}>
                <View style={estilos.linha}>
                  <Inicial nome={p.nome} />
                  <View style={estilos.flex}>
                    <Text style={estilos.nome}>{p.nome}</Text>
                    <Text style={estilos.sub}>Desde {dataCurta(p.desde)}</Text>
                  </View>
                  <Text style={[estilos.etiqueta, estilos.etiquetaOk]}>Ativa</Text>
                </View>
                <ChipsPets pets={p.pets} />
              </Tocavel>
            ))}
            {painel.convites.map((c) => (
              <View key={c.id} style={estilos.cartao}>
                <View style={estilos.linha}>
                  <Inicial nome={c.email} />
                  <View style={estilos.flex}>
                    <Text style={estilos.nome} numberOfLines={1}>{c.email}</Text>
                    <Text style={estilos.sub}>Convite enviado · vale até {dataCurta(c.expira_em)}</Text>
                  </View>
                  <Text style={[estilos.etiqueta, estilos.etiquetaAtencao]}>Aguardando</Text>
                </View>
                <View style={estilos.rodapeCartao}>
                  <ChipsPets pets={c.pets} />
                  <Tocavel accessibilityRole="button" onPress={agir(() => cancelarConvite(c.id))}>
                    <Text style={estilos.acaoPerigo}>Cancelar convite</Text>
                  </Tocavel>
                </View>
              </View>
            ))}
            <Text style={estilos.nota}>
              Até {painel.limite} pessoas por pet. Só você apaga o pet, convida ou remove pessoas. Incluído no Premium.
            </Text>
          </>
        ) : null}
      </ScrollView>
      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo={painel && !painel.premium ? 'Conhecer o Premium' : 'Convidar pessoa'}
          onPress={() => router.push(painel && !painel.premium ? '/premium' : '/guarda/convidar')}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  info: { backgroundColor: colors.primarySurface, borderRadius: 24, padding: 16 },
  infoTexto: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.primaryDeep },
  infoForte: { fontFamily: fontFamily.bold, color: colors.black },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  carregando: { marginTop: 24 },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 4 },
  vazio: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted, backgroundColor: colors.background, borderRadius: 20, padding: 16 },
  cartao: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border, borderRadius: 26, padding: 14, gap: 10 },
  cartaoConvite: { borderColor: colors.black },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inicial: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  inicialTexto: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.black },
  nome: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  sub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  etiqueta: { fontFamily: fontFamily.bold, fontSize: 11, borderRadius: 999, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 3 },
  etiquetaOk: { backgroundColor: colors.successSurface, color: colors.successText },
  etiquetaAtencao: { backgroundColor: colors.warningSurface, color: colors.warningText },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingLeft: 3, paddingRight: 10,
    borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white,
  },
  chipTexto: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.black },
  rodapeCartao: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acaoPerigo: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.healthText },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, paddingHorizontal: 4 },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
});
