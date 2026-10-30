import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Tocavel } from '../../src/components/Animacoes';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone } from '../../src/components/Icone';
import { mensagemDeErro } from '../../src/lib/cacheOffline';
import {
  abrirAlerta,
  carregarAvistamentos,
  encerrarAlerta,
  haQuanto,
  linkMapa,
  renovarAlerta,
  urlFotoAvistamento,
  type AlertaAberto,
  type Avistamento,
} from '../../src/perdido/perdido';
import { colors } from '../../src/theme/colors';
import { fontFamily } from '../../src/theme/typography';

const STATUS: Record<string, string> = { encontrado: 'Encontrado', encerrado: 'Encerrado', expirado: 'Expirou' };

/** Alerta em andamento, para o tutor: quem viu, renovar e encerrar (BUSINESS.md 5.29). */
export default function AlertaDoTutor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [alerta, setAlerta] = useState<AlertaAberto | null>(null);
  const [avistamentos, setAvistamentos] = useState<Avistamento[]>([]);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [agindo, setAgindo] = useState(false);

  const carregar = useCallback(() => {
    if (!id) return;
    Promise.all([abrirAlerta(id), carregarAvistamentos(id)]).then(
      ([a, lista]) => {
        if (!a.encontrado || !('dono' in a) || !a.dono) {
          setErro('Este alerta não está disponível nesta conta.');
          return;
        }
        setAlerta(a);
        setAvistamentos(lista);
        lista.filter((v) => v.foto_path).forEach((v) => urlFotoAvistamento(v.foto_path as string).then((url) => url && setFotos((f) => ({ ...f, [v.id]: url }))));
      },
      (e: unknown) => setErro(mensagemDeErro(e instanceof Error ? e.message : String(e))),
    );
  }, [id]);
  useFocusEffect(carregar);

  const agir = (acao: () => Promise<void>, depois?: () => void) => {
    setAgindo(true);
    acao().then(
      () => {
        carregar();
        depois?.();
      },
      (e: unknown) => Alert.alert('Não deu certo', mensagemDeErro(e instanceof Error ? e.message : String(e))),
    ).finally(() => setAgindo(false));
  };

  function encerrar() {
    if (!alerta) return;
    Alert.alert(`Encerrar o alerta do ${alerta.pet.nome}?`, 'Quem recebeu deixa de ver o alerta e o QR volta ao normal.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar alerta', style: 'destructive', onPress: () => agir(() => encerrarAlerta(alerta.id, false)) },
      { text: 'Encontrei!', onPress: () => agir(() => encerrarAlerta(alerta.id, true), () => Alert.alert('Que bom!', `${alerta.pet.nome} está de volta. O alerta foi encerrado.`)) },
    ]);
  }

  if (!alerta) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        {erro ? <Text style={estilos.erro}>{erro}</Text> : <ActivityIndicator color={colors.primaryDeep} />}
      </View>
    );
  }

  const ativo = alerta.status === 'ativo';
  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo={ativo ? `Alerta ativo · sumiu ${haQuanto(alerta.visto_em)}` : STATUS[alerta.status]} titulo={`Procurando o ${alerta.pet.nome}`} altura={196} />
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <View style={estilos.resumo}>
          <Text style={estilos.resumoTexto}>
            Raio de {alerta.raio_km} km · {ativo ? `vale até ${new Date(alerta.expira_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : 'encerrado'}
          </Text>
          {alerta.mensagem ? <Text style={estilos.recado}>“{alerta.mensagem}”</Text> : null}
          <Tocavel accessibilityRole="button" onPress={() => Linking.openURL(linkMapa(alerta.lat, alerta.lng))}>
            <Text style={estilos.link}>Ver o último lugar no mapa</Text>
          </Tocavel>
        </View>

        <Text style={estilos.secao}>Quem viu ({avistamentos.length})</Text>
        {avistamentos.length === 0 ? (
          <Text style={estilos.vazio}>Ninguém avisou ainda. Compartilhe o alerta com vizinhos e grupos do bairro.</Text>
        ) : null}
        {avistamentos.map((v) => (
          <Tocavel key={v.id} accessibilityRole="button" onPress={() => Linking.openURL(linkMapa(v.lat, v.lng))} style={[estilos.avistamento, v.com_a_pessoa && estilos.comPessoa]}>
            {fotos[v.id] ? <Image source={{ uri: fotos[v.id] }} style={estilos.foto} /> : null}
            <View style={estilos.flex}>
              <Text style={estilos.avTitulo}>{v.com_a_pessoa ? 'Está com uma pessoa' : 'Visto'} · {haQuanto(v.visto_em)}</Text>
              {v.mensagem ? <Text style={estilos.avTexto} numberOfLines={3}>{v.mensagem}</Text> : null}
              <Text style={estilos.avSub}>{v.origem === 'qr' ? 'Pelo QR da coleira' : 'Pelo app'} · toque para ver no mapa</Text>
            </View>
            <Icone nome="seta" size={18} espessura={2} />
          </Tocavel>
        ))}
        <Text style={estilos.nota}>Por segurança, você não vê quem avisou. Combine a devolução em um lugar público.</Text>
      </ScrollView>
      {ativo ? (
        <View style={estilos.rodape}>
          <BotaoPrimario titulo="Encontrei / encerrar" carregando={agindo} onPress={encerrar} />
          <View style={estilos.acoes}>
            <Tocavel accessibilityRole="button" disabled={agindo} onPress={() => agir(() => renovarAlerta(alerta.id), () => Alert.alert('Alerta renovado', 'Vale por mais 7 dias.'))} style={estilos.acao}>
              <Text style={estilos.acaoTexto}>Renovar 7 dias</Text>
            </Tocavel>
            <Tocavel
              accessibilityRole="button"
              onPress={() => Share.share({ message: `${alerta.pet.nome} sumiu ${haQuanto(alerta.visto_em)} perto daqui. Se vir, avise pelo PetLive ou pelo QR da coleira. ${linkMapa(alerta.lat, alerta.lng)}` })}
              style={estilos.acao}
            >
              <Text style={estilos.acaoTexto}>Compartilhar</Text>
            </Tocavel>
          </View>
        </View>
      ) : (
        <View style={estilos.rodape}>
          <BotaoPrimario titulo="Voltar" onPress={() => router.back()} />
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },
  resumo: { backgroundColor: colors.healthSurface, borderRadius: 24, padding: 16, gap: 6 },
  resumoTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.healthText },
  recado: { fontFamily: fontFamily.semiBold, fontSize: 15, lineHeight: 21, color: colors.black },
  link: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.primaryDeep, marginTop: 2 },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  vazio: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, backgroundColor: colors.surface, borderRadius: 20, padding: 14 },
  avistamento: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 22, padding: 12 },
  comPessoa: { backgroundColor: colors.successSurface },
  foto: { width: 56, height: 56, borderRadius: 16 },
  avTitulo: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  avTexto: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.black, marginTop: 2 },
  avSub: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, paddingHorizontal: 4 },
  erro: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.danger, textAlign: 'center' },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 10 },
  acoes: { flexDirection: 'row', gap: 10 },
  acao: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  acaoTexto: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black },
});
