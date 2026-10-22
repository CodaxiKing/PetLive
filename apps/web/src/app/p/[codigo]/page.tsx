import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const metadata: Metadata = {
  title: 'Pet encontrado - PetLive',
  description: 'Página pública do QR da coleira. Escaneie para ver informações do pet e entrar em contato com o tutor.',
  openGraph: {
    title: 'Pet encontrado - PetLive',
    description: 'Alguém encontrou este pet. Escaneie o QR da coleira para ver as informações.',
    type: 'website',
  },
}

interface QrPublicoConteudo {
  pet: {
    id: string
    nome: string
    especie: string
    raca: string | null
    nascimento: string | null
    foto_url: string | null
  }
  secoes: ('nome_foto' | 'telefone' | 'alergias')[]
  tutor?: {
    nome: string
    telefone: string
  }
  alergias?: string | null
  veterinario?: string | null
  observacoes?: string | null
}

interface QrPublicoResponse {
  valido: boolean
  conteudo?: QrPublicoConteudo
  codigo?: string
  erro?: 'nao_encontrado' | 'revogado' | 'pet_inativo' | 'rate_limit'
}

interface PetEncontradoPageProps {
  params: Promise<{ codigo: string }>
}

function formatarTelefone(tel: string): string {
  const limpo = tel.replace(/\D/g, '')
  if (limpo.length === 11) {
    return limpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  if (limpo.length === 10) {
    return limpo.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return tel
}

function ehCelular(tel: string): boolean {
  const limpo = tel.replace(/\D/g, '')
  return limpo.length === 11 && ['6', '7', '8', '9'].includes(limpo[2])
}

function linkWhatsApp(tel: string): string {
  const limpo = tel.replace(/\D/g, '')
  return `https://wa.me/55${limpo}?text=Ol%C3%A1%2C+encontrei+seu+pet+pelo+QR+da+coleira+do+PetLive.`
}

function especieLabel(especie: string): string {
  return especie === 'gato' ? 'Gato' : 'Cão'
}

export default async function PetEncontradoPage({ params }: PetEncontradoPageProps) {
  const { codigo } = await params

  if (!codigo || codigo.length < 4) {
    notFound()
  }

  const { data, error } = await supabase.rpc('obter_qr_publico', { p_codigo: codigo })

  if (error) {
    console.error('[PetEncontrado] Erro ao buscar QR:', error)
    notFound()
  }

  const response = data as QrPublicoResponse

  if (!response.valido) {
    // Página específica para cada tipo de erro
    return <QrErro erro={response.erro} />
  }

  if (!response.conteudo) {
    notFound()
  }

  const { pet, secoes, tutor, alergias, veterinario, observacoes } = response.conteudo
  const temTelefone = secoes.includes('telefone') && tutor?.telefone
  const temAlergias = secoes.includes('alergias')

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero com foto do pet */}
      <div className="relative bg-gradient-to-b from-blue-100 to-white py-16 px-4 sm:py-24">
        <div className="max-w-md mx-auto text-center">
          {pet.foto_url ? (
            <img
              src={pet.foto_url}
              alt={pet.nome}
              className="w-36 h-36 sm:w-40 sm:h-40 rounded-full mx-auto mb-4 border-4 border-white shadow-lg object-cover"
            />
          ) : (
            <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-full mx-auto mb-4 border-4 border-white shadow-lg bg-blue-100 flex items-center justify-center">
              <svg
                className="w-20 h-20 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                {pet.especie === 'gato' ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 18h-3a6 6 0 01-6-6 4 4 0 014-4h2a4 4 0 014 4 6 6 0 01-6 6zm6 0h3a6 6 0 006-6 4 4 0 00-4-4h-2a4 4 0 00-4 4 6 6 0 006 6z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 18h-3a6 6 0 01-6-6 4 4 0 014-4h2a4 4 0 014 4 6 6 0 01-6 6zm6 0h3a6 6 0 006-6 4 4 0 00-4-4h-2a4 4 0 00-4 4 6 6 0 006 6z"
                  />
                )}
              </svg>
            </div>
          )}

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">{pet.nome}</h1>
          <p className="text-lg text-gray-600 mb-1">
            {especieLabel(pet.especie)}{' '}
            {pet.raca && `· ${pet.raca}`}
          </p>
          {pet.nascimento && (
            <p className="text-gray-500">
              {calcularIdade(pet.nascimento)}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pb-16 -mt-8">
        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Aviso fixo sobre localização */}
          <div className="bg-blue-50 border-b border-blue-100 p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-blue-800 font-medium">
                  &ldquo;Enviar local&rdquo; avisa o tutor onde você está agora. Só acontece se você tocar no botão.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Contato do tutor */}
            {temTelefone && tutor && (
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <h2 className="text-lg font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Contato do tutor
                </h2>
                <p className="text-gray-700 mb-3">{tutor.nome}</p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={`tel:${tutor.telefone.replace(/\D/g, '')}`}
                    className="flex-1 min-w-[140px] bg-green-600 text-white py-3 px-4 rounded-lg font-semibold text-center hover:bg-green-700 transition-colors"
                  >
                    Ligar para {tutor.nome}
                  </a>
                  {ehCelular(tutor.telefone) && (
                    <a
                      href={linkWhatsApp(tutor.telefone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[140px] bg-green-500 text-white py-3 px-4 rounded-lg font-semibold text-center hover:bg-green-600 transition-colors"
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Alergias e saúde */}
            {temAlergias && (alergias || veterinario || observacoes) && (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <h2 className="text-lg font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Alergias e condições
                </h2>
                {alergias && (
                  <div className="mb-4">
                    <p className="text-sm text-amber-700 font-medium mb-1">Alergias e condições</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{alergias}</p>
                  </div>
                )}
                {veterinario && (
                  <div className="mb-4">
                    <p className="text-sm text-amber-700 font-medium mb-1">Veterinário habitual</p>
                    <p className="text-gray-700">{veterinario}</p>
                  </div>
                )}
                {observacoes && (
                  <div>
                    <p className="text-sm text-amber-700 font-medium mb-1">Observações</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{observacoes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Botão enviar localização */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <button
                id="btn-enviar-local"
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold text-center hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Enviar minha localização
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">
                Ao tocar, o navegador vai pedir permissão para acessar sua localização.
                O tutor receberá um ponto no mapa com onde você está agora.
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Página do app PetLive · <a href="https://petlive.app" className="text-blue-600 hover:underline">Conhecer o app</a></p>
          <p className="mt-1">Código: {codigo}</p>
        </div>
      </div>

      {/* Script para geolocalização */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const btn = document.getElementById('btn-enviar-local');
              if (!btn) return;
              btn.addEventListener('click', async function() {
                if (!navigator.geolocation) {
                  alert('Seu navegador não suporta geolocalização.');
                  return;
                }
                btn.disabled = true;
                btn.textContent = 'Obtendo localização...';
                try {
                  const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                      enableHighAccuracy: true,
                      timeout: 10000,
                      maximumAge: 0
                    });
                  });
                  const { latitude, longitude } = pos.coords;
                  const resp = await fetch('/api/qr/enviar-local', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ codigo: '${codigo}', lat: latitude, lng: longitude })
                  });
                  if (resp.ok) {
                    btn.textContent = 'Localização enviada! ✓';
                    btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                    btn.classList.add('bg-green-600');
                  } else {
                    const err = await resp.json();
                    throw new Error(err.erro || 'Erro ao enviar');
                  }
                } catch (e) {
                  btn.disabled = false;
                  btn.textContent = 'Enviar minha localização';
                  btn.classList.remove('bg-green-600');
                  btn.classList.add('bg-blue-600');
                  alert('Não foi possível enviar: ' + e.message);
                }
              });
            })();
          `,
        }}
      />
    </main>
  )
}

function calcularIdade(nascimento: string): string {
  const nasc = new Date(`${nascimento}T00:00:00`)
  const hoje = new Date()
  let anos = hoje.getFullYear() - nasc.getFullYear()
  let meses = hoje.getMonth() - nasc.getMonth()
  if (hoje.getDate() < nasc.getDate()) meses -= 1
  if (meses < 0) {
    anos -= 1
    meses += 12
  }
  if (anos < 0) return 'menos de 1 mês'
  if (anos === 0) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`
  return `${anos} ${anos === 1 ? 'ano' : 'anos'}`
}

function QrErro({ erro }: { erro?: QrPublicoResponse['erro'] }) {
  const mensagens: Record<string, { titulo: string; descricao: string }> = {
    nao_encontrado: {
      titulo: 'QR não encontrado',
      descricao: 'Este código não existe ou foi digitado incorretamente.',
    },
    revogado: {
      titulo: 'QR desativado',
      descricao: 'O tutor revogou este QR da coleira. Não é mais possível acessar as informações.',
    },
    pet_inativo: {
      titulo: 'Pet não disponível',
      descricao: 'Este pet não está mais ativo no PetLive.',
    },
    rate_limit: {
      titulo: 'Muitas tentativas',
      descricao: 'Você fez muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.',
    },
  }

  const msg = mensagens[erro ?? 'nao_encontrado'] || mensagens.nao_encontrado

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-lg p-8">
        <div className="w-20 h-20 mx-auto mb-6 bg-red-50 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{msg.titulo}</h1>
        <p className="text-gray-600 mb-6">{msg.descricao}</p>
        <a
          href="https://petlive.app"
          className="inline-flex items-center gap-2 text-blue-600 font-medium hover:underline"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Voltar ao PetLive
        </a>
      </div>
    </main>
  )
}