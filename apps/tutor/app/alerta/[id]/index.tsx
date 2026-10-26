import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { Tocavel } from '../../../src/components/Animacoes';
import { BotaoPrimario } from '../../../src/components/BotaoPrimario';
import { Icone } from '../../../src/components/Icone';
import { Mascote } from '../../../src/components/Mascote';
import { mensagemDeErro } from '../../../src/lib/cacheOffline';
import { abrirAlerta, distanciaKm, haQuanto, textoDistancia, type Alerta } from '../../../src/perdido/perdido';
import { colors } from '../../../src/theme/colors';
import { fontFamily } from '../../../src/theme/typography';

/** Alerta de pet perdido para quem está perto (protótipo PerdidoAlerta, tela 65). */
export default function AlertaPerdido() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [alerta, setAlerta] = useState<Alerta | null>(null);
  const [distancia, setDistancia] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      abrirAlerta(id).then(setAlerta, (e: unknown) => setErro(mensagemDeErro(e instanceof Error ? e.message : String(e))));
    }, [id]),
  );

  // Distância só com a permissão já dada (não pede de novo aqui).
  useEffect(() => {
    if (!alerta || !alerta.encontrado || !('lat' in alerta)) return;
    let vivo = true;
    Location.getForegroundPermissionsAsync()
      .then(async ({ granted }) => {
        if (!granted) return;
        const p = await Location.getLastKnownPositionAsync();
        if (vivo && p) setDistancia(distanciaKm(p.coords.latitude, p.coords.longitude, alerta.lat, alerta.lng));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [alerta]);

  if (!alerta) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        {erro ? <Text style={estilos.texto}>{erro}</Text> : <ActivityIndicator color={colors.primaryDeep} />}
      </View>
    );
  }
  if (!alerta.encontrado || !('pet' in alerta) || alerta.status !== 'ativo') {
    const fim = alerta.encontrado && alerta.status === 'encontrado';
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <Text style={estilos.fimTitulo}>{fim ? 'O pet já foi encontrado' : 'Este alerta foi encerrado'}</Text>
        <Text style={estilos.texto}>{fim ? 'Obrigado por ajudar a procurar.' : 'O tutor encerrou o alerta.'}</Text>
        <View style={estilos.voltar}>
          <BotaoPrimario titulo="Voltar" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const telefone = alerta.telefone?.replace(/\D/g, '') ?? '';
  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <View style={estilos.fotoCaixa}>
          {alerta.pet.foto_url ? (
            <Image source={{ uri: alerta.pet.foto_url }} style={estilos.foto} accessibilityLabel={`Foto de ${alerta.pet.nome}`} />
          ) : (
            <Mascote especie={alerta.pet.especie} size={180} />
          )}
          <Text style={estilos.selo}>PROCURA-SE</Text>
          <Tocavel accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={estilos.voltarTopo}>
            <Icone nome="seta" size={18} espessura={2.2} />
          </Tocavel>
        </View>
        <Text style={estilos.nome}>{alerta.pet.nome}</Text>
        <Text style={estilos.sub}>
          {[alerta.pet.especie === 'gato' ? 'Gato' : 'Cão', alerta.pet.raca].filter(Boolean).join(' · ')}
        </Text>
        <View style={estilos.info}>
          <Text style={estilos.infoForte}>Sumiu {haQuanto(alerta.visto_em)}{distancia !== null ? ` · ${textoDistancia(distancia)} de você` : ''}</Text>
          {alerta.mensagem ? <Text style={estilos.recado}>“{alerta.mensagem}”</Text> : null}
        </View>
        <Text style={estilos.aviso}>Não persiga o pet: ele pode se assustar e fugir. Avise o tutor e, se puder, fique de olho de longe.</Text>
      </ScrollView>
      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Vi este pet" onPress={() => router.push(`/alerta/${alerta.id}/visto`)} />
        <View style={estilos.acoes}>
          {telefone ? (
            <Tocavel accessibilityRole="button" onPress={() => Linking.openURL(`tel:${telefone}`)} style={estilos.acao}>
              <Text style={estilos.acaoTexto}>Ligar para o tutor</Text>
            </Tocavel>
          ) : null}
          <Tocavel
            accessibilityRole="button"
            onPress={() => Share.share({ message: `${alerta.pet.nome} está perdido e sumiu ${haQuanto(alerta.visto_em)} perto daqui. Se vir, avise pelo PetLive.` })}
            style={estilos.acao}
          >
            <Text style={estilos.acaoTexto}>Compartilhar</Text>
          </Tocavel>
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  conteudo: { paddingBottom: 24, gap: 8 },
  fotoCaixa: { height: 340, backgroundColor: colors.healthSurface, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  foto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  selo: {
    position: 'absolute', left: 24, bottom: 18, backgroundColor: colors.emergency, color: colors.white, fontFamily: fontFamily.extraBold,
    fontSize: 13, letterSpacing: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden',
  },
  voltarTopo: { position: 'absolute', left: 24, top: 52, width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] },
  nome: { fontFamily: fontFamily.medium, fontSize: 34, letterSpacing: -1, color: colors.black, paddingHorizontal: 24, marginTop: 8 },
  sub: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted, paddingHorizontal: 24 },
  info: { marginHorizontal: 24, backgroundColor: colors.background, borderRadius: 22, padding: 16, gap: 6, marginTop: 6 },
  infoForte: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  recado: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21, color: colors.black },
  aviso: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, paddingHorizontal: 28, marginTop: 4 },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  fimTitulo: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.black, textAlign: 'center' },
  voltar: { alignSelf: 'stretch', marginTop: 16 },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 10 },
  acoes: { flexDirection: 'row', gap: 10 },
  acao: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  acaoTexto: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black },
});
