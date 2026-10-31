/**
 * Camada única de pagamento (BUSINESS.md 23.1). Funções e telas falam só com
 * esta interface; trocar de provedor mexe apenas neste arquivo. Hoje: Asaas,
 * em sandbox por padrão (ASAAS_URL aponta para produção só quando configurado).
 */
export type CobrancaPix = { id: string; payload: string; qrBase64: string; expiraEm: string | null };
export type EventoPagamento =
  | { tipo: 'pago'; id: string; valorCentavos: number; pagoEm: string | null }
  | { tipo: 'ignorado' };

export interface ProvedorPagamento {
  criarCliente(dados: { nome: string; cpf: string; referencia: string }): Promise<string>;
  criarPix(dados: { cliente: string; valorCentavos: number; descricao: string; referencia: string; venceEm: Date }): Promise<CobrancaPix>;
  cancelarAssinatura(id: string): Promise<void>;
  /** O provedor responde (página de status). Só leitura, sem criar nada. */
  saude(): Promise<boolean>;
  lerWebhook(cabecalhos: Headers, corpo: unknown): EventoPagamento;
}

export class ErroPagamento extends Error {
  constructor(readonly codigo: 'sem_chave' | 'provedor' | 'dados' | 'nao_autorizado', mensagem: string) {
    super(mensagem);
  }
}

/** CPF com 11 dígitos e dígitos verificadores corretos. Devolve só os números. */
export function cpfValido(valor: string): string | null {
  const d = valor.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return null;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(d[n])) return null;
  }
  return d;
}

/** Data de vencimento do Asaas (dia, no fuso de Brasília). */
export function diaVencimento(data: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(data);
}

type Busca = typeof fetch;

export function asaas(opcoes: { chave: string; url?: string; tokenWebhook?: string; buscar?: Busca }): ProvedorPagamento {
  const base = (opcoes.url || 'https://api-sandbox.asaas.com/v3').replace(/\/$/, '');
  const buscar = opcoes.buscar ?? fetch;

  async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
    if (!opcoes.chave) throw new ErroPagamento('sem_chave', 'O Pix ainda não está configurado.');
    const resposta = await buscar(base + caminho, {
      method: metodo,
      headers: { access_token: opcoes.chave, 'Content-Type': 'application/json', 'User-Agent': 'PetLive' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await resposta.text();
    const json = texto ? JSON.parse(texto) : {};
    if (!resposta.ok) {
      const descricao = json?.errors?.[0]?.description;
      throw new ErroPagamento(resposta.status === 400 ? 'dados' : 'provedor', descricao || 'O provedor de pagamento não respondeu. Tente de novo.');
    }
    return json as T;
  }

  return {
    async criarCliente({ nome, cpf, referencia }) {
      const doc = cpfValido(cpf);
      if (!doc) throw new ErroPagamento('dados', 'CPF inválido.');
      const r = await chamar<{ id: string }>('POST', '/customers', { name: nome.slice(0, 100), cpfCnpj: doc, externalReference: referencia, notificationDisabled: true });
      return r.id;
    },
    async criarPix({ cliente, valorCentavos, descricao, referencia, venceEm }) {
      const cobranca = await chamar<{ id: string }>('POST', '/payments', {
        customer: cliente,
        billingType: 'PIX',
        value: valorCentavos / 100,
        dueDate: diaVencimento(venceEm),
        description: descricao.slice(0, 500),
        externalReference: referencia,
      });
      const qr = await chamar<{ encodedImage: string; payload: string; expirationDate?: string }>('GET', `/payments/${cobranca.id}/pixQrCode`);
      return { id: cobranca.id, payload: qr.payload, qrBase64: qr.encodedImage, expiraEm: qr.expirationDate ?? null };
    },
    async cancelarAssinatura(id) {
      await chamar('DELETE', `/subscriptions/${encodeURIComponent(id)}`);
    },
    async saude() {
      await chamar('GET', '/customers?limit=1');
      return true;
    },
    lerWebhook(cabecalhos, corpo) {
      if (!opcoes.tokenWebhook || cabecalhos.get('asaas-access-token') !== opcoes.tokenWebhook) {
        throw new ErroPagamento('nao_autorizado', 'Token do webhook inválido.');
      }
      const c = corpo as { event?: string; payment?: { id?: string; value?: number; paymentDate?: string; clientPaymentDate?: string } };
      if ((c?.event === 'PAYMENT_RECEIVED' || c?.event === 'PAYMENT_CONFIRMED') && c.payment?.id && typeof c.payment.value === 'number') {
        return { tipo: 'pago', id: c.payment.id, valorCentavos: Math.round(c.payment.value * 100), pagoEm: c.payment.clientPaymentDate ?? c.payment.paymentDate ?? null };
      }
      return { tipo: 'ignorado' };
    },
  };
}

/** Provedor configurado pelas variáveis do projeto (secrets das Edge Functions). */
export function provedorPadrao(): ProvedorPagamento {
  return asaas({
    chave: Deno.env.get('ASAAS_API_KEY') ?? '',
    url: Deno.env.get('ASAAS_URL') ?? undefined,
    tokenWebhook: Deno.env.get('ASAAS_WEBHOOK_TOKEN') ?? '',
  });
}
