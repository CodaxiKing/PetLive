import type { ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft';
import { Camera } from 'phosphor-react-native/src/icons/Camera';
import { Cat } from 'phosphor-react-native/src/icons/Cat';
import { Dog } from 'phosphor-react-native/src/icons/Dog';
import { Campo } from '../components/Campo';
import { Mascote } from '../components/Mascote';
import { colors } from '../theme/colors';
import { shadow } from '../theme/tokens';
import { fontFamily } from '../theme/typography';
import { pedirFoto, type AtivoFoto } from './CampoFoto';
import type { Especie, PetForm } from './types';
import { SugestoesRaca } from './SugestoesRaca';

const ESPECIES: { valor: Especie; rotulo: string }[] = [
  { valor: 'cao', rotulo: 'Cão' },
  { valor: 'gato', rotulo: 'Gato' },
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

/** Pílulas de escolha única (sexo e castração), como no protótipo. */
function Pilulas({ opcoes, ativo, onSelecionar }: { opcoes: readonly string[]; ativo: number; onSelecionar: (i: number) => void }) {
  return (
    <View style={estilos.pilulas} accessibilityRole="radiogroup">
      {opcoes.map((opcao, i) => (
        <Pressable
          key={opcao}
          accessibilityRole="radio"
          accessibilityState={{ checked: i === ativo }}
          onPress={() => onSelecionar(i)}
          style={[estilos.pilula, i === ativo && estilos.pilulaAtiva]}
        >
          <Text style={[estilos.pilulaTexto, i === ativo && estilos.pilulaTextoAtivo]}>{opcao}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Formulário do pet ("Conheça seu pet"), na versão 2 do protótipo
 * (CadastroPet): voltar e barra de passos no alto, título, a foto ao lado
 * do nome, Cão ou Gato em abas, e sexo e castração em pílulas. Nome,
 * espécie, raça e nascimento no passo 1; sexo, peso e castração no passo 2.
 */
export function FormularioPet({ form, onChange, titulo, passo, foto, onFoto, onVoltar }: Props) {
  const mostrar1 = passo !== 2;
  const mostrar2 = passo !== 1;
  const nome = form.nome.trim();
  const subtitulo =
    passo === 1
      ? 'Com estes dados o app sugere o calendário de vacinas.'
      : passo === 2
        ? 'O peso ajuda a acertar a dose dos remédios.'
        : null;

  return (
    <ScrollView
      style={estilos.flex}
      contentContainerStyle={estilos.conteudo}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={estilos.topo}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={8}
          onPress={onVoltar ?? (() => router.back())}
          style={({ pressed }) => [estilos.voltar, pressed && { opacity: 0.7 }]}
        >
          <ArrowLeft size={22} color={colors.black} />
        </Pressable>
        {passo ? (
          <>
            <View style={estilos.trilho} accessibilityLabel={`Passo ${passo} de 2`}>
              <View style={[estilos.progresso, { width: passo === 1 ? '50%' : '100%' }]} />
            </View>
            <Text style={estilos.passo}>{passo} de 2</Text>
          </>
        ) : null}
      </View>

      <View style={estilos.corpo}>
        <Text style={estilos.titulo} accessibilityRole="header">
          {titulo}
        </Text>
        {subtitulo ? <Text style={estilos.subtitulo}>{subtitulo}</Text> : null}

        {mostrar1 && onFoto ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={foto ? 'Trocar a foto do pet' : 'Adicionar foto do pet'}
            onPress={() => pedirFoto(onFoto, Boolean(foto))}
            style={estilos.fotoLinha}
          >
            <View style={estilos.retrato}>
              {foto ? (
                <Image source={{ uri: foto }} style={estilos.foto} accessibilityLabel="Foto do pet" />
              ) : (
                <Mascote especie={form.especie} size={96} recorte />
              )}
              <View style={estilos.camera}>
                <Camera size={18} color={colors.white} />
              </View>
            </View>
            <View style={estilos.flex}>
              <Text style={estilos.fotoTitulo} numberOfLines={1}>
                {nome ? `Foto ${form.sexo === 'femea' ? 'da' : 'do'} ${nome}` : 'Foto do pet'}
              </Text>
              <Text style={estilos.fotoSub}>{foto ? 'Toque para trocar' : 'Toque para adicionar (opcional)'}</Text>
            </View>
          </Pressable>
        ) : null}

        {mostrar1 ? (
          <>
            <View style={estilos.especies} accessibilityRole="radiogroup">
              {ESPECIES.map((especie) => {
                const ativa = form.especie === especie.valor;
                const Desenho = especie.valor === 'cao' ? Dog : Cat;
                return (
                  <Pressable
                    key={especie.valor}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: ativa }}
                    onPress={() => onChange('especie', especie.valor)}
                    style={[estilos.especie, ativa && estilos.especieAtiva]}
                  >
                    <Desenho size={20} color={ativa ? colors.black : colors.textMuted} weight={ativa ? 'bold' : 'regular'} />
                    <Text style={[estilos.especieTexto, ativa && estilos.especieTextoAtiva]}>{especie.rotulo}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Campo rotulo="Nome" placeholder="Ex.: Rex" value={form.nome} onChangeText={(v) => onChange('nome', v)} />

            <View style={estilos.linha}>
              <View style={estilos.flex}>
                <Campo
                  rotulo="Raça (opcional)"
                  placeholder={form.especie === 'gato' ? 'SRD' : 'Labrador'}
                  value={form.raca}
                  onChangeText={(v) => onChange('raca', v)}
                />
              </View>
              <View style={estilos.flex}>
                <Campo
                  rotulo="Nascimento"
                  mascara="data"
                  placeholder="dd/mm/aaaa"
                  value={form.nascimento}
                  onChangeText={(v) => onChange('nascimento', v)}
                />
              </View>
            </View>
            <SugestoesRaca especie={form.especie} busca={form.raca} onSelecionar={(nome) => onChange('raca', nome)} />
          </>
        ) : null}

        {mostrar2 ? (
          <>
            <Rotulo>Sexo</Rotulo>
            <Pilulas
              opcoes={SEXOS}
              ativo={form.sexo === 'macho' ? 0 : 1}
              onSelecionar={(i) => onChange('sexo', i === 0 ? 'macho' : 'femea')}
            />

            <Campo
              rotulo="Peso (kg)"
              placeholder="Ex.: 8,5"
              keyboardType="decimal-pad"
              value={form.peso}
              onChangeText={(v) => onChange('peso', v)}
            />

            <Rotulo>Castrado</Rotulo>
            <Pilulas
              opcoes={CASTRADO}
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
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 20 },
  voltar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  trilho: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  progresso: { height: 6, borderRadius: 3, backgroundColor: colors.black },
  passo: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.textMuted },
  corpo: { paddingHorizontal: 24, gap: 12 },
  titulo: {
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.2,
    fontFamily: fontFamily.bold,
    color: colors.black,
  },
  subtitulo: { fontSize: 15, lineHeight: 22, fontFamily: fontFamily.regular, color: colors.textMuted, marginTop: -6, marginBottom: 4 },
  fotoLinha: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 4 },
  retrato: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  foto: { width: 96, height: 96, borderRadius: 28 },
  camera: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.black,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoTitulo: { fontSize: 17, fontFamily: fontFamily.bold, color: colors.black },
  fotoSub: { fontSize: 14, fontFamily: fontFamily.regular, color: colors.textMuted, marginTop: 2 },
  rotulo: { fontSize: 14, fontFamily: fontFamily.semiBold, color: colors.textMuted, marginTop: 4, marginLeft: 4 },
  especies: { flexDirection: 'row', gap: 6, backgroundColor: '#E7EAF0', borderRadius: 999, padding: 4 },
  especie: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
  },
  especieAtiva: { backgroundColor: colors.white, ...shadow.card },
  especieTexto: { fontSize: 15, fontFamily: fontFamily.semiBold, color: colors.textMuted },
  especieTextoAtiva: { color: colors.black },
  linha: { flexDirection: 'row', gap: 10 },
  pilulas: { flexDirection: 'row', gap: 8 },
  pilula: {
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pilulaAtiva: { backgroundColor: colors.black, borderColor: colors.black },
  pilulaTexto: { fontSize: 15, fontFamily: fontFamily.semiBold, color: colors.black },
  pilulaTextoAtivo: { color: colors.white },
});
