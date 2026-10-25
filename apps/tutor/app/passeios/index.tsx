import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { usePets } from '../../src/pets/PetsProvider';
import { gravadorPasseioLocal } from '../../src/passeios/sessaoLocal';
import { gpsPasseio } from '../../src/passeios/gps';
import { gpsSegundoPlano, passeioSegundoPlanoDisponivel } from '../../src/passeios/segundoPlano';
import { TrajetoPasseio } from '../../src/passeios/TrajetoPasseio';
import { duracaoPasseio } from '../../src/passeios/passeio';
import { apagarPasseiosNuvem, limparControlePasseios, sincronizadorPasseios } from '../../src/passeios/nuvem';
import { colors } from '../../src/theme/colors';
import { spacing, radius } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';

export default function Passeios() {
  const { user, carregando } = useAuth();
  if (carregando) return <ActivityIndicator accessibilityLabel="Carregando sua conta" />;
  if (!user) return <Text>Entre na sua conta para gravar passeios.</Text>;
  return <GravarPasseio key={user.id} tutorId={user.id} />;
}

function GravarPasseio({ tutorId }: { tutorId: string }) {
  const insets = useSafeAreaInsets();
  const { pets, petAtivo, carregando: carregandoPets } = usePets();
  const meusPets = pets.filter((p) => p.tutor_id === tutorId && !p.em_memoria && p.ativo);
  const [petId, setPetId] = useState<string | null>(null);
  const pet = meusPets.find((p) => p.id === (petId ?? petAtivo?.id)) ?? meusPets[0];
  const [gravador] = useState(() => gravadorPasseioLocal(tutorId));
  const [segundoPlano, setSegundoPlano] = useState(() => gravador.permiteSegundoPlano());
  const estado = useSyncExternalStore(gravador.assinar, gravador.snapshot, gravador.snapshot);
  const [agora, setAgora] = useState(Date.now);
  const atual = estado.passeios.find((p) => p.status !== 'concluido');
  const ultimo = atual ?? estado.passeios.at(-1);
  const podeRetomar = atual && meusPets.some((p) => p.id === atual.petId);
  const vivo = useRef(false);

  useEffect(() => { vivo.current = true; void gravador.carregar(); return () => { vivo.current = false; }; }, [gravador]);
  useFocusEffect(useCallback(() => {
    const assinatura = AppState.addEventListener('change', (proximo) => {
      if (proximo !== 'active' && !gravador.permiteSegundoPlano()) void gravador.pausar('O app saiu do primeiro plano. Retome o passeio para voltar a gravar.');
    });
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    const checkpoint = setInterval(() => { void gravador.checkpoint(); }, 10000);
    return () => {
      assinatura.remove(); clearInterval(relogio); clearInterval(checkpoint);
      void gravador.pausar('Você saiu da tela. O passeio foi pausado.');
    };
  }, [gravador]));

  function escolherSegundoPlano(ativar: boolean) {
    const aplicar = () => {
      if (gravador.configurarGps(ativar ? gpsSegundoPlano : gpsPasseio, ativar)) setSegundoPlano(ativar);
    };
    if (!ativar) { aplicar(); return; }
    Alert.alert('Gravar com a tela apagada?', 'Durante o passeio, o PetLive usará sua localização precisa mesmo em segundo plano e mostrará um aviso permanente. Ao iniciar, permita a localização o tempo todo nas configurações do Android. O trajeto fica neste aparelho; o envio à nuvem continua opcional. Pausar ou sair desta tela encerra a gravação.', [
      { text: 'Agora não', style: 'cancel' }, { text: 'Ativar', onPress: aplicar },
    ]);
  }

  function finalizar() {
    Alert.alert('Revisar passeio?', 'A gravação será pausada para você conferir o resumo, escolher uma foto e salvar.', [
      { text: 'Continuar passeio', style: 'cancel' },
      { text: 'Revisar', onPress: async () => {
        if (!atual) return;
        await gravador.pausar('Confira o resumo antes de salvar o passeio.');
        if (vivo.current) router.push({ pathname: '/passeios/resumo', params: { id: atual.id } });
      } },
    ]);
  }

  return <ScrollView style={s.tela} contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
    <CabecalhoTela titulo="Passeios" />
    <Pressable accessibilityRole="button" onPress={() => router.push('/passeios/historico')} style={s.acao}><Text style={s.link}>Histórico e meta semanal</Text></Pressable>
    <Text style={s.texto}>{segundoPlano ? 'O passeio continua ao apagar a tela ou colocar o app em segundo plano. Sair desta tela, pausar ou finalizar encerra a gravação.' : 'Escolha seu pet e registre o passeio com GPS. Mantenha esta tela aberta: sair do app ou apagar a tela pausa a gravação.'}</Text>
    {passeioSegundoPlanoDisponivel() ? <View style={s.card}>
      <Text style={s.titulo}>Gravar com a tela apagada</Text>
      <Switch accessibilityLabel="Gravar passeio com a tela apagada" value={segundoPlano} disabled={estado.carregando || estado.ocupado || atual?.status === 'gravando'} onValueChange={escolherSegundoPlano} />
      <Text style={s.texto}>Opcional no Android. Pause para alterar. Se o sistema encerrar o app, retome o passeio manualmente; o último registro fica salvo.</Text>
    </View> : null}
    <Text style={s.texto}>Grave sem internet. Salve neste aparelho e, quando quiser, sincronize trajetos e anotações com sua conta. Fotos ficam somente aqui.</Text>
    {estado.erro ? <Text accessibilityRole="alert" style={s.erro}>{estado.erro}</Text> : null}
    {estado.carregando ? <>
      <ActivityIndicator accessibilityLabel="Carregando passeios salvos" />
      {estado.erro ? <BotaoPrimario titulo="Tentar carregar novamente" onPress={() => { void gravador.carregar(); }} /> : null}
    </> : <>
      {estado.aviso ? <Text accessibilityLiveRegion="polite" style={s.aviso}>{estado.aviso}</Text> : null}
      {ultimo ? <View style={s.card}>
        <Text accessibilityRole="header" style={s.titulo}>{ultimo.nomePet}</Text>
        <Text style={s.texto}>{ultimo.status === 'gravando' ? 'Gravando passeio' : ultimo.status === 'pausado' ? 'Passeio pausado' : 'Último passeio concluído'}</Text>
        <Text style={s.numero}>{(ultimo.distanciaM / 1000).toFixed(2).replace('.', ',')} km</Text>
        <Text style={s.texto}>{Math.floor(duracaoPasseio(ultimo, agora) / 60000)} min de tempo ativo · {ultimo.pontos.length} pontos GPS</Text>
        {!ultimo.pontos.length ? <Text style={s.texto}>{ultimo.status === 'gravando' ? 'Aguardando GPS com precisão de até 35 m. Vá para um local aberto.' : 'Nenhum ponto GPS foi registrado.'}</Text> : null}
        <TrajetoPasseio pontos={ultimo.pontos} />
      </View> : null}
      {atual ? <>
        {atual.status === 'gravando'
          ? <BotaoPrimario titulo="Pausar passeio" carregando={estado.ocupado} onPress={() => { void gravador.pausar(); }} />
          : <BotaoPrimario titulo="Retomar passeio" desabilitado={!podeRetomar || carregandoPets} carregando={estado.ocupado} onPress={() => { void gravador.retomar(); }} />}
        {!podeRetomar && !carregandoPets ? <Text style={s.texto}>Este pet não está ativo nesta conta. Você ainda pode finalizar o passeio salvo.</Text> : null}
        <Pressable accessibilityRole="button" disabled={estado.ocupado} onPress={finalizar} style={s.acao}><Text style={s.link}>Finalizar e revisar passeio</Text></Pressable>
        {estado.erro ? <Pressable accessibilityRole="button" disabled={estado.ocupado} onPress={() => { void gravador.pausar(); }} style={s.acao}><Text style={s.link}>Tentar salvar os dados novamente</Text></Pressable> : null}
      </> : carregandoPets ? <ActivityIndicator accessibilityLabel="Carregando pets" /> : meusPets.length ? <>
        <Text accessibilityRole="header" style={s.titulo}>Quem vai passear?</Text>
        <View style={s.opcoes}>{meusPets.map((p) => <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ checked: pet?.id === p.id, disabled: estado.ocupado }} disabled={estado.ocupado} onPress={() => setPetId(p.id)} style={[s.opcao, pet?.id === p.id && s.selecionado]}><Text style={s.texto}>{p.nome}</Text></Pressable>)}</View>
        <BotaoPrimario titulo="Iniciar passeio" carregando={estado.ocupado} onPress={() => { if (pet) void gravador.iniciar(pet); }} />
      </> : <BotaoPrimario titulo="Cadastrar um pet" onPress={() => router.push('/pet/novo')} />}
      {estado.passeios.length > 0 ? <Pressable accessibilityRole="button" disabled={estado.ocupado || atual?.status === 'gravando'} style={s.acao} onPress={() => Alert.alert('Apagar passeios deste aparelho?', 'Apaga os registros, fotos e anotações guardados pelo app nesta conta, incluindo o passeio pausado. Esta ação não pode ser desfeita.', [
        { text: 'Cancelar', style: 'cancel' }, { text: 'Apagar passeios', style: 'destructive', onPress: () => { void gravador.apagar(() => limparControlePasseios(tutorId)); } },
      ])}><Text style={s.erro}>Apagar passeios deste aparelho</Text></Pressable> : null}
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.titulo}>Seus passeios na nuvem</Text>
        <Text style={s.texto}>Envie seu trajeto GPS e anotações para a sua conta privada ou recupere os de outro aparelho. Pause antes de sincronizar. Fotos não são enviadas.</Text>
        <BotaoPrimario titulo="Sincronizar trajetos e anotações" carregando={estado.ocupado} desabilitado={atual?.status === 'gravando'} onPress={() => { void gravador.sincronizar(sincronizadorPasseios(tutorId)); }} />
        <Text style={s.texto}>Após oito horas sem atualização, passeios pausados na nuvem são encerrados no último registro, sem somar a espera. Apagar só deste aparelho mantém a cópia na nuvem, que volta ao sincronizar.</Text>
        <Pressable accessibilityRole="button" disabled={estado.ocupado || atual?.status === 'gravando'} style={s.acao} onPress={() => Alert.alert('Apagar passeios locais e da nuvem?', 'Remove os trajetos e anotações desta conta na nuvem e neste aparelho, incluindo suas fotos locais. Requer internet e não pode ser desfeito. Outros aparelhos podem manter cópias offline; apague-as também para evitar reenvio.', [
          { text: 'Cancelar', style: 'cancel' }, { text: 'Apagar tudo', style: 'destructive', onPress: () => { void gravador.apagar(() => apagarPasseiosNuvem(tutorId)); } },
        ])}><Text style={s.erro}>Apagar passeios locais e da nuvem</Text></Pressable>
      </View>
    </>}
  </ScrollView>;
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  texto: { ...typography.body, color: colors.textMuted },
  titulo: { ...typography.h3, color: colors.black },
  numero: { ...typography.h1, color: colors.primaryDeep },
  card: { padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, gap: spacing.sm },
  aviso: { ...typography.body, color: colors.primaryDeep },
  erro: { ...typography.body, color: colors.danger },
  link: { ...typography.bodyMedium, color: colors.primaryDeep },
  acao: { minHeight: 48, justifyContent: 'center' },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  opcao: { minHeight: 48, justifyContent: 'center', padding: spacing.md, borderWidth: 2, borderColor: colors.border, borderRadius: radius.pill },
  selecionado: { borderColor: colors.primaryDeep, backgroundColor: colors.hero },
});
