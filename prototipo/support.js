// Runtime local das telas .dc.html: lê o <x-dc>, roda o script do componente
// (class Component extends DCLogic) e preenche {{valores}}, <sc-if> e <sc-for>.
(function () {
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(parcial) {
      const novo = typeof parcial === 'function' ? parcial(this.state) : parcial;
      this.state = Object.assign({}, this.state, novo);
      if (this.__render) this.__render();
    }
    renderVals() { return {}; }
  }
  window.DCLogic = DCLogic;

  const SO_BINDING = /^\{\{\s*([^}]+?)\s*\}\}$/;
  const BINDING = /\{\{\s*([^}]+?)\s*\}\}/g;

  function resolver(expr, escopo) {
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    let v = escopo;
    for (const parte of expr.split('.')) {
      if (v == null) return undefined;
      v = v[parte];
    }
    return v;
  }

  function texto(v) { return v == null || v === false ? '' : String(v); }

  function interpolar(s, escopo) {
    return s.replace(BINDING, (_, expr) => texto(resolver(expr, escopo)));
  }

  function processarFilhos(origem, destino, escopo) {
    for (const no of origem.childNodes) {
      for (const saida of processar(no, escopo)) destino.appendChild(saida);
    }
  }

  function processar(no, escopo) {
    if (no.nodeType === Node.TEXT_NODE) {
      return [document.createTextNode(interpolar(no.nodeValue, escopo))];
    }
    if (no.nodeType !== Node.ELEMENT_NODE) return [no.cloneNode(true)];

    const tag = no.localName;
    if (tag === 'sc-if') {
      const m = SO_BINDING.exec(no.getAttribute('value') || '');
      if (!(m && resolver(m[1], escopo))) return [];
      const frag = document.createDocumentFragment();
      processarFilhos(no, frag, escopo);
      return [frag];
    }
    if (tag === 'sc-for') {
      const m = SO_BINDING.exec(no.getAttribute('list') || '');
      const lista = (m && resolver(m[1], escopo)) || [];
      const nome = no.getAttribute('as') || 'item';
      const frag = document.createDocumentFragment();
      Array.from(lista).forEach((item, i) => {
        const filho = Object.create(escopo);
        filho[nome] = item;
        filho.$index = i;
        processarFilhos(no, frag, filho);
      });
      return [frag];
    }

    const el = no.namespaceURI === 'http://www.w3.org/1999/xhtml'
      ? document.createElement(tag)
      : document.createElementNS(no.namespaceURI, no.tagName);
    for (const attr of no.attributes) {
      if (attr.name.startsWith('hint-')) continue;
      const m = SO_BINDING.exec(attr.value);
      if (attr.name.startsWith('on') && m) {
        const fn = resolver(m[1], escopo);
        if (typeof fn === 'function') el.addEventListener(attr.name.slice(2).toLowerCase(), fn);
        continue;
      }
      const valor = m ? texto(resolver(m[1], escopo)) : interpolar(attr.value, escopo);
      el.setAttribute(attr.name, valor);
      if (attr.name === 'value' && 'value' in el) el.value = valor;
    }
    processarFilhos(tag === 'template' ? no.content : no, el, escopo);
    return [el];
  }

  function iniciar() {
    const raiz = document.querySelector('x-dc');
    if (!raiz) return;

    const helmet = raiz.querySelector('helmet');
    if (helmet) {
      for (const filho of Array.from(helmet.childNodes)) {
        if (filho.nodeType === Node.ELEMENT_NODE) document.head.appendChild(filho);
      }
      helmet.remove();
    }

    const molde = document.createElement('div');
    while (raiz.firstChild) molde.appendChild(raiz.firstChild);

    let componente = new DCLogic({});
    const script = document.querySelector('script[data-dc-script]');
    if (script) {
      let props = {};
      try { props = JSON.parse(script.getAttribute('data-props') || '{}'); } catch (e) {}
      try {
        const Classe = new Function('DCLogic', script.textContent + '\nreturn Component;')(DCLogic);
        componente = new Classe(props);
      } catch (e) {
        console.error('Erro no script da tela', e);
      }
    }

    componente.__render = function () {
      // Guarda o foco e o cursor para o campo de texto não perder o que se digita.
      const ativo = document.activeElement;
      const idAtivo = ativo && raiz.contains(ativo) ? ativo.id : null;
      const sel = idAtivo && 'selectionStart' in ativo ? [ativo.selectionStart, ativo.selectionEnd] : null;

      let vals = {};
      try { vals = componente.renderVals() || {}; } catch (e) { console.error('Erro em renderVals', e); }
      const frag = document.createDocumentFragment();
      processarFilhos(molde, frag, vals);
      raiz.replaceChildren(frag);

      if (idAtivo) {
        const novo = document.getElementById(idAtivo);
        if (novo) {
          novo.focus();
          if (sel && novo.setSelectionRange) try { novo.setSelectionRange(sel[0], sel[1]); } catch (e) {}
        }
      }
    };
    componente.__render();
    document.documentElement.removeAttribute('data-dc-carregando');
  }

  document.documentElement.setAttribute('data-dc-carregando', '');
  const estilo = document.createElement('style');
  estilo.textContent = 'html[data-dc-carregando] x-dc{visibility:hidden}x-dc{display:contents}';
  document.head.appendChild(estilo);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
