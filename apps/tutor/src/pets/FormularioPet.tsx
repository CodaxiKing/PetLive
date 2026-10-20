import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Campo } from '../components/Campo';
import { ControleSegmentado } from '../components/ControleSegmentado';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { CampoFoto, type AtivoFoto } from './CampoFoto';
import type { PetForm } from './types';

const ESPECIES = ['Cachorro', 'Gato'] as const;
const SEXOS = ['Macho', 'Fêmea'] as const;
const CASTRADO = ['Sim', 'Não'] as const;

const INDICE_ESPECIE: Record<string, PetForm['especie']> = {
  Cachorro: 'cao',
  Gato: 'gato',
};
const INDICE_SEXO: Record<string, PetForm['sexo']> = { Macho: 'macho', 'Fêmea': 'femea' };

type Props = {
  form: PetForm;
  onChange: (campo: keyof PetForm, valor: string | boolean) => void;
  /** Foto atual: URI local nova ou URL pública já salva. */
  foto?: string | null;
  /** Chamado quando o tutor escolhe (ou remove) a foto. */
  onFoto?: (ativo: AtivoFoto | null) => void;
};

/** Formulário compartilhado entre "Novo pet" e "Editar pet". */
export function FormularioPet({ form, onChange, foto, onFoto }: Props) {
  return (
    <ScrollView
      style={estilos.flex}
      contentContainerStyle={estilos.conteudo}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {onFoto ? (
        <CampoFoto
          foto={foto ?? null}
          onEscolher={onFoto}
          onRemover={foto ? () => onFoto(null) : undefined}
        />
      ) : null}

      <Campo
        rotulo="Nome do pet"
        placeholder="Ex.: Nina"
        value={form.nome}
        onChangeText={(v) => onChange('nome', v)}
      />

      <View style={estilos.bloco}>
        <Text style={estilos.rotulo}>Espécie</Text>
        <ControleSegmentado
          opcoes={[...ESPECIES]}
          ativo={ESPECIES.findIndex((e) => INDICE_ESPECIE[e] === form.especie)}
          onSelecionar={(i) => onChange('especie', INDICE_ESPECIE[ESPECIES[i]])}
        />
      </View>

      <Campo
        rotulo="Raça"
        variante="azul"
        placeholder="Ex.: SRD, Golden, Siamês"
        value={form.raca}
        onChangeText={(v) => onChange('raca', v)}
      />

      <View style={estilos.bloco}>
        <Text style={estilos.rotulo}>Sexo</Text>
        <ControleSegmentado
          opcoes={[...SEXOS]}
          ativo={form.sexo === 'macho' ? 0 : 1}
          onSelecionar={(i) => onChange('sexo', INDICE_SEXO[SEXOS[i]])}
        />
      </View>

      <Campo
        rotulo="Data de nascimento"
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        value={form.nascimento}
        onChangeText={(v) => onChange('nascimento', v)}
      />

      <Campo
        rotulo="Peso (kg)"
        variante="verde"
        placeholder="Ex.: 8,5"
        keyboardType="decimal-pad"
        value={form.peso}
        onChangeText={(v) => onChange('peso', v)}
      />

      <View style={estilos.bloco}>
        <Text style={estilos.rotulo}>Castrado</Text>
        <ControleSegmentado
          opcoes={[...CASTRADO]}
          ativo={form.castrado ? 0 : 1}
          onSelecionar={(i) => onChange('castrado', CASTRADO[i] === 'Sim')}
        />
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  conteudo: { paddingBottom: 130, gap: spacing.lg },
  bloco: { gap: spacing.sm },
  rotulo: {
    ...typography.label,
    color: colors.text,
  },
});
