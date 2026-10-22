// Testa o acesso ao painel admin: sem 2FA é recusado, com 2FA entra, e o
// tutor comum nunca entra. Uso: node supabase/tests/testar-admin.mjs <ANON_KEY>
// Precisa de admin@petlive.dev (super, sem fator) e demo@petlive.dev (tutor).
import { createHmac } from 'node:crypto';

const BASE = 'http://127.0.0.1:54321';
const ANON = process.argv[2];
let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${msg}`);
  if (!cond) falhas++;
};

const pedir = async (caminho, { token, metodo = 'POST', corpo } = {}) => {
  const r = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: { apikey: ANON, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
};
const entrar = async (email) =>
  (await pedir('/auth/v1/token?grant_type=password', { corpo: { email, password: 'petlive123' } })).corpo.access_token;
const rpc = (nome, token, corpo = {}) => pedir(`/rest/v1/rpc/${nome}`, { token, corpo });

// TOTP (RFC 6238) para gerar o código do "app autenticador".
function totp(segredoBase32) {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of segredoBase32.replace(/=+$/, '')) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0');
  const chave = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac('sha1', chave).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}

// 1) Tutor comum.
const tutor = await entrar('demo@petlive.dev');
ok((await rpc('admin_eu', tutor)).corpo.admin === false, 'tutor comum não é da equipe');
ok((await rpc('admin_visao', tutor)).status >= 400, 'tutor comum não vê a visão geral');

// 2) Admin sem o segundo fator.
const aal1 = await entrar('admin@petlive.dev');
const eu1 = (await rpc('admin_eu', aal1)).corpo;
ok(eu1.admin === true && eu1.verificado === false, 'admin sem 2FA: é da equipe, mas não verificado');
ok((await rpc('admin_visao', aal1)).status >= 400, 'admin sem 2FA não vê dados');

// 3) Cadastra o app autenticador e verifica.
const fator = (await pedir('/auth/v1/factors', { token: aal1, corpo: { factor_type: 'totp', friendly_name: `teste-${Date.now()}` } })).corpo;
ok(Boolean(fator.totp?.secret), 'cadastro do app autenticador devolve o segredo (QR)');
const desafio = (await pedir(`/auth/v1/factors/${fator.id}/challenge`, { token: aal1, corpo: {} })).corpo;
const verificado = (await pedir(`/auth/v1/factors/${fator.id}/verify`, {
  token: aal1,
  corpo: { challenge_id: desafio.id, code: totp(fator.totp.secret) },
})).corpo;
const aal2 = verificado.access_token;
ok(Boolean(aal2), 'código do autenticador aceito');
ok((await rpc('admin_eu', aal2)).corpo.verificado === true, 'com 2FA: verificado');

const visao = await rpc('admin_visao', aal2);
ok(visao.status === 200 && typeof visao.corpo.tutores === 'number', `visão geral com 2FA (${visao.corpo.tutores} tutores)`);
const usuarios = (await rpc('admin_usuarios', aal2, { p_busca: 'demo' })).corpo;
ok(Array.isArray(usuarios) && usuarios[0]?.email === 'demo@petlive.dev', 'busca de usuários acha o demo');
const ficha = (await rpc('admin_usuario', aal2, { p_id: usuarios[0].id })).corpo;
ok(ficha.pets.length >= 1 && !('peso' in ficha.pets[0]), 'ficha traz pets sem dados de saúde');

// 4) Suspender e reativar grava na auditoria.
ok((await rpc('admin_suspender', aal2, { p_id: usuarios[0].id, p_suspender: true, p_motivo: 'teste' })).status < 300, 'suspende a conta');
ok((await pedir('/auth/v1/token?grant_type=password', { corpo: { email: 'demo@petlive.dev', password: 'petlive123' } })).status === 400, 'conta suspensa não entra');
ok((await rpc('admin_suspender', aal2, { p_id: usuarios[0].id, p_suspender: false })).status < 300, 'reativa a conta');
ok(Boolean(await entrar('demo@petlive.dev')), 'conta reativada entra de novo');
const auditoria = (await rpc('admin_auditoria', aal2)).corpo;
ok(auditoria.some((a) => a.acao === 'suspendeu a conta') && auditoria.some((a) => a.acao === 'reativou a conta'), 'auditoria registra as duas ações');
ok((await rpc('admin_suspender', aal2, { p_id: (await rpc('admin_eu', aal2)).corpo && (await pedir('/auth/v1/user', { token: aal2, metodo: 'GET' })).corpo.id, p_suspender: true })).status >= 400, 'não suspende a si mesmo');

// 6) Suporte: mensagem do site vira chamado; responder e fechar.
const email = `cliente-${Date.now()}@teste.dev`;
await rpc('registrar_contato_site', null, { p_tipo: 'contato', p_nome: 'Cliente Teste', p_email: email, p_mensagem: 'O app não abre no meu celular' });
let suporte = (await rpc('admin_suporte', aal2)).corpo;
const chamado = suporte.chamados.find((c) => c.email === email);
ok(chamado?.status === 'aberto', 'mensagem do site aparece como chamado aberto');
ok((await rpc('admin_suporte_acao', aal2, { p_contato: chamado.id, p_acao: 'responder', p_texto: 'Oi! Atualize o app.' })).status < 300, 'registra a resposta');
ok((await rpc('admin_suporte_acao', aal2, { p_contato: chamado.id, p_acao: 'nota', p_texto: 'Versão antiga.' })).status < 300, 'nota interna');
const notas = (await rpc('admin_suporte_notas', aal2, { p_contato: chamado.id })).corpo;
ok(notas.length === 2 && notas[0].tipo === 'resposta', 'histórico do chamado com resposta e nota');
suporte = (await rpc('admin_suporte', aal2)).corpo;
ok(suporte.chamados.find((c) => c.id === chamado.id).status === 'respondido', 'chamado fica respondido');
ok((await rpc('admin_suporte_acao', aal2, { p_contato: chamado.id, p_acao: 'fechar' })).status < 300, 'fecha o chamado');

// 7) LGPD: a exclusão não é feita à mão pelo painel.
await rpc('solicitar_exclusao_conta', tutor);
const lgpd = (await rpc('admin_lgpd', aal2)).corpo;
const pedido = lgpd.pedidos.find((p) => p.email === 'demo@petlive.dev' && p.tipo === 'apagar' && p.status === 'novo');
ok(Boolean(pedido) && lgpd.abertos >= 1, 'pedido de exclusão aparece em aberto');
ok((await rpc('admin_lgpd_concluir', aal2, { p_pedido: pedido.id })).status >= 400, 'exclusão não é concluída à mão');
await rpc('cancelar_exclusao_conta', tutor);

// 8) Moderação: indicação recusada exige motivo; aprovada vai para o mapa.
const nova = (await pedir('/rest/v1/sugestoes_lugar', {
  token: tutor,
  corpo: { nome: `Café Teste ${Date.now()}`, categoria: 'restaurante', aceita: 'caes', lat: -22.95, lng: -43.18 },
})).status;
ok(nova === 201, 'tutor indica um lugar');
let mod = (await rpc('admin_moderacao', aal2)).corpo;
const item = mod.itens.find((i) => i.status === 'em_analise' && i.nome.startsWith('Café Teste'));
ok(Boolean(item), 'indicação aparece para revisar');
ok((await rpc('admin_moderar_indicacao', aal2, { p_id: item.id, p_aprovar: false, p_motivo: '' })).status >= 400, 'recusar sem motivo é barrado');
ok((await rpc('admin_moderar_indicacao', aal2, { p_id: item.id, p_aprovar: true })).status < 300, 'aprova a indicação');
const noMapa = (await rpc('lugares_por_perto', tutor, { p_lat: -22.95, p_lng: -43.18, p_grupo: 'pet_friendly', p_raio_km: 1 })).corpo;
ok(noMapa.some((l) => l.nome === item.nome), 'lugar aprovado aparece no mapa');

// Relatórios e conteúdo mestre.
const rel = (await rpc('admin_relatorios', aal2, { p_dias: 365 })).corpo;
ok(rel.funil?.contas >= rel.funil?.com_pet && rel.retencao?.length === 6, 'relatórios: funil e 6 meses de retenção');
ok((await rpc('admin_relatorios', tutor)).status >= 400, 'tutor comum não vê relatórios');
const antes = (await rpc('admin_conteudo', aal2)).corpo;
const versao = (await rpc('admin_vacina_salvar', aal2, {
  p_id: null, p_especie: 'cao', p_nome: `Vacina teste ${Date.now()}`, p_primeira_dias: 180, p_reforco_dias: 365, p_descricao: 'teste', p_obrigatoria: false,
})).corpo;
const depois = (await rpc('admin_conteudo', aal2)).corpo;
ok(versao === antes.versoes[0].versao + 1 && depois.vacinas.length === antes.vacinas.length + 1, 'salvar vacina publica nova versão do calendário');
const vacinaTeste = depois.vacinas.find((v) => v.nome.startsWith('Vacina teste'));
ok((await pedir('/rest/v1/vaccine_schedule?select=nome', { token: tutor, metodo: 'GET' })).corpo.some((v) => v.nome === vacinaTeste.nome), 'o app do tutor já lê a vacina nova');
ok((await rpc('admin_vacina_salvar', aal2, { p_id: null, p_especie: 'peixe', p_nome: 'X', p_primeira_dias: 1, p_reforco_dias: null, p_descricao: '', p_obrigatoria: false })).status >= 400, 'vacina inválida é barrada');
ok((await rpc('admin_vacina_remover', aal2, { p_id: vacinaTeste.id })).status < 300, 'remove a vacina (e publica outra versão)');
const rascunho = (await rpc('admin_pacote_rascunho', aal2, { p_tipo: 'emergencia', p_conteudo: { teste: true } })).corpo;
const pacote = (await rpc('admin_conteudo', aal2)).corpo.pacotes.find((p) => p.tipo === 'emergencia' && p.versao === rascunho);
ok(pacote && !pacote.publicado, 'cria rascunho do pacote de emergência');
ok((await rpc('admin_pacote_publicar', aal2, { p_id: pacote.id })).status >= 400, 'emergência não publica sem veterinário e CRMV');

// Sistema: versão mínima e recursos (o app lê sem login).
const sistema = (await rpc('admin_sistema', aal2)).corpo;
ok(Array.isArray(sistema.versoes) && sistema.recursos.some((r) => r.chave === 'carteirinha_link'), 'sistema: versões e recursos');
ok((await rpc('admin_definir_versao_minima', aal2, { p_plataforma: 'android', p_versao: 'abc' })).status >= 400, 'versão mínima inválida é barrada');
await rpc('admin_definir_versao_minima', aal2, { p_plataforma: 'android', p_versao: '9.9.9' });
await rpc('admin_definir_recurso', aal2, { p_chave: 'indicar_lugar', p_ligado: false });
const config = (await rpc('config_app', null)).corpo;
ok(config.versao_minima.android === '9.9.9' && config.recursos.indicar_lugar === false, 'o app lê a versão mínima e o recurso desligado');
await rpc('admin_definir_versao_minima', aal2, { p_plataforma: 'android', p_versao: '0.0.0' });
await rpc('admin_definir_recurso', aal2, { p_chave: 'indicar_lugar', p_ligado: true });
ok((await rpc('admin_definir_recurso', tutor, { p_chave: 'indicar_lugar', p_ligado: false })).status >= 400, 'tutor comum não mexe nos recursos');

// Campanhas: só marketing ou super, horário no futuro, rascunho e cancelar.
ok((await rpc('admin_campanhas', tutor)).status >= 400, 'tutor comum não vê campanhas');
ok((await rpc('admin_campanha_salvar', aal2, { p_id: null, p_titulo: 'Teste', p_mensagem: 'Mensagem', p_publico: 'todos', p_link: '/inicio', p_agendar_para: '2000-01-01T09:00:00Z' })).status >= 400, 'campanha no passado é barrada');
ok((await rpc('admin_campanha_salvar', aal2, { p_id: null, p_titulo: 'Teste', p_mensagem: 'Mensagem', p_publico: 'todos', p_link: '/fora-do-app', p_agendar_para: null })).status >= 400, 'link fora da lista é barrado');
const rascunho2 = (await rpc('admin_campanha_salvar', aal2, { p_id: null, p_titulo: `Rascunho ${Date.now()}`, p_mensagem: 'Mensagem', p_publico: 'caes', p_link: '/mapa', p_agendar_para: null })).corpo;
const campanhas = (await rpc('admin_campanhas', aal2)).corpo;
ok(campanhas.campanhas.find((c) => c.id === rascunho2)?.status === 'rascunho', 'salva rascunho');
ok((await rpc('admin_campanha_cancelar', aal2, { p_id: rascunho2 })).status < 300, 'cancela a campanha');
ok(typeof (await rpc('admin_campanha_publico', aal2, { p_publico: 'todos' })).corpo === 'number', 'mostra o alcance do público');

// 5) Ninguém lê as tabelas direto.
ok((await pedir('/rest/v1/audit_log?select=*', { token: aal2, metodo: 'GET' })).status >= 400, 'audit_log não é lido direto pela API');

// Limpa o fator de teste (o admin volta a cadastrar pelo painel).
await pedir(`/auth/v1/factors/${fator.id}`, { token: aal2, metodo: 'DELETE' });

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
