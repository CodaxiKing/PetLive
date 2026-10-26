import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import type { LimitesPlano } from './limites';
import { limiteCadastroAtingido } from './limites';

export function AvisoLimitesPlano({ limites, petId }: { limites: LimitesPlano | null; petId?: string }) {
  if (!limites?.ativos || (petId && !limites.petsSomenteLeitura.includes(petId))) return null;
  return <View style={s.aviso}>
    <Text style={s.titulo}>{petId ? 'Este pet está somente em leitura' : 'Limites do seu plano'}</Text>
    <Text style={s.texto}>{petId ? 'Você continua vendo os dados e o histórico. Novos registros e edições estão limitados pelo plano atual. Nenhum dado foi apagado.' :
      `Seu plano permite editar ${limites.petsLimite ?? 'todos os'} pets. ${limites.petsSomenteLeitura.length ? 'Os demais continuam disponíveis para consulta.' : 'Seu histórico continua disponível.'}`}</Text>
    {!petId && limiteCadastroAtingido(limites) ? <Text style={s.texto}>O limite de cadastro foi atingido. Seus pets e históricos continuam disponíveis.</Text> : null}
  </View>;
}
const s = StyleSheet.create({ aviso: { backgroundColor: colors.warningSurface, padding: 16, borderRadius: 20, gap: 6 }, titulo: { ...typography.h3, color: colors.warningText }, texto: { ...typography.small, color: colors.warningText } });
