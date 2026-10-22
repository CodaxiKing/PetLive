// PetLive: API route para proxy da Edge Function public-qr
// GET /api/qr/publica?codigo=xxx
import { type NextRequest, NextResponse } from "next/server";

const EDGE_FUNCTIONS_URL = process.env.SUPABASE_EDGE_FUNCTIONS_URL ?? "";
const EDGE_FUNCTIONS_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codigo = searchParams.get("codigo");

    if (!codigo) {
      return NextResponse.json({ erro: "pedido", mensagem: 'Parâmetro "codigo" obrigatório.' }, { status: 400 });
    }

    if (!EDGE_FUNCTIONS_URL || !EDGE_FUNCTIONS_ANON_KEY) {
      return NextResponse.json({ erro: "config", mensagem: "Edge Functions não configuradas." }, { status: 503 });
    }

    const resposta = await fetch(`${EDGE_FUNCTIONS_URL}/public-qr?codigo=${encodeURIComponent(codigo)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${EDGE_FUNCTIONS_ANON_KEY}`,
        "Content-Type": "application/json",
      },
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