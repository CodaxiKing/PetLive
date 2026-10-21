import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
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
  compartilharCarteirinha,
  proximaVacina,
  seloProximaVacina,
  textoProximaVacina,
} from '../../src/pets/carteirinha';
import { usePets } from '../../src/pets/PetsProvider';
import { useVacinas } from '../../src/saude/VacinasProvider';
import { colors } from '../../src/theme/colors';
import { fontFamily } from '../../src/theme/typography';

/** Atalhos do Início (protótipo: fundo pastel, ícone num círculo branco). Só os da Fase 1. */
const ATALHOS: { nome: string; fundo: string; icone: NomeIcone; cor?: string; destino: Href }[] = [
  { nome: 'SOS', fundo: '#FBDADF', icone: 'cruz', cor: '#B3173A', destino: '/sos' },
  { nome: 'Lugares', fundo: '#E3F3FC', icone: 'local', destino: '/mapa' },
  { nome: 'Calcular', fundo: '#FFF0C9', icone: 'calculadora', destino: '/ferramentas/calculadoras' },
  { nome: 'Rotina', fundo: '#DDF3E6', icone: 'relogio', destino: '/lembretes/rotina' },
  { nome: 'Lembretes', fundo: '#EBDDFB', icone: 'sino', destino: '/lembretes' },
  { nome: 'Pet friendly', fundo: '#FFE3CC', icone: 'pata', destino: '/mapa/pet-friendly' },
];

/** Cartões de "Hoje", alternados (protótipo Início). */
const PALETA_HOJE = [
  { fundo: '#EBDDFB', texto: '#5B3C8F' },
  { fundo: '#FCE1EF', texto: '#8A2E5C' },
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
  const { pets, petAtivo, definirPetAtivo } = usePets();
  const { lembretes, concluirLembrete } = useLembretes();
  const { vacinas } = useVacinas();
  const cidade = useCidade();
  const [ola] = useState(saudacao);
  const [limiteHoje] = useState(fimDeHoje);
  const [concluindo, setConcluindo] = useState<string | null>(null);

  const hoje = lembretes.filter((l) => new Date(l.proxima_em).getTime() <= limiteHoje).slice(0, 3);
  const proxima = proximaVacina(vacinas);
  const nomePet = petAtivo?.nome ?? 'seu pet';

  function feito(lembrete: Lembrete) {
    if (concluindo) return;
    setConcluindo(lembrete.id);
    concluirLembrete(lembrete)
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
            accessibilityLabel="Avisos"
            onPress={() => router.push('/avisos')}
            style={estilos.botaoRedondo}
          >
            <IconeSino />
          </Tocavel>
          <Tocavel
            accessibilityRole="button"
            accessibilityLabel="Perfil"
            onPress={() => router.navigate('/perfil')}
            style={[estilos.botaoRedondo, estilos.botaoPerfil]}
          >
            <IconePerfil cor={colors.white} />
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

        <OndaHeroi largura={width} />
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
                      cor={proxima.dias < 0 ? '#F28B9B' : colors.hero}
                      fundo="#2B2F36"
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
            <Surgir key={atalho.nome} indice={Math.min(i, 4)}>
              <Tocavel
                accessibilityRole="button"
                onPress={() => router.push(atalho.destino)}
                style={[estilos.atalho, { backgroundColor: atalho.fundo }]}
              >
                <View style={estilos.atalhoIcone}>
                  <Icone nome={atalho.icone} size={20} cor={atalho.cor} espessura={atalho.cor ? 2.2 : 1.9} />
                </View>
                <Text
                  style={estilos.atalhoTexto}
                  numberOfLines={atalho.nome.includes(' ') ? 2 : 1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {atalho.nome}
                </Text>
              </Tocavel>
            </Surgir>
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
            hoje.map((lembrete, i) => {
              const cores = PALETA_HOJE[i % PALETA_HOJE.length];
              const pet = pets.find((p) => p.id === lembrete.pet_id);
              const quando = quandoHoje(lembrete.proxima_em);
              const destaque = i === 0;
              return (
                <Surgir key={lembrete.id} indice={i}>
                  <View style={[estilos.lembrete, { backgroundColor: cores.fundo }]}>
                    <View style={estilos.lembreteIcone}>
                      <Icone nome={ICONE_TIPO[lembrete.tipo]} size={18} />
                    </View>
                    <View style={estilos.flex}>
                      <Text style={estilos.lembreteTitulo} numberOfLines={1}>
                        {lembrete.titulo}
                      </Text>
                      <Text style={[estilos.lembreteSub, { color: cores.texto }]} numberOfLines={1}>
                        {pet ? `${pet.nome} · ${quando}` : quando}
                      </Text>
                    </View>
                    <Tocavel
                      accessibilityRole="button"
                      accessibilityLabel={`Marcar ${lembrete.titulo} como feito`}
                      disabled={concluindo !== null}
                      onPress={() => feito(lembrete)}
                      style={[estilos.feito, destaque ? estilos.feitoDestaque : estilos.feitoClaro]}
                    >
                      <Icone nome="check" size={18} cor={destaque ? colors.white : colors.black} espessura={2.4} />
                      <Text style={[estilos.feitoTexto, destaque && estilos.feitoTextoDestaque]}>Feito</Text>
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
                onPress={() => compartilharCarteirinha(petAtivo, vacinas)}
                estiloExterno={estilos.flex}
                style={[estilos.acao, estilos.acaoEscura]}
              >
                <Icone nome="compartilhar" size={16} cor={colors.white} espessura={1.9} />
                <Text style={[estilos.acaoTexto, estilos.acaoTextoEscuro]}>Enviar</Text>
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
    paddingBottom: 42,
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
  botaoPerfil: { backgroundColor: colors.black },
  ola: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.primaryDark, marginTop: 14, paddingHorizontal: 24 },
  titulo: {
    fontFamily: fontFamily.medium,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1,
    color: colors.black,
    marginTop: 2,
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
    backgroundColor: colors.black,
    borderRadius: 28,
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 20,
  },
  vacinaRotulo: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.hero },
  vacinaTitulo: { fontFamily: fontFamily.bold, fontSize: 20, letterSpacing: -0.2, color: colors.white, marginTop: 2 },
  vacinaBarra: { marginTop: 8 },
  vacinaBotao: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vacinaBotaoTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.black },
  atalhosRolagem: { marginHorizontal: -24, flexGrow: 0 },
  atalhos: { gap: 8, paddingHorizontal: 24 },
  atalho: {
    width: 72,
    borderRadius: 24,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 8,
  },
  atalhoIcone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atalhoTexto: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.black, textAlign: 'center' },
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
