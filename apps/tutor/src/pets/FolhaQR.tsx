import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { CodigoQR } from '../components/CodigoQR'
import { colors } from '../theme/colors'
import { fontFamily } from '../theme/typography'
import { quando, urlFicha } from './linkCarteirinha'

/**
 * QR para a clínica ler com a câmera (protótipo FichaEmergencia, "Mostrar QR
 * para a clínica ler"). Fundo branco e QR grande: lê mesmo com tela fraca.
 */
export function FolhaQR({
  link,
  nomePet,
  onFechar,
}: {
  link: { codigo: string; expira_em: string } | null
  nomePet: string
  onFechar: () => void
}) {
  return (
    <Modal visible={Boolean(link)} transparent animationType="fade" onRequestClose={onFechar}>
      <View style={estilos.fundo}>
        <View style={estilos.folha}>
          <Text style={estilos.titulo}>Ficha de emergência</Text>
          <Text style={estilos.sub}>{nomePet}: peça para a clínica apontar a câmera do celular.</Text>
          {link ? (
            <>
              <View style={estilos.qr}>
                <CodigoQR valor={urlFicha(link.codigo)} tamanho={240} />
              </View>
              <Text style={estilos.url} selectable>
                {urlFicha(link.codigo).replace(/^https?:\/\//, '')}
              </Text>
              <Text style={estilos.validade}>Vale até {quando(link.expira_em)}</Text>
            </>
          ) : null}
          <Pressable accessibilityRole="button" onPress={onFechar} style={estilos.fechar}>
            <Text style={estilos.fecharTexto}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 },
  folha: { backgroundColor: colors.white, borderRadius: 32, padding: 24, alignItems: 'center', gap: 8 },
  titulo: { fontFamily: fontFamily.bold, fontSize: 22, color: colors.black },
  sub: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  qr: { marginVertical: 8 },
  url: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.black, textAlign: 'center' },
  validade: { fontFamily: fontFamily.bold, fontSize: 13, color: '#8A6414' },
  fechar: { marginTop: 8, height: 48, alignSelf: 'stretch', borderRadius: 24, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  fecharTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.white },
})
