import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Tocavel } from '../../../src/components/Animacoes';
import { BotaoPrimario } from '../../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../../src/components/HeroiOnda';
import { Icone } from '../../../src/components/Icone';
import { mascaraData } from '../../../src/lib/mascaras';
import { usePets } from '../../../src/pets/PetsProvider';
import { supabase } from '../../../src/lib/supabase';
import { esquecerLeitura, linhasDaLeitura, marcarJaCadastradas, pegarLeitura, salvarRevisao, validarRevisao, type LinhaRevisao } from '../../../src/saude/leituraCartao';
import { useVacinas } from '../../../src/saude/VacinasProvider';
import { colors } from '../../../src/theme/colors';
import { fontFamily } from '../../../src/theme/typography';

/**
 * Revisar as vacinas lidas da foto do cartão (protótipo CartaoRevisar, tela 53).
 * Nada é salvo antes de o tutor conferir: cada linha pode ser editada ou desmarcada.
 */
export default function RevisarVacinas() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pets } = usePets();
  const { recarregar } = useVacinas();
  const pet = pets.find((p) => p.id === id);
  const [leitura] = useState(() => (id ? pegarLeitura(id) : null));
  const [linhas, setLinhas] = useState<LinhaRevisao[]>(() => (leitura ? linhasDaLeitura(leitura) : []));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Compara com o histórico do pet: o que já existe vai para "Já cadastradas".
  useEffect(() => {
    if (!id || !leitura) return;
    let vivo = true;
    Promise.resolve(supabase.from('vaccinations').select('nome, aplicada_em').eq('pet_id', id)).then(({ data }) => {
      if (vivo && data) setLinhas((atual) => marcarJaCadastradas(atual, data as { nome: string; aplicada_em: string }[]));
    });
    return () => {
      vivo = false;
    };
  }, [id, leitura]);

  const mudar = (i: number, campo: keyof LinhaRevisao, valor: string | boolean) =>
    setLinhas((atual) => atual.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  async function salvar() {
    if (!id) return;
    const problema = validarRevisao(linhas);
    setErro(problema);
    if (problema) return;
    setSalvando(true);
    try {
      const total = await salvarRevisao(id, linhas);
      esquecerLeitura(id);
      await recarregar();
      Alert.alert('Vacinas salvas', `${total} ${total === 1 ? 'vacina entrou' : 'vacinas entraram'} na carteirinha de ${pet?.nome ?? 'seu pet'}.`);
      router.back();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  const novas = linhas.filter((l) => !l.jaCadastrada);
  const jaTem = linhas.length - novas.length;
  const marcadas = novas.filter((l) => l.incluir).length;

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo={pet ? `Cartão do ${pet.nome}` : 'Cartão de vacina'} titulo="Revisar vacinas lidas" altura={196} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!leitura ? (
          <Text style={estilos.texto}>A leitura não está mais disponível. Fotografe o cartão de novo.</Text>
        ) : !leitura.legivel || linhas.length === 0 ? (
          <Text style={estilos.texto}>Não encontramos vacinas legíveis nesta foto. Tente outra foto com boa luz, ou registre as vacinas à mão.</Text>
        ) : (
          <>
            <Text style={estilos.texto}>
              {novas.length === 0
                ? `${pet?.nome ?? 'O pet'} já tem todas estas vacinas. Não há nada novo para salvar.`
                : `${novas.length} ${novas.length === 1 ? 'nova' : 'novas'}${jaTem ? ` · ${jaTem} já ${jaTem === 1 ? 'cadastrada' : 'cadastradas'}` : ''}. Confira nome, datas e lote. As marcadas com “Confira” tinham letra difícil ou data faltando.`}
            </Text>
            {novas.length ? <Text style={estilos.grupo}>Novas para adicionar</Text> : null}
            {linhas.map((l, i) => (l.jaCadastrada ? null : (
              <View key={i} style={[estilos.cartao, !l.incluir && estilos.cartaoFora]}>
                <View style={estilos.linhaTopo}>
                  <Tocavel
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: l.incluir }}
                    accessibilityLabel={`Incluir ${l.nome}`}
                    onPress={() => mudar(i, 'incluir', !l.incluir)}
                    style={[estilos.check, l.incluir && estilos.checkMarcado]}
                  >
                    {l.incluir ? <Icone nome="check" size={14} cor={colors.white} espessura={3} /> : null}
                  </Tocavel>
                  <TextInput
                    value={l.nome}
                    onChangeText={(v) => mudar(i, 'nome', v)}
                    accessibilityLabel="Nome da vacina"
                    style={estilos.nome}
                    maxLength={80}
                  />
                  {l.conferir ? <Text style={estilos.conferir}>Confira</Text> : null}
                </View>
                <View style={estilos.campos}>
                  <View style={estilos.campo}>
                    <Text style={estilos.rotulo}>Aplicada</Text>
                    <TextInput
                      value={l.aplicada}
                      onChangeText={(v) => mudar(i, 'aplicada', mascaraData(v))}
                      placeholder="dd/mm/aaaa"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      accessibilityLabel={`Data aplicada de ${l.nome}`}
                      style={estilos.valor}
                    />
                  </View>
                  <View style={estilos.campo}>
                    <Text style={estilos.rotulo}>Próxima</Text>
                    <TextInput
                      value={l.proxima}
                      onChangeText={(v) => mudar(i, 'proxima', mascaraData(v))}
                      placeholder="dd/mm/aaaa"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      accessibilityLabel={`Próxima dose de ${l.nome}`}
                      style={estilos.valor}
                    />
                  </View>
                  <View style={estilos.campo}>
                    <Text style={estilos.rotulo}>Lote</Text>
                    <TextInput
                      value={l.lote}
                      onChangeText={(v) => mudar(i, 'lote', v)}
                      placeholder="—"
                      placeholderTextColor={colors.textMuted}
                      accessibilityLabel={`Lote de ${l.nome}`}
                      style={estilos.valor}
                      maxLength={40}
                    />
                  </View>
                </View>
              </View>
            )))}
            {jaTem ? (
              <>
                <Text style={estilos.grupo}>Já cadastradas</Text>
                {linhas.filter((l) => l.jaCadastrada).map((l, i) => (
                  <View key={`ja-${i}`} style={estilos.jaCadastrada}>
                    <Icone nome="check" size={16} cor={colors.successText} espessura={2.4} />
                    <Text style={estilos.jaTexto}>{l.nome} · {l.aplicada}</Text>
                  </View>
                ))}
              </>
            ) : null}
            <Text style={estilos.nota}>
              A foto não foi guardada. Restam {leitura.restantes} {leitura.restantes === 1 ? 'leitura' : 'leituras'} neste mês.
            </Text>
          </>
        )}
        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
      </ScrollView>
      <View style={estilos.rodape}>
        {leitura?.legivel && novas.length ? (
          <BotaoPrimario
            titulo={marcadas ? `Salvar ${marcadas} ${marcadas === 1 ? 'vacina' : 'vacinas'}` : 'Marque uma vacina'}
            carregando={salvando}
            desabilitado={!marcadas}
            onPress={salvar}
          />
        ) : (
          <BotaoPrimario titulo="Voltar" onPress={() => router.back()} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  cartao: { backgroundColor: colors.healthSurface, borderRadius: 24, padding: 14, gap: 10 },
  cartaoFora: { backgroundColor: colors.background, opacity: 0.7 },
  linhaTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  checkMarcado: { backgroundColor: colors.black, borderColor: colors.black },
  nome: { flex: 1, fontFamily: fontFamily.bold, fontSize: 16, color: colors.black, paddingVertical: 4 },
  conferir: {
    fontFamily: fontFamily.bold, fontSize: 11, color: colors.warningText, backgroundColor: colors.warningSurface,
    borderRadius: 999, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 3,
  },
  campos: { flexDirection: 'row', gap: 8 },
  campo: { flex: 1, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  rotulo: { fontFamily: fontFamily.semiBold, fontSize: 11, color: colors.healthText },
  valor: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black, paddingVertical: 2 },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted, paddingHorizontal: 4 },
  grupo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 4 },
  jaCadastrada: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14 },
  jaTexto: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.textMuted },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
});
