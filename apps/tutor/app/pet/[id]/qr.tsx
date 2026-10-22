import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Share } from 'react-native'
import { Surgir, Tocavel } from '../../components/Animacoes'
import { BotaoPrimario } from '../../components/BotaoPrimario'
import { CodigoQR } from '../../components/CodigoQR'
import { Gradiente } from '../../components/Gradiente'
import { HeroiOnda } from '../../components/HeroiOnda'
import { Icone } from '../../components/Icone'
import { Interruptor } from '../../components/Interruptor'
import { usePets } from '../../pets/PetsProvider'
import { useEtiquetaQr } from '../../pets/EtiquetaQr'
import {
  criarQrColeira,
  atualizarQrColeira,
  revogarQrColeira,
  buscarQrColeira,
  obterQrPublico,
  QrColeiraConfig,
  QrPublicoResponse,
  SECOES_PADRAO,
  ROTULOS_SECOES,
  type SecaoQr,
} from '../../pets/qr'
import { colors } from '../../theme/colors'
import { fontFamily, typography } from '../../theme/typography'

/** Tela do QR da coleira (protótipo QR): mostra o QR, permite configurar
 * o que aparece ao escanear, baixar etiqueta e revogar. */
export default function TelaQrColeira() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets, plano } = usePets()
  const pet = pets.find((p) => p.id === id) ?? null

  const [config, setConfig] = useState<QrColeiraConfig | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [previaAberta, setPreviaAberta] = useState(false)
  const [previa, setPrevia] = useState<QrPublicoResponse | null>(null)
  const [previaCarregando, setPreviaCarregando] = useState(false)
  const [baixandoEtiqueta, setBaixandoEtiqueta] = useState(false)
  const [incluirNomeEtiqueta, setIncluirNomeEtiqueta] = useState(true)
  const [revogando, setRevogando] = useState(false)

  const isPremium = plano === 'premium'

  // Carrega a configuração do QR ao entrar na tela.
  useFocusEffect(
    useCallback(() => {
      if (!id) return
      let vivo = true
      const carregar = async () => {
        try {
          const existente = await buscarQrColeira(id)
          if (!vivo) return
          if (existente && !existente.revogado_em) {
            const qr = await criarQrColeira(id)
            setConfig(qr)
          } else if (existente && existente.revogado_em) {
            // QR revogado: mostra estado vazio para o tutor gerar novo
            setConfig(null)
          } else {
            setConfig(null)
          }
        } catch (e) {
          console.error('[QrColeira] erro ao carregar:', e)
        } finally {
          if (vivo) setCarregando(false)
        }
      }
      carregar()
      return () => {
        vivo = false
      }
    }, [id]),
  )

  // Gera o QR se não existir.
  const gerarQr = useCallback(async () => {
    if (!id || !pet) return
    setSalvando(true)
    try {
      const qr = await criarQrColeira(id)
      setConfig(qr)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao gerar QR'
      Alert.alert('Erro', msg)
    } finally {
      setSalvando(false)
    }
  }, [id, pet])

  // Alterna uma seção (exceto nome_foto que é obrigatório).
  const alternarSecao = useCallback(
    async (secao: SecaoQr) => {
      if (!config || !id) return
      if (secao === 'nome_foto') return // obrigatório

      const novasSecoes = config.secoes.includes(secao)
        ? config.secoes.filter((s) => s !== secao)
        : [...config.secoes, secao]

      setSalvando(true)
      try {
        const qr = await atualizarQrColeira(id, novasSecoes)
        setConfig(qr)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro ao salvar'
        Alert.alert('Erro', msg)
      } finally {
        setSalvando(false)
      }
    },
    [config, id],
  )

  // Abre a prévia da página pública.
  const abrirPrevia = useCallback(async () => {
    if (!config) return
    setPreviaCarregando(true)
    try {
      const resp = await obterQrPublico(config.codigo)
      setPrevia(resp)
      setPreviaAberta(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar prévia'
      Alert.alert('Erro', msg)
    } finally {
      setPreviaCarregando(false)
    }
  }, [config])

  // Revoga o QR.
  const confirmarRevogacao = useCallback(() => {
    Alert.alert(
      'Revogar QR da coleira?',
      'O código atual vai parar de funcionar. Quem escanear verá "QR desativado". Você pode gerar outro a qualquer momento.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revogar',
          style: 'destructive',
          onPress: async () => {
            if (!id || !config) return
            setRevogando(true)
            try {
              await revogarQrColeira(id)
              setConfig(null)
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Erro ao revogar'
              Alert.alert('Erro', msg)
            } finally {
              setRevogando(false)
            }
          },
        },
      ],
    )
  }, [id, config])

// Baixa a etiqueta (PDF/PNG) - usa expo-print.
  const { gerarEtiqueta } = useEtiquetaQr()
  const baixarEtiqueta = useCallback(async () => {
    if (!config || !pet) return
    if (!isPremium) {
      Alert.alert(
        'Recurso Premium',
        'Baixar etiqueta em alta resolução é um recurso do plano Premium.',
        [{ text: 'Conhecer o Premium', onPress: () => router.push('/premium') }, { text: 'OK', style: 'cancel' }],
      )
      return
    }

    setBaixandoEtiqueta(true)
    try {
      await gerarEtiqueta({
        codigo: config.codigo,
        nomePet: pet.nome,
        incluirNome: incluirNomeEtiqueta,
        tamanho: 'A6',
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao gerar etiqueta'
      Alert.alert('Erro', msg)
    } finally {
      setBaixandoEtiqueta(false)
    }
  }, [config, pet, isPremium, incluirNomeEtiqueta, gerarEtiqueta])

  // Pet em memória ou não encontrado.
  if (!pet) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <Text style={estilos.vazio}>Pet não encontrado.</Text>
      </View>
    )
  }

  const qrAtivo = config !== null
  const urlQr = config ? `https://petlive.app/r/${config.codigo}` : ''

  return (
    <View style={estilos.tela}>
      <HeroiOnda titulo="QR da coleira" altura={160}>
        {qrAtivo ? (
          <Tocavel
            accessibilityRole="button"
            accessibilityLabel={`Compartilhar o QR da coleira de ${pet.nome}`}
            onPress={abrirPrevia}
            estiloExterno={estilos.previaTopo}
            style={estilos.previaTopoBotao}
          >
            <Icone nome="olho" size={20} cor={colors.white} />
          </Tocavel>
        ) : null}
      </HeroiOnda>

      <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {carregando ? (
          <View style={estilos.carregando}>
            <Icone nome="carregando" size={32} cor={colors.primaryDeep} animado />
            <Text style={estilos.carregandoTexto}>Carregando QR...</Text>
          </View>
        ) : qrAtivo ? (
          <>
            {/* QR Code principal */}
            <Surgir indice={0} style={estilos.qrCard}>
              <View style={estilos.qrArea}>
                <Text style={estilos.qrTitulo}>QR da coleira do {pet.nome}</Text>
                <View style={estilos.qrContainer}>
                  <CodigoQR valor={urlQr} tamanho={220} />
                </View>
                <Text style={estilos.qrUrl} selectable>{urlQr}</Text>
                <Text style={estilos.qrDica}>
                  Não expira enquanto não for revogado. Funciona offline no app.
                </Text>
              </View>
            </Surgir>

            {/* O que aparece ao escanear */}
            <Surgir indice={1} style={estilos.secoesCard}>
              <View style={estilos.secoesTopo}>
                <Text style={estilos.secoesTitulo}>O que aparece ao escanear</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ver prévia da página pública"
                  onPress={abrirPrevia}
                  hitSlop={8}
                >
                  <Text style={estilos.previaLink}>Ver prévia</Text>
                </Pressable>
              </View>
              <Text style={estilos.secoesDescricao}>
                Escolha as informações que quem encontrar o pet vai ver.
              </Text>
              {Object.entries(ROTULOS_SECOES).map(([secao, info]) => (
                <View key={secao} style={estilos.secaoLinha}>
                  <View style={estilos.secaoInfo}>
                    <Text style={estilos.secaoTitulo}>{info.titulo}</Text>
                    <Text style={estilos.secaoSub}>{info.descricao}</Text>
                  </View>
                  <Interruptor
                    ligado={config.secoes.includes(secao as SecaoQr)}
                    onToggle={() => alternarSecao(secao as SecaoQr)}
                    rotulo={info.titulo}
                    desabilitado={info.obrigatorio || salvando}
                  />
                </View>
              ))}
            </Surgir>

            {/* Ações */}
            <Surgir indice={2} style={estilos.acoesCard}>
              {isPremium && (
                <View style={estilos.etiquetaOpcoes}>
                  <Text style={estilos.etiquetaOpcoesTitulo}>Opções da etiqueta</Text>
                  <View style={estilos.etiquetaToggle}>
                    <View style={estilos.etiquetaToggleInfo}>
                      <Text style={estilos.etiquetaToggleTitulo}>Incluir nome do pet</Text>
                      <Text style={estilos.etiquetaToggleSub}>Aparece acima do QR na etiqueta impressa</Text>
                    </View>
                    <Interruptor
                      ligado={incluirNomeEtiqueta}
                      onToggle={() => setIncluirNomeEtiqueta((v) => !v)}
                      rotulo="Incluir nome do pet na etiqueta"
                      desabilitado={baixandoEtiqueta}
                    />
                  </View>
                </View>
              )}
              <View style={estilos.acoesGrid}>
                <Tocavel
                  accessibilityRole="button"
                  accessibilityLabel="Baixar etiqueta para impressão"
                  onPress={baixarEtiqueta}
                  style={[
                    estilos.acaoBotao,
                    { backgroundColor: isPremium ? colors.primary : colors.disabled },
                  ]}
                  disabled={!isPremium || baixandoEtiqueta}
                >
                  <Icone nome="download" size={22} cor={isPremium ? colors.white : colors.textMuted} />
                  <Text style={[estilos.acaoTexto, { color: isPremium ? colors.white : colors.textMuted }]}>
                    Baixar etiqueta
                  </Text>
                </Tocavel>
                <Tocavel
                  accessibilityRole="button"
                  accessibilityLabel="Compartilhar QR"
                  onPress={abrirPrevia}
                  style={estilos.acaoBotaoSecundario}
                >
                  <Icone nome="compartilhar" size={22} cor={colors.primaryDeep} />
                  <Text style={estilos.acaoTexto}>Compartilhar QR</Text>
                </Tocavel>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Revogar QR da coleira"
                onPress={confirmarRevogacao}
                style={estilos.revogarBotao}
                disabled={revogando}
              >
                <Text style={estilos.revogarTexto}>Revogar QR da coleira</Text>
              </Pressable>
            </Surgir>

            {/* Info plano grátis */}
            {!isPremium && (
              <Surgir indice={3} style={estilos.infoGratis}>
                <Icone nome="info" size={16} cor={colors.warningText} />
                <Text style={estilos.infoGratisTexto}>
                  Plano Grátis: QR básico com nome, foto e telefone.{' '}
                  <Text style={estilos.infoGratisDestaque}>
                    Premium libera escolha completa das seções + etiqueta em alta resolução.
                  </Text>
                </Text>
              </Surgir>
            )}
          </>
        ) : (
          <>
            {/* Estado vazio: QR revogado ou nunca gerado */}
            <Surgir indice={0} style={estilos.vazioCard}>
              <Icone nome="qrcode" size={56} cor={colors.textMuted} />
              <Text style={estilos.vazioTitulo}>
                {config === null && pet ? 'QR da coleira não gerado' : 'QR da coleira revogado'}
              </Text>
              <Text style={estilos.vazioTexto}>
                {config === null && pet
                  ? 'Gere o QR para colocar na coleira do pet. Quem encontrar pode escanear e entrar em contato.'
                  : 'O código anterior foi desativado. Gere um novo QR quando quiser.'}
              </Text>
              <BotaoPrimario
                titulo="Gerar QR da coleira"
                icone={<Icone nome="qrcode" size={22} espessura={2} />}
                onPress={gerarQr}
                carregando={salvando}
              />
            </Surgir>

            {!isPremium && (
              <Surgir indice={1} style={estilos.infoGratis}>
                <Icone nome="info" size={16} cor={colors.warningText} />
                <Text style={estilos.infoGratisTexto}>
                  Plano Grátis: QR básico com nome, foto e telefone.{' '}
                  <Text style={estilos.infoGratisDestaque}>
                    Premium libera escolha completa das seções + etiqueta em alta resolução.
                  </Text>
                </Text>
              </Surgir>
            )}
          </>
        )}

        <Text style={estilos.nota}>
          O telefone nunca fica salvo no QR; vem do seu perfil no momento do acesso (LGPD).
          Cada acesso é registrado para auditoria; você não vê o IP bruto.
        </Text>
      </ScrollView>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 32, gap: 16 },
  carregando: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  carregandoTexto: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.textMuted },
  qrCard: { backgroundColor: colors.white, borderRadius: 28, padding: 20, gap: 12 },
  qrArea: { alignItems: 'center', gap: 10 },
  qrTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black, textAlign: 'center' },
  qrContainer: { backgroundColor: colors.white, borderRadius: 16, padding: 16, shadowColor: colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  qrUrl: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.primaryDeep, textAlign: 'center' },
  qrDica: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  secoesCard: { backgroundColor: colors.white, borderRadius: 28, padding: 20, gap: 12 },
  secoesTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  secoesTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  previaLink: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.primaryDeep },
  secoesDescricao: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  secaoLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  secaoInfo: { flex: 1, minWidth: 0 },
  secaoTitulo: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black },
  secaoSub: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  acoesCard: { backgroundColor: colors.white, borderRadius: 28, padding: 20, gap: 12 },
  etiquetaOpcoes: { backgroundColor: colors.background, borderRadius: 16, padding: 12, gap: 8 },
  etiquetaOpcoesTitulo: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.textMuted },
  etiquetaToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  etiquetaToggleInfo: { flex: 1, minWidth: 0 },
  etiquetaToggleTitulo: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black },
  etiquetaToggleSub: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  acoesGrid: { flexDirection: 'row', gap: 10 },
  acaoBotao: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 24 },
  acaoBotaoSecundario: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 24, backgroundColor: colors.primarySurface, borderWidth: 1.5, borderColor: colors.primary },
  acaoTexto: { fontFamily: fontFamily.bold, fontSize: 14 },
  revogarBotao: { height: 48, borderRadius: 24, backgroundColor: colors.dangerSurface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F5C6C6' },
  revogarTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.danger },
  infoGratis: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.warningSurface, borderRadius: 16, padding: 12 },
  infoGratisTexto: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.warningText, lineHeight: 17, flex: 1 },
  infoGratisDestaque: { fontFamily: fontFamily.bold },
  vazioCard: { backgroundColor: colors.white, borderRadius: 28, padding: 32, alignItems: 'center', gap: 12 },
  vazioTitulo: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.black, textAlign: 'center' },
  vazioTexto: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  nota: { fontFamily: fontFamily.regular, fontSize: 11, lineHeight: 16, color: '#6A7484', textAlign: 'center', marginTop: 8 },
  previaTopo: { position: 'absolute', right: 24, top: 56 },
  previaTopoBotao: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
})