import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Surgir, Tocavel } from '../../../src/components/Animacoes'
import { AvisoOffline } from '../../../src/components/AvisoOffline'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { Icone } from '../../../src/components/Icone'
import { MarcaPata } from '../../../src/components/MarcaPata'
import { Mascote } from '../../../src/components/Mascote'
import { AbaCalendario } from '../../../src/pets/AbaCalendario'
import { usePets } from '../../../src/pets/PetsProvider'
import { idadeEmAnos } from '../../../src/pets/types'
import { carregarConsultas, type Consulta } from '../../../src/saude/consultas'
import { GraficoPeso } from '../../../src/saude/GraficoPeso'
import { carregarPesos, formatarKg, type RegistroPeso } from '../../../src/saude/peso'
import { dataParaExibicao, diasAte, rotuloDose } from '../../../src/saude/types'
import { useVacinas } from '../../../src/saude/VacinasProvider'
import { colors } from '../../../src/theme/colors'
import { fontFamily, typography } from '../../../src/theme/typography'

const ABAS = ['Vacinas', 'Peso', 'Consultas'] as const
type Aba = (typeof ABAS)[number]

const CIRCULOS = ['#A9DCF6', '#EADCFB']

/** 'YYYY-MM-DD' -> 'DD/MM/AA', como no protótipo. */
function dataCurta(iso: string | null | undefined): string {
  const completa = dataParaExibicao(iso)
  return completa ? completa.replace(/\/(\d{2})(\d{2})$/, '/$2') : ''
}

function BotaoRedondo({ rotulo, onPress, children }: { rotulo: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [estilos.botaoRedondo, pressed && { opacity: 0.7 }]}
    >
      {children}
    </Pressable>
  )
}

/**
 * Tela do pet (protótipo Pet; board P0 "Tela do pet: resumo, abas e
 * etiquetas"): herói com o pet, nome e o alerta da próxima vacina, sexo,
 * idade e peso, e as abas Vacinas, Peso e Consultas com o registro no
 * rodapé. Editar, remédios, calendário sugerido e excluir ficam no topo.
 */
export default function PetDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { width } = useWindowDimensions()
  const { pets, definirPetAtivo, removerPet } = usePets()
  const { vacinas, removerVacina } = useVacinas()
  const [aba, setAba] = useState<Aba>('Vacinas')
  const [pesos, setPesos] = useState<RegistroPeso[]>([])
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [menuAberto, setMenuAberto] = useState(false)
  const [calendarioAberto, setCalendarioAberto] = useState(false)

  const pet = pets.find((p) => p.id === id) ?? null

  // Mantém o pet selecionado em sincronia com a rota (alimenta vacinas e remédios).
  useEffect(() => {
    if (pet) definirPetAtivo(pet.id)
  }, [pet, definirPetAtivo])

  // Peso e consultas recarregam ao voltar dos formulários.
  useFocusEffect(
    useCallback(() => {
      if (!id) return
      carregarPesos(id).then(setPesos, () => undefined)
      carregarConsultas(id).then(setConsultas, () => undefined)
    }, [id]),
  )

  if (!pet) {
    return (
      <View style={estilos.tela}>
        <Text style={estilos.vazio}>Pet não encontrado.</Text>
      </View>
    )
  }

  const petAtual = pet

  // Alerta do topo: a vacina atrasada mais antiga, ou a próxima em até 30 dias.
  const comDose = vacinas
    .map((v) => ({ v, dias: diasAte(v.proxima_dose) }))
    .filter((x): x is { v: (typeof vacinas)[number]; dias: number } => x.dias !== null)
    .sort((a, b) => a.dias - b.dias)
  const alerta = comDose.find((x) => x.dias <= 30)
  const textoAlerta = alerta
    ? alerta.dias < 0
      ? `${alerta.v.nome} vencida há ${Math.abs(alerta.dias)} dias`
      : alerta.dias === 0
        ? `${alerta.v.nome} vence hoje`
        : `${alerta.v.nome} vence em ${alerta.dias} dias`
    : null

  const pesoAtual = pesos.length ? pesos[pesos.length - 1].peso : petAtual.peso_atual
  const idade = idadeEmAnos(petAtual.nascimento)

  function ir(pathname: '/pet/[id]/carteirinha' | '/pet/[id]/editar' | '/pet/[id]/medicamentos' | '/pet/[id]/peso' | '/pet/[id]/consultas' | '/pet/[id]/vacina/nova' | '/pet/[id]/consultas/nova' | '/pet/[id]/linha-do-tempo') {
    setMenuAberto(false)
    router.push({ pathname, params: { id: petAtual.id } })
  }

  function confirmarExclusao() {
    setMenuAberto(false)
    Alert.alert(
      `Excluir ${petAtual.nome}?`,
      'Isso apaga também as vacinas, remédios e compromissos deste pet. Não dá para desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const ok = await removerPet(petAtual.id)
            if (ok) router.back()
          },
        },
      ],
    )
  }

  function confirmarRemocaoVacina(vacinaId: string, nome: string) {
    Alert.alert(`Remover ${nome}?`, 'O registro de vacina será apagado.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => removerVacina(vacinaId) },
    ])
  }

  const cta =
    aba === 'Vacinas'
      ? { titulo: 'Registrar vacina', acao: () => ir('/pet/[id]/vacina/nova') }
      : aba === 'Peso'
        ? { titulo: 'Registrar peso', acao: () => ir('/pet/[id]/peso') }
        : { titulo: 'Registrar consulta', acao: () => ir('/pet/[id]/consultas/nova') }

  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <View style={estilos.heroi}>
          <MarcaPata size={90} style={estilos.pata} />
          <View style={estilos.retrato}>
            {petAtual.foto_url ? (
              <Image source={{ uri: petAtual.foto_url }} style={estilos.foto} accessibilityLabel={`Foto de ${petAtual.nome}`} />
            ) : (
              <Mascote especie={petAtual.especie} size={260} recorte />
            )}
          </View>

          <View style={estilos.topo}>
            <BotaoRedondo rotulo="Voltar" onPress={() => router.back()}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M15 5l-7 7 7 7" stroke={colors.black} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </BotaoRedondo>
            <View style={estilos.topoDireita}>
              <BotaoRedondo rotulo={`Compartilhar a carteirinha de ${petAtual.nome}`} onPress={() => router.push(`/pet/${petAtual.id}/compartilhar`)}>
                <Icone nome="compartilhar" size={19} />
              </BotaoRedondo>
              <BotaoRedondo rotulo="Mais opções" onPress={() => setMenuAberto(true)}>
                <Text style={estilos.mais}>⋯</Text>
              </BotaoRedondo>
            </View>
          </View>

          <Svg style={estilos.onda} width={width} height={46} viewBox="0 0 390 46" preserveAspectRatio="none">
            <Path
              d="M0 46V26C28 8 56 10 80 24C104 38 132 40 154 26C180 8 214 10 238 26C262 42 300 38 322 22C346 6 372 12 390 24V46z"
              fill={colors.surface}
            />
          </Svg>
        </View>

        <View style={estilos.corpo}>
          <AvisoOffline />
          <View style={estilos.linhaNome}>
            <Text style={estilos.nome} numberOfLines={1} accessibilityRole="header">
              {petAtual.nome}
            </Text>
            {textoAlerta ? (
              <Text style={estilos.alerta} numberOfLines={1}>
                {textoAlerta}
              </Text>
            ) : null}
          </View>

          <View style={estilos.resumo}>
            <View style={[estilos.resumoItem, { backgroundColor: '#EBDDFB' }]}>
              <Text style={estilos.resumoValor}>{petAtual.sexo === 'femea' ? 'Fêmea' : petAtual.sexo === 'macho' ? 'Macho' : '—'}</Text>
              <Text style={[estilos.resumoRotulo, { color: '#5B3C8F' }]}>Sexo</Text>
            </View>
            <View style={[estilos.resumoItem, { backgroundColor: '#FFF1C9' }]}>
              <Text style={estilos.resumoValor}>{idade ?? '—'}</Text>
              <Text style={[estilos.resumoRotulo, { color: '#7A5F0A' }]}>Idade</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver peso"
              onPress={() => setAba('Peso')}
              style={[estilos.resumoItem, { backgroundColor: '#DDF3E6' }]}
            >
              <Text style={estilos.resumoValor}>{pesoAtual ? `${formatarKg(Number(pesoAtual))} kg` : '—'}</Text>
              <Text style={[estilos.resumoRotulo, { color: '#25683F' }]}>Peso</Text>
            </Pressable>
          </View>

          <View style={estilos.abas} accessibilityRole="tablist">
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

          <Surgir key={aba}>
          {aba === 'Vacinas' ? (
            <View style={estilos.lista}>
              {vacinas.length === 0 ? (
                <Text style={estilos.vazio}>Nenhuma vacina registrada. Veja o calendário sugerido no menu ⋯.</Text>
              ) : null}
              {vacinas.map((vacina, i) => {
                const dose = rotuloDose(vacina.proxima_dose)
                const chip =
                  dose.urgencia === 'vencida' || dose.urgencia === 'hoje' || dose.urgencia === 'perto'
                    ? dose.texto
                    : dataCurta(vacina.proxima_dose)
                return (
                  <Surgir key={vacina.id} indice={i}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityHint="Segure para apagar"
                      onLongPress={() => confirmarRemocaoVacina(vacina.id, vacina.nome)}
                      style={estilos.linha}
                    >
                      <View style={[estilos.circulo, { backgroundColor: CIRCULOS[i % CIRCULOS.length] }]}>
                        <Icone nome="vacina" size={18} />
                      </View>
                      <View style={estilos.flex}>
                        <Text style={estilos.linhaTitulo} numberOfLines={1}>
                          {vacina.nome}
                        </Text>
                        <Text style={estilos.linhaSub}>Aplicada em {dataCurta(vacina.aplicada_em)}</Text>
                      </View>
                      {chip ? (
                        <Text style={[estilos.chip, dose.urgencia === 'vencida' && estilos.chipVencida]}>{chip}</Text>
                      ) : null}
                    </Pressable>
                  </Surgir>
                )
              })}
            </View>
          ) : null}

          {aba === 'Peso' ? (
            <View style={estilos.lista}>
              {pesos.length > 1 ? <GraficoPeso registros={pesos} /> : null}
              {pesos.length === 0 ? <Text style={estilos.vazio}>Nenhum peso registrado ainda.</Text> : null}
              {[...pesos].reverse().slice(0, 3).map((registro, i) => (
                <Surgir key={registro.id} indice={i}>
                  <View style={estilos.linha}>
                    <View style={[estilos.circulo, { backgroundColor: '#DDF3E6' }]}>
                      <Icone nome="balanca" size={18} />
                    </View>
                    <View style={estilos.flex}>
                      <Text style={estilos.linhaTitulo}>{formatarKg(Number(registro.peso))} kg</Text>
                      <Text style={estilos.linhaSub}>Pesado em {dataCurta(registro.medido_em)}</Text>
                    </View>
                  </View>
                </Surgir>
              ))}
              {pesos.length > 0 ? (
                <Pressable accessibilityRole="link" onPress={() => ir('/pet/[id]/peso')} hitSlop={8}>
                  <Text style={estilos.verTudo}>Ver o histórico de peso ›</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {aba === 'Consultas' ? (
            <View style={estilos.lista}>
              {consultas.length === 0 ? <Text style={estilos.vazio}>Nenhuma consulta registrada ainda.</Text> : null}
              {consultas.slice(0, 4).map((consulta, i) => (
                <Surgir key={consulta.id} indice={i}>
                  <Pressable accessibilityRole="button" onPress={() => ir('/pet/[id]/consultas')} style={estilos.linha}>
                    <View style={[estilos.circulo, { backgroundColor: '#E0F1FA' }]}>
                      <Icone nome="relogio" size={18} />
                    </View>
                    <View style={estilos.flex}>
                      <Text style={estilos.linhaTitulo} numberOfLines={1}>
                        {consulta.motivo}
                      </Text>
                      <Text style={estilos.linhaSub} numberOfLines={1}>
                        {[dataCurta(consulta.realizada_em), consulta.local ?? consulta.veterinario].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </Pressable>
                </Surgir>
              ))}
              {consultas.length > 0 ? (
                <Pressable accessibilityRole="link" onPress={() => ir('/pet/[id]/consultas')} hitSlop={8}>
                  <Text style={estilos.verTudo}>Ver todas as consultas ›</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          </Surgir>

          {/* Atalhos do pet (protótipo Pet): remédios, carteirinha e compartilhar. */}
          <View style={estilos.atalhos}>
            {[
              { rotulo: 'Medicamentos', icone: 'capsula' as const, fundo: '#FFF0C9', acao: () => ir('/pet/[id]/medicamentos') },
              { rotulo: 'Carteirinha', icone: 'carteirinha' as const, fundo: '#EBDDFB', acao: () => ir('/pet/[id]/carteirinha') },
              { rotulo: 'Compartilhar', icone: 'compartilhar' as const, fundo: '#E3F3FC', acao: () => router.push(`/pet/${petAtual.id}/compartilhar`) },
            ].map((atalho) => (
              <Tocavel
                key={atalho.rotulo}
                accessibilityRole="button"
                onPress={atalho.acao}
                estiloExterno={estilos.flex}
                style={[estilos.atalho, { backgroundColor: atalho.fundo }]}
              >
                <Icone nome={atalho.icone} size={22} />
                <Text style={estilos.atalhoTexto} numberOfLines={1}>
                  {atalho.rotulo}
                </Text>
              </Tocavel>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo={cta.titulo}
          icone={<Text style={estilos.ctaMais}>+</Text>}
          onPress={cta.acao}
        />
      </View>

      {/* Mais opções */}
      <Modal visible={menuAberto} transparent animationType="fade" onRequestClose={() => setMenuAberto(false)}>
        <Pressable style={estilos.fundoModal} onPress={() => setMenuAberto(false)} accessibilityLabel="Fechar menu">
          <View style={estilos.folha}>
            <Pressable accessibilityRole="button" onPress={() => ir('/pet/[id]/editar')} style={estilos.opcao}>
              <Text style={estilos.opcaoTexto}>Editar {petAtual.nome}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => ir('/pet/[id]/medicamentos')} style={estilos.opcao}>
              <Text style={estilos.opcaoTexto}>Remédios e doses</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => ir('/pet/[id]/linha-do-tempo')} style={estilos.opcao}>
              <Text style={estilos.opcaoTexto}>Linha do tempo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMenuAberto(false)
                setCalendarioAberto(true)
              }}
              style={estilos.opcao}
            >
              <Text style={estilos.opcaoTexto}>Calendário sugerido de vacinas</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={confirmarExclusao} style={estilos.opcao}>
              <Text style={[estilos.opcaoTexto, estilos.opcaoPerigo]}>Excluir {petAtual.nome}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Calendário sugerido (por espécie e idade) */}
      <Modal visible={calendarioAberto} animationType="slide" onRequestClose={() => setCalendarioAberto(false)}>
        <View style={estilos.calendario}>
          <View style={estilos.calendarioTopo}>
            <Text style={estilos.calendarioTitulo}>Calendário sugerido</Text>
            <Pressable accessibilityRole="button" onPress={() => setCalendarioAberto(false)} hitSlop={10}>
              <Text style={estilos.fechar}>Fechar</Text>
            </Pressable>
          </View>
          <AbaCalendario />
        </View>
      </Modal>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  atalhos: { flexDirection: 'row', gap: 8, marginTop: 12 },
  atalho: { height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4 },
  atalhoTexto: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.black },
  conteudo: { paddingBottom: 24 },
  heroi: { height: 320, backgroundColor: colors.hero, overflow: 'hidden' },
  pata: { position: 'absolute', left: 30, top: 110 },
  retrato: { position: 'absolute', left: 0, right: 0, bottom: 4, alignItems: 'center' },
  foto: { width: 210, height: 210, borderRadius: 105, marginBottom: 34, borderWidth: 4, borderColor: colors.white },
  topo: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topoDireita: { flexDirection: 'row', gap: 10 },
  botaoRedondo: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mais: { fontSize: 22, lineHeight: 24, color: colors.black, fontFamily: fontFamily.bold },
  onda: { position: 'absolute', left: 0, bottom: -1 },
  corpo: { paddingHorizontal: 24, gap: 14 },
  linhaNome: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nome: {
    flex: 1,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.2,
    fontFamily: fontFamily.medium,
    color: colors.black,
  },
  alerta: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: fontFamily.bold,
    color: '#A3324F',
    backgroundColor: '#FDE0E6',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resumo: { flexDirection: 'row', gap: 10 },
  resumoItem: { flex: 1, borderRadius: 24, paddingVertical: 12, alignItems: 'center' },
  resumoValor: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.black },
  resumoRotulo: { fontSize: 12, fontFamily: fontFamily.medium },
  abas: { flexDirection: 'row', gap: 22, borderBottomWidth: 1.5, borderBottomColor: colors.border },
  aba: { paddingVertical: 8, borderBottomWidth: 3, borderBottomColor: 'transparent', marginBottom: -1.5 },
  abaAtiva: { borderBottomColor: colors.primary },
  abaTexto: { fontSize: 16, fontFamily: fontFamily.medium, color: colors.textMuted },
  abaTextoAtivo: { color: colors.black, fontFamily: fontFamily.bold },
  lista: { gap: 10 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 24,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 14,
  },
  circulo: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  linhaTitulo: { fontSize: 16, fontFamily: fontFamily.semiBold, color: colors.black },
  linhaSub: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textMuted },
  chip: {
    fontSize: 12,
    fontFamily: fontFamily.bold,
    color: colors.black,
    backgroundColor: colors.white,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipVencida: { color: '#A3324F', backgroundColor: '#FDE0E6' },
  vazio: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },
  verTudo: { fontSize: 13, fontFamily: fontFamily.semiBold, color: colors.primaryDeep, textAlign: 'center' },
  rodape: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 28, backgroundColor: colors.surface },
  ctaMais: { fontFamily: fontFamily.regular, fontSize: 28, lineHeight: 32, color: colors.black },
  fundoModal: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  folha: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 36,
    gap: 8,
  },
  opcao: { backgroundColor: colors.background, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 18 },
  opcaoTexto: { fontSize: 15, fontFamily: fontFamily.semiBold, color: colors.black },
  opcaoPerigo: { color: colors.danger },
  calendario: { flex: 1, backgroundColor: colors.background, paddingTop: 48 },
  calendarioTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  calendarioTitulo: { ...typography.h2, color: colors.black },
  fechar: { fontSize: 14, fontFamily: fontFamily.semiBold, color: colors.primaryDeep },
})
