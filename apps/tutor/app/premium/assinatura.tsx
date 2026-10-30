import { ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowsLeftRight } from 'phosphor-react-native/src/icons/ArrowsLeftRight';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { CrownSimple } from 'phosphor-react-native/src/icons/CrownSimple';
import { Diamond } from 'phosphor-react-native/src/icons/Diamond';
import { Sparkle } from 'phosphor-react-native/src/icons/Sparkle';
import { useAuth } from '../../src/auth/AuthProvider';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { lerAssinatura, resumoAssinatura, type MinhaAssinatura } from '../../src/perfil/assinatura';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';
import { shadow } from '../../src/theme/tokens';
import { fontFamily } from '../../src/theme/typography';

export default function Assinatura() {
  const { user } = useAuth();
  return user ? <Consulta key={user.id} tutorId={user.id} /> : null;
}

function Consulta({ tutorId }: { tutorId: string }) {
  const [dados, setDados] = useState<MinhaAssinatura | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  useFocusEffect(useCallback(() => {
    let ativo = true;
    setDados(null); setErro(false);
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('minha_assinatura', { p_tutor: tutorId });
        if (error) throw error;
        const resposta = lerAssinatura(data);
        if (ativo) setDados(resposta);
      } catch { if (ativo) setErro(true); }
    })();
    return () => { ativo = false; };
  // O contador dispara uma nova consulta quando o tutor pede para tentar novamente.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorId, tentativa]));
  const contrato = dados?.assinatura;
  const resumo = contrato ? resumoAssinatura(contrato) : null;
  const premium = dados?.plano === 'premium';
  return <ScrollView style={s.tela} contentContainerStyle={s.rolagem}>
    <HeroiOnda titulo="Minha assinatura" />
    <View style={s.corpo}>
      {erro ? <>
        <Text accessibilityRole="alert" style={s.texto}>Não foi possível consultar sua assinatura. Confira a conexão e tente novamente.</Text>
        <BotaoPrimario titulo="Tentar novamente" onPress={() => setTentativa(n => n + 1)} />
      </> : !dados ? <ActivityIndicator accessibilityLabel="Consultando assinatura" /> : <>
        <View style={s.plano}>
          <View style={s.planoTopo}>
            <View style={s.coroa}><CrownSimple size={22} color="#F2C14E" weight="fill" /></View>
            <Text style={[s.selo, premium ? s.seloAtivo : s.seloGratis]}>{resumo ? resumo.status : premium ? 'Liberado' : 'Grátis'}</Text>
          </View>
          <Text style={s.planoTitulo}>{contrato ? `Premium ${contrato.ciclo}` : premium ? 'Premium' : 'Plano Grátis'}</Text>
          <Text style={s.planoTexto}>
            {resumo ? `${resumo.periodo} · ${resumo.valor}`
              : premium ? 'Seu acesso Premium está liberado, mas não há dados de cobrança para exibir.'
              : 'Nenhuma assinatura de cobrança registrada para esta conta.'}
          </Text>
        </View>
        <View style={s.lista}>
          {resumo ? <Linha icone={<Diamond size={20} color={colors.text} />} titulo="Forma de pagamento" texto={resumo.pagamento} /> : null}
          <Linha icone={<Sparkle size={20} color={colors.text} />} titulo="O que está incluído" texto="Vários pets, PDF, guarda e cartão por foto" onPress={() => router.push('/premium')} />
          <Linha icone={<ArrowsLeftRight size={20} color={colors.text} />} titulo="Gerenciar assinatura" texto="Compra, mudança de plano e cancelamento ainda não estão disponíveis nesta versão." ultima />
        </View>
        <Text style={s.nota}>Se você já possui uma assinatura, esta tela apenas consulta os dados registrados. Nenhuma cobrança ou alteração é realizada aqui.</Text>
      </>}
    </View>
  </ScrollView>;
}

function Linha({ icone, titulo, texto, onPress, ultima }: { icone: ReactNode; titulo: string; texto: string; onPress?: () => void; ultima?: boolean }) {
  const conteudo = <>
    <View style={s.icone}>{icone}</View>
    <View style={s.textos}>
      <Text style={s.linhaTitulo}>{titulo}</Text>
      <Text style={s.texto}>{texto}</Text>
    </View>
    {onPress ? <CaretRight size={18} color={colors.textMuted} /> : null}
  </>;
  const estilo = [s.linha, !ultima && s.divisor];
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={titulo} onPress={onPress} style={({ pressed }) => [estilo, pressed && { opacity: 0.6 }]}>{conteudo}</Pressable>
    : <View style={estilo}>{conteudo}</View>;
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background }, rolagem: { paddingBottom: 40 },
  corpo: { paddingHorizontal: 20, gap: 14 },
  // Versão 2: cartão escuro do plano com a coroa e o selo de estado.
  plano: { backgroundColor: colors.black, borderRadius: 28, padding: 22, gap: 6 },
  planoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  coroa: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  selo: { fontFamily: fontFamily.bold, fontSize: 13, borderRadius: 999, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 5 },
  seloAtivo: { color: colors.successText, backgroundColor: colors.successSurface },
  seloGratis: { color: colors.white, backgroundColor: 'rgba(255,255,255,0.14)' },
  planoTitulo: { fontFamily: fontFamily.bold, fontSize: 24, letterSpacing: -0.6, color: colors.white },
  planoTexto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.75)' },
  lista: { backgroundColor: colors.surface, borderRadius: 26, ...shadow.card },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  divisor: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  icone: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  linhaTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.text },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  nota: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, paddingHorizontal: 4 },
});
