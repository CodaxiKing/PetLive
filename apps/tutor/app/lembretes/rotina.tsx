import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { Icone } from '../../src/components/Icone'
import { Interruptor } from '../../src/components/Interruptor'
import { useLembretes } from '../../src/lembretes/LembretesProvider'
import {
  carregarRotina,
  descricaoItem,
  ITENS_ROTINA,
  salvarRotina,
  type EstadoRotina,
  type ItemRotina,
} from '../../src/lembretes/rotina'
import { agendarUmLembrete, cancelarLembrete } from '../../src/notificacoes/sincronizarLembretes'
import { HORARIO_PADRAO } from '../../src/notificacoes/prefs'
import { usePets } from '../../src/pets/PetsProvider'
import { colors } from '../../src/theme/colors'
import { spacing } from '../../src/theme/tokens'
import { typography } from '../../src/theme/typography'
import { EstadoTela } from '../../src/components/EstadoTela'
import { textoDeErro } from '../../src/lib/erros'

/** Horários oferecidos, de hora em hora no período do dia. */

/**
 * Rotina de cuidados (protótipo Rotina; board P1 "Rotina de cuidados:
 * antipulgas, vermífugo, banho, dentes e aniversário"). Um interruptor por
 * item, o dia do antipulgas e o horário dos avisos. Salvar grava os
 * lembretes do pet (origem rotina) e agenda as notificações do aparelho.
 */
export default function Rotina() {
  const { petId: petParam } = useLocalSearchParams<{ petId?: string }>()
  const { pets, petAtivo } = usePets()
  const { recarregar } = useLembretes()

  const [petEscolhido, setPetEscolhido] = useState<string | null>(null)
  // Derivado: os pets podem chegar depois de a tela abrir.
  const petId = petEscolhido ?? petParam ?? petAtivo?.id ?? pets[0]?.id ?? null
  const [estado, setEstado] = useState<EstadoRotina | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const pet = pets.find((p) => p.id === petId) ?? null

  const carregar = useCallback((id: string) => {
    carregarRotina(id, HORARIO_PADRAO)
      .then(setEstado, (e) => setErroCarga(textoDeErro(e)))
  }, [])

  useEffect(() => {
    if (petId) carregar(petId)
  }, [petId, carregar])

  function escolherPet(id: string) {
    setEstado(null)
    setErroCarga(null)
    setPetEscolhido(id)
  }

  function mudarItem(item: ItemRotina, mudanca: Partial<EstadoRotina['itens'][ItemRotina]>) {
    setEstado((atual) =>
      atual ? { ...atual, itens: { ...atual.itens, [item]: { ...atual.itens[item], ...mudanca } } } : atual,
    )
  }

  async function salvar() {
    if (!pet || !estado || salvando) return
    setSalvando(true)
    try {
      const gravados = await salvarRotina(pet, estado)
      // Notificações do aparelho: agenda os ligados e cancela os desligados.
      await Promise.all(
        gravados.map((lembrete) =>
          (lembrete.ativo ? agendarUmLembrete(lembrete) : cancelarLembrete(lembrete.id)).catch(() => undefined),
        ),
      )
      await recarregar()
      router.back()
    } catch (e) {
      Alert.alert('Não foi possível salvar', textoDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo="Lembretes" titulo="Rotina de cuidados" />

      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {pets.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.pets}>
            {pets.map((p) => {
              const ativo = p.id === petId
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: ativo }}
                  onPress={() => escolherPet(p.id)}
                  style={[estilos.pilula, ativo && estilos.pilulaAtiva]}
                >
                  <Text style={[estilos.pilulaTexto, ativo && estilos.pilulaTextoAtiva]}>{p.nome}</Text>
                </Pressable>
              )
            })}
          </ScrollView>
        ) : null}

        {!pet ? (
          <Text style={estilos.vazio}>Cadastre um pet para montar a rotina de cuidados.</Text>
        ) : erroCarga ? (
          <EstadoTela tipo="erro" texto={erroCarga} onTentar={() => { setErroCarga(null); carregar(pet.id) }} />
        ) : !estado ? (
          <EstadoTela tipo="carregando" texto="Montando a rotina…" />
        ) : (
          <>
            {ITENS_ROTINA.map((definicao) => {
              const escolha = estado.itens[definicao.item]
              const semData = definicao.item === 'aniversario' && !pet.nascimento
              const ligado = escolha.ligado && !semData
              return (
                <View key={definicao.item} style={[estilos.cartao, { backgroundColor: definicao.fundo }]}>
                  <View style={estilos.cartaoTopo}>
                    <View style={estilos.flex}>
                      <Text style={estilos.cartaoTitulo}>{definicao.rotulo(pet)}</Text>
                      <Text style={estilos.cartaoDescricao}>{descricaoItem(definicao, escolha, pet)}</Text>
                    </View>
                    <Interruptor
                      ligado={ligado}
                      rotulo={definicao.rotulo(pet)}
                      desabilitado={semData || salvando}
                      onToggle={() => mudarItem(definicao.item, { ligado: !escolha.ligado })}
                    />
                  </View>

                  {definicao.item === 'antipulgas' && ligado ? (
                    <View style={estilos.dia}>
                      <Text style={estilos.diaRotulo}>Dia do mês</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Dia anterior"
                        onPress={() => mudarItem('antipulgas', { dia: escolha.dia <= 1 ? 28 : escolha.dia - 1 })}
                        style={estilos.passo}
                        hitSlop={6}
                      >
                        <Text style={estilos.passoTexto}>−</Text>
                      </Pressable>
                      <Text style={estilos.diaValor}>{escolha.dia}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Próximo dia"
                        onPress={() => mudarItem('antipulgas', { dia: escolha.dia >= 28 ? 1 : escolha.dia + 1 })}
                        style={estilos.passo}
                        hitSlop={6}
                      >
                        <Text style={estilos.passoTexto}>+</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              )
            })}

            <Text style={estilos.nota}>
              Cada lembrete aparece também na tela de Lembretes e respeita o Não perturbe.
            </Text>
          </>
        )}
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Salvar rotina"
          icone={<Icone nome="sino" size={22} />}
          carregando={salvando}
          desabilitado={!pet || !estado}
          onPress={salvar}
        />
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: spacing.lg, gap: 10 },
  pets: { gap: 8 },
  pilula: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.surface },
  pilulaAtiva: { backgroundColor: colors.black },
  pilulaTexto: { fontSize: 13, fontFamily: typography.label.fontFamily, color: colors.black },
  pilulaTextoAtiva: { color: colors.white },
  vazio: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  cartao: { borderRadius: 22, paddingVertical: 12, paddingHorizontal: 16, gap: 10 },
  cartaoTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartaoTitulo: { fontSize: 14, lineHeight: 19, fontFamily: typography.h1.fontFamily, color: colors.black },
  cartaoDescricao: { ...typography.small, color: colors.textMuted },
  dia: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  diaRotulo: { flex: 1, fontSize: 12, fontFamily: typography.label.fontFamily, color: colors.primaryDark },
  passo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passoTexto: { fontSize: 18, lineHeight: 20, fontFamily: typography.h1.fontFamily, color: colors.black },
  diaValor: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: typography.h1.fontFamily,
    color: colors.black,
  },
  nota: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: typography.small.fontFamily,
    color: '#566070',
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
})
