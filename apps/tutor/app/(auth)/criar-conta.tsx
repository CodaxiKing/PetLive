import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { Campo } from '../../src/components/Campo';
import { ControleSegmentado } from '../../src/components/ControleSegmentado';
import { entrarComGoogle } from '../../src/auth/google';
import { supabase, supabaseConfigurado } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';

type Modo = 'criar' | 'entrar';

const MINIMO_SENHA = 8;

function IconeUser() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.premiumText} strokeWidth={1.9} strokeLinecap="round">
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 20c1-4 4-6 8-6s7 2 8 6" />
    </Svg>
  );
}

function IconeEmail() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={5} width={18} height={14} rx={3} />
      <Path d="M4 7l8 6 8-6" />
    </Svg>
  );
}

function IconeSenha() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.successText} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={5} y={11} width={14} height={9} rx={3} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export default function CriarConta() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>('criar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [aceite, setAceite] = useState(false);
  const [termosAbertos, setTermosAbertos] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const criando = modo === 'criar';
  const nomeValido = !criando || nome.trim().length >= 2;
  const emailValido = /.+@.+\..+/.test(email.trim());
  const senhaValida = senha.length >= MINIMO_SENHA;
  const podeEnviar = nomeValido && emailValido && senhaValida && (!criando || aceite) && !carregando;

  async function enviar() {
    if (!podeEnviar) return;
    setErro(null);
    setAviso(null);

    if (!supabaseConfigurado) {
      setErro('Configure o .env com as chaves do Supabase para continuar.');
      return;
    }

    setCarregando(true);
    try {
      if (criando) {
        const aceiteEm = new Date().toISOString();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: {
            data: {
              full_name: nome.trim(),
              nome: nome.trim(),
              aceite_termos_em: aceiteEm,
            },
          },
        });
        if (error) throw error;

        // Com confirmação de e-mail ativada não há sessão ainda.
        if (!data.session) {
          setAviso('Enviamos um link de confirmação para o seu e-mail. Abra a mensagem para ativar a conta.');
        } else {
          // Rede de segurança: grava o aceite no perfil também no cliente
          // (o trigger handle_new_user já faz isso no servidor).
          await supabase.from('profiles').update({
            aceite_termos: true,
            aceite_termos_em: aceiteEm,
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        });
        if (error) throw error;
        // Com sessão ativa o layout raiz redireciona sozinho para o Início.
      }
    } catch (e) {
      setErro(traduzirErro(e instanceof Error ? e.message : String(e)));
    } finally {
      setCarregando(false);
    }
  }

  async function entrarGoogle() {
    setErro(null);
    setAviso(null);

    if (!supabaseConfigurado) {
      setErro('Configure o .env com as chaves do Supabase para continuar.');
      return;
    }

    setCarregando(true);
    try {
      // Com sessão criada, o layout raiz troca a rota sozinho.
      await entrarComGoogle();
    } catch (e) {
      setErro(traduzirErro(e instanceof Error ? e.message : String(e)));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={estilos.heroi}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={estilos.voltar}
          hitSlop={8}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={colors.black} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>

        <View style={estilos.patinha}>
          <Svg width={130} height={130} viewBox="0 0 24 24" fill="none" stroke={colors.white} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round">
            <Circle cx={6} cy={10} r={1.8} />
            <Circle cx={10} cy={6} r={1.8} />
            <Circle cx={14} cy={6} r={1.8} />
            <Circle cx={18} cy={10} r={1.8} />
            <Path d="M12 12c-3 0-5 2.5-5 4.5 0 1.5 1.2 2 2.6 2 1 0 1.6-.4 2.4-.4s1.4.4 2.4.4c1.4 0 2.6-.5 2.6-2 0-2-2-4.5-5-4.5z" />
          </Svg>
        </View>

        <Svg width={390} height={46} viewBox="0 0 390 46" preserveAspectRatio="none" style={estilos.onda}>
          <Path d="M0 46V26C28 8 56 10 80 24C104 38 132 40 154 26C180 8 214 10 238 26C262 42 300 38 322 22C346 6 372 12 390 24V46z" fill="#fff" />
        </Svg>
      </View>

      <ScrollView
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={estilos.titulo}>{criando ? 'Criar conta' : 'Entrar'}</Text>

        <ControleSegmentado
          opcoes={['Criar conta', 'Entrar']}
          ativo={criando ? 0 : 1}
          onSelecionar={(indice) => {
            setModo(indice === 0 ? 'criar' : 'entrar');
            setErro(null);
            setAviso(null);
          }}
        />

        {criando ? (
          <Campo
            rotulo="Nome"
            variante="roxo"
            icone={<IconeUser />}
            placeholder="Seu nome"
            autoCapitalize="words"
            autoComplete="name"
            value={nome}
            onChangeText={setNome}
          />
        ) : null}

        <Campo
          rotulo="E-mail"
          variante="azul"
          icone={<IconeEmail />}
          placeholder="voce@email.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Campo
          rotulo="Senha"
          variante="verde"
          icone={<IconeSenha />}
          placeholder={`Mínimo ${MINIMO_SENHA} caracteres`}
          secureTextEntry
          autoComplete={criando ? 'new-password' : 'current-password'}
          value={senha}
          onChangeText={setSenha}
        />

        {criando ? (
          <View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: aceite }}
              onPress={() => setAceite((atual) => !atual)}
              style={estilos.aceite}
              hitSlop={6}
            >
              <View style={[estilos.caixaAceite, aceite && estilos.caixaAceiteAtiva]}>
                {aceite ? (
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 12l5 5 9-10" stroke={colors.white} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                ) : null}
              </View>
              <Text style={estilos.textoAceite}>
                Aceito os termos de uso e o tratamento dos meus dados conforme a LGPD.
              </Text>
            </Pressable>

            <Pressable accessibilityRole="link" onPress={() => setTermosAbertos(true)} hitSlop={8}>
              <Text style={estilos.linkTermos}>Ler os termos de uso e a política de privacidade →</Text>
            </Pressable>
          </View>
        ) : null}

        {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
        {aviso ? <Text style={estilos.aviso}>{aviso}</Text> : null}

        <View style={estilos.acoes}>
          <BotaoPrimario titulo="Continuar" onPress={enviar} carregando={carregando} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continuar com Google"
            onPress={entrarGoogle}
            disabled={carregando}
            style={({ pressed }) => [estilos.google, pressed && { opacity: 0.7 }, carregando && { opacity: 0.5 }]}
          >
            <View style={estilos.googleG}>
              <Text style={estilos.googleGTexto}>G</Text>
            </View>
            <Text style={estilos.googleTexto}>Continuar com Google</Text>
          </Pressable>

          <Pressable accessibilityRole="link" onPress={() => {}} hitSlop={8}>
            <Text style={estilos.linkLojista}>Tenho uma loja ou clínica →</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={termosAbertos}
        animationType="slide"
        transparent
        onRequestClose={() => setTermosAbertos(false)}
      >
        <View style={estilos.fundoModal}>
          <View style={estilos.cartaoModal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={estilos.tituloModal}>Termos de uso e privacidade</Text>

              <Text style={estilos.subtituloModal}>1. O que é o PetLive</Text>
              <Text style={estilos.paragrafoModal}>
                O PetLive ajuda você a organizar vacinas, remédios, consultas e lembretes do seu pet.
                Os dados ficam vinculados à sua conta e são usados apenas para oferecer esses recursos.
              </Text>

              <Text style={estilos.subtituloModal}>2. Dados que coletamos</Text>
              <Text style={estilos.paragrafoModal}>
                Nome, e-mail e as informações que você cadastra sobre seus pets (espécie, raça, peso,
                histórico de saúde e fotos opcionais). Não vendemos nem compartilhamos seus dados com
                terceiros para fins de publicidade.
              </Text>

              <Text style={estilos.subtituloModal}>3. Base legal (LGPD)</Text>
              <Text style={estilos.paragrafoModal}>
                O tratamento acontece com base no seu consentimento (art. 7º, I) e na execução do
                serviço solicitado (art. 7º, V). Você pode revogar o consentimento a qualquer momento
                excluindo a sua conta em Configurações → Conta.
              </Text>

              <Text style={estilos.subtituloModal}>4. Seus direitos</Text>
              <Text style={estilos.paragrafoModal}>
                Você pode confirmar, acessar, corrigir, portar ou excluir seus dados, além de
                solicitar informações sobre o compartilhamento, conforme os art. 18 e 19 da LGPD.
                Solicitações: privacidade@petlive.app.
              </Text>

              <Text style={estilos.subtituloModal}>5. Segurança e retenção</Text>
              <Text style={estilos.paragrafoModal}>
                Usamos criptografia em trânsito e controle de acesso por usuário (RLS). Os dados são
                mantidos enquanto a conta existir e apagados em até 30 dias após a exclusão da conta.
              </Text>

              <Text style={estilos.subtituloModal}>6. Notificações</Text>
              <Text style={estilos.paragrafoModal}>
                Lembretes de vacinas, remédios e consultas são enviados por notificação local ou push.
                Você pode desativá-las nas configurações do sistema a qualquer momento.
              </Text>

              <Text style={estilos.versaoModal}>Versão vigente: 1.0 · Outubro de 2026</Text>
            </ScrollView>

            <View style={estilos.acoesModal}>
              <BotaoPrimario
                titulo="Li e aceito os termos"
                onPress={() => {
                  setAceite(true);
                  setTermosAbertos(false);
                }}
              />
              <Pressable accessibilityRole="button" onPress={() => setTermosAbertos(false)} hitSlop={8}>
                <Text style={estilos.fecharModal}>Fechar sem aceitar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/** Mensagens do Supabase em português, sem expor detalhes internos. */
function traduzirErro(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('already registered')) return 'Este e-mail já tem uma conta. Use "Entrar".';
  if (m.includes('password should be')) return `A senha precisa de pelo menos ${MINIMO_SENHA} caracteres.`;
  if (m.includes('email not confirmed')) return 'Confirme o e-mail antes de entrar.';
  if (m.includes('unable to validate') || m.includes('provider')) return 'Falha no acesso com Google. Tente novamente.';
  if (m.includes('fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique sua internet.';
  return 'Não foi possível continuar. Tente de novo em instantes.';
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.white,
  },
  heroi: {
    height: 210,
    backgroundColor: colors.hero,
    overflow: 'hidden',
  },
  voltar: {
    position: 'absolute',
    left: 24,
    top: 56,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  patinha: {
    position: 'absolute',
    right: 16,
    top: 30,
  },
  onda: {
    position: 'absolute',
    left: 0,
    bottom: -1,
  },
  conteudo: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 28,
    gap: 14,
  },
  titulo: {
    ...typography.h1,
    fontWeight: '500',
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.1,
    color: colors.black,
  },
  aceite: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  caixaAceite: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: colors.disabled,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  caixaAceiteAtiva: {
    backgroundColor: colors.black,
  },
  textoAceite: {
    ...typography.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    flex: 1,
  },
  linkTermos: {
    ...typography.caption,
    fontSize: 13,
    color: colors.primaryDeep,
    marginTop: spacing.xs,
    marginLeft: 34,
    textDecorationLine: 'underline',
  },
  fundoModal: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  cartaoModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '86%',
  },
  tituloModal: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtituloModal: {
    ...typography.bodyMedium,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: 2,
  },
  paragrafoModal: {
    ...typography.caption,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  versaoModal: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  acoesModal: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  fecharModal: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  erro: {
    ...typography.caption,
    color: colors.danger,
    backgroundColor: colors.dangerSurface,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  aviso: {
    ...typography.caption,
    color: colors.primaryDeep,
    backgroundColor: colors.primarySurface,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  acoes: {
    marginTop: 'auto',
    gap: 10,
    paddingTop: spacing.lg,
  },
  google: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleG: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.disabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleGTexto: {
    fontWeight: '800',
    fontSize: 13,
    color: colors.black,
  },
  googleTexto: {
    fontWeight: '600',
    fontSize: 15,
    color: colors.text,
  },
  linkLojista: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    paddingTop: 2,
  },
});
