import { StyleSheet } from 'react-native'
import { colors } from '../theme/colors'
import { fontFamily } from '../theme/typography'

/** Estilos comuns das telas de reserva (creche, hotelzinho, passeio). */
export const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export const er = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  sub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted },
  linha: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center' },
  opcao: { flex: 1, borderRadius: 22, borderWidth: 1.5, borderColor: colors.border, padding: 14, gap: 2 },
  ativo: { backgroundColor: colors.black, borderColor: colors.black },
  chipTexto: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.black },
  opcaoTitulo: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  claro: { color: colors.white },
  dia: { width: 56, height: 66, borderRadius: 20, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 2 },
  diaSemVaga: { opacity: 0.35 },
  diaSemana: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.textMuted },
  diaNumero: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.black },
  horario: { width: 76, height: 44, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  horarioTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  extra: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background, borderRadius: 18, padding: 12 },
  aviso: { backgroundColor: colors.warningSurface, borderRadius: 18, padding: 12 },
  avisoTexto: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.warningText },
  campo: { backgroundColor: colors.background, borderRadius: 22, padding: 14 },
  texto: { fontFamily: fontFamily.regular, fontSize: 15, color: colors.black, minHeight: 50, textAlignVertical: 'top' },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 8 },
  resumo: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black, textAlign: 'center' },
})
