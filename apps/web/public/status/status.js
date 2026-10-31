// Página de status do PetLive. Consulta a função pública "status" e o site,
// mostra cada parte como operante, lenta ou fora e guarda as últimas 30
// verificações só neste navegador (para ver se a queda foi agora ou não).
(function () {
  'use strict';

  var cfg = window.PETLIVE_STATUS || {};
  var CHAVE = 'petlive-status-historico';
  var TITULOS = {
    operante: ['Tudo funcionando', 'O app, o site e os serviços do PetLive estão no ar.'],
    lenta: ['Funcionando, mas devagar', 'Algumas partes estão respondendo mais devagar que o normal.'],
    parcial: ['Instabilidade em parte do serviço', 'Algumas partes estão fora do ar. O resto continua funcionando.'],
    fora: ['PetLive fora do ar', 'O app e o servidor não estão respondendo. Já estamos cuidando disso.'],
    manutencao: ['Manutenção em andamento', 'Estamos melhorando o PetLive. Volte em instantes.'],
  };
  var ROTULOS = { operante: 'Operante', lenta: 'Lenta', fora: 'Fora do ar', nao_configurado: 'Não configurado', verificando: 'Verificando' };
  var PARTES = [
    { id: 'api', nome: 'App e banco de dados' },
    { id: 'login', nome: 'Login e contas' },
    { id: 'arquivos', nome: 'Fotos e arquivos' },
    { id: 'pagamentos', nome: 'Pagamentos por Pix' },
    { id: 'funcoes', nome: 'Funções do servidor' },
    { id: 'site', nome: 'Site' },
  ];

  var $ = function (id) { return document.getElementById(id); };

  function comLimite(url, opcoes, ms) {
    var controle = new AbortController();
    var t = setTimeout(function () { controle.abort(); }, ms);
    opcoes = Object.assign({}, opcoes, { signal: controle.signal });
    return fetch(url, opcoes).finally(function () { clearTimeout(t); });
  }

  // O site responde? Sem CORS só dá para saber se chegou (resposta opaca) ou não.
  function conferirSite() {
    if (!cfg.site) return Promise.resolve({ id: 'site', nome: 'Site', estado: 'nao_configurado', ms: null });
    var inicio = Date.now();
    return comLimite(cfg.site, { mode: 'no-cors', cache: 'no-store' }, 8000)
      .then(function () {
        var ms = Date.now() - inicio;
        return { id: 'site', nome: 'Site', estado: ms > 2500 ? 'lenta' : 'operante', ms: ms };
      })
      .catch(function () { return { id: 'site', nome: 'Site', estado: 'fora', ms: null }; });
  }

  function conferirServidor() {
    return comLimite(cfg.funcaoStatus, { cache: 'no-store' }, 12000)
      .then(function (r) {
        if (!r.ok) throw new Error('status ' + r.status);
        return r.json();
      })
      .catch(function () {
        // A própria função não respondeu: o servidor inteiro está fora.
        return {
          geral: 'fora',
          manutencao: { ativa: false },
          componentes: PARTES.filter(function (p) { return p.id !== 'site'; }).map(function (p) {
            return { id: p.id, nome: p.nome, estado: 'fora', ms: null };
          }),
        };
      });
  }

  function geralCom(servidor, site) {
    if (servidor.manutencao && servidor.manutencao.ativa) return 'manutencao';
    var todos = servidor.componentes.concat([site]).filter(function (c) { return c.estado !== 'nao_configurado'; });
    var fora = todos.filter(function (c) { return c.estado === 'fora'; }).length;
    if (fora === todos.length) return 'fora';
    if (servidor.geral === 'fora') return 'fora';
    if (fora) return 'parcial';
    if (todos.some(function (c) { return c.estado === 'lenta'; })) return 'lenta';
    return 'operante';
  }

  function hora(data) {
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function previsao(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    var hoje = d.toDateString() === new Date().toDateString();
    return 'Previsão de volta: ' + (hoje ? 'hoje' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })) + ' às ' + hora(d);
  }

  function lerHistorico() {
    try { return JSON.parse(localStorage.getItem(CHAVE) || '[]'); } catch (e) { return []; }
  }

  function guardarHistorico(lista) {
    try { localStorage.setItem(CHAVE, JSON.stringify(lista.slice(-30))); } catch (e) { /* navegador sem armazenamento */ }
  }

  function desenharGeral(estado, manutencao) {
    var t = TITULOS[estado] || TITULOS.operante;
    var caixa = $('geral');
    caixa.dataset.estado = estado;
    $('geral-titulo').textContent = t[0];
    $('geral-texto').textContent = (estado === 'manutencao' && manutencao && manutencao.mensagem) || t[1];
    var antiga = caixa.querySelector('.previsao');
    if (antiga) antiga.remove();
    var p = estado === 'manutencao' && manutencao ? previsao(manutencao.previsao) : null;
    if (p) {
      var selo = document.createElement('span');
      selo.className = 'previsao';
      selo.textContent = p;
      caixa.appendChild(selo);
    }
    document.title = estado === 'operante' ? 'Status do PetLive' : (TITULOS[estado] || TITULOS.fora)[0] + ' · Status do PetLive';
  }

  function desenharLista(componentes) {
    var porId = {};
    componentes.forEach(function (c) { porId[c.id] = c; });
    var lista = $('lista');
    lista.innerHTML = '';
    PARTES.forEach(function (p) {
      var c = porId[p.id] || { estado: 'verificando', ms: null };
      var linha = document.createElement('div');
      linha.className = 'item';
      var ponto = document.createElement('span');
      ponto.className = 'ponto';
      ponto.dataset.estado = c.estado;
      ponto.setAttribute('aria-hidden', 'true');
      var nome = document.createElement('div');
      nome.className = 'nome';
      nome.textContent = p.nome;
      if (c.ms != null && c.estado !== 'fora') {
        var ms = document.createElement('small');
        ms.textContent = 'Respondeu em ' + (c.ms < 1000 ? c.ms + ' ms' : (c.ms / 1000).toFixed(1).replace('.', ',') + ' s');
        nome.appendChild(ms);
      }
      var rotulo = document.createElement('span');
      rotulo.className = 'rotulo';
      rotulo.dataset.estado = c.estado;
      rotulo.textContent = ROTULOS[c.estado] || c.estado;
      linha.append(ponto, nome, rotulo);
      lista.appendChild(linha);
    });
  }

  function desenharHistorico(lista) {
    var barras = $('barras');
    barras.innerHTML = '';
    var vazias = 30 - lista.length;
    for (var i = 0; i < vazias; i++) barras.appendChild(Object.assign(document.createElement('span'), { className: 'barra' }));
    lista.forEach(function (h) {
      var b = document.createElement('span');
      b.className = 'barra';
      b.dataset.estado = h.estado;
      b.title = hora(new Date(h.em)) + ' · ' + (TITULOS[h.estado] || [h.estado])[0];
      barras.appendChild(b);
    });
    $('legenda-inicio').textContent = lista.length ? hora(new Date(lista[0].em)) : '—';
  }

  var verificando = false;
  function verificar() {
    if (verificando) return;
    verificando = true;
    $('atualizar').disabled = true;
    $('atualizar').textContent = 'Verificando…';
    Promise.all([conferirServidor(), conferirSite()]).then(function (r) {
      var servidor = r[0], site = r[1];
      var estado = geralCom(servidor, site);
      desenharGeral(estado, servidor.manutencao);
      desenharLista(servidor.componentes.concat([site]));
      var historico = lerHistorico().concat([{ em: Date.now(), estado: estado }]);
      guardarHistorico(historico);
      desenharHistorico(historico.slice(-30));
      $('verificado').textContent = 'Verificado às ' + hora(new Date()) + '.';
    }).finally(function () {
      verificando = false;
      $('atualizar').disabled = false;
      $('atualizar').textContent = 'Atualizar';
    });
  }

  $('marca').href = cfg.site || '#';
  $('atualizar').addEventListener('click', verificar);
  desenharLista([]);
  desenharHistorico(lerHistorico().slice(-30));
  verificar();
  setInterval(verificar, (cfg.intervaloSegundos || 60) * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) verificar(); });
})();
