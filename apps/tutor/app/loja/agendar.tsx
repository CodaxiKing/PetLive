import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../src/components/Animacoes'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { reais } from '../../src/despesas/despesas'
import { abrirVitrine, type Loja, type Servico } from '../../src/loja/loja'
import { diaIso, duracaoTexto, hhmm, horariosLivres, proximosDias, remarcar, reservar, type HorarioLivre } from '../../src/loja/reservas'
import { AvatarPet } from '../../src/pets/AvatarPet'
import { usePets } from '../../src/pets/PetsProvider'
import { colors } from '../../src/theme/colors'
import { fontFamily } from '../../src/theme/typography'

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Agendar serviço por horário (protótipo Agendar). Com ?remarcar=<id>, troca o horário da reserva. */
export default function Agendar() {
  const { loja: lojaId, servico: servicoParam, remarcar: reservaId } = useLocalSearchParams<{ loja: string; servico?: string; remarcar?: string }>()
  const { pets, petAtivo } = usePets()
  const [loja, setLoja] = useState<Loja | null>(null)
  const [servicos, setServicos] = useState<Servico[]>([])
  const [servicoId, setServicoId] = useState<string | null>(servicoParam ?? null)
  const [petId, setPetId] = useState(petAtivo?.id ?? pets[0]?.id ?? null)
  const dias = proximosDias(14)
  const [dia, setDia] = useState(dias[0])
  // Resultado guardado com a consulta (serviço e dia): trocar a consulta mostra "carregando" sem reset no efeito.
  const chave = `${servicoId}|${diaIso(dia)}|${reservaId ?? ''}`
  const [grade, setGrade] = useState<{ chave: string; lista: HorarioLivre[] } | null>(null)
  const [selecao, setSelecao] = useState<{ chave: string; horario: HorarioLivre } | null>(null)
  const horarios = grade?.chave === chave ? grade.lista : null
  const escolhido = selecao?.chave === chave ? selecao.horario : null
  const setEscolhido = (h: HorarioLivre) => setSelecao({ chave, horario: h })
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!lojaId) return
    abrirVitrine(lojaId).then((v) => {
      if (!v.disponivel) return
      setLoja(v.loja)
      const porHorario = v.servicos.filter((s) => s.modelo === 'horario')
      setServicos(porHorario)
      setServicoId((atual) => atual ?? porHorario[0]?.id ?? null)
    }, (e: Error) => setErro(e.message))
  }, [lojaId])

  useEffect(() => {
    if (!servicoId) return
    let vivo = true
    const consulta = chave
    horariosLivres(servicoId, dia, reservaId).then(
      (lista) => vivo && setGrade({ chave: consulta, lista }),
      (e: Error) => {
        if (!vivo) return
        setGrade({ chave: consulta, lista: [] })
        setErro(e.message)
      },
    )
    return () => {
      vivo = false
    }
  }, [servicoId, dia, reservaId, chave])

  const servico = servicos.find((s) => s.id === servicoId) ?? null

  async function confirmar() {
    if (!escolhido || !servico) return
    setEnviando(true)
    setErro(null)
    try {
      if (reservaId) {
        await remarcar(reservaId, escolhido.inicio)
        router.back()
      } else {
        const r = await reservar(servico.id, escolhido.inicio, petId, mensagem)
        router.replace(`/pedidos/${r.id}`)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      // Horário tomado por outra pessoa: recarrega a grade.
      horariosLivres(servico.id, dia, reservaId).then((lista) => setGrade({ chave, lista }), () => undefined)
    } finally {
      setEnviando(false)
    }
  }

  if (!loja) return <View style={[estilos.tela, estilos.centro]}>{erro ? <Text style={estilos.sub}>{erro}</Text> : <ActivityIndicator color={colors.primaryDeep} />}</View>

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo={loja.name} titulo={reservaId ? 'Remarcar horário' : 'Agendar horário'} altura={176} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!reservaId && pets.length > 1 ? (
          <>
            <Text style={estilos.secao}>Pet</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.linhaChips}>
              {pets.map((p) => (
                <Tocavel key={p.id} accessibilityRole="radio" accessibilityState={{ selected: p.id === petId }} onPress={() => setPetId(p.id)} style={[estilos.pet, p.id === petId && estilos.ativo]}>
                  <AvatarPet especie={p.especie} foto={p.foto_url} size={30} />
                  <Text style={[estilos.chipTexto, p.id === petId && estilos.textoClaro]}>{p.nome}</Text>
                </Tocavel>
              ))}
            </ScrollView>
          </>
        ) : null}

        {!reservaId && servicos.length > 1 ? (
          <>
            <Text style={estilos.secao}>Serviço</Text>
            <View style={estilos.chips}>
              {servicos.map((s) => (
                <Tocavel key={s.id} accessibilityRole="radio" accessibilityState={{ selected: s.id === servicoId }} onPress={() => setServicoId(s.id)} style={[estilos.chip, s.id === servicoId && estilos.ativo]}>
                  <Text style={[estilos.chipTexto, s.id === servicoId && estilos.textoClaro]}>{s.name}</Text>
                </Tocavel>
              ))}
            </View>
          </>
        ) : null}

        <Text style={estilos.secao}>Dia</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.linhaChips}>
          {dias.map((d) => {
            const ativo = d.getTime() === dia.getTime()
            return (
              <Tocavel key={d.toISOString()} accessibilityRole="radio" accessibilityState={{ selected: ativo }} accessibilityLabel={d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} onPress={() => setDia(d)} style={[estilos.dia, ativo && estilos.ativo]}>
                <Text style={[estilos.diaSemana, ativo && estilos.textoClaro]}>{SEMANA[d.getDay()]}</Text>
                <Text style={[estilos.diaNumero, ativo && estilos.textoClaro]}>{d.getDate()}</Text>
              </Tocavel>
            )
          })}
        </ScrollView>

        <View style={estilos.cabecalhoHorarios}>
          <Text style={estilos.secao}>Horários disponíveis</Text>
          {servico?.duration_min ? <Text style={estilos.sub}>Duração: {duracaoTexto(servico.duration_min)}</Text> : null}
        </View>
        {!servico ? (
          <Text style={estilos.sub}>Esta loja ainda não tem serviços com agenda pelo app.</Text>
        ) : horarios === null ? (
          <ActivityIndicator color={colors.primaryDeep} />
        ) : horarios.length === 0 ? (
          <Text style={estilos.sub}>Sem horários livres neste dia. Tente outro dia.</Text>
        ) : (
          <View style={estilos.chips}>
            {horarios.map((h) => {
              const ativo = escolhido?.inicio === h.inicio
              return (
                <Tocavel key={h.inicio} accessibilityRole="radio" accessibilityState={{ selected: ativo }} onPress={() => setEscolhido(h)} style={[estilos.horario, ativo && estilos.ativo]}>
                  <Text style={[estilos.horarioTexto, ativo && estilos.textoClaro]}>{hhmm(h.inicio)}</Text>
                </Tocavel>
              )
            })}
          </View>
        )}
        <Text style={estilos.nota}>A loja define os dias, horários e vagas. {loja.cancel_until_min ? `Cancelamento grátis até ${duracaoTexto(loja.cancel_until_min)} antes.` : ''}</Text>

        {!reservaId ? (
          <View style={estilos.campo}>
            <TextInput value={mensagem} onChangeText={setMensagem} placeholder="Recado para a loja (opcional)" placeholderTextColor={colors.textMuted} multiline maxLength={500} style={estilos.texto} />
          </View>
        ) : null}
        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
      </ScrollView>
      <View style={estilos.rodape}>
        {escolhido && servico ? (
          <Text style={estilos.resumo}>
            {dia.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' })} · {hhmm(escolhido.inicio)} · {servico.name}
            {servico.price_cents !== null ? ` · ${reais(servico.price_cents)}` : ''}
          </Text>
        ) : null}
        <BotaoPrimario titulo={reservaId ? 'Confirmar novo horário' : 'Reservar horário'} carregando={enviando} desabilitado={!escolhido} onPress={confirmar} />
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  sub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted },
  linhaChips: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center' },
  pet: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: 14, height: 40, borderRadius: 20, backgroundColor: colors.surface },
  ativo: { backgroundColor: colors.black, borderColor: colors.black },
  chipTexto: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.black },
  textoClaro: { color: colors.white },
  dia: { width: 56, height: 66, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 2 },
  diaSemana: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.textMuted },
  diaNumero: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.black },
  cabecalhoHorarios: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  horario: { width: 76, height: 44, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  horarioTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  campo: { backgroundColor: colors.surface, borderRadius: 22, padding: 14 },
  texto: { fontFamily: fontFamily.regular, fontSize: 15, color: colors.black, minHeight: 50, textAlignVertical: 'top' },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 8 },
  resumo: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black, textAlign: 'center' },
})
