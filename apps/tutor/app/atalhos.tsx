import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Surgir, Tocavel } from '../src/components/Animacoes';
import { HeroiOnda } from '../src/components/HeroiOnda';
import { Icone, type NomeIcone } from '../src/components/Icone';
import { usePets } from '../src/pets/PetsProvider';
import { colors } from '../src/theme/colors';
import { shadow } from '../src/theme/tokens';
import { fontFamily } from '../src/theme/typography';

type Atalho = { nome: string; descricao: string; fundo: string; icone: NomeIcone; cor?: string; claro?: boolean; destino: (petId: string | null) => Href };

/**
 * Todos os atalhos (protótipo TodosAtalhos, BUSINESS.md 5.43). Os de fases
 * futuras só entram quando a implementação estiver disponível.
 */
const ATALHOS: Atalho[] = [
  // Cores com significado (prototipo/paleta.json): rosa saúde, lilás rotina, azul lugares e compras, SOS em vermelho.
  { nome: 'SOS', descricao: 'Clínica 24 h e primeiros socorros', fundo: colors.emergency, icone: 'cruz', cor: colors.emergency, claro: true, destino: () => '/sos' },
  { nome: 'Adoção', descricao: 'Conheça pets de ONGs verificadas', fundo: colors.primarySurface, icone: 'pata', destino: () => '/adocao' },
  { nome: 'Lugares', descricao: 'Clínicas, petshops e mais', fundo: colors.primarySurface, icone: 'local', destino: () => '/mapa' },
  { nome: 'Calculadoras', descricao: 'Ração, idade e peso', fundo: colors.healthSurface, icone: 'calculadora', destino: () => '/ferramentas/calculadoras' },
  { nome: 'Rotina', descricao: 'Banho, dentes e vermífugo', fundo: colors.premiumSurface, icone: 'relogio', destino: () => '/lembretes/rotina' },
  { nome: 'Lembretes', descricao: 'Doses e consultas', fundo: colors.premiumSurface, icone: 'sino', destino: () => '/lembretes' },
  {
    nome: 'Medicamentos',
    descricao: 'Remédios em andamento',
    fundo: colors.healthSurface,
    icone: 'capsula',
    destino: (petId) => (petId ? { pathname: '/pet/[id]/medicamentos', params: { id: petId } } : '/pet/novo'),
  },
  { nome: 'Pet friendly', descricao: 'Onde o pet pode ir', fundo: colors.primarySurface, icone: 'pata', destino: () => '/mapa/pet-friendly' },
  {
    nome: 'Carteirinha',
    descricao: 'Vacinas, remédios e mais',
    fundo: colors.healthSurface,
    icone: 'carteirinha',
    destino: (petId) => (petId ? { pathname: '/pet/[id]/carteirinha', params: { id: petId } } : '/pet/novo'),
  },
  {
    nome: 'Viagem',
    descricao: 'Checklist de carro ou avião',
    fundo: colors.premiumSurface,
    icone: 'carro',
    destino: (petId) => (petId ? { pathname: '/pet/[id]/viagem', params: { id: petId } } : '/pet/novo'),
  },
  { nome: 'Fogos e trovão', descricao: 'Dicas e modo calmo', fundo: colors.premiumSurface, icone: 'alerta', destino: () => '/cuidados/fogos' },
  { nome: 'Despesas', descricao: 'Quanto você gasta por mês', fundo: colors.primarySurface, icone: 'sacola', destino: () => '/despesas' },
  { nome: 'Passeios', descricao: 'Gravar com GPS, pausar e finalizar', fundo: colors.premiumSurface, icone: 'pata', destino: () => '/passeios' },
];

export default function TodosAtalhos() {
  const { petAtivo } = usePets();

  return (
    <View style={estilos.tela}>
      <HeroiOnda titulo="Atalhos" />
      <ScrollView contentContainerStyle={estilos.grade} showsVerticalScrollIndicator={false}>
        {ATALHOS.map((atalho, i) => (
          <Surgir key={atalho.nome} indice={Math.min(i, 5)} style={atalho.claro ? estilos.celulaLarga : estilos.celula}>
            <Tocavel
              accessibilityRole="button"
              accessibilityLabel={`${atalho.nome}: ${atalho.descricao}`}
              onPress={() => router.push(atalho.destino(petAtivo?.id ?? null))}
              style={[estilos.cartao, atalho.claro && estilos.cartaoSos]}
            >
              <View style={[estilos.icone, { backgroundColor: atalho.claro ? 'rgba(255,255,255,0.18)' : atalho.fundo }]}>
                <Icone nome={atalho.icone} size={20} cor={atalho.claro ? colors.white : atalho.cor} espessura={atalho.cor ? 2.2 : 1.9} />
              </View>
              <View style={atalho.claro ? estilos.flex : undefined}>
                <Text style={[estilos.nome, atalho.claro && estilos.textoClaro]}>{atalho.nome}</Text>
                <Text style={[estilos.descricao, atalho.claro && estilos.textoClaro]}>{atalho.descricao}</Text>
              </View>
            </Tocavel>
          </Surgir>
        ))}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  // Versão 2: cartões brancos com o ícone num quadrado colorido; o SOS ocupa a linha toda.
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, paddingBottom: 120 },
  celula: { width: '48.4%' },
  celulaLarga: { width: '100%' },
  flex: { flex: 1 },
  cartao: { borderRadius: 24, padding: 16, gap: 12, minHeight: 124, backgroundColor: colors.surface, ...shadow.card },
  cartaoSos: { backgroundColor: colors.emergency, flexDirection: 'row', alignItems: 'center', minHeight: 0 },
  icone: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nome: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  descricao: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16, color: colors.textMuted, marginTop: 2 },
  textoClaro: { color: colors.white },
});
