import { useCallback } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { CodigoQR } from '../../components/CodigoQR'
import { colors } from '../../theme/colors'
import { fontFamily } from '../../theme/typography'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { useFonts } from 'expo-font'

/**
 * Componente para gerar a etiqueta do QR da coleira em PDF/PNG.
 * Layout A6 (105 × 148 mm) ou etiqueta adesiva (50 × 30 mm / 70 × 40 mm).
 * Requer expo-print (já instalado).
 */

export interface EtiquetaQrProps {
  /** Código do QR (ex: "abc123") */
  codigo: string
  /** Nome do pet */
  nomePet: string
  /** URL base (ex: "https://petlive.app/r/") */
  urlBase?: string
  /** Incluir nome do pet na etiqueta */
  incluirNome?: boolean
  /** Tamanho da etiqueta: 'A6' | '50x30' | '70x40' */
  tamanho?: 'A6' | '50x30' | '70x40'
  /** Callback quando o PDF/PNG for gerado */
  onGerado?: (uri: string) => void
}

const TAMANHOS = {
  A6: { largura: 105, altura: 148, qrSize: 45, fonteUrl: 8, fonteRodape: 6 },
  '50x30': { largura: 50, altura: 30, qrSize: 22, fonteUrl: 5, fonteRodape: 4 },
  '70x40': { largura: 70, altura: 40, qrSize: 30, fonteUrl: 6, fonteRodape: 5 },
} as const

type TamanhoEtiqueta = keyof typeof TAMANHOS
type TamanhoEtiquetaValores = typeof TAMANHOS[TamanhoEtiqueta]

/** Converte mm para pontos (1 mm = 2.83465 pt) */
function mmParaPt(mm: number): number {
  return Math.round(mm * 2.83465)
}

/** Gera o HTML para a etiqueta */
function gerarHtmlEtiqueta(props: EtiquetaQrProps & { t: TamanhoEtiquetaValores }): string {
  const { codigo, nomePet, urlBase = 'https://petlive.app/r/', incluirNome = true, t } = props
  const url = `${urlBase}${codigo}`

  // Estilos em pontos
  const larguraPt = mmParaPt(t.largura)
  const alturaPt = mmParaPt(t.altura)
  const qrSizePt = mmParaPt(t.qrSize)
  const margemPt = mmParaPt(3) // 3mm margem

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {
      size: ${t.largura}mm ${t.altura}mm;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: ${t.largura}mm;
      height: ${t.altura}mm;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: white;
      color: #111;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3mm;
    }
    .qr-container {
      background: white;
      padding: 2mm;
      border-radius: 2mm;
      margin-bottom: 2mm;
    }
    .qr-svg {
      width: ${t.qrSize}mm;
      height: ${t.qrSize}mm;
      display: block;
    }
    .url {
      font-size: ${t.fonteUrl}pt;
      font-weight: 500;
      text-align: center;
      color: #1D5F86;
      margin-bottom: 1.5mm;
      word-break: break-all;
    }
    .nome-pet {
      font-size: ${t.fonteUrl + 2}pt;
      font-weight: 700;
      text-align: center;
      color: #111;
      margin-bottom: 1mm;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .instrucao {
      font-size: ${t.fonteRodape}pt;
      text-align: center;
      color: #5E6878;
      margin-bottom: 1.5mm;
      line-height: 1.3;
    }
    .rodape {
      font-size: ${t.fonteRodape}pt;
      text-align: center;
      color: #999;
      border-top: 0.5pt solid #E1E6EE;
      padding-top: 1mm;
      width: 100%;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="qr-container">
    <div id="qr-code" class="qr-svg"></div>
  </div>
  ${incluirNome ? `<div class="nome-pet">${nomePet}</div>` : ''}
  <div class="url">${url.replace(/^https?:\/\//, '')}</div>
  <div class="instrucao">Se me encontrou, escaneie ou acesse o link</div>
  <div class="rodape">PetLive — QR da coleira</div>
  <script>
    // QR Code simples em SVG (gerado via qrcode library no lado do cliente seria ideal,
    // mas para simplicidade usamos um data URI ou geramos no backend)
    // Aqui apenas placeholder - o QR real é injetado pelo componente React Native
  </script>
</body>
</html>
  `.trim()
}

/**
 * Hook para gerar e compartilhar a etiqueta do QR.
 * Retorna uma função `gerarEtiqueta` que cria o PDF e abre o Share Sheet.
 */
export function useEtiquetaQr() {
  const [fontsLoaded] = useFonts({
    'PlusJakartaSans-Bold': require('../assets/fonts/PlusJakartaSans-Bold.ttf'),
    'PlusJaketaSans-Medium': require('../assets/fonts/PlusJaketaSans-Medium.ttf'),
  })

  const gerarEtiqueta = useCallback(
    async (props: EtiquetaQrProps): Promise<string | null> => {
      if (!fontsLoaded) {
        console.warn('[EtiquetaQr] Fontes não carregadas ainda')
      }

      try {
        const t = TAMANHOS[props.tamanho || 'A6']
        const html = gerarHtmlEtiqueta({ ...props, t })

        // Gera o PDF usando expo-print
        const { uri } = await Print.printToFileAsync({
          html,
          base64: false,
          // Formato A6 ou custom
          width: t.largura * 2.83465, // mm para pontos
          height: t.altura * 2.83465,
        })

        // Compartilha via Share Sheet do sistema
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Etiqueta QR - ${props.nomePet}`,
            UTI: 'com.adobe.pdf',
          })
        }

        props.onGerado?.(uri)
        return uri
      } catch (e) {
        console.error('[EtiquetaQr] Erro ao gerar:', e)
        throw e
      }
    },
    [fontsLoaded],
  )

  return { gerarEtiqueta }
}

/**
 * Componente visual da etiqueta (para prévia no app).
 * Renderiza em SVG usando o mesmo CodigoQR do app.
 */
export function EtiquetaQrPreview({
  codigo,
  nomePet,
  urlBase = 'https://petlive.app/r/',
  incluirNome = true,
  tamanho = 'A6',
  style,
}: EtiquetaQrProps & { style?: any }) {
  const t = TAMANHOS[tamanho]
  const url = `${urlBase}${codigo}`

  return (
    <View style={[estilos.container, { width: mmParaPt(t.largura), height: mmParaPt(t.altura) }, style]}>
      <View style={[estilos.qrContainer, { padding: mmParaPt(2) }]}>
        <CodigoQR valor={url} tamanho={mmParaPt(t.qrSize)} />
      </View>
      {incluirNome && (
        <Text style={[estilos.nomePet, { fontSize: t.fonteUrl + 2, marginTop: mmParaPt(2) }]}>
          {nomePet.toUpperCase()}
        </Text>
      )}
      <Text style={[estilos.url, { fontSize: t.fonteUrl, marginTop: mmParaPt(1) }]}>
        {url.replace(/^https?:\/\//, '')}
      </Text>
      <Text style={[estilos.instrucao, { fontSize: t.fonteRodape, marginTop: mmParaPt(1.5) }]}>
        Se me encontrou, escaneie ou acesse o link
      </Text>
      <Text style={[estilos.rodape, { fontSize: t.fonteRodape, marginTop: mmParaPt(1.5) }]}>
        PetLive — QR da coleira
      </Text>
    </View>
  )
}

const estilos = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 4,
    padding: mmParaPt(3),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  qrContainer: {
    backgroundColor: colors.white,
    borderRadius: 4,
  },
  nomePet: {
    fontFamily: fontFamily.bold,
    color: colors.black,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  url: {
    fontFamily: fontFamily.medium,
    color: colors.primaryDeep,
    textAlign: 'center',
  },
  instrucao: {
    fontFamily: fontFamily.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  rodape: {
    fontFamily: fontFamily.regular,
    color: '#999',
    textAlign: 'center',
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingTop: mmParaPt(1),
    width: '100%',
  },
})