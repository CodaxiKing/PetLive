import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { lerAssinatura, resumoAssinatura, type MinhaAssinatura } from '../../src/perfil/assinatura';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';
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
  return <ScrollView style={s.tela} contentContainerStyle={s.rolagem}>
    <HeroiOnda subtitulo="Premium" titulo="Minha assinatura" altura={230} fundo={colors.premiumSurface} />
    <View style={s.corpo}>
      {erro ? <>
        <Text accessibilityRole="alert" style={s.texto}>Não foi possível consultar sua assinatura. Confira a conexão e tente novamente.</Text>
        <BotaoPrimario titulo="Tentar novamente" onPress={() => setTentativa(n => n + 1)} />
      </> : !dados ? <ActivityIndicator accessibilityLabel="Consultando assinatura" /> : <>
        <View style={s.card}>
          <Text style={s.titulo}>Plano {dados.plano === 'premium' ? 'Premium' : 'Grátis'}</Text>
          <Text style={s.texto}>{contrato ? `Contrato Premium ${contrato.ciclo}` : 'Nenhuma assinatura de cobrança registrada para esta conta.'}</Text>
          {!contrato && dados.plano === 'premium' ? <Text style={s.texto}>Seu acesso Premium está liberado, mas não há dados de cobrança para exibir.</Text> : null}
          {resumo ? <><Text style={s.status}>{resumo.status}</Text><Text style={s.texto}>{resumo.periodo}</Text><Text style={s.texto}>{resumo.valor}</Text></> : null}
        </View>
        {resumo ? <View style={s.linha}><Text style={s.legenda}>Forma de pagamento</Text><Text style={s.titulo}>{resumo.pagamento}</Text></View> : null}
        <View style={s.linha}><Text style={s.titulo}>Gerenciar assinatura</Text><Text style={s.texto}>Compra, mudança para mensal, atualização do pagamento e cancelamento ainda não estão disponíveis nesta versão.</Text></View>
        <Text style={s.texto}>Se você já possui uma assinatura, esta tela apenas consulta os dados registrados. Nenhuma cobrança ou alteração é realizada aqui.</Text>
      </>}
    </View>
  </ScrollView>;
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background }, rolagem: { paddingBottom: 40 },
  corpo: { paddingHorizontal: 24, gap: 12 },
  card: { backgroundColor: colors.premiumSurface, padding: 18, borderRadius: 26, gap: 8 },
  linha: { backgroundColor: colors.surface, borderRadius: 22, padding: 16, gap: 6 },
  titulo: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.text },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21, color: colors.textMuted },
  legenda: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  status: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.premiumText },
});
