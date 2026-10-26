import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Tocavel } from '../../../src/components/Animacoes';
import { HeroiOnda } from '../../../src/components/HeroiOnda';
import { Icone } from '../../../src/components/Icone';
import { mensagemDeErro } from '../../../src/lib/cacheOffline';
import { supabase } from '../../../src/lib/supabase';
import { usePets } from '../../../src/pets/PetsProvider';
import { colors } from '../../../src/theme/colors';
import { fontFamily } from '../../../src/theme/typography';

type Local = { id: string; lat: number; lng: number; precisao_m: number | null; mensagem: string | null; criado_em: string };

function quando(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Abre o ponto no app de mapas do aparelho. */
function abrirNoMapa(l: Local) {
  const url = Platform.OS === 'ios' ? `maps:?q=${l.lat},${l.lng}` : `geo:${l.lat},${l.lng}?q=${l.lat},${l.lng}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`));
}

/**
 * Localização enviada por quem escaneou o QR da coleira (BUSINESS.md 5.6 e
 * fluxo 19.12). Os locais ficam 30 dias.
 */
export default function PetAchado() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pets } = usePets();
  const pet = pets.find((p) => p.id === id);
  const [locais, setLocais] = useState<Local[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      Promise.resolve(
        supabase.from('qr_localizacoes').select('id, lat, lng, precisao_m, mensagem, criado_em').eq('pet_id', id).order('criado_em', { ascending: false }).limit(20),
      ).then(({ data, error }) => {
        if (error) setErro(mensagemDeErro(error.message));
        else setLocais((data ?? []) as Local[]);
      });
    }, [id]),
  );

  const [ultimo, ...anteriores] = locais ?? [];

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo="QR da coleira" titulo={`Acharam o ${pet?.nome ?? 'pet'}`} altura={196} />
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
        {!locais && !erro ? <ActivityIndicator color={colors.primaryDeep} style={estilos.carregando} /> : null}
        {locais && locais.length === 0 ? (
          <Text style={estilos.vazio}>Ninguém enviou localização pelo QR nos últimos 30 dias.</Text>
        ) : null}
        {ultimo ? (
          <View style={estilos.destaque}>
            <Text style={estilos.rotulo}>Último envio · {quando(ultimo.criado_em)}</Text>
            {ultimo.mensagem ? <Text style={estilos.recado}>“{ultimo.mensagem}”</Text> : null}
            {ultimo.precisao_m ? <Text style={estilos.sub}>Precisão de cerca de {ultimo.precisao_m} m</Text> : null}
            <Tocavel accessibilityRole="button" onPress={() => abrirNoMapa(ultimo)} style={estilos.botao}>
              <Icone nome="rota" size={18} cor={colors.white} espessura={2} />
              <Text style={estilos.botaoTexto}>Abrir no mapa</Text>
            </Tocavel>
          </View>
        ) : null}
        {anteriores.length ? <Text style={estilos.secao}>Envios anteriores</Text> : null}
        {anteriores.map((l) => (
          <Tocavel key={l.id} accessibilityRole="button" onPress={() => abrirNoMapa(l)} style={estilos.linha}>
            <View style={estilos.flex}>
              <Text style={estilos.linhaTitulo}>{quando(l.criado_em)}</Text>
              {l.mensagem ? <Text style={estilos.sub} numberOfLines={2}>{l.mensagem}</Text> : null}
            </View>
            <Icone nome="seta" size={18} espessura={2} />
          </Tocavel>
        ))}
        <Text style={estilos.nota}>
          Quem achou não vê seu telefone se você não liberou no QR. Combine a devolução em um lugar público e movimentado.
        </Text>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  carregando: { marginTop: 24 },
  vazio: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted, backgroundColor: colors.background, borderRadius: 20, padding: 16 },
  destaque: { backgroundColor: colors.primarySurface, borderRadius: 26, padding: 18, gap: 8 },
  rotulo: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.primaryDeep },
  recado: { fontFamily: fontFamily.semiBold, fontSize: 17, lineHeight: 23, color: colors.black },
  sub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  botao: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26, backgroundColor: colors.black },
  botaoTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.white },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background, borderRadius: 20, padding: 14 },
  linhaTitulo: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, paddingHorizontal: 4 },
});
