import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily, typography } from '../theme/typography';
import { useMovimentoReduzido } from './Animacoes';

type Props = {
  opcoes: string[];
  ativo: number;
  onSelecionar: (indice: number) => void;
};

const RESPIRO = 4;
const VAO = 4;

/**
 * Controle segmentado das telas de conta (Criar conta / Entrar):
 * pílula cinza com a opção ativa em preto, que desliza até a escolhida.
 */
export function ControleSegmentado({ opcoes, ativo, onSelecionar }: Props) {
  const reduzido = useMovimentoReduzido();
  const [largura, setLargura] = useState(0);
  const posicao = useState(() => new Animated.Value(Math.max(ativo, 0)))[0];
  const larguraOpcao = largura > 0 ? (largura - RESPIRO * 2 - VAO * (opcoes.length - 1)) / opcoes.length : 0;

  useEffect(() => {
    if (ativo < 0) return;
    if (reduzido) {
      posicao.setValue(ativo);
      return;
    }
    const animacao = Animated.spring(posicao, { toValue: ativo, useNativeDriver: true, speed: 18, bounciness: 6 });
    animacao.start();
    return () => animacao.stop();
  }, [ativo, reduzido, posicao]);

  return (
    <View style={estilos.trilho} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      {larguraOpcao > 0 && ativo >= 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            estilos.pilula,
            {
              width: larguraOpcao,
              transform: [
                {
                  translateX: posicao.interpolate({
                    inputRange: [0, Math.max(opcoes.length - 1, 1)],
                    outputRange: [0, (larguraOpcao + VAO) * Math.max(opcoes.length - 1, 1)],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      {opcoes.map((opcao, indice) => {
        const selecionado = indice === ativo;

        return (
          <Pressable
            key={opcao}
            accessibilityRole="tab"
            accessibilityState={{ selected: selecionado }}
            onPress={() => onSelecionar(indice)}
            style={[estilos.opcao, selecionado && larguraOpcao === 0 && estilos.opcaoAtiva]}
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
    gap: VAO,
    backgroundColor: colors.disabled,
    borderRadius: 26,
    padding: RESPIRO,
  },
  pilula: {
    position: 'absolute',
    left: RESPIRO,
    top: RESPIRO,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.black,
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
