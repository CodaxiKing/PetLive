import { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tocavel, useMovimentoReduzido } from '../components/Animacoes';
import { Icone, type NomeIcone } from '../components/Icone';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { abrirRota, appsDeMapaInstalados, NOME_APP_MAPA, type AppMapa, type DestinoRota } from './acoes';
import { formatarDistancia } from './lugares';

const VISUAL: Record<AppMapa, { icone: NomeIcone; fundo: string; sub: string }> = {
  google: { icone: 'local', fundo: '#DDF3E6', sub: 'Abre a rota no app' },
  waze: { icone: 'carro', fundo: '#CFE8FB', sub: 'Abre a rota no app' },
  apple: { icone: 'rota', fundo: '#EBDDFB', sub: 'Abre a rota no app' },
  navegador: { icone: 'navegador', fundo: '#DDF3E6', sub: 'Google Maps no site, sem instalar nada' },
};

type Props = {
  /** Lugar da rota; null fecha a folha. */
  destino: (DestinoRota & { distanciaKm?: number }) | null;
  onFechar: () => void;
};

/**
 * Folha "Traçar rota com" (protótipos RotaApps e RotaSemApps, BUSINESS.md
 * 5.15): só os apps de mapa instalados; sem nenhum, abre no navegador. A
 * folha aparece mesmo com um app só, para o tutor confirmar.
 */
export function FolhaRota({ destino, onFechar }: Props) {
  const reduzido = useMovimentoReduzido();
  const [apps, setApps] = useState<AppMapa[] | null>(null);
  const subida = useState(() => new Animated.Value(1))[0];
  const aberta = destino !== null;

  useEffect(() => {
    if (!aberta) return;
    let vivo = true;
    appsDeMapaInstalados().then(
      (lista) => vivo && setApps(lista),
      () => vivo && setApps([]),
    );
    return () => {
      vivo = false;
    };
  }, [aberta]);

  useEffect(() => {
    if (!aberta) return;
    subida.setValue(reduzido ? 0 : 1);
    if (reduzido) return;
    Animated.spring(subida, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 4 }).start();
  }, [aberta, reduzido, subida]);

  const opcoes: AppMapa[] = apps === null ? [] : apps.length > 0 ? apps : ['navegador'];
  const distancia = formatarDistancia(destino?.distanciaKm);

  function escolher(app: AppMapa) {
    if (!destino) return;
    abrirRota(app, destino);
    onFechar();
  }

  return (
    <Modal visible={aberta} transparent animationType="fade" statusBarTranslucent onRequestClose={onFechar}>
      <Pressable style={estilos.fundo} onPress={onFechar} accessibilityLabel="Fechar" />
      <Animated.View
        style={[
          estilos.folha,
          { transform: [{ translateY: subida.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }) }] },
        ]}
      >
        <View style={estilos.alca} />
        <Text style={estilos.titulo} accessibilityRole="header">
          Traçar rota com
        </Text>
        <Text style={estilos.sub} numberOfLines={1}>
          {[destino?.nome, distancia].filter(Boolean).join(' · ')}
        </Text>

        <View style={estilos.lista}>
          {opcoes.map((app) => {
            const visual = VISUAL[app];
            return (
              <Tocavel
                key={app}
                accessibilityRole="button"
                accessibilityLabel={`${NOME_APP_MAPA[app]}. ${visual.sub}`}
                onPress={() => escolher(app)}
                escala={0.98}
                style={estilos.opcao}
              >
                <View style={[estilos.opcaoIcone, { backgroundColor: visual.fundo }]}>
                  <Icone nome={visual.icone} size={22} espessura={2} />
                </View>
                <View style={estilos.opcaoTexto}>
                  <Text style={estilos.opcaoNome}>{NOME_APP_MAPA[app]}</Text>
                  <Text style={estilos.opcaoSub}>{visual.sub}</Text>
                </View>
                <Icone nome="seta" size={18} cor={colors.textMuted} espessura={2} />
              </Tocavel>
            );
          })}
        </View>

        {apps !== null ? (
          <Text style={estilos.nota}>
            {apps.length > 0
              ? 'Mostramos só os apps de mapa que estão no seu celular.'
              : 'Não encontramos app de mapa no seu celular. Abrimos a rota no navegador.'}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={onFechar}
          style={({ pressed }) => [estilos.cancelar, pressed && { opacity: 0.6 }]}
        >
          <Text style={estilos.cancelarTexto}>Cancelar</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,17,17,0.45)' },
  folha: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  alca: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#D5DCE5', marginBottom: 18 },
  titulo: { fontFamily: fontFamily.bold, fontSize: 24, letterSpacing: -0.5, color: colors.black, paddingHorizontal: 4 },
  sub: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted, marginTop: 2, paddingHorizontal: 4 },
  lista: { gap: 10, marginTop: 14 },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.background,
    borderRadius: 32,
    padding: 8,
    paddingRight: 20,
  },
  opcaoIcone: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  opcaoTexto: { flex: 1, minWidth: 0 },
  opcaoNome: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  opcaoSub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted },
  nota: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 12,
  },
  cancelar: {
    marginTop: 14,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelarTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
});
