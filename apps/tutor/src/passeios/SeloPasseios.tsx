import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BotaoPrimario } from '../components/BotaoPrimario';
import { Icone } from '../components/Icone';
import { repositorioPasseiosLocal } from './local';
import { progressoSeloPasseios } from './selo';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';

type Progresso = ReturnType<typeof progressoSeloPasseios>;
const data = (valor: number) => new Date(valor).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export function SeloPasseios({ tutorId, petId }: { tutorId: string; petId: string }) {
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  useFocusEffect(useCallback(() => {
    let ativo = true;
    let versao = tentativa;
    setProgresso(null); setErro(false);
    const carregar = () => {
      const pedido = ++versao;
      repositorioPasseiosLocal(tutorId).carregar().then((passeios) => {
        if (ativo && pedido === versao) {
          setProgresso(progressoSeloPasseios(passeios, tutorId, petId, Date.now())); setErro(false);
        }
      }, () => { if (ativo && pedido === versao) { setProgresso(null); setErro(true); } });
    };
    carregar();
    const timer = setInterval(carregar, 60000);
    return () => { ativo = false; clearInterval(timer); };
  }, [tutorId, petId, tentativa]));

  return <View style={estilos.card}>
    <Icone nome="escudo" size={34} cor={progresso?.conquistado ? colors.black : '#8A93A3'} />
    <Text style={estilos.titulo}>Passeios em dia</Text>
    <Text style={estilos.texto}>Três passeios concluídos por semana nas quatro últimas semanas completas, de segunda a domingo. A semana atual ainda não entra.</Text>
    {erro ? <><Text accessibilityRole="alert" style={estilos.texto}>Não foi possível conferir os passeios salvos. Seus dados foram preservados.</Text>
      <BotaoPrimario titulo="Tentar novamente" onPress={() => setTentativa((v) => v + 1)} /></>
      : !progresso ? <ActivityIndicator accessibilityLabel="Conferindo passeios" />
        : <>
          <Text style={estilos.titulo}>{progresso.conquistado ? 'Selo conquistado' : 'Seu progresso'}</Text>
          {progresso.semanas.map((s) => {
            const domingo = new Date(s.fim); domingo.setDate(domingo.getDate() - 1);
            return <Text key={s.inicio} style={estilos.texto}>{data(s.inicio)} a {data(domingo.getTime())}: {s.quantidade} de 3 passeios{s.quantidade >= 3 ? ' · completo' : ''}</Text>;
          })}
        </>}
    <Text style={estilos.texto}>Calculado com os passeios deste pet salvos nesta conta e neste aparelho, sem depender do plano. Apagar os registros altera o selo. Não há ranking nem avisos ao perder o selo. Respeite o ritmo e as orientações de cuidado do seu pet.</Text>
  </View>;
}

const estilos = StyleSheet.create({
  card: { padding: 20, borderRadius: 24, backgroundColor: '#E0F1FA', gap: 12 },
  titulo: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.black },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21, color: '#566070' },
});
