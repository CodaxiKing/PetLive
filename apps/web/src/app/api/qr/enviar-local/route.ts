import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { codigo, lat, lng } = body

    if (!codigo || typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ erro: 'Parâmetros inválidos' }, { status: 400 })
    }

    // Valida coordenadas
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ erro: 'Coordenadas inválidas' }, { status: 400 })
    }

    // Busca o pet_id pelo código para registrar no log
    const { data: settings, error: settingsError } = await supabase
      .from('pet_qr_settings')
      .select('pet_id')
      .eq('codigo', codigo)
      .maybeSingle()

    if (settingsError) {
      console.error('[enviar-local] Erro ao buscar settings:', settingsError)
      return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
    }

    if (!settings) {
      return NextResponse.json({ erro: 'QR não encontrado' }, { status: 404 })
    }

    // Registra o scan com localização
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconhecido'
    const ipHash = await hashIp(ip)

    await supabase.from('qr_scans').insert({
      pet_id: settings.pet_id,
      codigo,
      ip_hash: ipHash,
      user_agent: request.headers.get('user-agent') || null,
      lat,
      lng,
    })

    // Envia push para o tutor (via edge function ou direto se tiver service role)
    // Por enquanto, apenas registra no banco. O tutor receberá push via trigger ou job.
    // TODO: implementar envio de push notification

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[enviar-local] Erro:', e)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}

async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + 'petlive-qr-scan')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}