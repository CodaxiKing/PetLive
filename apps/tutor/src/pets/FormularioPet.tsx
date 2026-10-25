import type { ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { Campo } from '../components/Campo';
import { ControleSegmentado } from '../components/ControleSegmentado';
import { MarcaPata } from '../components/MarcaPata';
import { Mascote } from '../components/Mascote';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { pedirFoto, type AtivoFoto } from './CampoFoto';
import type { Especie, PetForm } from './types';

const ESPECIES: { valor: Especie; rotulo: string; fundo: string }[] = [
  { valor: 'cao', rotulo: 'Cão', fundo: colors.primarySurface },
  { valor: 'gato', rotulo: 'Gato', fundo: '#EADCFB' },
];
const SEXOS = ['Macho', 'Fêmea'] as const;
const CASTRADO = ['Sim', 'Não'] as const;

type Props = {
  form: PetForm;
  onChange: (campo: keyof PetForm, valor: string | boolean) => void;
  titulo: string;
  /** Cadastro em dois passos; sem passo, mostra tudo (edição). */
  passo?: 1 | 2;
  /** Foto atual: URI local nova ou URL pública já salva. */
  foto?: string | null;
  /** Chamado quando o tutor escolhe (ou remove) a foto. */
  onFoto?: (ativo: AtivoFoto | null) => void;
  /** Volta (passo 2 volta ao 1); o padrão fecha a tela. */
  onVoltar?: () => void;
  children?: ReactNode;
};

function Rotulo({ children }: { children: string }) {
  return <Text style={estilos.rotulo}>{children}</Text>;
}

/**
 * Formulário do pet (protótipo PerfilPet, "Conheça seu pet"): herói com o
 * mascote da espécie ou a foto e o botão da câmera; nome, espécie, raça e
 * nascimento no passo 1; sexo, peso e castração no passo 2.
 */
export function FormularioPet({ form, onChange, titulo, passo, foto, onFoto, onVoltar }: Props) {
  const { width } = useWindowDimensions();
  const mostrar1 = passo !== 2;
  const mostrar2 = passo !== 1;

  return (
    <ScrollView
      style={estilos.flex}
      contentContainerStyle={estilos.conteudo}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={estilos.heroi}>
        <MarcaPata size={110} style={estilos.pata} />
        <View style={estilos.retrato}>
          {foto ? (
            <Image source={{ uri: foto }} style={estilos.foto} accessibilityLabel="Foto do pet" />
          ) : (
            <Mascote especie={form.especie} size={250} recorte />
          )}
        </View>

        <View style={estilos.topo}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={8}
            onPress={onVoltar ?? (() => router.back())}
            style={estilos.voltar}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 5l-7 7 7 7" stroke={colors.black} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          {passo ? <Text style={estilos.passo}>Passo {passo} de 2</Text> : null}
        </View>

        {onFoto ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={foto ? 'Trocar a foto do pet' : 'Adicionar foto do pet'}
            onPress={() => pedirFoto(onFoto, Boolean(foto))}
            style={estilos.camera}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.black} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <Path d="M15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z" />
            </Svg>
          </Pressable>
        ) : null}

        <Svg style={estilos.onda} width={width} height={46} viewBox="0 0 390 46" preserveAspectRatio="none">
          <Path
            d="M0 46V26C28 8 56 10 80 24C104 38 132 40 154 26C180 8 214 10 238 26C262 42 300 38 322 22C346 6 372 12 390 24V46z"
            fill={colors.surface}
          />
        </Svg>
      </View>

      <View style={estilos.corpo}>
        <Text style={estilos.titulo} accessibilityRole="header">
          {titulo}
        </Text>

        {mostrar1 ? (
          <>
            <Campo rotulo="Nome" placeholder="Ex.: Rex" value={form.nome} onChangeText={(v) => onChange('nome', v)} />

            <View style={estilos.especies}>
              {ESPECIES.map((especie) => {
                const ativa = form.especie === especie.valor;
                return (
                  <Pressable
                    key={especie.valor}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: ativa }}
                    onPress={() => onChange('especie', especie.valor)}
                    style={[estilos.especie, ativa && estilos.especieAtiva]}
                  >
                    <View style={[estilos.especieAvatar, { backgroundColor: especie.fundo }]}>
                      <Mascote especie={especie.valor} size={46} recorte />
                    </View>
                    <Text style={[estilos.especieTexto, ativa && estilos.especieTextoAtivo]}>{especie.rotulo}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={estilos.linha}>
              <View style={estilos.flex}>
                <Campo
                  rotulo="Raça"
                  variante="roxo"
                  placeholder={form.especie === 'gato' ? 'SRD' : 'Labrador'}
                  value={form.raca}
                  onChangeText={(v) => onChange('raca', v)}
                />
              </View>
              <View style={estilos.flex}>
                <Campo
                  rotulo="Nascimento"
                  variante="azul"
                  mascara="data"
                  placeholder="dd/mm/aaaa"
                  value={form.nascimento}
                  onChangeText={(v) => onChange('nascimento', v)}
                />
              </View>
            </View>
          </>
        ) : null}

        {mostrar2 ? (
          <>
            <Rotulo>Sexo</Rotulo>
            <ControleSegmentado
              opcoes={[...SEXOS]}
              ativo={form.sexo === 'macho' ? 0 : 1}
              onSelecionar={(i) => onChange('sexo', i === 0 ? 'macho' : 'femea')}
            />

            <Campo
              rotulo="Peso (kg)"
              variante="verde"
              placeholder="Ex.: 8,5"
              keyboardType="decimal-pad"
              value={form.peso}
              onChangeText={(v) => onChange('peso', v)}
            />

            <Rotulo>Castrado</Rotulo>
            <ControleSegmentado
              opcoes={[...CASTRADO]}
              ativo={form.castrado ? 0 : 1}
              onSelecionar={(i) => onChange('castrado', CASTRADO[i] === 'Sim')}
            />
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingBottom: 130 },
  heroi: { height: 300, backgroundColor: colors.hero, overflow: 'hidden' },
  pata: { position: 'absolute', right: 24, top: 56 },
  retrato: { position: 'absolute', left: 0, right: 0, bottom: 6, alignItems: 'center' },
  foto: { width: 200, height: 200, borderRadius: 100, marginBottom: 30, borderWidth: 4, borderColor: colors.white },
  topo: { position: 'absolute', left: 24, top: 56, flexDirection: 'row', alignItems: 'center', gap: 10 },
  voltar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passo: {
    fontSize: 14,
    fontFamily: fontFamily.semiBold,
    color: colors.black,
    backgroundColor: colors.white,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  camera: {
    position: 'absolute',
    right: '24%',
    bottom: 64,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onda: { position: 'absolute', left: 0, bottom: -1 },
  corpo: { paddingHorizontal: 24, gap: 12 },
  titulo: {
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1,
    fontFamily: fontFamily.medium,
    color: colors.black,
    marginBottom: 4,
  },
  rotulo: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.black, marginTop: 4 },
  especies: { flexDirection: 'row', gap: 10 },
  especie: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 8,
    backgroundColor: colors.white,
  },
  especieAtiva: { backgroundColor: colors.black, borderColor: colors.black },
  especieAvatar: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  especieTexto: { fontSize: 17, fontFamily: fontFamily.semiBold, color: colors.black },
  especieTextoAtivo: { color: colors.white },
  linha: { flexDirection: 'row', gap: 10 },
});
