import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { BotaoPrimario } from '../src/components/BotaoPrimario';
import { Campo } from '../src/components/Campo';
import { HeroiOnda } from '../src/components/HeroiOnda';
import { MINIMO_SENHA, temSenha, trocarSenha, validarTrocaSenha } from '../src/perfil/senha';
import { colors } from '../src/theme/colors';
import { fontFamily } from '../src/theme/typography';

/**
 * Alterar senha (Editar perfil › Alterar senha): confirma a senha atual e
 * grava a nova. Contas que entram só com Google ou Apple não têm senha.
 */
export default function AlterarSenha() {
  const { user } = useAuth();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (salvando || !user?.email) return;
    const problema = validarTrocaSenha(atual, nova, confirmacao);
    setErro(problema);
    if (problema) return;
    setSalvando(true);
    try {
      await trocarSenha(user.email, atual, nova);
      Alert.alert('Senha alterada', 'Use a senha nova na próxima vez que entrar.');
      router.back();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo="Editar perfil" titulo="Alterar senha" altura={200} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        {temSenha(user) ? (
          <>
            <Campo rotulo="Senha atual" secureTextEntry autoComplete="current-password" value={atual} onChangeText={setAtual} />
            <Campo
              rotulo="Senha nova"
              placeholder={`Mínimo ${MINIMO_SENHA} caracteres`}
              secureTextEntry
              autoComplete="new-password"
              value={nova}
              onChangeText={setNova}
            />
            <Campo rotulo="Repita a senha nova" secureTextEntry autoComplete="new-password" value={confirmacao} onChangeText={setConfirmacao} />
            {erro ? (
              <Text style={estilos.erro} accessibilityRole="alert">
                {erro}
              </Text>
            ) : null}
            <Text style={estilos.texto}>Esqueceu a senha atual? Saia da conta e use Entrar › Esqueci minha senha.</Text>
            <View style={estilos.acoes}>
              <BotaoPrimario titulo="Salvar senha" onPress={salvar} carregando={salvando} />
            </View>
          </>
        ) : (
          <Text style={estilos.texto}>Você entra com Google ou Apple, então não há senha do PetLive para trocar.</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { paddingHorizontal: 24, paddingBottom: 32, gap: 14 },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  acoes: { marginTop: 6 },
});
