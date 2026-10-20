import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { Campo } from '../../src/components/Campo';
import { IconePerfil } from '../../src/components/Layout';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';

type Opcao = {
  rotulo: string;
  onPress?: () => void;
  /** Texto em vermelho (ação destrutiva, LGPD). */
  perigo?: boolean;
};

/**
 * Perfil do tutor (board: [APP-CLIENTE] "Perfil do tutor e sair da conta", P1):
 * identidade, edição do nome, termos/LGPD e sair da conta.
 */
export default function Perfil() {
  const router = useRouter();
  const { user } = useAuth();

  const [nome, setNome] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('nome')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setNome(data?.nome ?? null);
      });
  }, [user]);

  const nomeExibido =
    nome?.trim() ||
    (typeof user?.user_metadata?.nome === 'string' && user.user_metadata.nome.trim()) ||
    (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    user?.email ||
    'Tutor PetLive';

  function abrirEdicao() {
    setNomeEdicao(nomeExibido);
    setEditando(true);
  }

  async function salvarNome() {
    if (!user) return;
    const limpo = nomeEdicao.trim();
    if (!limpo) return;

    setSalvando(true);
    try {
      const { error } = await supabase.from('profiles').update({ nome: limpo }).eq('id', user.id);
      if (error) throw error;

      // Mantém os metadados do auth em dia (exibidos em outras telas).
      const { error: erroAuth } = await supabase.auth.updateUser({
        data: { nome: limpo, full_name: limpo },
      });
      if (erroAuth) throw erroAuth;

      setNome(limpo);
      setEditando(false);
    } catch (e) {
      Alert.alert('Não foi possível salvar', e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function sair() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Não foi possível sair', error.message);
      return;
    }
    // Sem sessão o layout raiz volta para as boas-vindas.
    router.replace('/welcome');
  }

  const opcoes: Opcao[] = [
    { rotulo: 'Meus dados', onPress: abrirEdicao },
    { rotulo: 'Avisos', onPress: () => router.push('/avisos') },
    { rotulo: 'Permissões', onPress: () => router.push('/permissoes') },
    { rotulo: 'Privacidade e dados', onPress: () => router.push('/privacidade') },
  ];

  return (
    <View style={estilos.tela}>
      <Text style={estilos.titulo}>Perfil</Text>

      <View style={estilos.cartao}>
        <View style={estilos.avatar}>
          <IconePerfil size={26} />
        </View>
        <View style={estilos.identidade}>
          <Text style={estilos.nome} numberOfLines={1}>
            {nomeExibido}
          </Text>
          <Text style={estilos.email} numberOfLines={1}>
            {user?.email ?? 'sem e-mail'}
          </Text>
        </View>
        <View style={estilos.plano}>
          <Text style={estilos.planoTexto}>Grátis</Text>
        </View>
      </View>

      <View style={estilos.opcoes}>
        {opcoes.map((opcao) => (
          <Pressable
            key={opcao.rotulo}
            accessibilityRole="button"
            onPress={opcao.onPress}
            style={({ pressed }) => [estilos.opcao, pressed && { opacity: 0.7 }]}
          >
            <Text style={[estilos.opcaoTexto, opcao.perigo && estilos.opcaoTextoPerigo]}>
              {opcao.rotulo}
            </Text>
            <Text style={estilos.opcaoSeta}>›</Text>
          </Pressable>
        ))}
      </View>

      <View style={estilos.avisos}>
        <Text style={estilos.avisoSaude}>
          O PetLive organiza informações e não substitui o atendimento veterinário.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={sair}
        style={({ pressed }) => [estilos.sair, pressed && { opacity: 0.7 }]}
      >
        <Text style={estilos.sairTexto}>Sair da conta</Text>
      </Pressable>

      {/* Editar nome */}
      <Modal
        visible={editando}
        animationType="slide"
        transparent
        onRequestClose={() => setEditando(false)}
      >
        <View style={estilos.fundoModal}>
          <View style={estilos.cartaoModal}>
            <Text style={estilos.tituloModal}>Meus dados</Text>
            <Text style={estilos.rotuloCampo}>Como você quer ser chamado</Text>
            <Campo
              rotulo="Nome"
              variante="azul"
              autoCapitalize="words"
              returnKeyType="done"
              value={nomeEdicao}
              onChangeText={setNomeEdicao}
              editable={!salvando}
            />
            <View style={estilos.acoesModal}>
              <BotaoPrimario
                titulo="Salvar"
                carregando={salvando}
                desabilitado={!nomeEdicao.trim() || salvando}
                onPress={salvarNome}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setEditando(false)}
                hitSlop={8}
                disabled={salvando}
              >
                <Text style={estilos.fecharModal}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingTop: 54,
    gap: spacing.xl,
  },
  titulo: {
    ...typography.h1,
    fontWeight: '500',
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.1,
    color: colors.black,
  },
  cartao: {
    backgroundColor: colors.primarySurface,
    borderRadius: 24,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identidade: {
    flex: 1,
    minWidth: 0,
  },
  nome: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.black,
  },
  email: {
    ...typography.small,
    color: colors.primaryDeep,
  },
  plano: {
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  planoTexto: {
    ...typography.label,
    fontSize: 12,
    color: colors.primaryDeep,
  },
  opcoes: {
    gap: spacing.sm,
  },
  opcao: {
    backgroundColor: colors.background,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opcaoTexto: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  opcaoTextoPerigo: {
    color: colors.danger,
    fontWeight: '600',
  },
  opcaoSeta: {
    fontSize: 22,
    color: colors.textMuted,
  },
  avisos: {
    marginTop: 'auto',
  },
  avisoSaude: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    backgroundColor: colors.warningSurface,
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sair: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 100,
  },
  sairTexto: {
    ...typography.button,
    color: colors.danger,
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
    gap: spacing.md,
  },
  tituloModal: {
    ...typography.h2,
    color: colors.text,
  },
  rotuloCampo: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textMuted,
  },
  acoesModal: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  fecharModal: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
