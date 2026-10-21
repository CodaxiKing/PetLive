import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily, typography } from '../theme/typography';

type Props = {
  opcoes: string[];
  ativo: number;
  onSelecionar: (indice: number) => void;
};

/**
 * Controle segmentado das telas de conta (Criar conta / Entrar):
 * pílula cinza com a opção ativa em preto.
 */
export function ControleSegmentado({ opcoes, ativo, onSelecionar }: Props) {
  return (
    <View style={estilos.trilho}>
      {opcoes.map((opcao, indice) => {
        const selecionado = indice === ativo;

        return (
          <Pressable
            key={opcao}
            accessibilityRole="tab"
            accessibilityState={{ selected: selecionado }}
            onPress={() => onSelecionar(indice)}
            style={[estilos.opcao, selecionado && estilos.opcaoAtiva]}
          >
            <Text style={[estilos.texto, selecionado && estilos.textoAtivo]}>{opcao}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  trilho: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.disabled,
    borderRadius: 26,
    padding: 4,
  },
  opcao: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcaoAtiva: {
    backgroundColor: colors.black,
  },
  texto: {
    ...typography.captionMedium,
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    color: colors.textMuted,
  },
  textoAtivo: {
    color: colors.white,
  },
});
