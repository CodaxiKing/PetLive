import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { denunciarEvento } from './eventos';
import { colors } from '../theme/colors';
import { components, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const MOTIVOS = [
  ['spam', 'Spam ou propaganda'], ['inadequado', 'Conteúdo inadequado'], ['fraude', 'Golpe ou fraude'],
  ['local_privado', 'Endereço residencial ou local privado'], ['informacao_falsa', 'Informação falsa'], ['outro', 'Outro motivo'],
] as const;
type Motivo = typeof MOTIVOS[number][0];

export function DenunciaEvento({ eventoId, onConcluido }: { eventoId: string; onConcluido: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState<Motivo | null>(null);
  const [detalhe, setDetalhe] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recebida, setRecebida] = useState(false);
  const ocupado = useRef(false);
  const controle = useRef({ ativo: true });
  useEffect(() => { const estado = controle.current; estado.ativo = true; return () => { estado.ativo = false; }; }, []);
  const texto = { ...typography.captionMedium, color: colors.primaryDeep, paddingVertical: spacing.md };
  function confirmar() {
    if (!motivo || ocupado.current) return;
    ocupado.current = true;
    Alert.alert('Enviar denúncia?', 'A equipe poderá analisar o evento. Seus dados não serão mostrados ao organizador.', [
      { text: 'Voltar', style: 'cancel', onPress: () => { ocupado.current = false; } },
      { text: 'Enviar denúncia', onPress: async () => {
        if (!controle.current.ativo) return;
        setEnviando(true); setErro(null);
        try { await denunciarEvento(eventoId, motivo, detalhe.trim() || undefined); if (controle.current.ativo) { setRecebida(true); setAberto(false); onConcluido(); } }
        catch (e) { if (controle.current.ativo) setErro(e instanceof Error ? e.message : 'Não foi possível enviar. Tente novamente.'); }
        finally { ocupado.current = false; if (controle.current.ativo) setEnviando(false); }
      } },
    ], { cancelable: false });
  }
  if (recebida) return <Text accessibilityLiveRegion="polite" style={texto}>Denúncia recebida. Obrigado por avisar.</Text>;
  return <View>
    <Pressable accessibilityRole="button" disabled={enviando} onPress={() => setAberto(!aberto)}><Text style={texto}>{aberto ? 'Fechar denúncia' : 'Denunciar evento'}</Text></Pressable>
    {aberto ? <View>
      <Text style={typography.body}>Selecione o motivo</Text>
      {MOTIVOS.map(([valor, rotulo]) => <Pressable key={valor} accessibilityRole="radio" accessibilityState={{ checked: motivo === valor, disabled: enviando }} disabled={enviando} onPress={() => setMotivo(valor)}><Text style={texto}>{motivo === valor ? '● ' : '○ '}{rotulo}</Text></Pressable>)}
      <TextInput accessibilityLabel="Detalhes da denúncia, opcional" value={detalhe} onChangeText={setDetalhe} maxLength={500} multiline editable={!enviando} style={[components.input, { minHeight: 80 }]} placeholder="Explique o que aconteceu (opcional)" />
      {erro ? <Text accessibilityRole="alert" style={typography.body}>{erro}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !motivo || enviando, busy: enviando }} disabled={!motivo || enviando} onPress={confirmar}><Text style={[texto, (!motivo || enviando) && { opacity: 0.5 }]}>{enviando ? 'Enviando…' : 'Enviar denúncia'}</Text></Pressable>
    </View> : null}
  </View>;
}
