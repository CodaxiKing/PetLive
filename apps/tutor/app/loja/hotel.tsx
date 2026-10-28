import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../src/components/Animacoes'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { Interruptor } from '../../src/components/Interruptor'
import { reais } from '../../src/despesas/despesas'
import { EscolhaPet } from '../../src/loja/EscolhaPet'
import { er, SEMANA } from '../../src/loja/estilosReserva'
import { diaIso, proximosDias } from '../../src/loja/reservas'
import { detalheServico, noitesEntre, porteDoPet, precoHotel, reservarHotel, TEXTO_PORTE, type DetalheServico } from '../../src/loja/servicos'
import { usePets } from '../../src/pets/PetsProvider'
import { colors } from '../../src/theme/colors'

/** Reservar hotelzinho (protótipo AgendarHotel): entrada, saída, porte e extras. */
export default function ReservarHotel() {
  const { servico: id } = useLocalSearchParams<{ servico: string }>()
  const { pets, petAtivo } = usePets()
  const [detalhe, setDetalhe] = useState<DetalheServico | null>(null)
  const [petId, setPetId] = useState(petAtivo?.id ?? pets[0]?.id ?? null)
  const [entrada, setEntrada] = useState<Date | null>(null)
  const [saida, setSaida] = useState<Date | null>(null)
  const [extras, setExtras] = useState<string[]>([])
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (id) detalheServico(id).then(setDetalhe, (e: Error) => setErro(e.message))
  }, [id])

  if (!detalhe || !detalhe.disponivel) {
    return <View style={[er.tela, er.centro]}>{detalhe || erro ? <Text style={er.sub}>{erro ?? 'Serviço indisponível.'}</Text> : <ActivityIndicator color={colors.primaryDeep} />}</View>
  }
  const { servico, loja, tarifas, vagas } = detalhe
  const pet = pets.find((p) => p.id === petId) ?? null
  const porte = porteDoPet(pet?.peso_atual ?? null)
  const noite = tarifas[porte]
  const dias = proximosDias(61).slice(1)
  const noites = entrada && saida ? noitesEntre(entrada, saida) : 0
  const total = precoHotel(noite, noites, detalhe.extras, extras)
  const livre = (d: Date) => (vagas?.[diaIso(d)] ?? 0) > 0

  // Primeiro toque marca a entrada, o segundo a saída; noites sem vaga no meio invalidam.
  function tocarDia(d: Date) {
    if (!entrada || saida || d.getTime() <= entrada.getTime()) {
      setEntrada(livre(d) ? d : null)
      setSaida(null)
      return
    }
    const noitesNoMeio = dias.filter((x) => x.getTime() >= entrada.getTime() && x.getTime() < d.getTime())
    if (noitesNoMeio.every(livre)) setSaida(d)
    else setErro('Há noites sem vaga nesse período. Escolha outras datas.')
  }

  async function enviar() {
    if (!petId || !entrada || !saida) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await reservarHotel(servico.id, entrada, saida, petId, extras, mensagem)
      router.replace(`/pedidos/${r.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  const dentro = (d: Date) => entrada && saida && d.getTime() > entrada.getTime() && d.getTime() < saida.getTime()
  return (
    <KeyboardAvoidingView style={er.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo={loja.name} titulo="Reservar hotelzinho" altura={176} />
      <ScrollView contentContainerStyle={er.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {pets.length > 1 ? (<><Text style={er.secao}>Pet</Text><EscolhaPet pets={pets} selecionado={petId} onEscolher={setPetId} /></>) : null}
        <Text style={er.sub}>{pet ? `${pet.nome} · ${TEXTO_PORTE[porte]}${pet.peso_atual ? ` (${pet.peso_atual} kg)` : ''}` : ''} · {noite ? `${reais(noite)} por noite` : 'o hotel não recebe este porte'}</Text>
        {servico.requires_vaccines ? <View style={er.aviso}><Text style={er.avisoTexto}>Este hotel pede as vacinas em dia na carteirinha do pet.</Text></View> : null}

        <Text style={er.secao}>Entrada e saída</Text>
        <View style={er.chips}>
          {dias.map((d) => {
            const marcado = (entrada && d.getTime() === entrada.getTime()) || (saida && d.getTime() === saida.getTime())
            return (
              <Tocavel key={d.toISOString()} accessibilityRole="button" accessibilityLabel={d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} onPress={() => { setErro(null); tocarDia(d) }} style={[er.dia, marcado && er.ativo, dentro(d) && { backgroundColor: colors.primarySurface }, !livre(d) && !marcado && er.diaSemVaga]}>
                <Text style={[er.diaSemana, marcado && er.claro]}>{SEMANA[d.getDay()]}</Text>
                <Text style={[er.diaNumero, marcado && er.claro]}>{d.getDate()}</Text>
              </Tocavel>
            )
          })}
        </View>
        <Text style={er.sub}>{entrada && saida ? `${entrada.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' })} → ${saida.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' })} · ${noites} ${noites === 1 ? 'noite' : 'noites'}` : entrada ? 'Agora toque no dia da saída.' : 'Toque no dia da entrada.'}</Text>

        {detalhe.extras.length ? (
          <>
            <Text style={er.secao}>Extras</Text>
            {detalhe.extras.map((e) => (
              <View key={e.id} style={er.extra}>
                <View style={er.flex}>
                  <Text style={er.opcaoTitulo}>{e.nome}</Text>
                  <Text style={er.sub}>+ {reais(e.price_cents)}{e.por_dia ? ' por dia' : ''}</Text>
                </View>
                <Interruptor ligado={extras.includes(e.id)} rotulo={e.nome} onToggle={() => setExtras((l) => (l.includes(e.id) ? l.filter((x) => x !== e.id) : [...l, e.id]))} />
              </View>
            ))}
          </>
        ) : null}
        <View style={er.campo}>
          <TextInput value={mensagem} onChangeText={setMensagem} placeholder="Rotina, alimentação e cuidados (opcional)" placeholderTextColor={colors.textMuted} multiline maxLength={500} style={er.texto} />
        </View>
        {erro ? <Text style={er.erro} accessibilityRole="alert">{erro}</Text> : null}
      </ScrollView>
      <View style={er.rodape}>
        {total !== null ? <Text style={er.resumo}>{noites} {noites === 1 ? 'noite' : 'noites'} · {reais(total)}</Text> : null}
        <BotaoPrimario titulo="Solicitar reserva" carregando={enviando} desabilitado={!entrada || !saida || total === null || !petId} onPress={enviar} />
      </View>
    </KeyboardAvoidingView>
  )
}
