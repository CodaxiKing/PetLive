import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../src/components/Animacoes'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { reais } from '../../src/despesas/despesas'
import { EscolhaPet } from '../../src/loja/EscolhaPet'
import { er, SEMANA } from '../../src/loja/estilosReserva'
import { diaIso, proximosDias } from '../../src/loja/reservas'
import { detalheServico, precoCreche, reservarCreche, type DetalheServico } from '../../src/loja/servicos'
import { usePets } from '../../src/pets/PetsProvider'
import { colors } from '../../src/theme/colors'

/** Reservar creche (protótipo AgendarCreche): período, dias e pacote. */
export default function ReservarCreche() {
  const { servico: id } = useLocalSearchParams<{ servico: string }>()
  const { pets, petAtivo } = usePets()
  const [detalhe, setDetalhe] = useState<DetalheServico | null>(null)
  const [petId, setPetId] = useState(petAtivo?.id ?? pets[0]?.id ?? null)
  const [periodo, setPeriodo] = useState<'dia' | 'meio'>('dia')
  const [dias, setDias] = useState<Date[]>([])
  const [pacote, setPacote] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (id) detalheServico(id).then(setDetalhe, (e: Error) => setErro(e.message))
  }, [id])

  if (!detalhe || !detalhe.disponivel) {
    return <View style={[er.tela, er.centro]}>{detalhe || erro ? <Text style={er.sub}>{erro ?? 'Serviço indisponível.'}</Text> : <ActivityIndicator color={colors.primaryDeep} />}</View>
  }
  const { servico, loja, planos, vagas } = detalhe
  const proximos = proximosDias(21).slice(1)
  const avulso = (p: 'dia' | 'meio') => planos.find((x) => x.period === p && x.package_days === null)
  const pacotes = planos.filter((p) => p.period === periodo && p.package_days !== null)
  const total = precoCreche(planos, periodo, dias.length, pacote)
  const alternarDia = (d: Date) => setDias((l) => (l.some((x) => x.getTime() === d.getTime()) ? l.filter((x) => x.getTime() !== d.getTime()) : [...l, d].sort((a, b) => a.getTime() - b.getTime())))

  async function enviar() {
    if (!petId || !dias.length || !servico) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await reservarCreche(servico.id, dias, periodo, pacote, petId, mensagem)
      router.replace(`/pedidos/${r.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      detalheServico(servico.id).then(setDetalhe, () => undefined)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <KeyboardAvoidingView style={er.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo={loja.name} titulo="Reservar creche" altura={176} />
      <ScrollView contentContainerStyle={er.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {pets.length > 1 ? (<><Text style={er.secao}>Pet</Text><EscolhaPet pets={pets} selecionado={petId} onEscolher={setPetId} /></>) : null}
        <Text style={er.secao}>Período</Text>
        <View style={[er.chips, { flexWrap: 'nowrap' }]}>
          {(['dia', 'meio'] as const).filter((p) => avulso(p)).map((p) => (
            <Tocavel key={p} accessibilityRole="radio" accessibilityState={{ selected: periodo === p }} onPress={() => { setPeriodo(p); setPacote(false) }} style={[er.opcao, periodo === p && er.ativo]}>
              <Text style={[er.opcaoTitulo, periodo === p && er.claro]}>{p === 'dia' ? 'Dia inteiro' : 'Meio período'}</Text>
              <Text style={[er.sub, periodo === p && er.claro]}>{reais(avulso(p)!.price_cents)} por dia</Text>
            </Tocavel>
          ))}
        </View>
        <Text style={er.secao}>Quais dias?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={er.linha}>
          {proximos.map((d) => {
            const livres = vagas?.[diaIso(d)] ?? 0
            const ativo = dias.some((x) => x.getTime() === d.getTime())
            return (
              <Tocavel key={d.toISOString()} accessibilityRole="checkbox" accessibilityState={{ checked: ativo, disabled: !livres }} accessibilityLabel={`${d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' })}${livres ? '' : ', sem vagas'}`} disabled={!livres && !ativo} onPress={() => alternarDia(d)} style={[er.dia, ativo && er.ativo, !livres && er.diaSemVaga]}>
                <Text style={[er.diaSemana, ativo && er.claro]}>{SEMANA[d.getDay()]}</Text>
                <Text style={[er.diaNumero, ativo && er.claro]}>{d.getDate()}</Text>
              </Tocavel>
            )
          })}
        </ScrollView>
        <Text style={er.sub}>Toque para escolher mais de um dia. Dias apagados estão sem vagas.</Text>
        {servico.entrada_ate || servico.retirada_desde ? <Text style={er.sub}>{[servico.entrada_ate ? `Entrada até ${servico.entrada_ate}` : null, servico.retirada_desde ? `retirada a partir de ${servico.retirada_desde}` : null].filter(Boolean).join(' · ')}</Text> : null}
        {pacotes.length ? (
          <>
            <Text style={er.secao}>Pacote</Text>
            <View style={er.chips}>
              <Tocavel accessibilityRole="radio" accessibilityState={{ selected: !pacote }} onPress={() => setPacote(false)} style={[er.chip, !pacote && er.ativo]}>
                <Text style={[er.chipTexto, !pacote && er.claro]}>Avulso</Text>
              </Tocavel>
              {pacotes.map((p) => {
                const cabe = dias.length === p.package_days
                const ativo = pacote && cabe
                return (
                  <Tocavel key={p.id} accessibilityRole="radio" accessibilityState={{ selected: ativo }} onPress={() => setPacote(true)} style={[er.chip, ativo && er.ativo]}>
                    <Text style={[er.chipTexto, ativo && er.claro]}>{p.package_days} diárias · {reais(p.package_cents ?? 0)}</Text>
                  </Tocavel>
                )
              })}
            </View>
            {pacote && total === null ? <Text style={er.sub}>Escolha o mesmo número de dias do pacote.</Text> : null}
          </>
        ) : null}
        <View style={er.campo}>
          <TextInput value={mensagem} onChangeText={setMensagem} placeholder="Recado para a creche (opcional)" placeholderTextColor={colors.textMuted} multiline maxLength={500} style={er.texto} />
        </View>
        {erro ? <Text style={er.erro} accessibilityRole="alert">{erro}</Text> : null}
      </ScrollView>
      <View style={er.rodape}>
        {dias.length ? <Text style={er.resumo}>{dias.length} {dias.length === 1 ? 'diária' : 'diárias'}{total !== null ? ` · ${reais(total)}` : ''}</Text> : null}
        <BotaoPrimario titulo="Reservar creche" carregando={enviando} desabilitado={!dias.length || !petId || total === null} onPress={enviar} />
      </View>
    </KeyboardAvoidingView>
  )
}
