import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Surgir, Tocavel } from '../components/Animacoes'
import { Icone } from '../components/Icone'
import { apagarAnexo, carregarAnexos, urlsAnexos } from './anexos'
import { filtrarAnexos, rotuloTipo, TIPOS_ANEXO, tituloAnexo, type Anexo, type TipoAnexo } from './anexosRegras'
import { ImagemZoom } from './ImagemZoom'
import { dataParaExibicao } from './types'
import { colors } from '../theme/colors'
import { fontFamily, typography } from '../theme/typography'

type Props = {
  petId: string
  /** Abre o formulário (novo, ou edição com o id). Passa pelo controle de pet só para consulta. */
  onAnexar: (anexoId?: string) => void
}

/**
 * Anexos de saúde do pet (P-B7CbI): fotos do cartão de vacina e de exames,
 * do mais recente para o mais antigo, com filtro por tipo. Tocar abre em
 * tela cheia com zoom; dali dá para editar ou excluir.
 */
export function AbaAnexos({ petId, onAnexar }: Props) {
  const insets = useSafeAreaInsets()
  const [anexos, setAnexos] = useState<Anexo[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [filtro, setFiltro] = useState<TipoAnexo | null>(null)
  const [aberto, setAberto] = useState<Anexo | null>(null)
  const [erro, setErro] = useState(false)

  const carregar = useCallback(() => {
    let vivo = true
    carregarAnexos(petId)
      .then(async (lista) => {
        const assinadas = await urlsAnexos(lista.map((a) => a.arquivo_path))
        if (!vivo) return
        setErro(false)
        setAnexos(lista)
        setUrls(assinadas)
      })
      .catch(() => {
        if (!vivo) return
        setErro(true)
        setAnexos((atual) => atual ?? [])
      })
    return () => {
      vivo = false
    }
  }, [petId])

  // Recarrega ao voltar do formulário.
  useFocusEffect(carregar)

  function confirmarExclusao(anexo: Anexo) {
    Alert.alert('Excluir este anexo?', `${tituloAnexo(anexo)}. A foto é apagada da sua conta e não dá para desfazer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          apagarAnexo(anexo).then(
            () => {
              setAberto(null)
              setAnexos((atual) => (atual ?? []).filter((a) => a.id !== anexo.id))
            },
            (e) => Alert.alert('Não deu para excluir', e instanceof Error ? e.message : String(e)),
          ),
      },
    ])
  }

  if (anexos === null) return <ActivityIndicator color={colors.primaryDeep} style={estilos.carregando} />

  const lista = filtrarAnexos(anexos, filtro)

  if (anexos.length === 0) {
    return (
      <View style={estilos.vazio}>
        <View style={estilos.vazioIcone}>
          <Icone nome="documento" size={26} />
        </View>
        <Text style={estilos.vazioTitulo}>{erro ? 'Não deu para carregar os anexos' : 'Nenhum anexo ainda'}</Text>
        <Text style={estilos.vazioTexto}>
          {erro ? 'Confira a internet e tente de novo.' : 'Guarde aqui a foto do cartão de vacina e dos exames. Só você vê.'}
        </Text>
        <Tocavel accessibilityRole="button" onPress={erro ? carregar : () => onAnexar()} style={estilos.vazioBotao}>
          <Text style={estilos.vazioBotaoTexto}>{erro ? 'Tentar novamente' : 'Anexar o primeiro'}</Text>
        </Tocavel>
      </View>
    )
  }

  return (
    <View style={estilos.lista}>
      <View style={estilos.filtros}>
        {[{ valor: null, rotulo: 'Todos' }, ...TIPOS_ANEXO].map((f) => {
          const ativo = filtro === f.valor
          return (
            <Tocavel
              key={f.rotulo}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              onPress={() => setFiltro(f.valor)}
              style={[estilos.filtro, ativo && estilos.filtroAtivo]}
            >
              <Text style={[estilos.filtroTexto, ativo && estilos.filtroTextoAtivo]}>{f.rotulo}</Text>
            </Tocavel>
          )
        })}
      </View>

      {lista.length === 0 ? <Text style={estilos.semFiltro}>Nenhum anexo deste tipo.</Text> : null}
      {lista.map((anexo, i) => (
        <Surgir key={anexo.id} indice={i}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${rotuloTipo(anexo.tipo)}: ${tituloAnexo(anexo)}, ${dataParaExibicao(anexo.data)}`}
            accessibilityHint="Abre a imagem em tela cheia"
            onPress={() => setAberto(anexo)}
            style={estilos.linha}
          >
            <View style={estilos.miniatura}>
              {urls[anexo.arquivo_path] ? (
                <Image source={{ uri: urls[anexo.arquivo_path] }} style={estilos.miniaturaImagem} />
              ) : (
                <Icone nome={anexo.tipo === 'vacina' ? 'vacina' : 'documento'} size={18} />
              )}
            </View>
            <View style={estilos.flex}>
              <Text style={estilos.linhaTitulo} numberOfLines={1}>
                {tituloAnexo(anexo)}
              </Text>
              <Text style={estilos.linhaSub} numberOfLines={1}>
                {rotuloTipo(anexo.tipo)} · {dataParaExibicao(anexo.data)}
              </Text>
            </View>
          </Pressable>
        </Surgir>
      ))}

      <Modal visible={aberto !== null} animationType="fade" onRequestClose={() => setAberto(null)} statusBarTranslucent>
        {aberto ? (
          <View style={[estilos.cheia, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
            <View style={estilos.cheiaTopo}>
              <View style={estilos.flex}>
                <Text style={estilos.cheiaTitulo} numberOfLines={1}>
                  {tituloAnexo(aberto)}
                </Text>
                <Text style={estilos.cheiaSub}>
                  {rotuloTipo(aberto.tipo)} · {dataParaExibicao(aberto.data)}
                </Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setAberto(null)} hitSlop={12}>
                <Text style={estilos.cheiaAcao}>Fechar</Text>
              </Pressable>
            </View>
            <View style={estilos.cheiaImagem}>
              {urls[aberto.arquivo_path] ? (
                <ImagemZoom uri={urls[aberto.arquivo_path]} rotulo={tituloAnexo(aberto)} />
              ) : (
                <Text style={estilos.cheiaSub}>Não deu para abrir a imagem. Confira a internet.</Text>
              )}
            </View>
            <View style={estilos.cheiaRodape}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const id = aberto.id
                  setAberto(null)
                  onAnexar(id)
                }}
                style={estilos.cheiaBotao}
              >
                <Text style={estilos.cheiaBotaoTexto}>Editar</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => confirmarExclusao(aberto)} style={estilos.cheiaBotao}>
                <Text style={[estilos.cheiaBotaoTexto, estilos.perigo]}>Excluir</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  )
}

const estilos = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  carregando: { marginVertical: 20 },
  lista: { gap: 10 },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filtro: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.background },
  filtroAtivo: { backgroundColor: colors.black },
  filtroTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.black },
  filtroTextoAtivo: { color: colors.white },
  semFiltro: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 24,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 14,
  },
  miniatura: { width: 52, height: 52, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFF0C9', alignItems: 'center', justifyContent: 'center' },
  miniaturaImagem: { width: '100%', height: '100%' },
  linhaTitulo: { fontSize: 16, fontFamily: fontFamily.semiBold, color: colors.black },
  linhaSub: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textMuted },
  vazio: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  vazioIcone: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF0C9', alignItems: 'center', justifyContent: 'center' },
  vazioTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  vazioTexto: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  vazioBotao: { marginTop: 4, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.black },
  vazioBotaoTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.white },
  cheia: { flex: 1, backgroundColor: '#000' },
  cheiaTopo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 8 },
  cheiaTitulo: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.white },
  cheiaSub: { fontFamily: fontFamily.regular, fontSize: 13, color: '#C9CED6' },
  cheiaAcao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.white },
  cheiaImagem: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  cheiaRodape: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 8 },
  cheiaBotao: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 999, backgroundColor: '#1F232A' },
  cheiaBotaoTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.white },
  perigo: { color: '#FF8FA3' },
})
