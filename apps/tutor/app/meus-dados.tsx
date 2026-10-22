import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../src/auth/AuthProvider'
import { BotaoPrimario } from '../src/components/BotaoPrimario'
import { Campo } from '../src/components/Campo'
import { HeroiOnda } from '../src/components/HeroiOnda'
import { Interruptor } from '../src/components/Interruptor'
import { mensagemDeErro } from '../src/lib/cacheOffline'
import { mascaraTelefone, telefoneValido } from '../src/lib/mascaras'
import { supabase } from '../src/lib/supabase'
import { colors } from '../src/theme/colors'
import { fontFamily } from '../src/theme/typography'

type Dados = {
  nome: string
  telefone: string
  whatsapp: boolean
  cidade: string
  contato_emergencia_nome: string
  contato_emergencia_telefone: string
}

/**
 * Meus dados: nome, celular (com WhatsApp), cidade e um contato de
 * emergência. São os contatos que a carteirinha, a ficha de emergência e o
 * acesso de cuidador mostram quando o tutor libera; o e-mail não aparece
 * para ninguém.
 */
export default function MeusDados() {
  const { user } = useAuth()
  const [dados, setDados] = useState<Dados | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('nome, telefone, whatsapp, cidade, contato_emergencia_nome, contato_emergencia_telefone')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const d = (data ?? {}) as Partial<Record<keyof Dados, string | boolean | null>>
        setDados({
          nome: (d.nome as string) ?? '',
          telefone: mascaraTelefone((d.telefone as string) ?? ''),
          whatsapp: d.whatsapp !== false,
          cidade: (d.cidade as string) ?? '',
          contato_emergencia_nome: (d.contato_emergencia_nome as string) ?? '',
          contato_emergencia_telefone: mascaraTelefone((d.contato_emergencia_telefone as string) ?? ''),
        })
      })
  }, [user])

  if (!dados) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <ActivityIndicator color={colors.primaryDeep} />
      </View>
    )
  }
  const mudar = (campo: keyof Dados, valor: string | boolean) => setDados((d) => (d ? { ...d, [campo]: valor } : d))

  async function salvar() {
    if (!user || !dados) return
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
    setSalvando(true)
    try {
      const nome = dados.nome.trim()
      const { error } = await supabase
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
      if (error) throw new Error(error.message)
      // Mantém o nome do auth em dia (aparece em outras telas).
      await supabase.auth.updateUser({ data: { nome, full_name: nome } }).catch(() => undefined)
      router.back()
    } catch (e) {
      Alert.alert('Não deu para salvar', mensagemDeErro(e instanceof Error ? e.message : String(e)))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo="Perfil" titulo="Meus dados" altura={200} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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

        <Text style={estilos.secao}>Contato de emergência</Text>
        <Text style={estilos.ajuda}>Alguém para a clínica ou o cuidador procurar se não conseguirem falar com você.</Text>
        <Campo rotulo="Nome" variante="verde" autoCapitalize="words" placeholder="Ex.: Ana (irmã)" value={dados.contato_emergencia_nome} onChangeText={(v) => mudar('contato_emergencia_nome', v)} maxLength={60} />
        <Campo rotulo="Celular" variante="verde" mascara="telefone" placeholder="(21) 99999-9999" value={dados.contato_emergencia_telefone} onChangeText={(v) => mudar('contato_emergencia_telefone', v)} />

        <Text style={estilos.nota}>Seu e-mail não aparece para ninguém. O celular e o contato de emergência só aparecem nos links que você enviar e quando você liberar.</Text>
      </ScrollView>
      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Salvar" carregando={salvando} onPress={salvar} />
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  centro: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 18 },
  linhaTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  linhaSub: { fontFamily: fontFamily.regular, fontSize: 12, color: '#5E6878' },
  secao: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black, marginTop: 8 },
  ajuda: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: '#5E6878', marginTop: -6 },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: '#6A7484', marginTop: 4 },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
})
