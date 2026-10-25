import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Tocavel } from '../../../src/components/Animacoes';
import { BotaoPrimario } from '../../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../../src/components/HeroiOnda';
import { Icone } from '../../../src/components/Icone';
import { abrirConvite, nomesPets, responderConvite, type Convite } from '../../../src/guarda/guarda';
import { mensagemDeErro } from '../../../src/lib/cacheOffline';
import { AvatarPet } from '../../../src/pets/AvatarPet';
import { usePets } from '../../../src/pets/PetsProvider';
import { colors } from '../../../src/theme/colors';
import { fontFamily } from '../../../src/theme/typography';

const SITUACAO: Record<string, string> = {
  aceito: 'Este convite já foi aceito.',
  recusado: 'Este convite foi recusado.',
  cancelado: 'Quem convidou cancelou este convite.',
  expirado: 'Este convite expirou. Peça um novo.',
};

/**
 * Convite de guarda recebido (protótipo GuardaConvite, tela 103). Abre pelo
 * aviso (/guarda/convite/<id>) ou pelo link do convite (/guarda/convite/link?t=<token>).
 */
export default function ConviteGuarda() {
  const { id, t } = useLocalSearchParams<{ id: string; t?: string }>();
  const token = typeof t === 'string' && t ? t : null;
  const idConvite = token ? null : id;
  const { recarregar } = usePets();
  const [convite, setConvite] = useState<Convite | null>(null);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [respondendo, setRespondendo] = useState<'aceitar' | 'recusar' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      abrirConvite(idConvite, token).then(
        (c) => {
          setConvite(c);
          if (c.encontrado) setEscolhidos(c.pets.map((p) => p.id));
        },
        (e: unknown) => setErro(mensagemDeErro(e instanceof Error ? e.message : String(e))),
      );
    }, [idConvite, token]),
  );

  async function responder(aceitar: boolean) {
    if (!convite?.encontrado) return;
    if (aceitar && escolhidos.length === 0) {
      setErro('Escolha pelo menos um pet.');
      return;
    }
    setErro(null);
    setRespondendo(aceitar ? 'aceitar' : 'recusar');
    try {
      await responderConvite(convite.id, aceitar, aceitar ? escolhidos : null, token);
      if (aceitar) {
        await recarregar();
        router.replace('/pets');
      } else {
        router.back();
      }
    } catch (e) {
      setErro(mensagemDeErro(e instanceof Error ? e.message : String(e)));
    } finally {
      setRespondendo(null);
    }
  }

  if (!convite && !erro) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <ActivityIndicator color={colors.primaryDeep} />
      </View>
    );
  }

  const aberto = convite?.encontrado && convite.situacao === 'enviado' && !convite.proprio;
  const titulo = convite?.encontrado ? `Dividir os cuidados de ${nomesPets(convite.pets)}` : 'Convite';

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo={convite?.encontrado ? `${convite.titular} convidou você` : 'Guarda compartilhada'} titulo={titulo} altura={230} />
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {!convite?.encontrado ? <Text style={estilos.texto}>Não encontramos este convite. Confira se você entrou com o e-mail que recebeu o convite.</Text> : null}
        {convite?.encontrado && convite.proprio ? <Text style={estilos.texto}>Este convite foi você que enviou.</Text> : null}
        {convite?.encontrado && !convite.proprio && convite.situacao !== 'enviado' ? <Text style={estilos.texto}>{SITUACAO[convite.situacao]}</Text> : null}

        {aberto && convite?.encontrado ? (
          <>
            <Text style={estilos.secao}>Aceitar quais pets?</Text>
            {convite.pets.map((p) => {
              const marcado = escolhidos.includes(p.id);
              return (
                <Tocavel
                  key={p.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marcado }}
                  onPress={() => setEscolhidos((a) => (a.includes(p.id) ? a.filter((x) => x !== p.id) : [...a, p.id]))}
                  style={[estilos.pet, marcado && estilos.petMarcado]}
                >
                  <AvatarPet especie={p.especie} foto={p.foto_url} size={48} />
                  <View style={estilos.flex}>
                    <Text style={estilos.petNome}>{p.nome}</Text>
                    <Text style={estilos.petSub}>{p.especie === 'gato' ? 'Gato' : 'Cão'}</Text>
                  </View>
                  <View style={[estilos.check, marcado && estilos.checkMarcado]}>
                    {marcado ? <Icone nome="check" size={14} cor={colors.white} espessura={3} /> : null}
                  </View>
                </Tocavel>
              );
            })}
            <View style={estilos.resumo}>
              <Text style={estilos.resumoTexto}>
                Você vai ver e atualizar vacinas, remédios, peso e lembretes. O que você registrar aparece para {convite.titular} na hora, com o seu nome. Você pode sair da guarda quando quiser.
              </Text>
            </View>
            <View style={estilos.linhaValidade}>
              <Text style={estilos.validade}>
                Vale até {new Date(convite.expira_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </Text>
              <Text style={estilos.semPremium}>Não precisa de Premium</Text>
            </View>
          </>
        ) : null}
        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
      </ScrollView>
      <View style={estilos.rodape}>
        {aberto ? (
          <>
            <BotaoPrimario titulo="Aceitar" carregando={respondendo === 'aceitar'} desabilitado={respondendo !== null} onPress={() => responder(true)} />
            <Tocavel accessibilityRole="button" disabled={respondendo !== null} onPress={() => responder(false)} style={estilos.recusar}>
              <Text style={estilos.recusarTexto}>{respondendo === 'recusar' ? 'Recusando…' : 'Recusar'}</Text>
            </Tocavel>
          </>
        ) : (
          <BotaoPrimario titulo="Voltar" onPress={() => router.back()} />
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  centro: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  texto: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  pet: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white,
    borderWidth: 2, borderColor: colors.border, borderRadius: 24, paddingVertical: 10, paddingLeft: 10, paddingRight: 14,
  },
  petMarcado: { borderColor: colors.black },
  petNome: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  petSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkMarcado: { backgroundColor: colors.black, borderColor: colors.black },
  resumo: { backgroundColor: colors.background, borderRadius: 22, padding: 14 },
  resumoTexto: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  linhaValidade: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  validade: {
    fontFamily: fontFamily.bold, fontSize: 11, color: colors.warningText, backgroundColor: colors.warningSurface,
    borderRadius: 999, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 3,
  },
  semPremium: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.warningText },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 10 },
  recusar: { height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  recusarTexto: { fontFamily: fontFamily.semiBold, fontSize: 15, color: colors.black },
});
