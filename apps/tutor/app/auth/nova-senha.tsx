import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { Campo } from '../../src/components/Campo';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { MarcaPata } from '../../src/components/MarcaPata';
import { sessaoDoLinkDeRecuperacao } from '../../src/auth/senha';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';
import { fontFamily } from '../../src/theme/typography';

const MINIMO_SENHA = 8;

/**
 * Nova senha (link "Esqueci minha senha" do e-mail): cria a sessão de
 * recuperação a partir do link e grava a senha nova. Depois segue para o app.
 */
export default function NovaSenha() {
  const url = Linking.useLinkingURL();
  const [estado, setEstado] = useState<'conferindo' | 'pronto' | 'invalido'>('conferindo');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let vivo = true;
    sessaoDoLinkDeRecuperacao(url).then(
      (ok) => vivo && setEstado(ok ? 'pronto' : 'invalido'),
      () => vivo && setEstado('invalido'),
    );
    return () => {
      vivo = false;
    };
  }, [url]);

  async function salvar() {
    setErro(null);
    if (senha.length < MINIMO_SENHA) {
      setErro(`A senha precisa ter pelo menos ${MINIMO_SENHA} caracteres.`);
      return;
    }
    if (senha !== confirmacao) {
      setErro('As duas senhas não são iguais.');
      return;
    }
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      setErro(error.message.includes('different from the old') ? 'Use uma senha diferente da anterior.' : 'Não deu para salvar. Tente de novo.');
      return;
    }
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo="Conta" titulo="Nova senha" altura={210} semVoltar>
        <MarcaPata size={110} style={estilos.pata} />
      </HeroiOnda>

      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        {estado === 'conferindo' ? (
          <ActivityIndicator color={colors.primaryDeep} style={estilos.carregando} accessibilityLabel="Conferindo o link" />
        ) : estado === 'invalido' ? (
          <>
            <Text style={estilos.texto}>
              Este link expirou ou já foi usado. Peça um novo em Entrar › Esqueci minha senha.
            </Text>
            <BotaoPrimario titulo="Voltar para entrar" onPress={() => router.replace('/')} />
          </>
        ) : (
          <>
            <Text style={estilos.texto}>Escolha uma senha nova para a sua conta.</Text>
            <Campo
              rotulo="Nova senha"
              variante="verde"
              placeholder={`Mínimo ${MINIMO_SENHA} caracteres`}
              secureTextEntry
              autoComplete="new-password"
              value={senha}
              onChangeText={setSenha}
            />
            <Campo
              rotulo="Repita a senha"
              variante="verde"
              secureTextEntry
              autoComplete="new-password"
              value={confirmacao}
              onChangeText={setConfirmacao}
            />
            {erro ? (
              <Text style={estilos.erro} accessibilityRole="alert">
                {erro}
              </Text>
            ) : null}
            <View style={estilos.acoes}>
              <BotaoPrimario titulo="Salvar senha" onPress={salvar} carregando={salvando} />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  pata: { position: 'absolute', right: 30, top: 54 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 32, gap: 14 },
  carregando: { marginTop: 32 },
  texto: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  acoes: { marginTop: 6 },
});
