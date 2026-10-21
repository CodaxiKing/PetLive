import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutAnimation,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/**
 * Animações do protótipo (CSS dos .dc.html): cartões que sobem ao entrar
 * ("rise" 0,6 s, 18 px, 80 ms entre um e outro), mascote que flutua ("bob")
 * e barras que crescem da esquerda ("grow"). Com "reduzir movimento" ligado
 * no aparelho, tudo aparece parado.
 */

/** Curva cubic-bezier(.2,.7,.2,1) do protótipo. */
const CURVA = Easing.bezier(0.2, 0.7, 0.2, 1);

export function useMovimentoReduzido(): boolean {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduzido, () => undefined);
    const assinatura = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzido);
    return () => assinatura.remove();
  }, []);
  return reduzido;
}

/** Entra subindo e aparecendo; `indice` escalona a lista (máx. 5 passos, como no CSS). */
export function Surgir({
  children,
  indice = 0,
  style,
}: {
  children: ReactNode;
  indice?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduzido = useMovimentoReduzido();
  const progresso = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (reduzido) {
      progresso.setValue(1);
      return;
    }
    const animacao = Animated.timing(progresso, {
      toValue: 1,
      duration: 600,
      delay: Math.min(indice, 4) * 80,
      easing: CURVA,
      useNativeDriver: true,
    });
    animacao.start();
    return () => animacao.stop();
  }, [reduzido, indice, progresso]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progresso,
          transform: [{ translateY: progresso.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Flutua devagar para cima e para baixo (mascote, 3,4 s). */
export function Flutuar({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduzido = useMovimentoReduzido();
  const valor = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (reduzido) {
      valor.setValue(0);
      return;
    }
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(valor, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(valor, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [reduzido, valor]);

  return (
    <Animated.View
      style={[style, { transform: [{ translateY: valor.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

/** Barra de progresso que cresce da esquerda até `fracao` (0 a 1). */
export function BarraProgresso({
  fracao,
  cor,
  fundo,
  altura = 8,
}: {
  fracao: number;
  cor: string;
  fundo: string;
  altura?: number;
}) {
  const reduzido = useMovimentoReduzido();
  const valor = useState(() => new Animated.Value(0))[0];
  const alvo = Math.max(0, Math.min(1, fracao));

  useEffect(() => {
    if (reduzido) {
      valor.setValue(alvo);
      return;
    }
    const animacao = Animated.timing(valor, {
      toValue: alvo,
      duration: 1100,
      delay: 300,
      easing: CURVA,
      useNativeDriver: false,
    });
    animacao.start();
    return () => animacao.stop();
  }, [reduzido, alvo, valor]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(alvo * 100) }}
      style={{ height: altura, borderRadius: altura / 2, backgroundColor: fundo, overflow: 'hidden' }}
    >
      <Animated.View
        style={{
          height: altura,
          borderRadius: altura / 2,
          backgroundColor: cor,
          width: valor.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </Animated.View>
  );
}

/**
 * Pressable com "mola": encolhe um pouco ao tocar e volta com spring, como
 * os botões do protótipo (`:active { transform: scale(.97) }`).
 */
export function Tocavel({
  children,
  style,
  escala = 0.96,
  estiloExterno,
  ...props
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Estilo do Pressable de fora (ex.: flex: 1 numa linha). */
  estiloExterno?: StyleProp<ViewStyle>;
  /** Quanto encolhe ao tocar (1 = nada). */
  escala?: number;
}) {
  const reduzido = useMovimentoReduzido();
  const valor = useState(() => new Animated.Value(1))[0];

  const animar = (para: number) => {
    if (reduzido) return;
    Animated.spring(valor, { toValue: para, useNativeDriver: true, speed: 40, bounciness: para === 1 ? 8 : 0 }).start();
  };

  return (
    <Pressable
      {...props}
      style={estiloExterno}
      onPressIn={(e) => {
        animar(escala);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animar(1);
        props.onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale: valor }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Balanço lento dos desenhos brancos do herói (protótipo: "sway" 5 s, ±7°). */
export function Balancar({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduzido = useMovimentoReduzido();
  const valor = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (reduzido) {
      valor.setValue(0);
      return;
    }
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(valor, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(valor, { toValue: -1, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [reduzido, valor]);

  return (
    <Animated.View
      style={[
        style,
        { transform: [{ rotate: valor.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Entra subindo de baixo (cartões que aparecem sobre o mapa). */
export function Deslizar({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduzido = useMovimentoReduzido();
  const valor = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (reduzido) {
      valor.setValue(1);
      return;
    }
    const animacao = Animated.spring(valor, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 6 });
    animacao.start();
    return () => animacao.stop();
  }, [reduzido, valor]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: valor.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [{ translateY: valor.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Anima a próxima mudança de layout (item que entra, sai ou muda de lugar). */
export function animarLista() {
  LayoutAnimation.configureNext({
    duration: 280,
    create: { type: 'easeInEaseOut', property: 'opacity' },
    update: { type: 'spring', springDamping: 0.8 },
    delete: { type: 'easeInEaseOut', property: 'opacity' },
  });
}
