import { useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../src/components/Animacoes'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { Icone } from '../../src/components/Icone'
import { mensagemDeErro } from '../../src/lib/cacheOffline'
import { useRecurso } from '../../src/lib/configApp'
import { ligarPara } from '../../src/mapa/acoes'
import { AvatarPet } from '../../src/pets/AvatarPet'
import { abrirWhatsAppComTexto, ehCelular, ITENS_FICHA, mensagemFicha, resumoPet, secoesFicha } from '../../src/pets/fichaEmergencia'
import { FolhaQR } from '../../src/pets/FolhaQR'
import { gerarLink, urlFicha, type OrigemLink } from '../../src/pets/linkCarteirinha'
import { usePets } from '../../src/pets/PetsProvider'
import { colors } from '../../src/theme/colors'
import { fontFamily } from '../../src/theme/typography'

const ROSA = '#FDE0E6'
const HORAS = 24
// Para a clínica vai tudo: alergias, remédios, vacinas e peso, veterinário e telefone.
const TUDO = new Set(ITENS_FICHA.map((i) => i.chave))

/**
 * Enviar a ficha à clínica (protótipo EnviarFichaClinica): abre o WhatsApp
 * da clínica com a mensagem e o link. O número vem do mapa e não é guardado;
 * fica registrado só o lugar e o canal. Quem envia é o tutor, no WhatsApp dele.
 */
export default function TelaEnviarFicha() {
  const { lugar, nome, telefone } = useLocalSearchParams<{ lugar?: string; nome?: string; telefone?: string }>()
  const { pets, petAtivo, definirPetAtivo, adicionarPet } = usePets()
  const ligado = useRecurso('carteirinha_link')
  const pet = petAtivo ?? pets[0] ?? null
  const [enviando, setEnviando] = useState<OrigemLink['canal'] | null>(null)
  const [qr, setQr] = useState<{ codigo: string; expira_em: string } | null>(null)
  const celular = telefone ? ehCelular(telefone) : false

  if (!pet) {
    return (
      <View style={estilos.tela}>
        <HeroiOnda fundo={ROSA} subtitulo={nome ?? 'Clínica'} titulo="Enviar a ficha" altura={200} />
        <View style={estilos.vazio}>
          <Text style={estilos.vazioTexto}>Cadastre um pet para enviar a ficha de emergência.</Text>
          <BotaoPrimario titulo="Cadastrar pet" onPress={adicionarPet} />
        </View>
      </View>
    )
  }

  async function enviar(canal: NonNullable<OrigemLink['canal']>) {
    if (!pet) return
    setEnviando(canal)
    try {
      const link = await gerarLink(pet.id, secoesFicha(TUDO), HORAS, { tipo: 'emergencia', lugar: lugar ?? null, canal })
      const mensagem = mensagemFicha(pet, link.codigo, HORAS)
      if (canal === 'whatsapp') await abrirWhatsAppComTexto(mensagem, celular ? telefone : null)
      else if (canal === 'qr') setQr(link)
      else await Share.share({ message: urlFicha(link.codigo) })
    } catch (e) {
      Alert.alert('Não deu para gerar a ficha', mensagemDeErro(e instanceof Error ? e.message : String(e)))
    } finally {
      setEnviando(null)
    }
  }

  const previa = mensagemFicha(pet, 'codigo', HORAS).replace(urlFicha('codigo'), urlFicha('…').replace(/^https?:\/\//, ''))

  return (
    <View style={estilos.tela}>
      <HeroiOnda fundo={ROSA} subtitulo={nome ?? 'Clínica'} titulo="Enviar a ficha" altura={200} />
      <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {telefone ? (
          <>
            <View style={[estilos.cartao, { backgroundColor: celular ? colors.successSurface : '#FFF0C9' }]}>
              <View style={estilos.cartaoIcone}>
                <Icone nome="telefone" size={20} />
              </View>
              <View style={estilos.flex}>
                <Text style={estilos.cartaoRotulo}>{celular ? 'WhatsApp da clínica' : 'Telefone da clínica'}</Text>
                <Text style={estilos.cartaoValor}>{telefone} · número do mapa</Text>
              </View>
            </View>
            <Text style={estilos.nota}>
              {celular
                ? 'Confira o número antes de enviar. Ele vem do mapa e pode estar desatualizado.'
                : 'Este número parece ser fixo e pode não ter WhatsApp. Você escolhe o contato na hora de enviar, ou liga para a clínica.'}
            </Text>
          </>
        ) : null}

        {pets.length > 1 ? (
          <View style={estilos.pets}>
            {pets.map((p) => (
              <Tocavel
                key={p.id}
                accessibilityRole="button"
                accessibilityState={{ selected: p.id === pet.id }}
                onPress={() => definirPetAtivo(p.id)}
                style={[estilos.petChip, p.id === pet.id && estilos.petChipAtivo]}
              >
                <Text style={[estilos.petChipTexto, p.id === pet.id && estilos.petChipTextoAtivo]}>{p.nome}</Text>
              </Tocavel>
            ))}
          </View>
        ) : null}

        <View style={[estilos.cartao, { backgroundColor: colors.background }]}>
          <View style={estilos.avatar}>
            <AvatarPet especie={pet.especie} foto={pet.foto_url} size={44} />
          </View>
          <View style={estilos.flex}>
            <Text style={estilos.cartaoRotulo}>Pet</Text>
            <Text style={estilos.cartaoValor}>{resumoPet(pet)}</Text>
          </View>
        </View>

        <Text style={estilos.secao}>Mensagem que será enviada</Text>
        <Text style={estilos.balao}>{previa}</Text>
        <View style={estilos.inclui}>
          <Text style={estilos.incluiRotulo}>Inclui:</Text>
          {['Alergias', 'Remédios', 'Vacinas', 'Peso'].map((c) => (
            <Text key={c} style={estilos.chip}>{c}</Text>
          ))}
        </View>
        <Tocavel accessibilityRole="link" onPress={() => router.push(`/pet/${pet.id}/ficha`)}>
          <Text style={estilos.mudar}>Mudar o que vai na ficha</Text>
        </Tocavel>
        <Text style={estilos.aviso}>Você está enviando essas informações para esta clínica. O link vale por {HORAS} h e você pode cancelar.</Text>
        {!ligado ? <Text style={estilos.pausado}>O envio por link está pausado agora. Ligue para a clínica.</Text> : null}
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo={celular ? 'WhatsApp da clínica' : 'Enviar pelo WhatsApp'}
          carregando={enviando === 'whatsapp'}
          desabilitado={!ligado || enviando !== null}
          icone={<Icone nome="compartilhar" size={22} espessura={2} />}
          onPress={() => enviar('whatsapp')}
        />
        <View style={estilos.linha}>
          <Tocavel accessibilityRole="button" disabled={!ligado || enviando !== null} onPress={() => enviar('copiar')} estiloExterno={estilos.flex} style={estilos.secundario}>
            {enviando === 'copiar' ? <ActivityIndicator color={colors.black} /> : <Text style={estilos.secundarioTexto}>Copiar link</Text>}
          </Tocavel>
          <Tocavel accessibilityRole="button" disabled={!ligado || enviando !== null} onPress={() => enviar('qr')} estiloExterno={estilos.flex} style={estilos.secundario}>
            {enviando === 'qr' ? <ActivityIndicator color={colors.black} /> : <Text style={estilos.secundarioTexto}>Mostrar QR</Text>}
          </Tocavel>
        </View>
        {telefone && !celular ? (
          <Tocavel accessibilityRole="button" onPress={() => ligarPara(telefone)} style={estilos.secundario}>
            <Text style={estilos.secundarioTexto}>Ligar para a clínica</Text>
          </Tocavel>
        ) : null}
      </View>

      <FolhaQR link={qr} nomePet={pet.nome} onFechar={() => setQr(null)} />
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },
  vazio: { padding: 24, gap: 16 },
  vazioTexto: { fontFamily: fontFamily.regular, fontSize: 15, color: colors.textMuted },
  cartao: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 26, padding: 12 },
  cartaoIcone: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.white },
  cartaoRotulo: { fontFamily: fontFamily.regular, fontSize: 12, color: '#5E6878' },
  cartaoValor: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: '#6A7484', paddingHorizontal: 6 },
  pets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  petChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.background },
  petChipAtivo: { backgroundColor: colors.black },
  petChipTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  petChipTextoAtivo: { color: colors.white },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  balao: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.black,
    backgroundColor: colors.successSurface,
    borderRadius: 22,
    borderBottomRightRadius: 6,
    overflow: 'hidden',
    padding: 16,
    marginLeft: 20,
  },
  inclui: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  incluiRotulo: { fontFamily: fontFamily.regular, fontSize: 13, color: '#5E6878' },
  chip: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: colors.successText,
    backgroundColor: colors.successSurface,
    borderRadius: 999,
    overflow: 'hidden',
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  mudar: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black, textDecorationLine: 'underline' },
  aviso: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: '#6A7484', textAlign: 'center' },
  pausado: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: '#7A5A00',
    backgroundColor: '#FFF0C9',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 10 },
  linha: { flexDirection: 'row', gap: 10 },
  secundario: { height: 50, borderRadius: 25, backgroundColor: colors.disabled, alignItems: 'center', justifyContent: 'center' },
  secundarioTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
})
