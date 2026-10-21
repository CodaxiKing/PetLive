import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../../src/auth/AuthProvider'
import { Surgir, Tocavel } from '../../../src/components/Animacoes'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { Gradiente } from '../../../src/components/Gradiente'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { Icone, type NomeIcone } from '../../../src/components/Icone'
import { supabase } from '../../../src/lib/supabase'
import { AvatarPet } from '../../../src/pets/AvatarPet'
import {
  compartilharCarteirinha,
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
  const pet = pets.find((p) => p.id === id) ?? null

  const [vacinas, setVacinas] = useState<Vacina[]>([])
  const [remedios, setRemedios] = useState<Remedio[]>([])
  const [carregando, setCarregando] = useState(true)
  const [tutor, setTutor] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!id) return
      let vivo = true
      Promise.all([
        supabase.from('vaccinations').select('*').eq('pet_id', id).order('aplicada_em', { ascending: false }),
        remediosEmUso(id).catch(() => [] as Remedio[]),
      ]).then(([resVacinas, emUso]) => {
        if (!vivo) return
        setVacinas((resVacinas.data ?? []) as Vacina[])
        setRemedios(emUso)
        setCarregando(false)
      })
      return () => {
        vivo = false
      }
    }, [id]),
  )

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('nome')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setTutor(data?.nome?.trim() || null))
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
    { rotulo: 'Idade', valor: idadeEmAnos(pet.nascimento) ?? '—', fundo: '#FFF0C9', cor: '#7A5A00' },
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
      <HeroiOnda titulo="Carteirinha" altura={176}>
        <Tocavel
          accessibilityRole="button"
          accessibilityLabel={`Compartilhar a carteirinha de ${pet.nome}`}
          onPress={() => compartilharCarteirinha(pet, vacinas)}
          estiloExterno={estilos.compartilharTopo}
          style={estilos.compartilharTopoBotao}
        >
          <Icone nome="compartilhar" size={20} cor={colors.white} />
        </Tocavel>
      </HeroiOnda>

      <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <Surgir indice={0} style={estilos.identidade}>
          <View style={estilos.identidadeTopo}>
            <Gradiente de={colors.hero} ate={colors.premiumSurface} />
            <View style={estilos.avatar}>
              <AvatarPet especie={pet.especie} foto={pet.foto_url} size={76} />
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
              <View key={d.rotulo} style={[estilos.dado, { backgroundColor: d.fundo }]}>
                <Text style={[estilos.dadoRotulo, { color: d.cor }]}>{d.rotulo}</Text>
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
            <Bloco icone="vacina" titulo="Vacinas" fundo={colors.primarySurface} indice={1}>
              {vacinas.length === 0 ? (
                <Text style={estilos.vazio}>Nenhuma vacina registrada.</Text>
              ) : (
                <>
                  <View style={estilos.linhaVacina}>
                    <Text style={[estilos.colunaNome, estilos.cabecalhoTabela]}>Vacina</Text>
                    <Text style={[estilos.coluna, estilos.cabecalhoTabela]}>Aplicada</Text>
                    <Text style={[estilos.coluna, estilos.cabecalhoTabela]}>Próxima</Text>
                  </View>
                  {vacinas.map((v, i) => {
                    const dias = diasAte(v.proxima_dose)
                    const alerta = dias !== null && dias <= 7
                    return (
                      <View key={v.id} style={[estilos.linhaVacina, i > 0 && estilos.linhaDivisoria]}>
                        <Text style={[estilos.colunaNome, estilos.celula]} numberOfLines={1}>
                          {v.nome}
                        </Text>
                        <Text style={[estilos.coluna, estilos.celula]}>{dataCurta(v.aplicada_em)}</Text>
                        <Text style={[estilos.coluna, estilos.celula, alerta && estilos.celulaAlerta]}>
                          {dataCurta(v.proxima_dose)}
                        </Text>
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

            <Bloco icone="capsula" titulo="Remédios em uso" fundo="#FFF0C9" indice={2}>
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

            <Bloco icone="coracao" titulo="Saúde e cuidados" fundo={colors.successSurface} indice={3}>
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
          </>
        )}

        <Text style={estilos.nota}>Dados informados pelo tutor. Ao compartilhar, a mensagem leva o que está aqui.</Text>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Compartilhar carteirinha"
          icone={<Icone nome="compartilhar" size={22} espessura={2} />}
          onPress={() => compartilharCarteirinha(pet, vacinas)}
        />
      </View>
    </View>
  )
}

function Bloco({
  icone,
  titulo,
  fundo,
  indice,
  children,
}: {
  icone: NomeIcone
  titulo: string
  fundo: string
  indice: number
  children: ReactNode
}) {
  return (
    <Surgir indice={indice} style={[estilos.bloco, { backgroundColor: fundo }]}>
      <View style={estilos.blocoTopo}>
        <View style={estilos.blocoIcone}>
          <Icone nome={icone} size={18} />
        </View>
        <Text style={estilos.blocoTitulo}>{titulo}</Text>
      </View>
      {children}
    </Surgir>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  centro: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  compartilharTopo: { position: 'absolute', right: 24, top: 56 },
  compartilharTopoBotao: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  carregando: { marginTop: 24 },
  identidade: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: '#E6EAF0',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 3,
  },
  identidadeTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.white, overflow: 'hidden' },
  nome: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 30, letterSpacing: -0.8, color: colors.black },
  raca: { fontFamily: fontFamily.regular, fontSize: 13, color: '#2B3A4A', marginTop: 2 },
  tutor: { fontFamily: fontFamily.bold, fontSize: 13, color: '#2B3A4A', marginTop: 2 },
  dados: { flexDirection: 'row', gap: 8, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 14 },
  dado: { flex: 1, minWidth: 0, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 10 },
  dadoRotulo: { fontFamily: fontFamily.semiBold, fontSize: 11 },
  dadoValor: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 1 },
  bloco: { borderRadius: 26, paddingVertical: 14, paddingHorizontal: 16, gap: 8 },
  blocoTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  blocoIcone: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blocoTitulo: { flex: 1, fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  vazio: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted },
  linhaVacina: { flexDirection: 'row', gap: 6, paddingVertical: 6 },
  linhaDivisoria: { borderTopWidth: 1, borderTopColor: '#C9E3F2' },
  colunaNome: { flex: 1.3, minWidth: 0 },
  coluna: { flex: 1 },
  cabecalhoTabela: { fontFamily: fontFamily.bold, fontSize: 11, color: colors.primaryDeep },
  celula: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.black },
  celulaAlerta: { color: '#B3173A' },
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
  remedioSub: { fontFamily: fontFamily.regular, fontSize: 12, color: '#7A5A00' },
  remedioDia: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: colors.black,
    backgroundColor: colors.white,
    borderRadius: 999,
    overflow: 'hidden',
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  cuidados: { flexDirection: 'row', gap: 8 },
  cuidado: { flex: 1, minWidth: 0, backgroundColor: colors.white, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10 },
  cuidadoRotulo: { fontFamily: fontFamily.semiBold, fontSize: 11, color: '#1F6B45' },
  cuidadoValor: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  nota: { fontFamily: fontFamily.regular, fontSize: 11, lineHeight: 16, color: '#6A7484', textAlign: 'center' },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
})
