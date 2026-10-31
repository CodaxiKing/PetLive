import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import * as Location from 'expo-location'
import { useAuth } from '../src/auth/AuthProvider'
import { Tocavel } from '../src/components/Animacoes'
import { BotaoPrimario } from '../src/components/BotaoPrimario'
import { Campo } from '../src/components/Campo'
import { HeroiOnda } from '../src/components/HeroiOnda'
import { Icone } from '../src/components/Icone'
import { Interruptor } from '../src/components/Interruptor'
import { mensagemDeErro } from '../src/lib/cacheOffline'
import { mascaraTelefone, telefoneValido } from '../src/lib/mascaras'
import { supabase } from '../src/lib/supabase'
import { escolherFoto } from '../src/pets/CampoFoto'
import { enviarFotoPerfil, removerFotoPerfil, urlFotoPerfil } from '../src/perfil/foto'
import { temSenha } from '../src/perfil/senha'
import { colors } from '../src/theme/colors'
import { fontFamily } from '../src/theme/typography'
import { textoDeErro } from '../src/lib/erros'

type Dados = {
  nome: string
  telefone: string
  whatsapp: boolean
  cidade: string
  contato_emergencia_nome: string
  contato_emergencia_telefone: string
}

/**
 * Editar perfil: foto, nome, celular (com WhatsApp), cidade e um contato de
 * emergência, e o acesso à troca de senha. São os contatos que a carteirinha,
 * a ficha de emergência e o acesso de cuidador mostram quando o tutor libera;
 * o e-mail não aparece para ninguém.
 */
export default function MeusDados() {
  const { user } = useAuth()
  return user ? <FormularioPerfil key={user.id} tutorId={user.id} /> : null
}

function FormularioPerfil({ tutorId }: { tutorId: string }) {
  const { user } = useAuth()
  const [dados, setDados] = useState<Dados | null>(null)
  const [salvando, setSalvando] = useState(false)
  // A foto é salva na hora em que é escolhida, sem esperar o botão Salvar.
  const [foto, setFoto] = useState<string | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [localizando, setLocalizando] = useState(false)
  const [erroCarga, setErroCarga] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const trava = useRef(false)
  const montado = useRef(true)
  useEffect(() => { montado.current = true; return () => { montado.current = false } }, [])

  useEffect(() => {
    let ativo = true
    void Promise.resolve(supabase
      .from('profiles')
      .select('nome, telefone, whatsapp, cidade, contato_emergencia_nome, contato_emergencia_telefone, avatar_url')
      .eq('id', tutorId)
      .single())
      .then(async ({ data, error }) => {
        if (!ativo) return
        if (error || !data) throw new Error('Perfil indisponível')
        const d = (data ?? {}) as Partial<Record<keyof Dados | 'avatar_url', string | boolean | null>>
        const caminho = (d.avatar_url as string) || null
        setFoto(caminho)
        const url = await urlFotoPerfil(caminho)
        if (!ativo) return
        setFotoUrl(url)
        setDados({
          nome: (d.nome as string) ?? '',
          telefone: mascaraTelefone((d.telefone as string) ?? ''),
          whatsapp: d.whatsapp !== false,
          cidade: (d.cidade as string) ?? '',
          contato_emergencia_nome: (d.contato_emergencia_nome as string) ?? '',
          contato_emergencia_telefone: mascaraTelefone((d.contato_emergencia_telefone as string) ?? ''),
        })
      }).catch(() => { if (ativo) setErroCarga(true) })
    return () => { ativo = false }
  }, [tutorId, tentativa])

  if (!dados) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        {erroCarga ? <View style={estilos.falhaCarga}>
          <Text accessibilityRole="alert" style={estilos.ajuda}>Não foi possível carregar seu perfil. Confira a conexão e tente novamente.</Text>
          <BotaoPrimario titulo="Tentar novamente" onPress={() => { setErroCarga(false); setTentativa(n => n + 1) }} />
          <Tocavel accessibilityRole="button" onPress={() => router.back()}><Text style={estilos.fotoTexto}>Voltar</Text></Tocavel>
        </View> : <ActivityIndicator color={colors.primaryDeep} />}
      </View>
    )
  }
  const mudar = (campo: keyof Dados, valor: string | boolean) => setDados((d) => (d ? { ...d, [campo]: valor } : d))
  const inicial = (dados.nome.trim() || user?.email || '?').charAt(0).toUpperCase()

  function trocarFoto() {
    if (!user || trava.current || enviandoFoto) return
    const usar = (origem: 'galeria' | 'camera') => async () => {
      if (trava.current) return
      trava.current = true
      setEnviandoFoto(true)
      try {
        const ativo = await escolherFoto(origem)
        if (!ativo || !montado.current) return
        const caminho = await enviarFotoPerfil(user.id, ativo, foto)
        if (!montado.current) return
        setFoto(caminho)
        // Mostra a foto escolhida já, sem esperar o link assinado.
        setFotoUrl(ativo.uri)
      } catch (e) {
        if (montado.current) Alert.alert('Não deu para trocar a foto', textoDeErro(e))
      } finally {
        trava.current = false
        if (montado.current) setEnviandoFoto(false)
      }
    }
    const remover = async () => {
      if (trava.current) return
      trava.current = true
      setEnviandoFoto(true)
      try {
        await removerFotoPerfil(user.id, foto)
        if (!montado.current) return
        setFoto(null)
        setFotoUrl(null)
      } catch (e) {
        if (montado.current) Alert.alert('Não deu para remover a foto', textoDeErro(e))
      } finally {
        trava.current = false
        if (montado.current) setEnviandoFoto(false)
      }
    }
    Alert.alert('Sua foto', 'Ela aparece só para você, no seu perfil.', [
      foto ? { text: 'Remover', style: 'destructive', onPress: remover } : { text: 'Cancelar', style: 'cancel' },
      { text: 'Galeria', onPress: usar('galeria') },
      { text: 'Câmera', onPress: usar('camera') },
    ])
  }

  async function usarLocalizacao() {
    if (localizando) return
    setLocalizando(true)
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync()
      if (!granted) {
        Alert.alert('Localização desligada', 'Autorize a localização nas configurações do aparelho ou digite a cidade.')
        return
      }
      const posicao = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const [endereco] = await Location.reverseGeocodeAsync(posicao.coords)
      const cidade = endereco?.city ?? endereco?.subregion
      if (cidade) mudar('cidade', cidade.slice(0, 60))
      else Alert.alert('Cidade não encontrada', 'Digite o nome da sua cidade.')
    } catch {
      Alert.alert('Não deu para usar a localização', 'Confira o GPS e a internet ou digite a cidade.')
    } finally {
      setLocalizando(false)
    }
  }

  async function salvar() {
    if (!user || !dados || trava.current) return
    if (dados.nome.trim().length < 2) {
      Alert.alert('Falta o nome', 'Como você quer ser chamado?')
      return
    }
    if (dados.telefone && !telefoneValido(dados.telefone)) {
      Alert.alert('Confira o celular', 'Use o DDD e o número, como (21) 99999-9999.')
      return
    }
    if (dados.contato_emergencia_telefone && !telefoneValido(dados.contato_emergencia_telefone)) {
      Alert.alert('Confira o contato de emergência', 'Use o DDD e o número, como (21) 99999-9999.')
      return
    }
    trava.current = true
    setSalvando(true)
    try {
      const nome = dados.nome.trim()
      const { data: salvo, error } = await supabase
        .from('profiles')
        .update({
          nome,
          telefone: dados.telefone || null,
          whatsapp: dados.whatsapp,
          cidade: dados.cidade.trim() || null,
          contato_emergencia_nome: dados.contato_emergencia_nome.trim() || null,
          contato_emergencia_telefone: dados.contato_emergencia_telefone || null,
        })
        .eq('id', user.id)
        .select('id')
        .single()
      if (error || salvo?.id !== tutorId) throw new Error(error?.message ?? 'Seu perfil não foi salvo. Tente novamente.')
      if (!montado.current) return
      if (montado.current) router.back()
    } catch (e) {
      if (montado.current) Alert.alert('Não deu para salvar', mensagemDeErro(textoDeErro(e)))
    } finally {
      trava.current = false
      if (montado.current) setSalvando(false)
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo="Perfil" titulo="Editar perfil" altura={200} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={estilos.fotoBloco}>
          <Tocavel accessibilityRole="button" accessibilityLabel="Trocar foto do perfil" onPress={trocarFoto} style={estilos.foto}>
            {fotoUrl ? <Image source={{ uri: fotoUrl }} style={estilos.fotoImagem} /> : <Text style={estilos.fotoLetra}>{inicial}</Text>}
            <View style={estilos.fotoBotao}>
              {enviandoFoto ? <ActivityIndicator size="small" color={colors.white} /> : <Icone nome="camera" size={16} cor={colors.white} espessura={2.2} />}
            </View>
          </Tocavel>
          <Text style={estilos.fotoTexto}>{foto ? 'Trocar foto' : 'Adicionar foto'}</Text>
        </View>
        <Campo rotulo="Como você quer ser chamado" variante="roxo" autoCapitalize="words" value={dados.nome} onChangeText={(v) => mudar('nome', v)} maxLength={60} />
        <Campo rotulo="Celular com DDD" variante="amarelo" mascara="telefone" placeholder="(21) 99999-9999" value={dados.telefone} onChangeText={(v) => mudar('telefone', v)} />
        <View style={estilos.linha}>
          <View style={estilos.flex}>
            <Text style={estilos.linhaTitulo}>Este celular tem WhatsApp</Text>
            <Text style={estilos.linhaSub}>Mostra o botão Chamar no WhatsApp para a clínica e o cuidador</Text>
          </View>
          <Interruptor ligado={dados.whatsapp} rotulo="Este celular tem WhatsApp" onToggle={() => mudar('whatsapp', !dados.whatsapp)} />
        </View>
        <Campo rotulo="Cidade" variante="azul" autoCapitalize="words" placeholder="Rio de Janeiro" value={dados.cidade} onChangeText={(v) => mudar('cidade', v)} maxLength={60} />
        <Tocavel accessibilityRole="button" onPress={usarLocalizacao} disabled={localizando} style={estilos.localizacao}>
          {localizando ? <ActivityIndicator size="small" color={colors.primaryDeep} /> : <Icone nome="mira" size={16} cor={colors.primaryDeep} espessura={2.2} />}
          <Text style={estilos.localizacaoTexto}>Usar minha localização</Text>
        </Tocavel>

        <Text style={estilos.secao}>Contato de emergência</Text>
        <Text style={estilos.ajuda}>Alguém para a clínica ou o cuidador procurar se não conseguirem falar com você.</Text>
        <Campo rotulo="Nome" variante="verde" autoCapitalize="words" placeholder="Ex.: Ana (irmã)" value={dados.contato_emergencia_nome} onChangeText={(v) => mudar('contato_emergencia_nome', v)} maxLength={60} />
        <Campo rotulo="Celular" variante="verde" mascara="telefone" placeholder="(21) 99999-9999" value={dados.contato_emergencia_telefone} onChangeText={(v) => mudar('contato_emergencia_telefone', v)} />

        <Text style={estilos.secao}>Conta</Text>
        <Tocavel accessibilityRole="button" accessibilityLabel="Alterar e-mail de acesso" onPress={() => router.push('/alterar-email')} style={estilos.linha}>
          <View style={estilos.flex}>
            <Text style={estilos.linhaSub}>E-mail de acesso</Text>
            <Text style={estilos.linhaTitulo} numberOfLines={1}>{user?.email ?? '—'}</Text>
          </View>
          <Icone nome="seta" size={18} cor="#566070" />
        </Tocavel>
        {temSenha(user) ? (
          <Tocavel accessibilityRole="button" onPress={() => router.push('/alterar-senha')} style={estilos.linha}>
            <View style={estilos.flex}>
              <Text style={estilos.linhaTitulo}>Alterar senha</Text>
              <Text style={estilos.linhaSub}>Pede a senha atual antes da nova</Text>
            </View>
            <Icone nome="seta" size={18} espessura={2} />
          </Tocavel>
        ) : (
          <Text style={estilos.ajuda}>Você entra com Google ou Apple, então não há senha do PetLive para trocar.</Text>
        )}

        <Text style={estilos.nota}>Seu e-mail não aparece para ninguém. O celular e o contato de emergência só aparecem nos links que você enviar e quando você liberar.</Text>
      </ScrollView>
      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Salvar" carregando={salvando} desabilitado={enviandoFoto} onPress={salvar} />
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { alignItems: 'center', justifyContent: 'center' },
  falhaCarga: { paddingHorizontal: 24, gap: 20, width: '100%' },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 18 },
  linhaTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  linhaSub: { fontFamily: fontFamily.regular, fontSize: 12, color: '#566070' },
  secao: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black, marginTop: 8 },
  ajuda: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: '#566070', marginTop: -6 },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: '#566070', marginTop: 4 },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
  fotoBloco: { alignItems: 'center', gap: 6, paddingTop: 8, marginBottom: 4 },
  foto: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  fotoImagem: { width: 92, height: 92, borderRadius: 46 },
  fotoLetra: { fontFamily: fontFamily.semiBold, fontSize: 38, color: colors.black },
  fotoBotao: {
    position: 'absolute', right: -2, bottom: 2, width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.black, borderWidth: 3, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  fotoTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.primaryDeep },
  localizacao: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: -4,
    height: 40, paddingLeft: 12, paddingRight: 16, borderRadius: 20, backgroundColor: colors.primarySurface,
  },
  localizacaoTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.primaryDeep },
})
