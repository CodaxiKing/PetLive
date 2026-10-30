import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BotaoPrimario } from '../src/components/BotaoPrimario';
import { HeroiOnda } from '../src/components/HeroiOnda';
import { useAuth } from '../src/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';
import { atualizarWidget } from '../src/widget/tarefaWidget';
import { confirmarDoseWidget } from '../src/widget/proximo';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';

/** Links do widget nunca confirmam medicação automaticamente. */
export default function ConfirmarDoseDoWidget() {
  const { tutor, medicamento, quando } = useLocalSearchParams<{ tutor: string; medicamento: string; quando: string }>();
  const { user, carregando } = useAuth();
  const [consulta, setRemedio] = useState<{ nome: string; dose: string; petNome: string; chave: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const ciclo = useRef(0);
  const chave = `${tutor}:${medicamento}:${tentativa}`;
  const remedio = consulta?.chave === chave ? consulta : null;
  const valido = typeof tutor === 'string' && typeof medicamento === 'string' && typeof quando === 'string' &&
    Number.isFinite(Date.parse(quando)) && user?.id === tutor;
  useFocusEffect(useCallback(() => {
    let atual = true;
    ciclo.current++;
    setRemedio(null); setErro(null); setSucesso(false);
    setOcupado(false);
    if (!valido) return;
    supabase.from('medications').select('nome,dose,pets(nome)').eq('id', medicamento).eq('ativo', true).single().then(({ data, error }) => {
      if (!atual) return;
      if (error || !data) setErro('Não foi possível consultar o medicamento. Confira a conexão e tente novamente.');
      else {
        const pet = data.pets as unknown as { nome: string } | null;
        setRemedio({ nome: data.nome, dose: data.dose, petNome: pet?.nome ?? 'Seu pet', chave });
      }
    });
    return () => { atual = false; ciclo.current++; };
  }, [valido, medicamento, chave]));

  async function confirmar() {
    if (!valido || !remedio || ocupado || sucesso) return;
    const versao = ciclo.current;
    setOcupado(true); setErro(null);
    try {
      await confirmarDoseWidget(medicamento, quando, tutor);
      if (versao !== ciclo.current) return;
      setSucesso(true);
      await atualizarWidget().catch(() => undefined);
    } catch (e) { if (versao === ciclo.current) setErro(e instanceof Error ? e.message : 'Dose não confirmada. Tente novamente.'); }
    finally { if (versao === ciclo.current) setOcupado(false); }
  }
  return <View style={s.tela}>
    <HeroiOnda titulo="Confirmar dose" subtitulo="Widget PetLive" altura={210} />
    <View style={s.corpo}>
      {carregando ? <ActivityIndicator /> : !valido ? <>
        <Text style={s.texto}>Este widget pertence a outra sessão ou precisa ser atualizado. Abra o PetLive com a conta correta.</Text>
        <BotaoPrimario titulo="Abrir PetLive" onPress={() => router.replace('/inicio')} />
      </> : sucesso ? <Text accessibilityRole="alert" style={s.texto}>Dose confirmada. Obrigado por cuidar!</Text> : <>
        {remedio ? <><Text style={s.titulo}>{remedio.petNome} · {remedio.nome}</Text><Text style={s.texto}>{remedio.dose} · {new Date(quando).toLocaleString('pt-BR')}</Text>
          <Text style={s.texto}>Confirme somente se você já deu esta dose ao pet.</Text>
          <BotaoPrimario titulo="Já dei esta dose" carregando={ocupado} onPress={() => { void confirmar(); }} /></> : !erro ? <ActivityIndicator /> : null}
        {erro ? <><Text accessibilityRole="alert" style={s.texto}>{erro}</Text><BotaoPrimario titulo="Tentar novamente" desabilitado={ocupado} onPress={() => setTentativa(n => n + 1)} /></> : null}
      </>}
    </View>
  </View>;
}
const s = StyleSheet.create({ tela: { flex: 1, backgroundColor: colors.background }, corpo: { padding: 24, gap: 18 }, texto: { ...typography.body, color: colors.text }, titulo: { ...typography.h2, color: colors.text } });
