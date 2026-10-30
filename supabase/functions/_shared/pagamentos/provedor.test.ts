// Rode com: deno test supabase/functions/_shared/pagamentos/provedor.test.ts
import { assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert@1';
import { asaas, cpfValido, diaVencimento, ErroPagamento } from './provedor.ts';

type Chamada = { url: string; metodo: string; corpo: unknown; chave: string | null };

function falso(respostas: Record<string, { status?: number; corpo: unknown }>) {
  const chamadas: Chamada[] = [];
  const buscar = (async (url: string, init: RequestInit) => {
    const metodo = init.method ?? 'GET';
    chamadas.push({ url, metodo, corpo: init.body ? JSON.parse(String(init.body)) : undefined, chave: new Headers(init.headers).get('access_token') });
    const r = respostas[`${metodo} ${new URL(url).pathname}`];
    if (!r) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(r.corpo), { status: r.status ?? 200 });
  }) as typeof fetch;
  return { buscar, chamadas };
}

Deno.test('CPF: dígitos verificadores', () => {
  assertEquals(cpfValido('529.982.247-25'), '52998224725');
  assertEquals(cpfValido('529.982.247-24'), null);
  assertEquals(cpfValido('111.111.111-11'), null);
  assertEquals(cpfValido('123'), null);
});

Deno.test('vencimento no fuso de Brasília', () => {
  assertEquals(diaVencimento(new Date('2026-10-31T01:30:00Z')), '2026-10-30');
});

Deno.test('cria cliente e Pix com QR', async () => {
  const { buscar, chamadas } = falso({
    'POST /v3/customers': { corpo: { id: 'cus_1' } },
    'POST /v3/payments': { corpo: { id: 'pay_1' } },
    'GET /v3/payments/pay_1/pixQrCode': { corpo: { encodedImage: 'iVBOR', payload: '000201', expirationDate: '2026-10-30 23:59:59' } },
  });
  const p = asaas({ chave: 'k', buscar });
  assertEquals(await p.criarCliente({ nome: 'Ana', cpf: '529.982.247-25', referencia: 'u1' }), 'cus_1');
  const pix = await p.criarPix({ cliente: 'cus_1', valorCentavos: 17091, descricao: 'Pedido nº 1', referencia: 'pg1', venceEm: new Date('2026-10-30T15:00:00Z') });
  assertEquals(pix, { id: 'pay_1', payload: '000201', qrBase64: 'iVBOR', expiraEm: '2026-10-30 23:59:59' });
  assertEquals(chamadas[0].corpo, { name: 'Ana', cpfCnpj: '52998224725', externalReference: 'u1', notificationDisabled: true });
  assertEquals(chamadas[1].corpo, { customer: 'cus_1', billingType: 'PIX', value: 170.91, dueDate: '2026-10-30', description: 'Pedido nº 1', externalReference: 'pg1' });
  assertEquals(chamadas.every((c) => c.chave === 'k' && c.url.startsWith('https://api-sandbox.asaas.com/v3/')), true);
});

Deno.test('sem chave, CPF inválido e erro do provedor', async () => {
  await assertRejects(() => asaas({ chave: '' }).cancelarAssinatura('sub_1'), ErroPagamento, 'não está configurado');
  const { buscar, chamadas } = falso({ 'POST /v3/payments': { status: 400, corpo: { errors: [{ description: 'Cliente inválido.' }] } } });
  const p = asaas({ chave: 'k', buscar });
  await assertRejects(() => p.criarCliente({ nome: 'Ana', cpf: '000', referencia: 'u' }), ErroPagamento, 'CPF inválido');
  assertEquals(chamadas.length, 0);
  await assertRejects(() => p.criarPix({ cliente: 'x', valorCentavos: 1, descricao: 'd', referencia: 'r', venceEm: new Date() }), ErroPagamento, 'Cliente inválido.');
});

Deno.test('webhook: token, pagamento recebido e outros eventos', () => {
  const p = asaas({ chave: 'k', tokenWebhook: 'segredo' });
  const ok = new Headers({ 'asaas-access-token': 'segredo' });
  assertThrows(() => p.lerWebhook(new Headers({ 'asaas-access-token': 'x' }), {}), ErroPagamento);
  assertThrows(() => asaas({ chave: 'k' }).lerWebhook(new Headers(), {}), ErroPagamento);
  assertEquals(p.lerWebhook(ok, { event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1', value: 170.91, paymentDate: '2026-10-30' } }),
    { tipo: 'pago', id: 'pay_1', valorCentavos: 17091, pagoEm: '2026-10-30' });
  assertEquals(p.lerWebhook(ok, { event: 'PAYMENT_CREATED', payment: { id: 'pay_1', value: 1 } }), { tipo: 'ignorado' });
});
