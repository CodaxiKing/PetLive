import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../src/components/Animacoes'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { reais } from '../../src/despesas/despesas'
import { carregarEnderecos, type Endereco } from '../../src/loja/enderecos'
import { EscolhaPet } from '../../src/loja/EscolhaPet'
import { er, SEMANA } from '../../src/loja/estilosReserva'
import { diaIso, hhmm, proximosDias } from '../../src/loja/reservas'
import { detalheServico, horariosPasseio, reservarPasseio, type DetalheServico } from '../../src/loja/servicos'
import { usePets } from '../../src/pets/PetsProvider'
import { colors } from '../../src/theme/colors'

/** Agendar passeio (protótipo AgendarPasseio): duração, dia, horário de saída e endereço de busca. */
export default function AgendarPasseio() {
  const { servico: id } = useLocalSearchParams<{ servico: string }>()
  const { pets, petAtivo } = usePets()
  const [detalhe, setDetalhe] = useState<DetalheServico | null>(null)
  const [petId, setPetId] = useState(petAtivo?.id ?? pets[0]?.id ?? null)
  const [duracao, setDuracao] = useState<30 | 60>(30)
  const dias = proximosDias(14)
  const [dia, setDia] = useState(dias[0])
  const chave = `${diaIso(dia)}|${duracao}`
  const [grade, setGrade] = useState<{ chave: string; lista: { inicio: string }[] } | null>(null)
  const [escolha, setEscolha] = useState<{ chave: string; inicio: string } | null>(null)
  const [enderecos, setEnderecos] = useState<Endereco[]>([])
  const [enderecoId, setEnderecoId] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (id) detalheServico(id).then(setDetalhe, (e: Error) => setErro(e.message))
    carregarEnderecos().then((l) => {
      setEnderecos(l)
      setEnderecoId(l[0]?.id ?? null)
    }, () => undefined)
  }, [id])

  useEffect(() => {
    if (!id) return
    let vivo = true
    const consulta = chave
    horariosPasseio(id, dia, duracao).then((lista) => vivo && setGrade({ chave: consulta, lista }), () => vivo && setGrade({ chave: consulta, lista: [] }))
    return () => {
      vivo = false
    }
  }, [id, dia, duracao, chave])

  if (!detalhe || !detalhe.disponivel || !detalhe.passeio) {
    return <View style={[er.tela, er.centro]}>{detalhe || erro ? <Text style={er.sub}>{erro ?? 'Passeio indisponível.'}</Text> : <ActivityIndicator color={colors.primaryDeep} />}</View>
  }
  const { loja, passeio, servico } = detalhe
  const horarios = grade?.chave === chave ? grade.lista : null
  const inicio = escolha?.chave === chave ? escolha.inicio : null
  const preco = duracao === 30 ? passeio.price_30_cents : passeio.price_60_cents

  async function enviar() {
    if (!inicio || !petId || !enderecoId) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await reservarPasseio(servico.id, inicio, duracao, petId, enderecoId, mensagem)
      router.replace(`/pedidos/${r.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <KeyboardAvoidingView style={er.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo={loja.name} titulo="Agendar passeio" altura={176} />
      <ScrollView contentContainerStyle={er.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {pets.length > 1 ? (<><Text style={er.secao}>Pet</Text><EscolhaPet pets={pets} selecionado={petId} onEscolher={setPetId} /></>) : null}
        <Text style={er.secao}>Duração</Text>
        <View style={[er.chips, { flexWrap: 'nowrap' }]}>
          {([30, 60] as const).map((d) => (
            <Tocavel key={d} accessibilityRole="radio" accessibilityState={{ selected: duracao === d }} onPress={() => setDuracao(d)} style={[er.opcao, duracao === d && er.ativo]}>
              <Text style={[er.opcaoTitulo, duracao === d && er.claro]}>{d} min</Text>
              <Text style={[er.sub, duracao === d && er.claro]}>{reais(d === 30 ? passeio.price_30_cents : passeio.price_60_cents)}</Text>
            </Tocavel>
          ))}
        </View>
        <Text style={er.secao}>Dia</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={er.linha}>
          {dias.map((d) => {
            const atende = passeio.weekdays.includes(d.getDay())
            const ativo = d.getTime() === dia.getTime()
            return (
              <Tocavel key={d.toISOString()} accessibilityRole="radio" accessibilityState={{ selected: ativo, disabled: !atende }} disabled={!atende} onPress={() => setDia(d)} style={[er.dia, ativo && er.ativo, !atende && er.diaSemVaga]}>
                <Text style={[er.diaSemana, ativo && er.claro]}>{SEMANA[d.getDay()]}</Text>
                <Text style={[er.diaNumero, ativo && er.claro]}>{d.getDate()}</Text>
              </Tocavel>
            )
          })}
        </ScrollView>
        <Text style={er.secao}>Horário de saída</Text>
        {horarios === null ? <ActivityIndicator color={colors.primaryDeep} /> : horarios.length === 0 ? <Text style={er.sub}>Sem horários neste dia.</Text> : (
          <View style={er.chips}>
            {horarios.map((h) => {
              const ativo = inicio === h.inicio
              return (
                <Tocavel key={h.inicio} accessibilityRole="radio" accessibilityState={{ selected: ativo }} onPress={() => setEscolha({ chave, inicio: h.inicio })} style={[er.horario, ativo && er.ativo]}>
                  <Text style={[er.horarioTexto, ativo && er.claro]}>{hhmm(h.inicio)}</Text>
                </Tocavel>
              )
            })}
          </View>
        )}
        <Text style={er.secao}>Busca na sua casa</Text>
        {enderecos.length === 0 ? (
          <Text style={er.sub}>Cadastre um endereço numa solicitação de entrega (Loja › Entrega › Novo endereço) para o passeador buscar o pet.</Text>
        ) : (
          <View style={er.chips}>
            {enderecos.map((e) => (
              <Tocavel key={e.id} accessibilityRole="radio" accessibilityState={{ selected: enderecoId === e.id }} onPress={() => setEnderecoId(e.id)} style={[er.chip, enderecoId === e.id && er.ativo]}>
                <Text style={[er.chipTexto, enderecoId === e.id && er.claro]}>{[e.street, e.number].filter(Boolean).join(', ')}</Text>
              </Tocavel>
            ))}
          </View>
        )}
        <Text style={er.sub}>Atende até {String(passeio.radius_km).replace('.', ',')} km da loja.</Text>
        <View style={er.campo}>
          <TextInput value={mensagem} onChangeText={setMensagem} placeholder="Recado para o passeador (opcional)" placeholderTextColor={colors.textMuted} multiline maxLength={500} style={er.texto} />
        </View>
        {erro ? <Text style={er.erro} accessibilityRole="alert">{erro}</Text> : null}
      </ScrollView>
      <View style={er.rodape}>
        {inicio ? <Text style={er.resumo}>{dia.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' })} · {hhmm(inicio)} · {duracao} min · {reais(preco)}</Text> : null}
        <BotaoPrimario titulo="Reservar passeio" carregando={enviando} desabilitado={!inicio || !petId || !enderecoId} onPress={enviar} />
      </View>
    </KeyboardAvoidingView>
  )
}
