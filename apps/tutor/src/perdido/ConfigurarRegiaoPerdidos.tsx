import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Interruptor } from '../components/Interruptor';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { consultarRegiaoPerdidos, desligarRegiaoPerdidos, ligarRegiaoPerdidos, type RegiaoPerdidos } from './perdido';

/** Alertas de pet perdido perto de você (BUSINESS.md 5.29): opt-in com região aproximada. */
export function ConfigurarRegiaoPerdidos() {
  const [regiao, setRegiao] = useState<RegiaoPerdidos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const vida = useRef(true);

  useEffect(() => {
    vida.current = true;
    consultarRegiaoPerdidos().then(
      (r) => vida.current && setRegiao(r),
      () => vida.current && setRegiao({ ativo: false }),
    );
    return () => {
      vida.current = false;
    };
  }, []);

  async function alternar() {
    if (!regiao || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const r = regiao.ativo ? await desligarRegiaoPerdidos() : await ligarRegiaoPerdidos();
      if (vida.current) setRegiao(r);
    } catch (e) {
      if (vida.current) setErro(e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      if (vida.current) setOcupado(false);
    }
  }

  return (
    <View style={s.card}>
      <View style={s.linha}>
        <View style={s.flex}>
          <Text accessibilityRole="header" style={s.titulo}>Pets perdidos perto de você</Text>
          <Text style={s.texto}>
            Receba o alerta quando um pet sumir no seu bairro. Guardamos só uma região aproximada (~1 km), renovada quando você abre o app.
          </Text>
        </View>
        {regiao ? (
          <Interruptor ligado={regiao.ativo} rotulo="Alertas de pets perdidos" desabilitado={ocupado} onToggle={alternar} />
        ) : (
          <ActivityIndicator accessibilityLabel="Carregando alertas de pets perdidos" />
        )}
      </View>
      {erro ? <Text accessibilityRole="alert" style={s.erro}>{erro}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.background, padding: 18, borderRadius: 24, gap: 10 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  titulo: { ...typography.h3, color: colors.black },
  texto: { ...typography.body, color: colors.textMuted },
  erro: { ...typography.body, color: colors.danger },
});
