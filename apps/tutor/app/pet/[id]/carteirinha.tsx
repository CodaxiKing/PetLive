import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft'
import { useAuth } from '../../../src/auth/AuthProvider'
import { Surgir, Tocavel } from '../../../src/components/Animacoes'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { BotaoRedondo } from '../../../src/components/Layout'
import { Icone, type NomeIcone } from '../../../src/components/Icone'
import { supabase } from '../../../src/lib/supabase'
import { voltarOuInicio } from '../../../src/lib/voltar'
import { usePlano } from '../../../src/lib/plano'
import { abrirPdf, compartilharPdf } from '../../../src/lib/pdf'
import { AvatarPet } from '../../../src/pets/AvatarPet'
import { camposPdf, camposPdfIniciais, htmlCarteirinha } from '../../../src/pets/carteirinhaPdf'
import {
  proximaVacina,
  remediosEmUso,
  textoProximaVacina,
} from '../../../src/pets/carteirinha'
import { usePets } from '../../../src/pets/PetsProvider'
import { idadeEmAnos } from '../../../src/pets/types'
import { progressoDias } from '../../../src/remedios/doses'
import type { Remedio } from '../../../src/remedios/types'
import { diasAte, type Vacina } from '../../../src/saude/types'
import { colors } from '../../../src/theme/colors'
import { shadow } from '../../../src/theme/tokens'
import { fontFamily } from '../../../src/theme/typography'

/** "12/09/25", como na tabela do protótipo. */
function dataCurta(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a.slice(2)}`
}

/**
 * Carteirinha de saúde (protótipo Carteirinha): o pet, vacinas, remédios em
 * uso e cuidados, num lugar só para mostrar ou enviar. Só aparecem os dados
 * que o tutor registrou; o envio usa o menu de compartilhar do sistema.
 */
export default function TelaCarteirinha() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets } = usePets()
  const { user } = useAuth()
  const plano = usePlano()
  const pet = pets.find((p) => p.id === id) ?? null

  const [vacinas, setVacinas] = useState<Vacina[]>([])
  const [remedios, setRemedios] = useState<Remedio[]>([])
  const [carregando, setCarregando] = useState(true)
  const [perfilTutor, setPerfilTutor] = useState<{ id: string; nome: string | null } | null>(null)
  const tutor = perfilTutor?.id === user?.id ? perfilTutor?.nome ?? null : null
  const [campos, setCampos] = useState({ ...camposPdfIniciais })
  const [opcoesPdf, setOpcoesPdf] = useState(false)
  const [erroDados, setErroDados] = useState(false)
  const [gerando, setGerando] = useState(false)
  const ocupado = useRef(false)

  const gerarPdf = async (enviar = false) => {
    if (!pet || carregando || erroDados || ocupado.current) return
    if (plano !== 'premium') {
      Alert.alert('Carteirinha em PDF', 'Salvar a carteirinha em PDF faz parte do Premium. A carteirinha continua disponível para compartilhar por link.')
      return
    }
    ocupado.current = true
    setGerando(true)
    try {
      const html = htmlCarteirinha(pet, tutor, vacinas, remedios, campos)
      const resultado = await (enviar ? compartilharPdf(html) : abrirPdf(html))
      if (resultado === 'sem-modulo') Alert.alert('Atualize o app', 'O PDF precisa da versão mais nova do PetLive na loja de apps.')
      if (resultado === 'indisponivel') Alert.alert('Envio indisponível', 'Use a prévia para imprimir ou salvar o PDF neste aparelho.')
    } catch {
      Alert.alert('Não deu para gerar o PDF', 'Tente de novo em instantes.')
    } finally {
      ocupado.current = false
      setGerando(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (!id) return
      let vivo = true
      setCarregando(true)
      setErroDados(false)
      setOpcoesPdf(false)
      Promise.all([
        supabase.from('vaccinations').select('*').eq('pet_id', id).order('aplicada_em', { ascending: false }),
        remediosEmUso(id),
      ]).then(([resVacinas, emUso]) => {
        if (!vivo) return
        if (resVacinas.error) throw resVacinas.error
        setVacinas((resVacinas.data ?? []) as Vacina[])
        setRemedios(emUso)
        setCarregando(false)
      }).catch(() => {
        if (!vivo) return
        setErroDados(true)
        setCarregando(false)
      })
      return () => {
        vivo = false
      }
    }, [id, setOpcoesPdf]),
  )

  useEffect(() => {
    if (!user) return
    let vivo = true
    supabase
      .from('profiles')
      .select('nome')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (vivo) setPerfilTutor({ id: user.id, nome: data?.nome?.trim() || null }) })
    return () => { vivo = false }
  }, [user])

  if (!pet) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <ActivityIndicator color={colors.primaryDeep} />
      </View>
    )
  }

  const proxima = proximaVacina(vacinas)
  const especie = pet.especie === 'gato' ? 'Gato' : 'Cão'
  const dados = [
    { rotulo: 'Idade', valor: idadeEmAnos(pet.nascimento) ?? '—', fundo: '#FFF0C9', cor: '#8A6414' },
    { rotulo: 'Sexo', valor: pet.sexo ? (pet.sexo === 'femea' ? 'Fêmea' : 'Macho') : '—', fundo: colors.premiumSurface, cor: colors.premiumText },
    {
      rotulo: 'Peso',
      valor: pet.peso_atual ? `${String(pet.peso_atual).replace('.', ',')} kg` : '—',
      fundo: colors.successSurface,
      cor: '#1F6B45',
    },
  ]

  return (
    <View style={estilos.tela}>
      <View style={estilos.topo}>
        <BotaoRedondo acessibilidade="Voltar" onPress={voltarOuInicio}>
          <ArrowLeft size={22} color={colors.black} />
        </BotaoRedondo>
        <Text style={estilos.titulo} accessibilityRole="header">Carteirinha</Text>
        <Tocavel
          accessibilityRole="button"
          accessibilityLabel={`Compartilhar a carteirinha de ${pet.nome}`}
          onPress={() => router.push(`/pet/${pet.id}/compartilhar`)}
          style={estilos.compartilharTopoBotao}
        >
          <Icone nome="compartilhar" size={20} cor={colors.white} />
        </Tocavel>
      </View>

      <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <Surgir indice={0} style={estilos.identidade}>
          <View style={estilos.identidadeTopo}>
            <View style={estilos.avatar}>
              {pet.foto_url ? (
                <Image source={{ uri: pet.foto_url }} style={estilos.avatarFoto} accessibilityLabel={`Foto de ${pet.nome}`} />
              ) : (
                <AvatarPet especie={pet.especie} foto={null} size={72} />
              )}
            </View>
            <View style={estilos.flex}>
              <Text style={estilos.nome} numberOfLines={1}>
                {pet.nome}
              </Text>
              <Text style={estilos.raca}>{[especie, pet.raca].filter(Boolean).join(' · ')}</Text>
              {tutor ? <Text style={estilos.tutor}>Tutor: {tutor}</Text> : null}
            </View>
          </View>
          <View style={estilos.dados}>
            {dados.map((d) => (
              <View key={d.rotulo} style={estilos.dado}>
                <Text style={estilos.dadoRotulo}>{d.rotulo}</Text>
                <Text style={estilos.dadoValor} numberOfLines={1}>
                  {d.valor}
                </Text>
              </View>
            ))}
          </View>
        </Surgir>

        {carregando ? (
          <ActivityIndicator color={colors.primaryDeep} style={estilos.carregando} />
        ) : (
          <>
            <Bloco icone="vacina" titulo="Vacinas" fundo={colors.healthSurface} cor={colors.healthText} indice={1}>
              {vacinas.length === 0 ? (
                <Text style={estilos.vazio}>Nenhuma vacina registrada.</Text>
              ) : (
                <>
                  {vacinas.map((v, i) => {
                    const dias = diasAte(v.proxima_dose)
                    const vencida = dias !== null && dias < 0
                    const perto = dias !== null && dias >= 0 && dias <= 30
                    const selo = dias === null ? null : vencida ? 'Vencida' : perto ? (dias === 0 ? 'Hoje' : `${dias} ${dias === 1 ? 'dia' : 'dias'}`) : 'Em dia'
                    return (
                      <View key={v.id} style={[estilos.linhaVacina, i > 0 && estilos.linhaDivisoria]}>
                        <View style={[estilos.vacinaIcone, { backgroundColor: colors.healthSurface }]}>
                          <Icone nome="vacina" size={18} cor={colors.healthText} />
                        </View>
                        <View style={estilos.flex}>
                          <Text style={estilos.vacinaNome} numberOfLines={1}>{v.nome}</Text>
                          <Text style={estilos.vacinaSub}>
                            {v.proxima_dose ? `Próxima ${dataCurta(v.proxima_dose)}` : `Aplicada ${dataCurta(v.aplicada_em)}`}
                          </Text>
                        </View>
                        {selo ? (
                          <Text style={[estilos.selo, vencida ? estilos.seloVencida : perto ? estilos.seloPerto : estilos.seloEmDia]}>{selo}</Text>
                        ) : null}
                      </View>
                    )
                  })}
                  {proxima && proxima.dias <= 7 ? (
                    <Text style={estilos.aviso}>
                      {proxima.dias < 0 ? textoProximaVacina(proxima) : `${proxima.vacina.nome} vence ${proxima.dias === 0 ? 'hoje' : `em ${proxima.dias} ${proxima.dias === 1 ? 'dia' : 'dias'}`}`}
                    </Text>
                  ) : null}
                </>
              )}
            </Bloco>

            <Bloco icone="capsula" titulo="Remédios em uso" fundo={colors.healthSurface} cor={colors.healthText} indice={2}>
              {remedios.length === 0 ? (
                <Text style={estilos.vazio}>Nenhum remédio em uso agora.</Text>
              ) : (
                remedios.map((r) => {
                  const { dia, total } = progressoDias(r)
                  return (
                    <View key={r.id} style={estilos.remedio}>
                      <View style={estilos.flex}>
                        <Text style={estilos.remedioNome} numberOfLines={1}>
                          {r.nome}
                        </Text>
                        <Text style={estilos.remedioSub} numberOfLines={1}>
                          {[r.dose, r.frequencia].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <Text style={estilos.remedioDia}>{total ? `Dia ${dia} de ${total}` : `Dia ${dia}`}</Text>
                    </View>
                  )
                })
              )}
            </Bloco>

            <Bloco icone="coracao" titulo="Saúde e cuidados" fundo={colors.premiumSurface} cor={colors.premiumText} indice={3}>
              <View style={estilos.cuidados}>
                <View style={estilos.cuidado}>
                  <Text style={estilos.cuidadoRotulo}>Castrado</Text>
                  <Text style={estilos.cuidadoValor}>
                    {pet.castrado === null ? 'Não informado' : pet.castrado ? 'Sim' : 'Não'}
                  </Text>
                </View>
                <View style={estilos.cuidado}>
                  <Text style={estilos.cuidadoRotulo}>Raça</Text>
                  <Text style={estilos.cuidadoValor} numberOfLines={1}>
                    {pet.raca ?? 'Não informada'}
                  </Text>
                </View>
              </View>
            </Bloco>

            {pet.alergias ? (
              <Bloco icone="alerta" titulo="Alergias e condições" fundo={colors.healthSurface} cor={colors.healthText} indice={4}>
                <View style={estilos.alergias}>
                  {pet.alergias.split(/[,;\n]/).map((a) => a.trim()).filter(Boolean).map((a) => (
                    <Text key={a} style={[estilos.selo, estilos.seloVencida]}>{a}</Text>
                  ))}
                </View>
              </Bloco>
            ) : null}
            {pet.veterinario ? (
              <Bloco icone="telefone" titulo="Veterinário" fundo={colors.primarySurface} cor={colors.primaryDeep} indice={5}>
                <Text style={estilos.textoLivre}>{pet.veterinario}</Text>
              </Bloco>
            ) : null}
            {pet.observacoes ? (
              <Bloco icone="livro" titulo="Observações" fundo={colors.premiumSurface} cor={colors.premiumText} indice={6}>
                <Text style={estilos.textoLivre}>{pet.observacoes}</Text>
              </Bloco>
            ) : null}
          </>
        )}

        <Text style={estilos.nota}>Dados informados pelo tutor. Ao compartilhar, você escolhe o que vai no link e por quanto tempo ele vale.</Text>
        <Tocavel accessibilityRole="button" onPress={() => router.push({ pathname: '/pet/[id]/qr', params: { id: pet.id } })} style={estilos.botaoPdf}>
          <Text style={estilos.textoPdf}>QR da coleira</Text>
        </Tocavel>
        {erroDados ? <Text accessibilityRole="alert" style={estilos.aviso}>Não foi possível carregar todos os dados. Volte e abra a carteirinha novamente antes de gerar o PDF.</Text> : null}
        <Tocavel accessibilityRole="button" onPress={() => setOpcoesPdf(!opcoesPdf)} style={estilos.botaoPdf}>
          <Text style={estilos.textoPdf}>Salvar carteirinha em PDF{plano === 'premium' ? '' : ' · Premium'}</Text>
        </Tocavel>
        {opcoesPdf ? <View style={estilos.bloco}>
          <Text style={estilos.blocoTitulo}>O que incluir no PDF</Text>
          <Text style={estilos.nota}>Nome e dados básicos do pet sempre aparecem. Escolha os demais campos e confira a prévia antes de enviar.</Text>
          {(Object.keys(camposPdf) as (keyof typeof camposPdf)[]).map((campo) => <View key={campo} style={estilos.remedio}>
            <Text style={[estilos.textoLivre, estilos.flex]}>{camposPdf[campo]}</Text>
            <Switch accessibilityLabel={camposPdf[campo]} value={campos[campo]} disabled={gerando} onValueChange={(valor) => setCampos((atual) => ({ ...atual, [campo]: valor }))} />
          </View>)}
          <BotaoPrimario titulo={gerando ? 'Preparando PDF…' : 'Prévia / imprimir'} desabilitado={gerando || carregando || erroDados} onPress={() => { void gerarPdf() }} />
          <BotaoPrimario titulo="Gerar e enviar PDF" desabilitado={gerando || carregando || erroDados} onPress={() => { void gerarPdf(true) }} />
          <Text style={estilos.nota}>O arquivo enviado não expira. Quem receber poderá guardar uma cópia.</Text>
        </View> : null}
        <Tocavel accessibilityRole="button" onPress={() => router.push({ pathname: '/pet/[id]/cartao', params: { id: pet.id } })} style={estilos.botaoPdf}>
          <Text style={estilos.textoPdf}>Gerar imagem do cartão do pet</Text>
        </Tocavel>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Compartilhar carteirinha"
          icone={<Icone nome="compartilhar" size={22} espessura={2} />}
          onPress={() => router.push(`/pet/${pet.id}/compartilhar`)}
        />
      </View>
    </View>
  )
}

function Bloco({
  icone,
  titulo,
  fundo,
  cor,
  indice,
  children,
}: {
  icone: NomeIcone
  titulo: string
  /** Fundo do ícone, na cor de significado (rosa saúde, lilás rotina, azul lugares). */
  fundo: string
  cor?: string
  indice: number
  children: ReactNode
}) {
  return (
    <Surgir indice={indice} style={estilos.bloco}>
      <View style={estilos.blocoTopo}>
        <View style={[estilos.blocoIcone, { backgroundColor: fundo }]}>
          <Icone nome={icone} size={18} cor={cor} />
        </View>
        <Text style={estilos.blocoTitulo}>{titulo}</Text>
      </View>
      {children}
    </Surgir>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  titulo: { flex: 1, fontFamily: fontFamily.bold, fontSize: 28, letterSpacing: -0.9, color: colors.black },
  compartilharTopoBotao: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conteudo: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  carregando: { marginTop: 24 },
  identidade: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', ...shadow.card },
  identidadeTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  avatar: { width: 72, height: 72, borderRadius: 22, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  avatarFoto: { width: 72, height: 72, borderRadius: 22 },
  nome: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.6, color: colors.black },
  raca: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted, marginTop: 1 },
  tutor: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.textMuted, marginTop: 1 },
  dados: { flexDirection: 'row', gap: 8, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 14 },
  dado: { flex: 1, minWidth: 0, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.background },
  dadoRotulo: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.textMuted },
  dadoValor: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.black, marginTop: 1 },
  bloco: { borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, gap: 8, backgroundColor: colors.surface, ...shadow.card },
  blocoTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  blocoIcone: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blocoTitulo: { flex: 1, fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  vazio: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted },
  linhaVacina: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  linhaDivisoria: { borderTopWidth: 1, borderTopColor: colors.border },
  vacinaIcone: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  vacinaNome: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  vacinaSub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted },
  selo: { fontFamily: fontFamily.bold, fontSize: 12, borderRadius: 999, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  seloEmDia: { color: colors.successText, backgroundColor: colors.successSurface },
  seloPerto: { color: colors.warningText, backgroundColor: colors.warningSurface },
  seloVencida: { color: colors.healthText, backgroundColor: colors.healthSurface },
  alergias: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  aviso: {
    backgroundColor: '#FFE3E3',
    color: '#9B2C2C',
    fontFamily: fontFamily.bold,
    fontSize: 12,
    borderRadius: 14,
    overflow: 'hidden',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  remedio: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  remedioNome: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  remedioSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  remedioDia: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: colors.black,
    backgroundColor: colors.background,
    borderRadius: 999,
    overflow: 'hidden',
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  cuidados: { flexDirection: 'row', gap: 8 },
  cuidado: { flex: 1, minWidth: 0, backgroundColor: colors.background, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
  cuidadoRotulo: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.textMuted },
  cuidadoValor: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  textoLivre: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.black },
  nota: { fontFamily: fontFamily.regular, fontSize: 11, lineHeight: 16, color: '#566070', textAlign: 'center' },
  botaoPdf: { minHeight: 50, borderRadius: 25, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 4, ...shadow.card },
  textoPdf: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  rodape: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
})
