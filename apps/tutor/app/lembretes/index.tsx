import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { Icone } from '../../src/components/Icone'
import { LinhaIcone } from '../../src/components/LinhaIcone'
import { Mascote } from '../../src/components/Mascote'
import { Flutuar } from '../../src/components/Animacoes'
import { Flutuar } from '../../src/components/Animacoes'
import { usePets } from '../../src/pets/PetsProvider'
import { useLembretes } from '../../src/lembretes/LembretesProvider'
import type { Lembrete } from '../../src/lembretes/types'
import {
  REPETICOES,
  TIPOS,
  corUrgencia,
  dataParaExibicao,
  rotuloProximidade,
} from '../../src/lembretes/types'
import { permissaoConcedida, pedirPermissao } from '../../src/notificacoes/notificacoes'
import { colors } from '../../src/theme/colors'
import { typography } from '../../src/theme/typography'
import { radius, shadow, spacing } from '../../src/theme/tokens'

type Aba = 'Hoje' | 'Semana' | 'Mês'

const ABAS: Aba[] = ['Hoje', 'Semana', 'Mês']

function diasAte(iso: string): number {
  const [data] = iso.split('T')
  const [a, m, d] = data.split('-').map(Number)
  const alvo = new Date(a, m - 1, d)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  alvo.setHours(0, 0, 0, 0)
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000)
}

export default function Lembretes() {
  const { lembretes, carregando, concluirLembrete, removerLembrete, recarregar } = useLembretes()
  const { pets } = usePets()
  const [aba, setAba] = useState<Aba>('Hoje')
  const [atualizando, setAtualizando] = useState(false)
  // 'inicial' = ainda não perguntou; 'negada' = usuário recusou (mostra atalho p/ ajustar).
  const [permissao, setPermissao] = useState<'inicial' | 'concedida' | 'negada' | 'indefinida'>(
    'inicial',
  )

  useEffect(() => {
    permissaoConcedida()
      .then((concedida) => setPermissao(concedida ? 'concedida' : 'inicial'))
      .catch(() => {})
  }, [])

  const ativarAvisos = useCallback(async () => {
    const resultado = await pedirPermissao()
    setPermissao(resultado)
    if (resultado === 'negada') {
      Alert.alert(
        'Avisos desativados',
        'Para receber os lembretes, libere as notificações do PetLive nas configurações do aparelho.',
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
        ],
      )
    }
  }, [])

  const nomePet = useCallback(
    (id: string | null) => (id ? (pets.find((p) => p.id === id)?.nome ?? null) : null),
    [pets],
  )

  const filtrados = useMemo(() => {
    const limite = aba === 'Hoje' ? 0 : aba === 'Semana' ? 7 : 31
    return lembretes.filter((l) => {
      const dias = diasAte(l.proxima_em)
      // "Mês" mostra o que vem em até ~1 mês; vencidos ficam sempre visíveis.
      return dias <= limite
    })
  }, [lembretes, aba])

  const confirmarRemocao = (lembrete: Lembrete) => {
    Alert.alert('Remover lembrete?', `"${lembrete.titulo}" será apagado.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => removerLembrete(lembrete.id) },
    ])
  }

  return (
    <View style={estilos.tela}>
      <View style={estilos.cabecalho}>
        <Text style={estilos.titulo}>Lembretes</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Novo lembrete"
          onPress={() => router.push('/lembretes/novo')}
          style={({ pressed }) => [estilos.novo, shadow.floating, pressed && estilos.pressionado]}
        >
          <Text style={estilos.novoSinal}>＋</Text>
        </Pressable>
      </View>

      <View style={estilos.abas}>
        {ABAS.map((op) => {
          const ativa = op === aba
          return (
            <Pressable
              key={op}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativa }}
              onPress={() => setAba(op)}
              style={[estilos.aba, ativa && estilos.abaAtiva]}
            >
              <Text style={[estilos.abaTexto, ativa && estilos.abaTextoAtivo]}>{op}</Text>
            </Pressable>
          )
        })}
      </View>

      <View style={estilos.atalhoRotina}>
        <LinhaIcone
          icone={<Icone nome="relogio" />}
          rotulo="Rotina de cuidados"
          valor="Antipulgas, vermífugo, banho e mais"
          onPress={() => router.push('/lembretes/rotina')}
          direita={<Icone nome="seta" size={16} cor={colors.textMuted} />}
        />
      </View>

      {permissao !== 'concedida' ? (
        <Pressable
          accessibilityRole="button"
          onPress={ativarAvisos}
          style={({ pressed }) => [estilos.banner, pressed && estilos.pressionado]}
        >
          <Text style={estilos.bannerTitulo}>
            {permissao === 'negada' ? 'Avisos desativados' : 'Ative os avisos'}
          </Text>
          <Text style={estilos.bannerTexto}>
            {permissao === 'negada'
              ? 'Toque para abrir as configurações do aparelho.'
              : 'Receba um toque antes de cada vacina, consulta ou remédio.'}
          </Text>
        </Pressable>
      ) : null}

      {carregando ? (
        <View style={estilos.centro}>
          <ActivityIndicator color={colors.primaryDeep} />
        </View>
      ) : filtrados.length === 0 ? (
        <View style={estilos.centro}>
          <Flutuar><Flutuar><Mascote especie="gato" size={130} /></Flutuar></Flutuar>
          <Text style={estilos.vazioTitulo}>Nenhum lembrete {aba.toLowerCase()}</Text>
          <Text style={estilos.vazioTexto}>
            Crie lembretes de vacina, consulta ou banho para não esquecer.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={estilos.lista}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={async () => {
                setAtualizando(true)
                await recarregar()
                setAtualizando(false)
              }}
              tintColor={colors.primaryDeep}
            />
          }
        >
          {filtrados.map((lembrete) => {
            const tipo = TIPOS.find((t) => t.valor === lembrete.tipo) ?? TIPOS[4]
            const proximidade = rotuloProximidade(lembrete.proxima_em)
            const urgencia = corUrgencia(proximidade.urgencia)
            const pet = nomePet(lembrete.pet_id)
            const repeticao = REPETICOES.find((r) => r.valor === lembrete.repetir)

            return (
              <View
                key={lembrete.id}
                style={[estilos.card, { backgroundColor: tipo.fundo }]}
              >
                <View style={estilos.cardTopo}>
                  <View style={estilos.flex}>
                    <Text style={[estilos.cardTitulo, { color: tipo.cor }]}>{lembrete.titulo}</Text>
                    <Text style={[estilos.cardSub, { color: tipo.cor }]}>
                      {[pet, repeticao?.rotulo].filter(Boolean).join(' · ') || tipo.rotulo}
                    </Text>
                  </View>

                  <View style={[estilos.etiqueta, { backgroundColor: urgencia.fundo }]}>
                    <Text style={[estilos.etiquetaTexto, { color: urgencia.texto }]}>
                      {proximidade.texto}
                    </Text>
                  </View>
                </View>

                <Text style={[estilos.cardData, { color: tipo.cor }]}>
                  {dataParaExibicao(lembrete.proxima_em)}
                </Text>

                <View style={estilos.acoes}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => concluirLembrete(lembrete)}
                    style={({ pressed }) => [estilos.botaoFeito, pressed && estilos.pressionado]}
                  >
                    <Text style={estilos.botaoFeitoTexto}>Marcar como feito</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remover ${lembrete.titulo}`}
                    onPress={() => confirmarRemocao(lembrete)}
                    hitSlop={8}
                    style={({ pressed }) => [estilos.botaoRemover, pressed && estilos.pressionado]}
                  >
                    <Text style={estilos.botaoRemoverTexto}>✕</Text>
                  </Pressable>
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  titulo: { ...typography.h1, fontSize: 30, lineHeight: 36, color: colors.black },
  novo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  novoSinal: { fontSize: 28, lineHeight: 32, color: colors.black },
  abas: {
    flexDirection: 'row',
    gap: 4,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: colors.disabled,
    borderRadius: 26,
    padding: 4,
  },
  atalhoRotina: { marginHorizontal: spacing.xl, marginBottom: spacing.md },
  aba: { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  abaAtiva: { backgroundColor: colors.black },
  abaTexto: { ...typography.captionMedium, color: colors.textMuted },
  abaTextoAtivo: { color: colors.white },
  banner: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: colors.warningSurface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  bannerTitulo: { ...typography.bodyMedium, color: colors.warningText },
  bannerTexto: { ...typography.caption, color: colors.warningText, marginTop: 2 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md },
  vazioTitulo: { ...typography.h3, color: colors.text, textAlign: 'center' },
  vazioTexto: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  lista: { paddingHorizontal: spacing.xl, paddingBottom: 130, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  cardTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitulo: { ...typography.h3, fontWeight: '700' },
  cardSub: { ...typography.caption, marginTop: 2, opacity: 0.8 },
  cardData: { ...typography.captionMedium },
  etiqueta: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  etiquetaTexto: { ...typography.small, fontWeight: '700' },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  botaoFeito: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoFeitoTexto: { ...typography.captionMedium, color: colors.text },
  botaoRemover: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoRemoverTexto: { fontSize: 16, color: colors.textMuted },
  pressionado: { opacity: 0.6 },
})
