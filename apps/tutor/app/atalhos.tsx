import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Surgir, Tocavel } from '../src/components/Animacoes';
import { HeroiOnda } from '../src/components/HeroiOnda';
import { Icone, type NomeIcone } from '../src/components/Icone';
import { usePets } from '../src/pets/PetsProvider';
import { colors } from '../src/theme/colors';
import { fontFamily } from '../src/theme/typography';

type Atalho = { nome: string; descricao: string; fundo: string; icone: NomeIcone; cor?: string; destino: (petId: string | null) => Href };

/**
 * Todos os atalhos (protótipo TodosAtalhos, BUSINESS.md 5.43). Os de fases
 * futuras (Eventos, Adoção e Passeios) só entram quando a fase existir.
 */
const ATALHOS: Atalho[] = [
  { nome: 'SOS', descricao: 'Clínica 24 h e primeiros socorros', fundo: '#FBDADF', icone: 'cruz', cor: '#B3173A', destino: () => '/sos' },
  { nome: 'Lugares', descricao: 'Clínicas, petshops e mais', fundo: '#E3F3FC', icone: 'local', destino: () => '/mapa' },
  { nome: 'Calculadoras', descricao: 'Ração, idade e peso', fundo: '#FFF0C9', icone: 'calculadora', destino: () => '/ferramentas/calculadoras' },
  { nome: 'Rotina', descricao: 'Banho, dentes e vermífugo', fundo: '#DDF3E6', icone: 'relogio', destino: () => '/lembretes/rotina' },
  { nome: 'Lembretes', descricao: 'Doses e consultas', fundo: '#EBDDFB', icone: 'sino', destino: () => '/lembretes' },
  {
    nome: 'Medicamentos',
    descricao: 'Remédios em andamento',
    fundo: '#FFF0C9',
    icone: 'capsula',
    destino: (petId) => (petId ? { pathname: '/pet/[id]/medicamentos', params: { id: petId } } : '/pet/novo'),
  },
  { nome: 'Pet friendly', descricao: 'Onde o pet pode ir', fundo: '#FFE3CC', icone: 'pata', destino: () => '/mapa/pet-friendly' },
  {
    nome: 'Carteirinha',
    descricao: 'Vacinas, remédios e mais',
    fundo: '#EBDDFB',
    icone: 'carteirinha',
    destino: (petId) => (petId ? { pathname: '/pet/[id]/carteirinha', params: { id: petId } } : '/pet/novo'),
  },
  { nome: 'Despesas', descricao: 'Quanto você gasta por mês', fundo: '#DDF3E6', icone: 'sacola', destino: () => '/despesas' },
];

export default function TodosAtalhos() {
  const { petAtivo } = usePets();

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo="Tudo o que o app faz" titulo="Atalhos" altura={196} />
      <ScrollView contentContainerStyle={estilos.grade} showsVerticalScrollIndicator={false}>
        {ATALHOS.map((atalho, i) => (
          <Surgir key={atalho.nome} indice={Math.min(i, 5)} style={estilos.celula}>
            <Tocavel
              accessibilityRole="button"
              accessibilityLabel={`${atalho.nome}: ${atalho.descricao}`}
              onPress={() => router.push(atalho.destino(petAtivo?.id ?? null))}
              style={[estilos.cartao, { backgroundColor: atalho.fundo }]}
            >
              <View style={estilos.icone}>
                <Icone nome={atalho.icone} size={20} cor={atalho.cor} espessura={atalho.cor ? 2.2 : 1.9} />
              </View>
              <View>
                <Text style={estilos.nome}>{atalho.nome}</Text>
                <Text style={estilos.descricao}>{atalho.descricao}</Text>
              </View>
            </Tocavel>
          </Surgir>
        ))}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 24, paddingBottom: 40 },
  celula: { width: '48.4%' },
  cartao: { borderRadius: 24, padding: 14, gap: 10, minHeight: 112 },
  icone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nome: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  descricao: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16, color: colors.textMuted, marginTop: 2 },
});
