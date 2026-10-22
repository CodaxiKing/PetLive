// PetLive: API route para proxy da Edge Function qr-location
// POST /api/qr/localizacao { codigo, lat, lng }
import { type NextRequest, NextResponse } from "next/server";

const EDGE_FUNCTIONS_URL = process.env.SUPABASE_EDGE_FUNCTIONS_URL ?? "";
const EDGE_FUNCTIONS_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";

export async function POST(request: NextRequest) {
  try {
    const corpo = await request.json();
    const { codigo, lat, lng } = corpo;

    if (!codigo || typeof codigo !== "string") {
      return NextResponse.json({ erro: "pedido", mensagem: 'Parâmetro "codigo" obrigatório.' }, { status: 400 });
    }
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ erro: "pedido", mensagem: "Coordenadas inválidas." }, { status: 400 });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ erro: "pedido", mensagem: "Coordenadas fora do intervalo válido." }, { status: 400 });
    }

    if (!EDGE_FUNCTIONS_URL || !EDGE_FUNCTIONS_ANON_KEY) {
      return NextResponse.json({ erro: "config", mensagem: "Edge Functions não configuradas." }, { status: 503 });
    }

    const resposta = await fetch(`${EDGE_FUNCTIONS_URL}/qr-location`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${EDGE_FUNCTIONS_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ codigo, lat, lng }),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      return NextResponse.json(dados, { status: resposta.status });
    }

    return NextResponse.json(dados, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ erro: "interno", mensagem }, { status: 500 });
  }
}