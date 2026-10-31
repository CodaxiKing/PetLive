import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { IconeSino } from '../../src/components/Layout';
import { Mascote } from '../../src/components/Mascote';
import { Gradiente } from '../../src/components/Gradiente';
import { Icone, type NomeIcone } from '../../src/components/Icone';
import { Surgir, Tocavel } from '../../src/components/Animacoes';
import { AvisoOffline } from '../../src/components/AvisoOffline';
import { itensEmAndamento, type ItemAndamento } from '../../src/inicio/emAndamento';
import { minhasSolicitacoes } from '../../src/loja/loja';
import { meusPedidosAlbumTodos } from '../../src/pets/albumPedido';
import { chegadaAtual } from '../../src/sos/chegada';
import { AVISO_SEM_SALVAR } from '../../src/lib/cacheOffline';
import { useLembretes } from '../../src/lembretes/LembretesProvider';
import type { Lembrete, TipoLembrete } from '../../src/lembretes/types';
import { AvatarPet } from '../../src/pets/AvatarPet';
import { coresDoPet } from '../../src/pets/coresPet';
import {
  antirrabicaEmDia,
  proximaVacina,
  seloProximaVacina,
  textoProximaVacina,
} from '../../src/pets/carteirinha';
import { usePets } from '../../src/pets/PetsProvider';
import { contarNaoLidos } from '../../src/notificacoes/caixa';
import { sincronizarDoses } from '../../src/notificacoes/doses';
import {
  carregarDosesHoje,
  confirmarDose,
  emTratamentoHoje,
  garantirDosesHoje,
  type DoseHoje,
} from '../../src/remedios/doses';
import { useRemedios } from '../../src/remedios/RemediosProvider';
import { useVacinas } from '../../src/saude/VacinasProvider';
import { colors } from '../../src/theme/colors';
import { fontFamily } from '../../src/theme/typography';
import { shadow } from '../../src/theme/tokens';
import { textoDeErro } from '../../src/lib/erros';

/**
 * Atalhos do Início (protótipo: fundo pastel, ícone num círculo branco). Só os da Fase 1.
 * O SOS não entra aqui: ele fica no meio da barra de abas (versão 2).
 */
const ATALHOS: { nome: string; fundo: string; icone: NomeIcone; cor?: string; destino: Href | { pet: 'carteirinha' | 'medicamentos' } }[] = [
  { nome: 'Lembretes', fundo: colors.premiumSurface, icone: 'sino', cor: colors.premiumText, destino: '/lembretes' },
  { nome: 'Carteirinha', fundo: colors.healthSurface, icone: 'carteirinha', cor: colors.healthText, destino: { pet: 'carteirinha' } },
  { nome: 'Remédios', fundo: colors.healthSurface, icone: 'capsula', cor: colors.healthText, destino: { pet: 'medicamentos' } },
  { nome: 'Calcular', fundo: colors.healthSurface, icone: 'calculadora', cor: colors.healthText, destino: '/ferramentas/calculadoras' },
  { nome: 'Lugares', fundo: colors.primarySurface, icone: 'local', cor: colors.primaryDeep, destino: '/mapa' },
  { nome: 'Rotina', fundo: colors.premiumSurface, icone: 'relogio', cor: colors.premiumText, destino: '/lembretes/rotina' },
  { nome: 'Ver todos', fundo: colors.white, icone: 'grade', destino: '/atalhos' },
];

/** Item da lista Hoje: lembrete ou dose de remédio do pet escolhido. */
type ItemHoje =
  | { tipo: 'lembrete'; chave: string; titulo: string; quando: string; icone: NomeIcone; lembrete: Lembrete }
  | { tipo: 'dose'; chave: string; titulo: string; quando: string; icone: NomeIcone; dose: DoseHoje };

const ICONE_TIPO: Record<TipoLembrete, NomeIcone> = {
  vacina: 'vacina',
  vermifugo: 'capsula',
  consulta: 'cruz',
  banho_tosa: 'gota',
  outro: 'sino',
};

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function fimDeHoje(): number {
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  return fim.getTime();
}

/** "hoje, 9:00" ou "atrasado desde 12/10". */
function quandoHoje(iso: string): string {
  const data = new Date(iso);
  const inicioDeHoje = new Date();
  inicioDeHoje.setHours(0, 0, 0, 0);
  if (data < inicioDeHoje) {
    return `atrasado desde ${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`;
  }
  return `hoje, ${data.getHours()}:${String(data.getMinutes()).padStart(2, '0')}`;
}

/**
 * Início (versão 2 do protótipo, Inicio): data e saudação, os pets em
 * pílulas, o pet ativo em foto grande com a próxima vacina e Registrar, o
 * que vence hoje com "Feito" e os atalhos em grade.
 */
export default function Inicio() {
  const router = useRouter();
  const { user } = useAuth();

  const { pets, petAtivo, definirPetAtivo, seniores } = usePets();
  const { lembretes, concluirLembrete } = useLembretes();
  const { remedios } = useRemedios();
  const [doses, setDoses] = useState<DoseHoje[]>([]);
  const [naoLidos, setNaoLidos] = useState(0);

  // Ponto vermelho no sino: avisos ainda não lidos na caixa.
  useFocusEffect(
    useCallback(() => {
      contarNaoLidos().then(setNaoLidos);
    }, []),
  );

  // Em andamento: pedido, Pix por pagar, ida à clínica. Falha de rede só esconde a seção.
  const [andamento, setAndamento] = useState<ItemAndamento[]>([]);
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      Promise.all([
        minhasSolicitacoes().catch(() => []),
        chegadaAtual().catch(() => null),
        meusPedidosAlbumTodos().catch(() => []),
      ]).then(([pedidos, chegada, albuns]) => {
        if (vivo) setAndamento(itensEmAndamento(pedidos, chegada, albuns));
      });
      return () => {
        vivo = false;
      };
    }, []),
  );
  const { vacinas } = useVacinas();
  const [ola] = useState(saudacao);
  const [limiteHoje] = useState(fimDeHoje);
  const [concluindo, setConcluindo] = useState<string | null>(null);

  // Doses de hoje dos remédios do pet escolhido (geradas como em Medicamentos).
  const emCurso = remedios.filter(emTratamentoHoje);
  const idsRemedios = emCurso.map((r) => r.id).join(',');
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      const lista = remedios.filter((r) => idsRemedios.split(',').includes(r.id));
      garantirDosesHoje(lista)
        .catch(() => undefined)
        .then(() => carregarDosesHoje(lista.map((r) => r.id)))
        .then(
          (achadas) => {
            if (vivo) setDoses(achadas);
          },
          () => undefined,
        );
      return () => {
        vivo = false;
      };
    }, [idsRemedios, remedios]),
  );

  // "Hoje" segue o pet escolhido no topo (BUSINESS.md 5.43): os lembretes dele
  // (e os sem pet) e as doses que faltam, na ordem do horário.
  const hoje: ItemHoje[] = [
    ...lembretes
      .filter((l) => (l.pet_id === null || l.pet_id === petAtivo?.id) && new Date(l.proxima_em).getTime() <= limiteHoje)
      .map((l): ItemHoje => ({ tipo: 'lembrete', chave: l.id, titulo: l.titulo, quando: l.proxima_em, icone: ICONE_TIPO[l.tipo], lembrete: l })),
    ...doses
      .filter((d) => !d.confirmada_em && !d.pulada)
      .map((d): ItemHoje => ({
        tipo: 'dose',
        chave: d.id,
        titulo: remedios.find((r) => r.id === d.medication_id)?.nome ?? 'Remédio',
        quando: d.prevista_para,
        icone: 'capsula',
        dose: d,
      })),
  ]
    .sort((a, b) => new Date(a.quando).getTime() - new Date(b.quando).getTime())
    .slice(0, 4);
  const proxima = proximaVacina(vacinas);
  const nomePet = petAtivo?.nome ?? 'seu pet';

  function feito(item: ItemHoje) {
    if (concluindo) return;
    setConcluindo(item.chave);
    const salvar =
      item.tipo === 'lembrete'
        ? concluirLembrete(item.lembrete)
        : confirmarDose(item.dose.id).then(
            () => {
              setDoses((atual) => atual.filter((d) => d.id !== item.dose.id));
              // Dose dada antes da hora: a notificação dela não toca mais.
              sincronizarDoses().catch(() => undefined);
              return true;
            },
            (e: unknown) => {
              // Guarda compartilhada: outra pessoa já deu esta dose.
              const msg = textoDeErro(e, '');
              if (!msg.includes('já marcou')) return false;
              setDoses((atual) => atual.filter((d) => d.id !== item.dose.id));
              sincronizarDoses().catch(() => undefined);
              Alert.alert('Dose já dada', msg);
              return true;
            },
          );
    salvar
      .then((ok) => {
        if (!ok) Alert.alert('Não deu para salvar', AVISO_SEM_SALVAR);
      })
      .finally(() => setConcluindo(null));
  }

  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dataTexto = dataHoje.charAt(0).toUpperCase() + dataHoje.slice(1);
  const nomeTutor =
    (typeof user?.user_metadata?.nome === 'string' && user.user_metadata.nome.trim().split(' ')[0]) ||
    (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim().split(' ')[0]) ||
    '';
  const coresAtivo = petAtivo ? coresDoPet(petAtivo, Math.max(0, pets.findIndex((p) => p.id === petAtivo.id))) : null;

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
      <View style={estilos.cabecalho}>
        <View style={estilos.flex}>
          <Text style={estilos.data} numberOfLines={1}>{dataTexto}</Text>
          <Text style={estilos.titulo} numberOfLines={1} accessibilityRole="header">
            {nomeTutor ? `${ola}, ${nomeTutor}` : ola}
          </Text>
        </View>
        <Tocavel
          accessibilityRole="button"
          accessibilityLabel={naoLidos > 0 ? `Avisos, ${naoLidos} ${naoLidos === 1 ? 'novo' : 'novos'}` : 'Avisos'}
          onPress={() => router.push('/avisos/caixa')}
          style={estilos.botaoRedondo}
        >
          <IconeSino size={22} />
          {naoLidos > 0 ? <View style={estilos.pontoSino} /> : null}
        </Tocavel>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={estilos.petsRolagem}
        contentContainerStyle={estilos.pets}
      >
        {pets.map((pet) => {
          const ativo = pet.id === petAtivo?.id;
          return (
            <Tocavel
              key={pet.id}
              accessibilityRole="button"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={ativo ? `Abrir ${pet.nome}` : `Mostrar ${pet.nome}`}
              onPress={() =>
                ativo
                  ? router.push({ pathname: '/pet/[id]', params: { id: pet.id } })
                  : definirPetAtivo(pet.id)
              }
              style={[estilos.petChip, ativo ? estilos.petChipAtivo : estilos.petChipInativo]}
            >
              <AvatarPet especie={pet.especie} foto={pet.foto_url} size={32} />
              <Text style={[estilos.petNome, ativo && estilos.petNomeAtivo]}>{pet.nome}</Text>
              {seniores.has(pet.id) ? <Text style={estilos.etiquetaSenior}>Sênior</Text> : null}
            </Tocavel>
          );
        })}
        <Tocavel
          accessibilityRole="button"
          accessibilityLabel="Adicionar pet"
          onPress={() => router.push('/pet/novo')}
          style={[estilos.petChip, estilos.petChipInativo, estilos.petMais]}
        >
          <Icone nome="cruz" size={16} espessura={2.2} />
          <Text style={estilos.petNome}>Adicionar</Text>
        </Tocavel>
      </ScrollView>

      <View style={estilos.corpo}>
        <AvisoOffline />
        {petAtivo ? (
          <Surgir indice={0}>
            <Tocavel
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${petAtivo.nome}`}
              onPress={() => router.push({ pathname: '/pet/[id]', params: { id: petAtivo.id } })}
              escala={0.98}
              style={[estilos.destaque, { backgroundColor: coresAtivo?.fundo ?? colors.primarySurface }]}
            >
              {petAtivo.foto_url ? (
                <Image source={{ uri: petAtivo.foto_url }} style={estilos.destaqueFoto} accessibilityLabel={`Foto de ${petAtivo.nome}`} />
              ) : (
                <View style={estilos.destaqueMascote}>
                  <Mascote especie={petAtivo.especie} size={210} recorte />
                </View>
              )}
              <Gradiente de={colors.black} ate={colors.black} opacidadeDe={0} opacidadeAte={0.72} />
              <View style={estilos.destaqueRodape}>
                <View style={estilos.flex}>
                  {proxima ? (
                    <Text style={estilos.destaqueSelo} numberOfLines={1}>{seloProximaVacina(proxima)}</Text>
                  ) : antirrabicaEmDia(vacinas) ? (
                    <Text style={[estilos.destaqueSelo, estilos.destaqueSeloOk]}>Antirrábica em dia</Text>
                  ) : null}
                  <Text style={estilos.destaqueTitulo} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                    {proxima ? textoProximaVacina(proxima) : `Vacinas ${petAtivo.sexo === 'femea' ? 'da' : 'do'} ${nomePet}`}
                  </Text>
                </View>
                <Tocavel
                  accessibilityRole="button"
                  accessibilityLabel="Registrar vacina"
                  onPress={() => router.push({ pathname: '/pet/[id]/vacina/nova', params: { id: petAtivo.id } })}
                  style={estilos.registrar}
                >
                  <Text style={estilos.registrarTexto}>Registrar</Text>
                </Tocavel>
              </View>
            </Tocavel>
          </Surgir>
        ) : null}

        {andamento.length ? (
          <>
            <Text style={[estilos.secaoTitulo, estilos.andamentoTitulo]}>Em andamento</Text>
            <View style={estilos.lista}>
              {andamento.map((item, i) => (
                <Tocavel
                  key={item.chave}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.titulo}. ${item.sub}`}
                  onPress={() => router.push(item.destino)}
                  style={[estilos.linha, i > 0 && estilos.divisoria]}
                >
                  <View style={[estilos.linhaIcone, { backgroundColor: item.urgente ? '#FDE0E6' : colors.primarySurface }]}>
                    <Icone nome={item.urgente ? 'sino' : 'relogio'} size={20} cor={item.urgente ? colors.emergency : colors.primaryDeep} />
                  </View>
                  <View style={estilos.flex}>
                    <Text style={estilos.linhaTitulo} numberOfLines={1}>{item.titulo}</Text>
                    <Text style={estilos.linhaSub} numberOfLines={1}>{item.sub}</Text>
                  </View>
                  <Icone nome="seta" size={18} cor={colors.textMuted} />
                </Tocavel>
              ))}
            </View>
          </>
        ) : null}

        <View style={estilos.secao}>
          <Text style={estilos.secaoTitulo}>Hoje</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/lembretes')}>
            <Text style={estilos.secaoAcao}>Ver tudo</Text>
          </Pressable>
        </View>

        <View style={estilos.lista}>
          {hoje.length === 0 ? (
            <Tocavel
              accessibilityRole="button"
              accessibilityLabel="Nada para hoje. Criar lembrete"
              onPress={() => router.push('/lembretes/novo')}
              style={estilos.linha}
            >
              <View style={[estilos.linhaIcone, { backgroundColor: colors.successSurface }]}>
                <Icone nome="check" size={20} cor={colors.successText} espessura={2.2} />
              </View>
              <View style={estilos.flex}>
                <Text style={estilos.linhaTitulo}>Nada para hoje</Text>
                <Text style={estilos.linhaSub}>Toque para criar um lembrete</Text>
              </View>
              <Icone nome="seta" size={18} cor={colors.textMuted} />
            </Tocavel>
          ) : (
            hoje.map((item, i) => {
              const pet = item.tipo === 'dose' ? petAtivo : pets.find((p) => p.id === item.lembrete.pet_id);
              const quando = quandoHoje(item.quando);
              const saude = item.tipo === 'dose' || item.icone === 'vacina' || item.icone === 'capsula';
              return (
                <Surgir key={item.chave} indice={i}>
                  <View style={[estilos.linha, i > 0 && estilos.divisoria]}>
                    <View style={[estilos.linhaIcone, { backgroundColor: saude ? colors.healthSurface : colors.premiumSurface }]}>
                      <Icone nome={item.icone} size={20} cor={saude ? colors.healthText : colors.premiumText} />
                    </View>
                    <View style={estilos.flex}>
                      <Text style={estilos.linhaTitulo} numberOfLines={1}>
                        {item.titulo}
                      </Text>
                      <Text style={estilos.linhaSub} numberOfLines={1}>
                        {pet ? `${pet.nome} · ${quando}` : quando}
                      </Text>
                    </View>
                    <Tocavel
                      accessibilityRole="button"
                      accessibilityLabel={`Marcar ${item.titulo} como feito`}
                      disabled={concluindo !== null}
                      onPress={() => feito(item)}
                      style={estilos.feito}
                    >
                      <Text style={estilos.feitoTexto}>Feito</Text>
                    </Tocavel>
                  </View>
                </Surgir>
              );
            })
          )}
        </View>

        <Text style={[estilos.secaoTitulo, estilos.atalhosTitulo]}>Atalhos</Text>
        <View style={estilos.atalhos}>
          {ATALHOS.map((atalho, i) => (
            <Surgir key={atalho.nome} indice={Math.min(i, 5)} style={estilos.atalhoCelula}>
              <Tocavel
                accessibilityRole="button"
                onPress={() => router.push(typeof atalho.destino === 'object' && 'pet' in atalho.destino
                  ? petAtivo ? `/pet/${petAtivo.id}/${atalho.destino.pet}` as Href : '/pet/novo'
                  : atalho.destino)}
                style={[estilos.atalho, { backgroundColor: atalho.fundo }]}
              >
                <View style={estilos.atalhoIcone}>
                  <Icone nome={atalho.icone} size={22} cor={atalho.cor ?? colors.black} espessura={2} />
                </View>
                <Text style={estilos.atalhoTexto} numberOfLines={1}>
                  {atalho.nome}
                </Text>
              </Tocavel>
            </Surgir>
          ))}
        </View>
      </View>

      {/* Espaço para o menu inferior flutuante não cobrir o conteúdo. */}
      <View style={estilos.respiro} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { paddingBottom: 24 },
  flex: { flex: 1, minWidth: 0 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 60 },
  data: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.textMuted },
  titulo: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.9, color: colors.black },
  botaoRedondo: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  pontoSino: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.healthText,
    borderWidth: 2,
    borderColor: colors.white,
  },
  petsRolagem: { marginTop: 16, flexGrow: 0 },
  pets: { gap: 8, paddingHorizontal: 24, paddingVertical: 4 },
  petChip: {
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 16,
  },
  petChipAtivo: { backgroundColor: colors.black },
  petChipInativo: { backgroundColor: colors.white, ...shadow.card },
  petMais: { paddingLeft: 14 },
  petNome: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  petNomeAtivo: { color: colors.white },
  etiquetaSenior: { fontFamily: fontFamily.bold, fontSize: 10, color: colors.warningText, backgroundColor: colors.warningSurface, borderRadius: 999, overflow: 'hidden', paddingVertical: 2, paddingHorizontal: 7 },
  corpo: { paddingHorizontal: 20, gap: 12, marginTop: 12 },
  // Versão 2: o pet ativo em foto grande, com a próxima vacina por cima.
  destaque: { height: 210, borderRadius: 28, overflow: 'hidden', justifyContent: 'flex-end' },
  destaqueFoto: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
  destaqueMascote: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  destaqueRodape: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, padding: 18 },
  destaqueSelo: {
    alignSelf: 'flex-start',
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: colors.healthText,
    backgroundColor: colors.healthSurface,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  destaqueSeloOk: { color: colors.successText, backgroundColor: colors.successSurface },
  destaqueTitulo: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 29, letterSpacing: -0.6, color: colors.white },
  registrar: { height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center' },
  registrarTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  secao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, marginHorizontal: 4 },
  secaoTitulo: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.black },
  secaoAcao: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.primaryDeep },
  lista: { backgroundColor: colors.surface, borderRadius: 24, overflow: 'hidden', ...shadow.card },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  divisoria: { borderTopWidth: 1, borderTopColor: colors.border },
  linhaIcone: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  linhaTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  linhaSub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted, marginTop: 1 },
  feito: { height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: colors.black, justifyContent: 'center' },
  feitoTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.white },
  andamentoTitulo: { marginTop: 4 },
  atalhosTitulo: { marginTop: 10, marginHorizontal: 4 },
  atalhos: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  atalhoCelula: { width: '50%', padding: 5 },
  atalho: { height: 96, borderRadius: 24, padding: 14, justifyContent: 'space-between' },
  atalhoIcone: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  atalhoTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  respiro: { height: 110 },
});
