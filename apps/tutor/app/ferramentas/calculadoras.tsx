import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { ControleSegmentado } from '../../src/components/ControleSegmentado';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone } from '../../src/components/Icone';
import {
  anosDesde,
  diferencaDaFaixa,
  faseDaVida,
  formatarKg,
  idadeHumana,
  lerNumero,
  pesoIdeal,
  porcaoDiaria,
  portePeloPeso,
  ROTULO_ATIVIDADE,
  ROTULO_FASE,
  ROTULO_PORTE,
  type Atividade,
  type Especie,
  type Fase,
  type Porte,
} from '../../src/ferramentas/calculos';
import { usePets } from '../../src/pets/PetsProvider';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';

const ABAS = ['Idade', 'Ração', 'Peso'];
const ABA_IDADE = 0;
const ABA_RACAO = 1;
const ABA_PESO = 2;

/** Caixa de campo do protótipo: rótulo pequeno cinza e o valor embaixo. */
function Caixa({ rotulo, children, flex }: { rotulo: string; children: ReactNode; flex?: boolean }) {
  return (
    <View style={[estilos.caixa, flex && estilos.flex]}>
      <Text style={estilos.caixaRotulo}>{rotulo}</Text>
      {children}
    </View>
  );
}

/** Opções em pílulas dentro de uma caixa (espécie, porte, fase, atividade). */
function Opcoes<T extends string>({
  opcoes,
  valor,
  onEscolher,
}: {
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  onEscolher: (valor: T) => void;
}) {
  return (
    <View style={estilos.opcoes}>
      {opcoes.map((opcao) => {
        const ativa = opcao.valor === valor;
        return (
          <Pressable
            key={opcao.valor}
            accessibilityRole="radio"
            accessibilityState={{ checked: ativa }}
            onPress={() => onEscolher(opcao.valor)}
            hitSlop={4}
            style={[estilos.opcao, ativa && estilos.opcaoAtiva]}
          >
            <Text style={[estilos.opcaoTexto, ativa && estilos.opcaoTextoAtiva]}>{opcao.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function paraOpcoes<T extends string>(rotulos: Record<T, string>): { valor: T; rotulo: string }[] {
  return (Object.keys(rotulos) as T[]).map((valor) => ({ valor, rotulo: rotulos[valor] }));
}

const ESPECIES = paraOpcoes<Especie>({ cao: 'Cão', gato: 'Gato' });
const PORTES = paraOpcoes(ROTULO_PORTE);
const FASES = paraOpcoes(ROTULO_FASE);
const ATIVIDADES = paraOpcoes(ROTULO_ATIVIDADE);
const SIM_NAO = paraOpcoes<'sim' | 'nao'>({ sim: 'Sim', nao: 'Não' });

/**
 * Calculadoras (tela 50, protótipo Calculadoras; board P2 "Calculadora de
 * idade em anos humanos", "de porção diária de ração" e "de peso ideal").
 * Escolher um pet preenche os campos; tudo é calculado no aparelho.
 */
export default function Calculadoras() {
  const { pets } = usePets();

  const [aba, setAba] = useState(ABA_RACAO);
  const [petId, setPetId] = useState<string | null>(null);
  const [especie, setEspecie] = useState<Especie>('cao');
  const [porte, setPorte] = useState<Porte>('medio');
  const [anosTexto, setAnosTexto] = useState('');
  const [pesoTexto, setPesoTexto] = useState('');
  const [raca, setRaca] = useState('');
  const [castrado, setCastrado] = useState(true);
  const [atividade, setAtividade] = useState<Atividade>('normal');
  /** null = fase pela idade; o tutor pode escolher outra. */
  const [faseEscolhida, setFaseEscolhida] = useState<Fase | null>(null);
  const [calculado, setCalculado] = useState(false);

  // Começa com o primeiro pet, se houver.
  useEffect(() => {
    if (petId === null && pets.length > 0) escolherPet(pets[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pets]);

  function escolherPet(id: string | null) {
    setPetId(id ?? '');
    setFaseEscolhida(null);
    const pet = pets.find((p) => p.id === id);
    if (!pet) return;
    setEspecie(pet.especie);
    setRaca(pet.raca ?? '');
    if (pet.castrado !== null) setCastrado(pet.castrado);
    const anos = anosDesde(pet.nascimento);
    setAnosTexto(anos === null ? '' : formatarKg(anos));
    if (pet.peso_atual) {
      setPesoTexto(formatarKg(pet.peso_atual));
      setPorte(portePeloPeso(pet.peso_atual));
    }
  }

  const anos = lerNumero(anosTexto);
  const peso = lerNumero(pesoTexto);
  const faseAuto = Number.isFinite(anos) ? faseDaVida(especie, porte, anos) : 'adulto';
  const fase = faseEscolhida ?? faseAuto;

  const resultados = useMemo(() => {
    const idade = Number.isFinite(anos) ? idadeHumana(especie, porte, anos) : null;
    const porcao = Number.isFinite(peso)
      ? porcaoDiaria({ especie, pesoKg: peso, fase, atividade, castrado, anos: Number.isFinite(anos) ? anos : 3 })
      : null;
    const ideal = pesoIdeal(especie, porte, raca);
    return { idade, porcao, ideal };
  }, [anos, peso, especie, porte, fase, atividade, castrado, raca]);

  const pet = pets.find((p) => p.id === petId);
  const diferenca = Number.isFinite(peso) ? diferencaDaFaixa(peso, resultados.ideal.faixa) : null;

  function calcular() {
    Keyboard.dismiss();
    setCalculado(true);
  }

  const textoFaixa = `${formatarKg(resultados.ideal.faixa[0])} a ${formatarKg(resultados.ideal.faixa[1])} kg`;
  const textoIdade = resultados.idade === null ? '—' : `${resultados.idade} anos`;

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo="Ferramentas" titulo="Calculadoras" />

      <ScrollView
        contentContainerStyle={estilos.conteudo}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ControleSegmentado opcoes={ABAS} ativo={aba} onSelecionar={setAba} />

        <Caixa rotulo="Pet">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.opcoes}>
            {pets.map((p) => {
              const ativo = p.id === petId;
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: ativo }}
                  onPress={() => escolherPet(p.id)}
                  style={[estilos.opcao, ativo && estilos.opcaoAtiva]}
                >
                  <Text style={[estilos.opcaoTexto, ativo && estilos.opcaoTextoAtiva]}>
                    {p.nome} · {p.especie === 'cao' ? 'cão' : 'gato'}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: !pet }}
              onPress={() => escolherPet(null)}
              style={[estilos.opcao, !pet && estilos.opcaoAtiva]}
            >
              <Text style={[estilos.opcaoTexto, !pet && estilos.opcaoTextoAtiva]}>Outro pet</Text>
            </Pressable>
          </ScrollView>
        </Caixa>

        {pet ? null : (
          <Caixa rotulo="Espécie">
            <Opcoes opcoes={ESPECIES} valor={especie} onEscolher={setEspecie} />
          </Caixa>
        )}

        <View style={estilos.linha}>
          <Caixa rotulo="Peso (kg)" flex>
            <TextInput
              value={pesoTexto}
              onChangeText={(texto) => {
                setPesoTexto(texto);
                const kg = lerNumero(texto);
                if (Number.isFinite(kg) && kg > 0) setPorte(portePeloPeso(kg));
              }}
              keyboardType="decimal-pad"
              placeholder="Ex.: 12"
              placeholderTextColor={colors.textMuted}
              style={estilos.entrada}
              accessibilityLabel="Peso em quilos"
            />
          </Caixa>
          <Caixa rotulo="Idade (anos)" flex>
            <TextInput
              value={anosTexto}
              onChangeText={(texto) => {
                setAnosTexto(texto);
                setFaseEscolhida(null);
              }}
              keyboardType="decimal-pad"
              placeholder="Ex.: 3"
              placeholderTextColor={colors.textMuted}
              style={estilos.entrada}
              accessibilityLabel="Idade em anos"
            />
          </Caixa>
        </View>

        {especie === 'cao' && aba !== ABA_RACAO ? (
          <Caixa rotulo="Porte">
            <Opcoes opcoes={PORTES} valor={porte} onEscolher={setPorte} />
          </Caixa>
        ) : null}

        {aba === ABA_RACAO ? (
          <>
            <Caixa rotulo="Fase">
              <Opcoes opcoes={FASES} valor={fase} onEscolher={setFaseEscolhida} />
            </Caixa>
            <Caixa rotulo="Atividade">
              <Opcoes opcoes={ATIVIDADES} valor={atividade} onEscolher={setAtividade} />
            </Caixa>
            <Caixa rotulo="Castrado">
              <Opcoes
                opcoes={SIM_NAO}
                valor={castrado ? 'sim' : 'nao'}
                onEscolher={(v) => setCastrado(v === 'sim')}
              />
            </Caixa>
          </>
        ) : null}

        {aba === ABA_PESO ? (
          <Caixa rotulo="Raça (opcional)">
            <TextInput
              value={raca}
              onChangeText={setRaca}
              placeholder="Ex.: Shih Tzu, SRD"
              placeholderTextColor={colors.textMuted}
              style={estilos.entrada}
              autoCapitalize="words"
              accessibilityLabel="Raça"
            />
          </Caixa>
        ) : null}

        {calculado ? (
          <>
            <View style={estilos.resultado} accessibilityLiveRegion="polite">
              {aba === ABA_RACAO ? (
                resultados.porcao ? (
                  <>
                    <Text style={estilos.resultadoRotulo}>Porção diária estimada</Text>
                    <Text style={estilos.resultadoValor}>{resultados.porcao.gramasDia} g</Text>
                    <Text style={estilos.resultadoDetalhe}>
                      Em {resultados.porcao.refeicoes} refeições, cerca de {resultados.porcao.gramasRefeicao} g cada
                    </Text>
                  </>
                ) : (
                  <Text style={estilos.resultadoDetalhe}>Informe o peso para estimar a porção.</Text>
                )
              ) : aba === ABA_IDADE ? (
                <>
                  <Text style={estilos.resultadoRotulo}>Idade em anos humanos</Text>
                  <Text style={estilos.resultadoValor}>{textoIdade}</Text>
                  <Text style={estilos.resultadoDetalhe}>
                    {resultados.idade === null
                      ? 'Informe a idade do pet.'
                      : `Fase: ${ROTULO_FASE[faseAuto].toLowerCase()}`}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={estilos.resultadoRotulo}>
                    Peso ideal {resultados.ideal.origem === 'raca' ? 'da raça' : resultados.ideal.origem === 'porte' ? `do porte ${ROTULO_PORTE[porte].toLowerCase()}` : 'de gatos'}
                  </Text>
                  <Text style={estilos.resultadoValor}>{textoFaixa}</Text>
                  <Text style={estilos.resultadoDetalhe}>
                    {diferenca === null
                      ? 'Informe o peso atual para comparar.'
                      : diferenca === 0
                        ? `Peso atual ${formatarKg(peso)} kg: dentro da faixa.`
                        : `Peso atual ${formatarKg(peso)} kg: ${formatarKg(Math.abs(diferenca))} kg ${diferenca > 0 ? 'acima' : 'abaixo'}. Converse com o veterinário.`}
                  </Text>
                </>
              )}
            </View>

            <View style={estilos.linha}>
              {aba !== ABA_IDADE ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAba(ABA_IDADE)}
                  style={[estilos.mini, { backgroundColor: '#EADCFB' }]}
                >
                  <Text style={[estilos.miniRotulo, { color: '#5B3E8A' }]}>Idade humana</Text>
                  <Text style={estilos.miniValor}>{textoIdade}</Text>
                </Pressable>
              ) : null}
              {aba !== ABA_RACAO ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAba(ABA_RACAO)}
                  style={[estilos.mini, { backgroundColor: '#D8F2E3' }]}
                >
                  <Text style={[estilos.miniRotulo, { color: '#1F6B45' }]}>Ração por dia</Text>
                  <Text style={estilos.miniValor}>
                    {resultados.porcao ? `${resultados.porcao.gramasDia} g` : '—'}
                  </Text>
                </Pressable>
              ) : null}
              {aba !== ABA_PESO ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAba(ABA_PESO)}
                  style={[estilos.mini, { backgroundColor: '#E0F1FA' }]}
                >
                  <Text style={[estilos.miniRotulo, { color: colors.primaryDark }]}>Peso ideal</Text>
                  <Text style={estilos.miniValor}>{textoFaixa}</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        <Text style={estilos.nota}>
          São estimativas. Siga a embalagem da ração e a orientação do veterinário.
        </Text>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Calcular" icone={<Icone nome="calculadora" size={22} />} onPress={calcular} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  conteudo: { paddingHorizontal: 24, paddingBottom: spacing.lg, gap: 10 },
  linha: { flexDirection: 'row', gap: 8 },
  caixa: { backgroundColor: '#F5F6FA', borderRadius: 20, paddingVertical: 9, paddingHorizontal: 16, gap: 4 },
  caixaRotulo: { fontSize: 11, fontFamily: typography.h1.fontFamily, color: '#6A7484' },
  entrada: {
    fontSize: 14,
    fontFamily: typography.label.fontFamily,
    color: colors.black,
    paddingVertical: 0,
  },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  opcao: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: colors.white,
  },
  opcaoAtiva: { backgroundColor: colors.black },
  opcaoTexto: { fontSize: 13, fontFamily: typography.label.fontFamily, color: colors.black },
  opcaoTextoAtiva: { color: colors.white },
  resultado: { backgroundColor: '#D8F2E3', borderRadius: 26, paddingVertical: 16, paddingHorizontal: 18 },
  resultadoRotulo: { fontSize: 12, fontFamily: typography.h1.fontFamily, color: '#1F6B45' },
  resultadoValor: {
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.black,
  },
  resultadoDetalhe: { fontSize: 13, lineHeight: 18, fontFamily: typography.caption.fontFamily, color: '#1F6B45' },
  mini: { flex: 1, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14 },
  miniRotulo: { fontSize: 11, fontFamily: typography.h1.fontFamily },
  miniValor: { fontSize: 18, lineHeight: 24, fontFamily: typography.h1.fontFamily, color: colors.black },
  nota: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: typography.small.fontFamily,
    color: '#6A7484',
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
});
