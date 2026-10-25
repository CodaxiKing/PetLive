import { Fragment, useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { IconeLocal, IconePerfil, IconeSino, OndaHeroi } from '../../src/components/Layout';
import { Gradiente } from '../../src/components/Gradiente';
import { Icone, type NomeIcone } from '../../src/components/Icone';
import { BarraProgresso, Surgir, Tocavel } from '../../src/components/Animacoes';
import { AvisoOffline } from '../../src/components/AvisoOffline';
import { AVISO_SEM_SALVAR } from '../../src/lib/cacheOffline';
import { useLembretes } from '../../src/lembretes/LembretesProvider';
import type { Lembrete, TipoLembrete } from '../../src/lembretes/types';
import { useCidade } from '../../src/mapa/useCidade';
import { AvatarPet } from '../../src/pets/AvatarPet';
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

/** Atalhos do Início (protótipo: fundo pastel, ícone num círculo branco). Só os da Fase 1. */
const ATALHOS: { nome: string; fundo: string; icone: NomeIcone; cor?: string; destino: Href | { pet: 'carteirinha' | 'medicamentos' } }[] = [
  { nome: 'SOS', fundo: colors.emergency, icone: 'cruz', cor: colors.white, destino: '/sos' },
  { nome: 'Lembretes', fundo: colors.premiumSurface, icone: 'sino', cor: colors.premiumText, destino: '/lembretes' },
  { nome: 'Carteirinha', fundo: colors.healthSurface, icone: 'carteirinha', cor: colors.healthText, destino: { pet: 'carteirinha' } },
  { nome: 'Remédios', fundo: colors.healthSurface, icone: 'capsula', cor: colors.healthText, destino: { pet: 'medicamentos' } },
  { nome: 'Calcular', fundo: colors.healthSurface, icone: 'calculadora', cor: colors.healthText, destino: '/ferramentas/calculadoras' },
  { nome: 'Lugares', fundo: colors.primarySurface, icone: 'local', cor: colors.primaryDeep, destino: '/mapa' },
  { nome: 'Rotina', fundo: colors.premiumSurface, icone: 'relogio', cor: colors.premiumText, destino: '/lembretes/rotina' },
  { nome: 'Ver todos', fundo: '#F3F5F8', icone: 'grade', destino: '/atalhos' },
];

/** Item da lista Hoje: lembrete ou dose de remédio do pet escolhido. */
type ItemHoje =
  | { tipo: 'lembrete'; chave: string; titulo: string; quando: string; icone: NomeIcone; lembrete: Lembrete }
  | { tipo: 'dose'; chave: string; titulo: string; quando: string; icone: NomeIcone; dose: DoseHoje };

/** Cartões de "Hoje", alternados (protótipo Início). */
const PALETA_HOJE = [
  { fundo: colors.healthSurface, texto: '#4A5568' },
  { fundo: colors.healthSurface, texto: '#4A5568' },
];

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
 * Início (protótipo Inicio): saudação e pets no herói, próxima vacina,
 * atalhos, o que vence hoje com "Feito" e a carteirinha do pet ativo.
 */
export default function Inicio() {
  const router = useRouter();
  const { width } = useWindowDimensions();
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
  const { vacinas } = useVacinas();
  const cidade = useCidade();
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
              const msg = e instanceof Error ? e.message : '';
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

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
      <View style={estilos.heroi}>
        <View style={estilos.cabecalho}>
          <View style={estilos.local} accessibilityLabel={`Local: ${cidade}`}>
            <IconeLocal size={18} />
            <Text style={estilos.localNome} numberOfLines={1}>
              {cidade}
            </Text>
          </View>
          <View style={estilos.flex} />
          <Tocavel
            accessibilityRole="button"
            accessibilityLabel={naoLidos > 0 ? `Avisos, ${naoLidos} ${naoLidos === 1 ? 'novo' : 'novos'}` : 'Avisos'}
            onPress={() => router.push('/avisos/caixa')}
            style={estilos.botaoRedondo}
          >
            <IconeSino />
            {naoLidos > 0 ? <View style={estilos.pontoSino} /> : null}
          </Tocavel>
          <Tocavel
            accessibilityRole="button"
            accessibilityLabel="Perfil"
            onPress={() => router.navigate('/perfil')}
            style={[estilos.botaoRedondo, estilos.botaoPerfil]}
          >
            <IconePerfil />
          </Tocavel>
        </View>

        <Text style={estilos.ola}>{ola}</Text>
        <Text style={estilos.titulo} numberOfLines={1}>
          {petAtivo ? `Como está ${petAtivo.sexo === 'femea' ? 'a' : 'o'} ${petAtivo.nome}?` : 'Olá!'}
        </Text>

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
                <AvatarPet especie={pet.especie} foto={pet.foto_url} size={30} />
                <Text style={[estilos.petNome, ativo && estilos.petNomeAtivo]}>{pet.nome}</Text>
                {seniores.has(pet.id) ? <Text style={estilos.etiquetaSenior}>Sênior</Text> : null}
              </Tocavel>
            );
          })}
          <Tocavel
            accessibilityRole="button"
            accessibilityLabel="Adicionar pet"
            onPress={() => router.push('/pet/novo')}
            style={estilos.petMais}
          >
            <Icone nome="cruz" size={16} espessura={2.6} />
          </Tocavel>
        </ScrollView>

        <OndaHeroi largura={width} altura={30} />
      </View>

      <View style={estilos.corpo}>
        <AvisoOffline />
        {petAtivo ? (
          <Surgir indice={0}>
            <Tocavel
              accessibilityRole="button"
              accessibilityLabel={proxima ? `Próxima vacina: ${textoProximaVacina(proxima)}. Registrar` : 'Registrar vacina'}
              onPress={() => router.push({ pathname: '/pet/[id]/vacina/nova', params: { id: petAtivo.id } })}
              escala={0.97}
              style={estilos.vacina}
            >
              <View style={estilos.flex}>
                <Text style={estilos.vacinaRotulo}>{proxima ? 'Próxima vacina' : 'Vacinas'}</Text>
                <Text style={estilos.vacinaTitulo} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {proxima ? textoProximaVacina(proxima) : 'Nenhuma dose agendada'}
                </Text>
                {proxima ? (
                  <View style={estilos.vacinaBarra}>
                    <BarraProgresso
                      fracao={proxima.fracao}
                      cor={colors.healthText}
                      fundo={colors.healthSurface}
                      altura={6}
                    />
                  </View>
                ) : null}
              </View>
              <View style={estilos.vacinaBotao}>
                <Text style={estilos.vacinaBotaoTexto}>Registrar</Text>
              </View>
            </Tocavel>
          </Surgir>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={estilos.atalhosRolagem}
          contentContainerStyle={estilos.atalhos}
          accessibilityLabel="Atalhos"
        >
          {ATALHOS.map((atalho, i) => (
            <Fragment key={atalho.nome}>
            {i === 4 ? <View style={estilos.atalhosDivisor} /> : null}
            <Surgir indice={Math.min(i, 4)}>
              <Tocavel
                accessibilityRole="button"
                onPress={() => router.push(typeof atalho.destino === 'object' && 'pet' in atalho.destino
                  ? petAtivo ? `/pet/${petAtivo.id}/${atalho.destino.pet}` as Href : '/pet/novo'
                  : atalho.destino)}
                style={[estilos.atalho, i >= 4 && estilos.atalhoSecundario]}
              >
                <View style={[estilos.atalhoIcone, i >= 4 && estilos.atalhoIconeSecundario, { backgroundColor: atalho.fundo }]}>
                  <Icone nome={atalho.icone} size={i < 4 ? 26 : 20} cor={atalho.cor} espessura={i === 0 ? 2.6 : 2} />
                </View>
                <Text
                  style={[estilos.atalhoTexto, i === 0 && estilos.atalhoSos, i >= 4 && estilos.atalhoTextoSecundario]}
                  numberOfLines={atalho.nome.includes(' ') ? 2 : 1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {atalho.nome}
                </Text>
              </Tocavel>
            </Surgir>
            </Fragment>
          ))}
        </ScrollView>

        <View style={estilos.secao}>
          <Text style={estilos.secaoTitulo}>Hoje</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/lembretes')}>
            <Text style={estilos.secaoAcao}>Ver todos ›</Text>
          </Pressable>
        </View>

        <View style={estilos.hoje}>
          {hoje.length === 0 ? (
            <Tocavel
              accessibilityRole="button"
              accessibilityLabel="Nada para hoje. Criar lembrete"
              onPress={() => router.push('/lembretes/novo')}
              style={[estilos.lembrete, estilos.lembreteVazio]}
            >
              <View style={estilos.lembreteIcone}>
                <Icone nome="check" size={18} espessura={2.2} />
              </View>
              <View style={estilos.flex}>
                <Text style={estilos.lembreteTitulo}>Nada para hoje</Text>
                <Text style={[estilos.lembreteSub, { color: colors.textMuted }]}>Toque para criar um lembrete</Text>
              </View>
            </Tocavel>
          ) : (
            hoje.map((item, i) => {
              const cores = PALETA_HOJE[i % PALETA_HOJE.length];
              const pet = item.tipo === 'dose' ? petAtivo : pets.find((p) => p.id === item.lembrete.pet_id);
              const quando = quandoHoje(item.quando);
              return (
                <Surgir key={item.chave} indice={i}>
                  <View style={[estilos.lembrete, { backgroundColor: cores.fundo }]}>
                    <View style={estilos.lembreteIcone}>
                      <Icone nome={item.icone} size={18} />
                    </View>
                    <View style={estilos.flex}>
                      <Text style={estilos.lembreteTitulo} numberOfLines={1}>
                        {item.titulo}
                      </Text>
                      <Text style={[estilos.lembreteSub, { color: cores.texto }]} numberOfLines={1}>
                        {pet ? `${pet.nome} · ${quando}` : quando}
                      </Text>
                    </View>
                    <Tocavel
                      accessibilityRole="button"
                      accessibilityLabel={`Marcar ${item.titulo} como feito`}
                      disabled={concluindo !== null}
                      onPress={() => feito(item)}
                      style={[estilos.feito, estilos.feitoClaro]}
                    >
                      <Icone nome="check" size={18} espessura={2.4} />
                      <Text style={estilos.feitoTexto}>Feito</Text>
                    </Tocavel>
                  </View>
                </Surgir>
              );
            })
          )}
        </View>

        {petAtivo ? (
          <Surgir indice={2} style={estilos.carteirinha}>
            <Gradiente de={colors.hero} ate={colors.premiumSurface} />
            <Tocavel
              accessibilityRole="button"
              accessibilityLabel={`Carteirinha de ${nomePet}`}
              onPress={() => router.push({ pathname: '/pet/[id]/carteirinha', params: { id: petAtivo.id } })}
              escala={0.98}
              style={estilos.carteirinhaTopo}
            >
              <View style={estilos.carteirinhaAvatar}>
                <AvatarPet especie={petAtivo.especie} foto={petAtivo.foto_url} size={46} />
              </View>
              <View style={estilos.flex}>
                <Text style={estilos.carteirinhaTitulo} numberOfLines={1}>
                  Carteirinha {petAtivo.sexo === 'femea' ? 'da' : 'do'} {petAtivo.nome}
                </Text>
                <View style={estilos.carteirinhaSelos}>
                  {proxima ? (
                    <Text style={[estilos.selo, estilos.seloBranco]}>{seloProximaVacina(proxima)}</Text>
                  ) : null}
                  {antirrabicaEmDia(vacinas) ? (
                    <Text style={[estilos.selo, estilos.seloVerde]}>Antirrábica ok</Text>
                  ) : null}
                </View>
              </View>
              <Icone nome="seta" size={16} espessura={2} />
            </Tocavel>

            <View style={estilos.carteirinhaAcoes}>
              <Tocavel
                accessibilityRole="button"
                accessibilityLabel={`Escanear cartão de vacina de ${petAtivo.nome}`}
                onPress={() => router.push(`/pet/${petAtivo.id}/documentos-saude`)}
                estiloExterno={estilos.flex}
                style={estilos.acao}
              >
                <Icone nome="camera" size={16} espessura={1.9} />
                <Text style={estilos.acaoTexto}>Escanear</Text>
              </Tocavel>
              <Tocavel
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/pet/[id]/medicamentos', params: { id: petAtivo.id } })}
                estiloExterno={estilos.flex}
                style={estilos.acao}
              >
                <Icone nome="capsula" size={16} espessura={1.9} />
                <Text style={estilos.acaoTexto}>Remédios</Text>
              </Tocavel>
              <Tocavel
                accessibilityRole="button"
                accessibilityLabel={`Enviar a carteirinha de ${petAtivo.nome}`}
                onPress={() => router.push(`/pet/${petAtivo.id}/compartilhar`)}
                estiloExterno={estilos.flex}
                style={estilos.acao}
              >
                <Icone nome="compartilhar" size={16} espessura={1.9} />
                <Text style={estilos.acaoTexto}>Enviar</Text>
              </Tocavel>
            </View>
          </Surgir>
        ) : null}
      </View>

      {/* Espaço para o menu inferior flutuante não cobrir o conteúdo. */}
      <View style={estilos.respiro} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  conteudo: { paddingBottom: 24 },
  flex: { flex: 1, minWidth: 0 },
  heroi: {
    backgroundColor: colors.hero,
    overflow: 'hidden',
    paddingTop: 50,
    paddingBottom: 24,
    minHeight: 236,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24 },
  local: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    maxWidth: 182,
    borderRadius: 22,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
  },
  localNome: { flexShrink: 1, fontFamily: fontFamily.bold, fontSize: 13, color: colors.black },
  botaoRedondo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pontoSino: {
    position: 'absolute',
    right: 9,
    top: 9,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D93B5A',
    borderWidth: 2,
    borderColor: colors.white,
  },
  botaoPerfil: { backgroundColor: colors.white },
  ola: { fontFamily: fontFamily.semiBold, fontSize: 13, lineHeight: 18, color: colors.primaryDark, marginTop: 14, paddingHorizontal: 24 },
  titulo: {
    fontFamily: fontFamily.medium,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1,
    color: colors.black,
    marginTop: 0,
    paddingHorizontal: 24,
  },
  petsRolagem: { marginTop: 10, flexGrow: 0 },
  pets: { gap: 8, paddingHorizontal: 24 },
  petChip: {
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 5,
    paddingRight: 14,
  },
  petChipAtivo: { backgroundColor: colors.black },
  petChipInativo: { backgroundColor: colors.white },
  petNome: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.black },
  etiquetaSenior: { fontFamily: fontFamily.bold, fontSize: 10, color: '#8A6414', backgroundColor: '#FFF0C9', borderRadius: 999, overflow: 'hidden', paddingVertical: 2, paddingHorizontal: 7 },
  petNomeAtivo: { color: colors.white },
  petMais: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corpo: { paddingHorizontal: 24, gap: 12 },
  vacina: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 20,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.10,
    shadowRadius: 17,
    elevation: 4,
  },
  vacinaRotulo: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.healthText },
  vacinaTitulo: { fontFamily: fontFamily.bold, fontSize: 20, letterSpacing: -0.2, color: colors.black, marginTop: 2 },
  vacinaBarra: { marginTop: 8 },
  vacinaBotao: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vacinaBotaoTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.white },
  atalhosRolagem: { marginHorizontal: -24, flexGrow: 0 },
  atalhos: { gap: 6, paddingHorizontal: 24, paddingBottom: 2, alignItems: 'flex-start' },
  atalho: {
    width: 72,
    alignItems: 'center',
    gap: 7,
  },
  atalhoSecundario: { width: 66, gap: 5, paddingTop: 8 },
  atalhosDivisor: { width: 1, height: 60, backgroundColor: colors.border, marginHorizontal: 8, marginTop: 10 },
  atalhoIcone: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atalhoIconeSecundario: { width: 48, height: 48, borderRadius: 18 },
  atalhoTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.black, textAlign: 'center' },
  atalhoTextoSecundario: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.textMuted },
  atalhoSos: { fontFamily: fontFamily.extraBold, color: colors.emergency },
  secao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 },
  secaoTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  secaoAcao: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.textMuted },
  hoje: { gap: 8 },
  lembrete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 24,
    paddingVertical: 8,
    paddingRight: 8,
    paddingLeft: 12,
  },
  lembreteVazio: { backgroundColor: colors.background, minHeight: 60 },
  lembreteIcone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lembreteTitulo: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  lembreteSub: { fontFamily: fontFamily.regular, fontSize: 12 },
  feito: {
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 16,
  },
  feitoDestaque: { backgroundColor: colors.black },
  feitoClaro: { backgroundColor: colors.white },
  feitoTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  feitoTextoDestaque: { color: colors.white },
  carteirinha: {
    borderRadius: 28,
    padding: 12,
    gap: 10,
    overflow: 'hidden',
  },
  carteirinhaTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  carteirinhaAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white, overflow: 'hidden' },
  carteirinhaTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  carteirinhaSelos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  selo: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  seloBranco: { backgroundColor: colors.white, color: colors.black },
  seloVerde: { backgroundColor: colors.successSurface, color: '#1F6B45' },
  carteirinhaAcoes: { flexDirection: 'row', gap: 6 },
  acao: {
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  acaoEscura: { backgroundColor: colors.black },
  acaoTexto: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.black },
  acaoTextoEscuro: { color: colors.white },
  respiro: { height: 90 },
});
