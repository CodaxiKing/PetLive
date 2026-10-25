import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '../src/auth/AuthProvider';
import { BotaoPrimario } from '../src/components/BotaoPrimario';
import { Campo } from '../src/components/Campo';
import { HeroiOnda } from '../src/components/HeroiOnda';
import { solicitarTrocaEmail, validarTrocaEmail } from '../src/perfil/email';
import { colors } from '../src/theme/colors';
import { fontFamily } from '../src/theme/typography';

export default function AlterarEmail() {
  const { user } = useAuth();
  return user ? <Formulario key={user.id} tutorId={user.id} /> : null;
}

function Formulario({ tutorId }: { tutorId: string }) {
  const { user, atualizarUsuario } = useAuth();
  const [novo, setNovo] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [solicitado, setSolicitado] = useState(false);
  const trava = useRef(false);
  const ativo = useRef(true);
  useEffect(() => { ativo.current = true; return () => { ativo.current = false; }; }, []);

  async function executar(verificar: boolean) {
    if (trava.current) return;
    const problema = verificar ? null : validarTrocaEmail(user?.email ?? '', novo, confirmacao);
    setErro(problema ?? '');
    if (problema) return;
    trava.current = true;
    setOcupado(true);
    setMensagem('');
    try {
      if (verificar) {
        const conta = await atualizarUsuario();
        if (!ativo.current || conta?.id !== tutorId) return;
        setMensagem(conta.email?.toLowerCase() === novo.trim().toLowerCase()
          ? 'E-mail confirmado e atualizado.'
          : 'A confirmação ainda está pendente. Confira as mensagens no endereço novo e no atual, inclusive o spam.');
      } else {
        const conta = await solicitarTrocaEmail(tutorId, novo);
        if (!ativo.current || conta?.id !== tutorId) return;
        setSolicitado(true);
        setMensagem('Solicitação aceita. Siga as instruções de confirmação recebidas por e-mail. Depois volte e toque em Verificar confirmação.');
      }
    } catch (e) {
      if (ativo.current) setErro(e instanceof Error ? e.message : 'Não foi possível concluir. Tente novamente.');
    } finally {
      trava.current = false;
      if (ativo.current) setOcupado(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo="Editar perfil" titulo="Alterar e-mail" altura={200} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Text style={estilos.texto}>E-mail atual: {user?.email ?? '—'}</Text>
        <Text style={estilos.texto}>A troca depende da confirmação por e-mail. Seu endereço atual continua válido enquanto a alteração estiver pendente.</Text>
        <Campo rotulo="Novo e-mail" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={254} editable={!ocupado && !solicitado} value={novo} onChangeText={setNovo} />
        <Campo rotulo="Repita o novo e-mail" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} editable={!ocupado && !solicitado} value={confirmacao} onChangeText={setConfirmacao} />
        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
        {mensagem ? <Text style={estilos.texto} accessibilityLiveRegion="polite">{mensagem}</Text> : null}
        <BotaoPrimario titulo={solicitado ? 'Verificar confirmação' : 'Solicitar alteração'} carregando={ocupado} onPress={() => executar(solicitado)} />
        {solicitado ? <BotaoPrimario titulo="Solicitar novamente" desabilitado={ocupado} onPress={() => { setSolicitado(false); setMensagem(''); }} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  conteudo: { paddingHorizontal: 24, paddingBottom: 32, gap: 14 },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
});
