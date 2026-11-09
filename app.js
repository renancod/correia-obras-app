/* ==========================================================
   CORREIA OBRAS — app (roda no navegador / celular)
   ========================================================== */

/* ---------- Comunicação com a API (Google Apps Script) ---------- */
const Sessao = {
  get pin() { try { return localStorage.getItem('co_pin') || ''; } catch (e) { return ''; } },
  set pin(v) { try { v ? localStorage.setItem('co_pin', v) : localStorage.removeItem('co_pin'); } catch (e) { } }
};
const Api = {
  async chamar(fn, ...args) {
    // text/plain evita a checagem CORS extra que o Apps Script não responde
    const r = await fetch(window.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn, args, pin: Sessao.pin }), redirect: 'follow' });
    const j = await r.json();
    if (j.erro) {
      if (j.codigo === 'PIN') { Sessao.pin = ''; Entrada.mostrar(j.erro); }
      throw new Error(j.erro);
    }
    return j.ok;
  }
};

/* ---------- Estado ---------- */
let D = { obras: [], etapasContrato: [], entradas: [], saidas: [], etapasEmpreiteiro: [], config: {}, usuario: '' };

const TIPOS_SAIDA = ['Empreiteiro', 'Material', 'Outros custos da obra', 'Despesa da empresa', 'Retirada pessoal'];
const FORMAS = ['Pix', 'Transferência', 'Dinheiro', 'Boleto', 'Cartão', 'Cheque'];
const STATUS_OBRA = ['Em andamento', 'Paralisada', 'Finalizada'];

/* ---------- Utilitários ---------- */
const U = {
  moeda(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); },
  moedaCurta(v) {
    const n = Number(v) || 0, a = Math.abs(n);
    if (a >= 1e6) return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
    if (a >= 1e4) return 'R$ ' + (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    return U.moeda(n);
  },
  data(iso) { if (!iso) return '-'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; },
  dataLonga(iso) {
    const d = new Date(iso + 'T12:00:00');
    const hoje = U.hoje(), ontem = U.isoDe(new Date(Date.now() - 864e5));
    if (iso === hoje) return 'Hoje';
    if (iso === ontem) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  },
  isoDe(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },
  hoje() { return U.isoDe(new Date()); }, // data LOCAL (corrige o bug do app antigo, que usava UTC)
  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  soma(lista, campo = 'valor') { return lista.reduce((s, r) => s + (Number(r[campo]) || 0), 0); },
  // aceita "1.234,56", "1234,56", "1234.56"
  lerValor(txt) {
    let s = String(txt || '').replace(/[^\d,.-]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    return Math.round((parseFloat(s) || 0) * 100) / 100;
  },
  valorParaCampo(v) { return v ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; },
  pct(a, b) { return b > 0 ? Math.max(0, Math.min(100, a / b * 100)) : 0; },
  sinal(v) { return v < 0 ? 'neg' : ''; }
};

const ICONES = {
  inicio: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  obras: '<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M10 21v-6h4v6"/>',
  lanc: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  entra: '<path d="M12 19V5M5 12l7 7 7-7"/>',
  sai: '<path d="M12 5v14M5 12l7-7 7 7"/>',
  doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  olhoFechado: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'
};

// Valores sensíveis (resultado da obra): sempre escondidos ao abrir o app; só aparecem tocando no olho.
// Fica só na memória de propósito: ao fechar e abrir o app, volta a esconder.
const Privado = {
  visivel: false,
  valor(v) { return Privado.visivel ? U.moeda(v) : 'R$ ••••••'; },
  alternar() { Privado.visivel = !Privado.visivel; Rota.render(); }
};
const ic = n => `<svg viewBox="0 0 24 24">${ICONES[n]}</svg>`;

/* ---------- Cálculos (um lugar só) ---------- */
const Calc = {
  obra(o) {
    const etapasC = D.etapasContrato.filter(e => e.obraId === o.id);
    const entradas = D.entradas.filter(e => e.obraId === o.id);
    const saidas = D.saidas.filter(s => s.obraId === o.id);
    const etapasE = D.etapasEmpreiteiro.filter(e => e.obraId === o.id);
    const porTipo = t => U.soma(saidas.filter(s => s.tipo === t));

    const contrato = U.soma(etapasC);
    const recebido = U.soma(entradas);
    const aReceber = contrato - recebido;

    const empContratado = U.soma(etapasE);
    const empPago = porTipo('Empreiteiro');
    const empPagoSemEtapa = U.soma(saidas.filter(s => s.tipo === 'Empreiteiro' && !etapasE.some(e => e.id === s.etapaEmpreiteiroId)));
    const empAPagar = etapasE.reduce((s, e) => s + Math.max(0, e.valor - Calc.pagoEtapaEmp(e.id)), 0);

    const outrosCustos = porTipo('Material') + porTipo('Outros custos da obra');
    const despEmpresa = porTipo('Despesa da empresa');
    const retiradas = porTipo('Retirada pessoal');

    // Quanto a obra deixa para a empresa se tudo for recebido e pago como contratado
    const sobraPrevista = contrato - empContratado - empPagoSemEtapa - outrosCustos;
    const jaRetirado = retiradas + despEmpresa;
    const aindaDisponivel = sobraPrevista - jaRetirado;
    // Dinheiro desta obra que está na conta hoje
    const caixa = recebido - U.soma(saidas);

    // Reserva para custos extras fora de contrato: % (configurável na obra) sobre os custos previstos
    const reservaPct = Calc.reservaPct(o);
    const custosPrevistos = empContratado + empPagoSemEtapa + outrosCustos;
    const reserva = Math.round(custosPrevistos * reservaPct) / 100;
    const sobraComReserva = sobraPrevista - reserva;

    return { contrato, recebido, aReceber, empContratado, empPago, empAPagar, empPagoSemEtapa, outrosCustos, despEmpresa, retiradas,
      sobraPrevista, jaRetirado, aindaDisponivel, caixa, pctRecebido: U.pct(recebido, contrato),
      reservaPct, custosPrevistos, reserva, sobraComReserva };
  },
  reservaPct(o) {
    const v = o.reservaPct;
    return v === '' || v === undefined || v === null || isNaN(Number(v)) ? 10 : Number(v);
  },
  pagoEtapaEmp(id) { return U.soma(D.saidas.filter(s => s.etapaEmpreiteiroId === id)); },
  pagoEtapaContrato(id) { return U.soma(D.entradas.filter(e => e.etapaId === id)); },
  saldoConta() { return (Number(D.config.saldoInicial) || 0) + U.soma(D.entradas) - U.soma(D.saidas); },
  geral() {
    const ativas = D.obras.filter(o => o.status !== 'Finalizada');
    const cs = D.obras.map(o => Calc.obra(o));
    const mes = U.hoje().slice(0, 7);
    const doMes = l => l.filter(r => String(r.data).slice(0, 7) === mes);
    return {
      saldo: Calc.saldoConta(),
      aReceber: cs.reduce((s, c) => s + Math.max(0, c.aReceber), 0),
      aPagar: cs.reduce((s, c) => s + c.empAPagar, 0),
      ativas: ativas.length,
      mesEntrou: U.soma(doMes(D.entradas)),
      mesCustos: U.soma(doMes(D.saidas).filter(s => !['Retirada pessoal', 'Despesa da empresa'].includes(s.tipo))),
      mesRetiradas: U.soma(doMes(D.saidas).filter(s => ['Retirada pessoal', 'Despesa da empresa'].includes(s.tipo)))
    };
  }
};

const Busca = {
  obra: id => D.obras.find(o => o.id === id),
  nomeObra: id => (D.obras.find(o => o.id === id) || {}).nome || '(obra removida)',
  etapaC: id => D.etapasContrato.find(e => e.id === id),
  etapaE: id => D.etapasEmpreiteiro.find(e => e.id === id)
};

/* ---------- Avisos e folha ---------- */
function aviso(msg) {
  const a = document.getElementById('aviso');
  a.textContent = msg; a.classList.add('mostra');
  clearTimeout(aviso._t); aviso._t = setTimeout(() => a.classList.remove('mostra'), 3000);
}
const Folha = {
  abrir(titulo, html) {
    document.getElementById('folhaTitulo').textContent = titulo;
    document.getElementById('folhaCorpo').innerHTML = html;
    document.getElementById('folha').classList.add('aberta');
  },
  fechar() { document.getElementById('folha').classList.remove('aberta'); document.getElementById('folhaCorpo').innerHTML = ''; }
};

/* ---------- Gravação ---------- */
async function salvar(chave, registro, msg) {
  const r = await Api.chamar('api_salvar', chave, registro);
  const lista = D[chave], i = lista.findIndex(x => x.id === r.id);
  if (i >= 0) lista[i] = r; else lista.push(r);
  if (msg) aviso(msg);
  Rota.render();
  return r;
}
async function excluir(chave, id, msg) {
  await Api.chamar('api_excluir', chave, id);
  D[chave] = D[chave].filter(x => x.id !== id);
  if (msg) aviso(msg);
  Rota.render();
}
// trava o botão enquanto grava (a planilha leva ~1s)
async function comBotao(btn, fn) {
  const txt = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'Salvando…';
  try { await fn(); } catch (e) { aviso('Erro: ' + (e.message || e)); btn.disabled = false; btn.innerHTML = txt; }
}

/* ---------- Navegação ---------- */
const MENU = [
  { id: 'inicio', nome: 'Início', ic: 'inicio' },
  { id: 'obras', nome: 'Obras', ic: 'obras' },
  { id: 'lancamentos', nome: 'Lançamentos', ic: 'lanc' },
  { id: 'ajustes', nome: 'Ajustes', ic: 'ajustes' }
];
const Rota = {
  atual() { const h = (location.hash || '#inicio').slice(1).split('/'); return { pag: h[0] || 'inicio', id: h[1], aba: h[2] }; },
  ir(h) { if (location.hash === '#' + h) Rota.render(); else location.hash = h; },
  menu() {
    const r = Rota.atual(), grupo = r.pag === 'obra' || r.pag === 'relatorio' ? 'obras' : r.pag;
    document.getElementById('navLateral').innerHTML = MENU.map(m =>
      `<a href="#${m.id}" class="${grupo === m.id ? 'ativo' : ''}">${ic(m.ic)}${m.nome}</a>`).join('');
    const it = m => `<a href="#${m.id}" class="${grupo === m.id ? 'ativo' : ''}">${ic(m.ic)}${m.nome}</a>`;
    document.getElementById('navInferior').innerHTML = it(MENU[0]) + it(MENU[1]) +
      `<button class="mais" onclick="Form.lancamento()"><span class="circulo">${ic('mais')}</span>Lançar</button>` + it(MENU[2]) + it(MENU[3]);
  },
  render() {
    const r = Rota.atual();
    Rota.menu();
    const voltar = document.getElementById('btnVoltar');
    voltar.hidden = !(r.pag === 'obra' || r.pag === 'relatorio');
    voltar.onclick = () => r.pag === 'relatorio' ? Rota.ir('obra/' + r.id) : Rota.ir('obras');
    const t = document.getElementById('titulo'), c = document.getElementById('conteudo');
    const telas = { inicio: Telas.inicio, obras: Telas.obras, obra: Telas.obra, lancamentos: Telas.lancamentos, ajustes: Telas.ajustes, relatorio: Telas.relatorio };
    const tela = telas[r.pag] || Telas.inicio;
    const res = tela(r);
    t.textContent = res.titulo;
    c.innerHTML = res.html;
    if (res.depois) res.depois();
  }
};
window.addEventListener('hashchange', () => { Rota.render(); window.scrollTo(0, 0); });

const Filtro = { obra: '' };
// filtros da tela Lançamentos (ficam enquanto o app estiver aberto)
const FiltroLanc = { mes: null, grupo: '', obra: '', texto: '' };

/* ---------- Componentes de tela ---------- */
const TIPO_GRUPO = {
  entradas: { nome: 'Entradas', filtro: l => l._t === 'e' },
  empreiteiros: { nome: 'Empreiteiros', filtro: l => l.tipo === 'Empreiteiro' },
  custos: { nome: 'Material e outros', filtro: l => ['Material', 'Outros custos da obra'].includes(l.tipo) },
  retiradas: { nome: 'Retiradas', filtro: l => ['Retirada pessoal', 'Despesa da empresa'].includes(l.tipo) }
};
const ehRetiradaTipo = t => ['Retirada pessoal', 'Despesa da empresa'].includes(t);

function linhaLancamento(l, mostrarObra) {
  const entrada = l._t === 'e';
  const classe = entrada ? 'e' : (ehRetiradaTipo(l.tipo) ? 'r' : 's');
  const obs = String(l.observacao || '').replace(/\n/g, ' · ');
  let tit, sub;
  if (entrada) {
    const et = Busca.etapaC(l.etapaId);
    tit = et ? et.descricao : 'Recebimento';
    sub = 'Recebimento' + (obs ? ' · ' + obs : '');
  } else if (l.tipo === 'Empreiteiro') {
    const et = Busca.etapaE(l.etapaEmpreiteiroId);
    tit = l.empreiteiro || 'Empreiteiro';
    sub = (et ? et.descricao : 'Empreiteiro') + (obs ? ' · ' + obs : '');
  } else {
    tit = obs ? obs.split(' · ')[0] : l.tipo;
    sub = l.tipo;
  }
  return `<li class="lanc" onclick="Form.lancamento('${l._t}','${l.id}')">
    <span class="lanc-ic ${classe}">${ic(entrada ? 'entra' : 'sai')}</span>
    <div class="lanc-txt"><div class="lanc-tit">${U.esc(tit)}</div>
      <div class="lanc-sub">${mostrarObra ? `<span class="tag-obra">${U.esc(Busca.nomeObra(l.obraId))}</span>` : ''}${U.esc(sub)}</div></div>
    <span class="lanc-val ${entrada ? 'pos' : classe === 'r' ? 'neg' : ''}">${entrada ? '+' : '−'} ${U.moeda(l.valor)}</span></li>`;
}

function htmlLancamentos(lista, vazio, opcoes) {
  const op = Object.assign({ mostrarObra: true, totalDia: true }, opcoes || {});
  if (!lista.length) return `<div class="painel vazio">${vazio || 'Nenhum lançamento.'}</div>`;
  const dias = [];
  lista.forEach(l => { const d = dias[dias.length - 1]; if (d && d.data === l.data) d.itens.push(l); else dias.push({ data: l.data, itens: [l] }); });
  return '<div class="painel"><ul class="lanc-lista">' + dias.map(d => {
    const saldo = U.soma(d.itens.filter(x => x._t === 'e')) - U.soma(d.itens.filter(x => x._t === 's'));
    return `<li class="lanc-dia"><span>${U.dataLonga(d.data)}</span>${op.totalDia ? `<span class="${saldo < 0 ? 'neg' : 'pos'}">${saldo < 0 ? '−' : '+'} ${U.moeda(Math.abs(saldo))}</span>` : ''}</li>` +
      d.itens.map(l => linhaLancamento(l, op.mostrarObra)).join('');
  }).join('') + '</ul></div>';
}
function todosLancamentos() {
  return [...D.entradas.map(e => ({ ...e, _t: 'e' })), ...D.saidas.map(s => ({ ...s, _t: 's' }))]
    .sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));
}
function seloStatus(s) { return `<span class="selo ${s === 'Em andamento' ? 'andamento' : s === 'Finalizada' || s === 'Concluída' ? 'ok' : 'alerta'}">${U.esc(s)}</span>`; }

// Cor da barra pelo risco: verde = sua parte com folga; amarelo = perto do limite; vermelho = retirou mais que a sua parte
const Risco = {
  de(o, c) {
    if (o.status === 'Finalizada') return { nivel: 'fim', rotulo: 'Finalizada' };
    const d = c.aindaDisponivel, limite = Math.max(1000, c.sobraPrevista * 0.1);
    if (d < 0) return { nivel: 'neg', rotulo: 'Retirado acima da sua parte' };
    if (d < limite) return { nivel: 'atencao', rotulo: 'Perto do limite' };
    return { nivel: 'ok', rotulo: 'Sua parte com folga' };
  }
};
function cartaoObra(o) {
  const c = Calc.obra(o), r = Risco.de(o, c);
  return `<a class="painel obra-card" href="#obra/${o.id}">
    <div class="obra-topo"><div><div class="obra-nome">${U.esc(o.nome)}</div><div class="obra-cli">${U.esc(o.cliente)}${o.cidade ? ' · ' + U.esc(o.cidade) : ''}</div></div>${seloStatus(o.status)}</div>
    <div class="barra risco-${r.nivel}"><i style="width:${c.pctRecebido}%"></i></div>
    <div class="barra-legenda"><span>${c.pctRecebido.toFixed(0)}% recebido</span>${Privado.visivel && r.nivel !== 'fim' ? `<span class="risco-txt risco-${r.nivel}">${r.rotulo}: ${U.moeda(c.aindaDisponivel)}</span>` : ''}</div>
    <div class="obra-nums">
      <div><span class="mut">Recebido</span><b>${U.moedaCurta(c.recebido)}</b></div>
      <div><span class="mut">Falta receber</span><b>${U.moedaCurta(c.aReceber)}</b></div>
      <div><span class="mut">Falta pagar emp.</span><b>${U.moedaCurta(c.empAPagar)}</b></div>
    </div></a>`;
}
function botaoOlho() {
  return `<button class="icone olho" onclick="Privado.alternar()" aria-label="${Privado.visivel ? 'Esconder valores' : 'Mostrar valores'}" title="${Privado.visivel ? 'Esconder valores' : 'Mostrar valores'}">${ic(Privado.visivel ? 'olho' : 'olhoFechado')}</button>`;
}

// Avisos do Início: só aparece o que pede ação
function avisos() {
  const l = [], hoje = U.hoje();
  D.obras.filter(o => o.status !== 'Finalizada').forEach(o => {
    const c = Calc.obra(o), r = Risco.de(o, c);
    if (r.nivel === 'neg') l.push({ nivel: 'neg', txt: `<b>${U.esc(o.nome)}</b>: retiradas acima da sua parte${Privado.visivel ? ` (${U.moeda(c.aindaDisponivel)})` : ''}.`, link: '#obra/' + o.id });
    else if (r.nivel === 'atencao') l.push({ nivel: 'atencao', txt: `<b>${U.esc(o.nome)}</b>: sua parte está perto do limite${Privado.visivel ? ` (${U.moeda(c.aindaDisponivel)})` : ''}.`, link: '#obra/' + o.id });
    D.etapasEmpreiteiro.filter(e => e.obraId === o.id && e.status !== 'Concluída' && e.prazo && e.prazo < hoje)
      .forEach(e => l.push({ nivel: 'atencao', txt: `<b>${U.esc(e.empreiteiro)}</b> (${U.esc(e.descricao)}) passou do prazo de ${U.data(e.prazo)} · ${U.esc(o.nome)}.`, link: '#obra/' + o.id + '/empreiteiros' }));
    D.etapasEmpreiteiro.filter(e => e.obraId === o.id && Calc.pagoEtapaEmp(e.id) > e.valor + 0.01)
      .forEach(e => l.push({ nivel: 'neg', txt: `<b>${U.esc(e.empreiteiro)}</b> (${U.esc(e.descricao)}) recebeu ${U.moeda(Calc.pagoEtapaEmp(e.id) - e.valor)} a mais que o combinado.`, link: '#obra/' + o.id + '/empreiteiros' }));
  });
  return l;
}

/* ---------- Telas ---------- */
const Telas = {
  inicio() {
    const g = Calc.geral();
    const sobra = g.saldo + g.aReceber - g.aPagar;
    const obras = D.obras.filter(o => o.status !== 'Finalizada');
    const suaParte = obras.reduce((s, o) => s + Calc.obra(o).aindaDisponivel, 0);
    const av = avisos();
    const pv = v => Privado.valor(v);
    return {
      titulo: 'Início',
      html: `
      <section class="secao inicio-topo">
        <div class="painel painel-pad saldo-card">
          <div class="saldo-rot">Saldo em conta</div>
          <div class="saldo-val ${U.sinal(g.saldo)}">${U.moeda(g.saldo)}</div>
          <div class="mut saldo-ajuda">Confira com o extrato do banco</div>
          <div class="mes-linha">
            <div><span>Entrou no mês</span><b class="pos">${U.moedaCurta(g.mesEntrou)}</b></div>
            <div><span>Custos de obra</span><b>${U.moedaCurta(g.mesCustos)}</b></div>
            <div><span>Retiradas</span><b>${U.moedaCurta(g.mesRetiradas)}</b></div>
          </div>
        </div>
        <div class="painel painel-pad fechar-card">
          <div class="bloco-cab"><h3>Para fechar as obras ativas</h3>${botaoOlho()}</div>
          <p class="expl">Se todos os clientes pagarem e você pagar todos os empreiteiros:</p>
          <dl class="conta">
            <div><dt>Saldo em conta</dt><dd>${U.moeda(g.saldo)}</dd></div>
            <div><dt>+ A receber dos clientes</dt><dd class="pos">${U.moeda(g.aReceber)}</dd></div>
            <div><dt>− A pagar aos empreiteiros</dt><dd>${U.moeda(g.aPagar)}</dd></div>
            <div class="total"><dt>${Privado.visivel && sobra < 0 ? 'Falta (aporte seu)' : 'Sobra'}</dt><dd class="${Privado.visivel ? U.sinal(sobra) : ''}">${pv(sobra)}</dd></div>
          </dl>
          <div class="sua-parte"><span>Sua parte nas obras ativas</span><b class="${Privado.visivel ? U.sinal(suaParte) : ''}">${pv(suaParte)}</b></div>
        </div>
      </section>
      <section class="secao">
        <div class="secao-cab"><h2>Avisos</h2></div>
        ${av.length ? `<div class="painel avisos">${av.map(a => `<a class="aviso-item ${a.nivel}" href="${a.link}"><span class="ponto"></span><span>${a.txt}</span></a>`).join('')}</div>`
          : '<div class="painel painel-pad mut">Tudo em dia: nenhuma obra no limite e nenhum prazo vencido.</div>'}
      </section>
      <section class="secao">
        <div class="secao-cab"><h2>Obras em andamento</h2><a href="#obras">Ver todas</a></div>
        ${obras.length ? `<div class="obras-lista">${obras.map(cartaoObra).join('')}</div>` : '<div class="painel vazio">Nenhuma obra em andamento.</div>'}
        <p class="legenda-risco"><span><i class="risco-ok"></i>sua parte com folga</span><span><i class="risco-atencao"></i>perto do limite</span><span><i class="risco-neg"></i>retirado acima</span></p>
      </section>
      <section class="secao">
        <div class="secao-cab"><h2>Últimos lançamentos</h2><a href="#lancamentos">Ver todos</a></div>
        ${htmlLancamentos(todosLancamentos().slice(0, 6), null, { totalDia: false })}
      </section>`
    };
  },

  obras() {
    const grupos = STATUS_OBRA.map(s => ({ s, l: D.obras.filter(o => o.status === s) })).filter(g => g.l.length);
    return {
      titulo: 'Obras',
      html: `<div class="barra-ferr"><span class="esp"></span><button class="btn btn-primario" onclick="Form.obra()">${ic('mais')}Nova obra</button></div>` +
        (grupos.length ? grupos.map(g => `<section class="secao"><div class="secao-cab"><h2>${g.s}</h2></div><div class="obras-lista">${g.l.map(cartaoObra).join('')}</div></section>`).join('')
          : '<div class="painel vazio">Nenhuma obra cadastrada.</div>')
    };
  },

  obra(r) {
    const o = Busca.obra(r.id);
    if (!o) return { titulo: 'Obra', html: '<div class="painel vazio">Obra não encontrada.</div>' };
    const aba = r.aba || 'resumo';
    const abas = [['resumo', 'Resumo'], ['contrato', 'Contrato'], ['recebimentos', 'Recebimentos'], ['gastos', 'Gastos'], ['empreiteiros', 'Empreiteiros']];
    const c = Calc.obra(o);
    let corpo = '';

    if (aba === 'resumo') {
      corpo = `<div class="blocos">
        <div class="painel painel-pad bloco"><h3>Cliente</h3><p class="expl">O que o cliente contratou e já pagou.</p>
          <dl class="linhas"><div><dt>Contratado</dt><dd>${U.moeda(c.contrato)}</dd></div><div><dt>Recebido</dt><dd class="pos">${U.moeda(c.recebido)}</dd></div>
          <div class="total"><dt>Falta receber</dt><dd>${U.moeda(c.aReceber)}</dd></div></dl>
          <div class="barra risco-${Risco.de(o, c).nivel}"><i style="width:${c.pctRecebido}%"></i></div><div class="barra-legenda"><span>${c.pctRecebido.toFixed(0)}% recebido</span>${Privado.visivel && o.status !== 'Finalizada' ? `<span class="risco-txt risco-${Risco.de(o, c).nivel}">${Risco.de(o, c).rotulo}</span>` : ''}</div></div>
        <div class="painel painel-pad bloco"><h3>Custos da obra</h3><p class="expl">Empreiteiros, material e outros gastos da obra.</p>
          <dl class="linhas"><div><dt>Empreiteiros contratados</dt><dd>${U.moeda(c.empContratado)}</dd></div><div><dt>Já pago a empreiteiros</dt><dd>${U.moeda(c.empPago)}</dd></div>
          <div><dt>Material e outros</dt><dd>${U.moeda(c.outrosCustos)}</dd></div>
          <div class="total"><dt>Falta pagar a empreiteiros</dt><dd>${U.moeda(c.empAPagar)}</dd></div></dl>
          ${o.status === 'Finalizada' ? '' : `<dl class="linhas reserva"><div><dt>Reserva p/ extras fora do contrato (${String(c.reservaPct).replace('.', ',')}%)</dt><dd>${U.moeda(c.reserva)}</dd></div>
          <div><dt>Custo total estimado</dt><dd>${U.moeda(c.custosPrevistos + c.reserva)}</dd></div></dl>
          <p class="expl" style="margin-top:8px">O % da reserva se muda em Editar obra.</p>`}</div>
        <div class="painel painel-pad bloco"><div class="bloco-cab"><h3>Resultado</h3>
          <button class="icone olho" onclick="Privado.alternar()" aria-label="${Privado.visivel ? 'Esconder valores' : 'Mostrar valores'}" title="${Privado.visivel ? 'Esconder valores' : 'Mostrar valores'}">${ic(Privado.visivel ? 'olho' : 'olhoFechado')}</button></div>
          <p class="expl">Quanto a obra deixa para você.</p>
          <dl class="linhas"><div><dt>Sobra prevista</dt><dd class="${Privado.visivel ? U.sinal(c.sobraPrevista) : ''}">${Privado.valor(c.sobraPrevista)}</dd></div>
          ${o.status === 'Finalizada' ? '' : `<div><dt>Sobra prevista com a reserva</dt><dd class="${Privado.visivel ? U.sinal(c.sobraComReserva) : ''}">${Privado.valor(c.sobraComReserva)}</dd></div>`}
          <div><dt>Já retirado (pessoal + empresa)</dt><dd>${Privado.valor(c.jaRetirado)}</dd></div>
          <div class="total"><dt>Ainda disponível</dt><dd class="${Privado.visivel ? U.sinal(c.aindaDisponivel) : ''}">${Privado.valor(c.aindaDisponivel)}</dd></div></dl>
          <p class="expl" style="margin-top:10px">Sobra prevista = contratado − empreiteiros − material/outros.</p></div>
      </div>
      <section class="secao" style="margin-top:24px"><div class="secao-cab"><h2>Últimos lançamentos desta obra</h2><a onclick="Filtro.obra='${o.id}';Rota.ir('lancamentos')">Ver todos</a></div>
      ${htmlLancamentos(todosLancamentos().filter(l => l.obraId === o.id).slice(0, 6), null, { mostrarObra: false, totalDia: false })}</section>`;
    }

    if (aba === 'contrato') {
      const ets = D.etapasContrato.filter(e => e.obraId === o.id).sort((a, b) => a.ordem - b.ordem);
      corpo = `<p class="nota">O valor do contrato é a soma das etapas. Para um aditivo ou serviço extra, adicione uma etapa nova.</p>
      <div class="barra-ferr"><span class="esp"></span><button class="btn btn-primario" onclick="Form.etapaContrato('${o.id}')">${ic('mais')}Nova etapa</button></div>
      <div class="painel tabela-wrap"><table class="tab"><thead><tr><th>Etapa</th><th class="n">Contratado</th><th class="n">Pago</th><th class="n">Falta</th></tr></thead><tbody>
      ${ets.map(e => { const p = Calc.pagoEtapaContrato(e.id); return `<tr class="clicavel" onclick="Form.etapaContrato('${o.id}','${e.id}')"><td>${U.esc(e.descricao)}${e.observacao ? `<div class="sub">${U.esc(e.observacao)}</div>` : ''}</td><td class="n">${U.moeda(e.valor)}</td><td class="n">${U.moeda(p)}</td><td class="n"><b class="${U.sinal(e.valor - p)}">${U.moeda(e.valor - p)}</b></td></tr>`; }).join('') || '<tr><td colspan="4" class="vazio">Nenhuma etapa. Cadastre as etapas do contrato.</td></tr>'}
      </tbody><tfoot><tr><td>Total</td><td class="n">${U.moeda(c.contrato)}</td><td class="n">${U.moeda(c.recebido)}</td><td class="n">${U.moeda(c.aReceber)}</td></tr></tfoot></table></div>`;
    }

    if (aba === 'recebimentos') {
      const l = D.entradas.filter(e => e.obraId === o.id).map(e => ({ ...e, _t: 'e' })).sort((a, b) => b.data.localeCompare(a.data));
      corpo = `<div class="barra-ferr"><span class="mut">${l.length} recebimento(s) · ${U.moeda(c.recebido)}</span><span class="esp"></span><button class="btn btn-primario" onclick="Form.lancamento('e',null,'${o.id}')">${ic('mais')}Novo recebimento</button></div>${htmlLancamentos(l, null, { mostrarObra: false })}`;
    }

    if (aba === 'gastos') {
      const l = D.saidas.filter(s => s.obraId === o.id).map(s => ({ ...s, _t: 's' })).sort((a, b) => b.data.localeCompare(a.data));
      const tot = TIPOS_SAIDA.map(t => [t, U.soma(l.filter(s => s.tipo === t))]).filter(x => x[1]);
      corpo = `<div class="painel tabela-wrap" style="margin-bottom:14px"><table class="tab"><tbody>${tot.map(([t, v]) => `<tr><td>${t}</td><td class="n">${U.moeda(v)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total de saídas</td><td class="n">${U.moeda(U.soma(l))}</td></tr></tfoot></table></div>
        <div class="barra-ferr"><span class="esp"></span><button class="btn btn-primario" onclick="Form.lancamento('s',null,'${o.id}')">${ic('mais')}Nova saída</button></div>${htmlLancamentos(l, null, { mostrarObra: false })}`;
    }

    if (aba === 'empreiteiros') {
      const ets = D.etapasEmpreiteiro.filter(e => e.obraId === o.id);
      corpo = `<div class="barra-ferr"><span class="esp"></span><button class="btn btn-primario" onclick="Form.etapaEmp('${o.id}')">${ic('mais')}Nova etapa de empreiteiro</button></div>
      <div class="painel tabela-wrap"><table class="tab"><thead><tr><th>Empreiteiro / etapa</th><th class="n">Contratado</th><th class="n">Pago</th><th class="n">Falta</th><th>Prazo</th></tr></thead><tbody>
      ${ets.map(e => {
        const p = Calc.pagoEtapaEmp(e.id), f = e.valor - p;
        let prazo = e.prazo ? U.data(e.prazo) : '-';
        if (e.status === 'Concluída') prazo = `<span class="selo ok">Concluída${e.dataConclusao ? ' ' + U.data(e.dataConclusao) : ''}</span>`;
        else if (e.prazo && e.prazo < U.hoje()) prazo += ` <span class="selo alerta">atrasada</span>`;
        return `<tr class="clicavel" onclick="Form.etapaEmp('${o.id}','${e.id}')"><td><b>${U.esc(e.empreiteiro)}</b><div class="sub">${U.esc(e.descricao)}</div></td><td class="n">${U.moeda(e.valor)}</td><td class="n">${U.moeda(p)}</td><td class="n ${f < 0 ? 'neg' : ''}"><b>${U.moeda(f)}</b></td><td>${prazo}</td></tr>`;
      }).join('') || '<tr><td colspan="5" class="vazio">Nenhuma etapa de empreiteiro.</td></tr>'}
      </tbody><tfoot><tr><td>Total</td><td class="n">${U.moeda(c.empContratado)}</td><td class="n">${U.moeda(c.empPago - c.empPagoSemEtapa)}</td><td class="n">${U.moeda(c.empAPagar)}</td><td></td></tr></tfoot></table></div>
      ${c.empPagoSemEtapa ? `<p class="nota" style="margin-top:12px">${U.moeda(c.empPagoSemEtapa)} pagos a empreiteiros sem etapa vinculada.</p>` : ''}`;
    }

    return {
      titulo: o.nome,
      html: `<div class="cab-obra"><div><div class="mut">${U.esc(o.cliente)}${o.cidade ? ' · ' + U.esc(o.cidade) : ''}</div>${seloStatus(o.status)}</div>
        <div class="acoes"><button class="btn" onclick="Form.obra('${o.id}')">${ic('editar')}Editar</button><a class="btn btn-primario" href="#relatorio/${o.id}">${ic('doc')}Relatório do cliente</a></div></div>
        <nav class="abas">${abas.map(([k, n]) => `<a href="#obra/${o.id}/${k}" class="${aba === k ? 'ativo' : ''}">${n}</a>`).join('')}</nav>${corpo}`
    };
  },

  lancamentos() {
    const F = FiltroLanc;
    if (Filtro.obra) { F.obra = Filtro.obra; Filtro.obra = ''; F.mes = ''; F.grupo = ''; }
    const meses = [...new Set(todosLancamentos().map(l => String(l.data).slice(0, 7)))].sort();
    const mesPadrao = () => meses.includes(U.hoje().slice(0, 7)) ? U.hoje().slice(0, 7) : (meses[meses.length - 1] || '');
    if (F.mes === null) F.mes = mesPadrao();
    const nomeMes = m => { const [y, mm] = m.split('-'); const t = new Date(+y, +mm - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
    const i = meses.indexOf(F.mes);
    return {
      titulo: 'Lançamentos',
      html: `<div class="lanc-ferr">
        <div class="mes-nav">
          <button class="icone" id="mAnt" ${!F.mes || i <= 0 ? 'disabled' : ''} aria-label="Mês anterior"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
          <button class="mes-nome" id="mTodos" title="${F.mes ? 'Ver todos os meses' : 'Voltar para um mês'}">${F.mes ? nomeMes(F.mes) : 'Todos os meses'}</button>
          <button class="icone" id="mProx" ${!F.mes || i >= meses.length - 1 ? 'disabled' : ''} aria-label="Próximo mês"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button>
        </div>
        <div class="chips filtro-chips">${[['', 'Tudo'], ...Object.entries(TIPO_GRUPO).map(([k, v]) => [k, v.nome])].map(([k, n]) => `<button type="button" data-g="${k}" class="${F.grupo === k ? 'ativo' : ''}">${n}</button>`).join('')}</div>
        <div class="barra-ferr">
          <select id="fObra"><option value="">Todas as obras</option>${D.obras.map(o => `<option value="${o.id}" ${F.obra === o.id ? 'selected' : ''}>${U.esc(o.nome)}</option>`).join('')}</select>
          <input id="fTexto" type="search" placeholder="Buscar na descrição…" value="${U.esc(F.texto)}">
        </div>
      </div>
      <div class="kpis tres lanc-resumo" id="resumoFiltro"></div>
      <div id="listaLanc"></div>`,
      depois() {
        const f = () => {
          let l = todosLancamentos();
          if (F.obra) l = l.filter(x => x.obraId === F.obra);
          if (F.grupo) l = l.filter(TIPO_GRUPO[F.grupo].filtro);
          if (F.mes) l = l.filter(x => String(x.data).startsWith(F.mes));
          const tx = F.texto.toLowerCase();
          if (tx) l = l.filter(x => [x.observacao, x.empreiteiro, x.tipo, Busca.nomeObra(x.obraId)].join(' ').toLowerCase().includes(tx));
          const e = U.soma(l.filter(x => x._t === 'e')), s = U.soma(l.filter(x => x._t === 's'));
          resumoFiltro.innerHTML = `<div class="kpi"><div class="kpi-rot">Entrou</div><div class="kpi-val pos">${U.moedaCurta(e)}</div></div>
            <div class="kpi"><div class="kpi-rot">Saiu</div><div class="kpi-val">${U.moedaCurta(s)}</div></div>
            <div class="kpi"><div class="kpi-rot">Saldo · ${l.length} lanç.</div><div class="kpi-val ${U.sinal(e - s)}">${U.moedaCurta(e - s)}</div></div>`;
          listaLanc.innerHTML = htmlLancamentos(l, 'Nada encontrado com esses filtros.', { mostrarObra: !F.obra });
        };
        mAnt.onclick = () => { F.mes = meses[i - 1]; Rota.render(); };
        mProx.onclick = () => { F.mes = meses[i + 1]; Rota.render(); };
        mTodos.onclick = () => { F.mes = F.mes ? '' : mesPadrao(); Rota.render(); };
        document.querySelectorAll('.filtro-chips [data-g]').forEach(b => b.onclick = () => { F.grupo = b.dataset.g; Rota.render(); });
        fObra.onchange = () => { F.obra = fObra.value; f(); };
        fTexto.oninput = () => { F.texto = fTexto.value; f(); };
        f();
      }
    };
  },

  ajustes() {
    const cfg = D.config;
    return {
      titulo: 'Ajustes',
      html: `<section class="secao"><div class="secao-cab"><h2>Conta bancária</h2></div><div class="painel painel-pad">
        <div class="campos"><div class="campo"><label>Saldo inicial da conta (antes do 1º lançamento)</label><input id="aSaldo" inputmode="decimal" value="${U.valorParaCampo(cfg.saldoInicial)}" placeholder="0,00"></div></div>
        <p class="mut" style="font-size:13px">Saldo calculado hoje: <b>${U.moeda(Calc.saldoConta())}</b>. Se não bater com o extrato, falta algum lançamento ou o saldo inicial.</p></div></section>
      <section class="secao"><div class="secao-cab"><h2>Dados no relatório do cliente</h2></div><div class="painel painel-pad"><div class="campos">
        <div class="campo cheio"><label>Nome da empresa</label><input id="aNome" value="${U.esc(cfg.empresaNome || '')}"></div>
        <div class="campo"><label>Contato (telefone / e-mail)</label><input id="aContato" value="${U.esc(cfg.empresaContato || '')}"></div>
        <div class="campo"><label>Chave PIX</label><input id="aPix" value="${U.esc(cfg.empresaPix || '')}"></div></div>
        <div class="form-acoes"><button class="btn btn-primario" id="aSalvar">Salvar ajustes</button></div></div></section>
      <section class="secao"><div class="secao-cab"><h2>Quem pode entrar</h2></div><div class="painel painel-pad">
        <p style="margin-top:0">Você entrou como <b>${U.esc(D.usuario.nome)}</b>. <a class="link" onclick="sair()">Sair deste aparelho</a></p>
        ${D.usuario.admin ? `<div id="listaUsuarios" class="mut">Carregando…</div>
        <div class="campos" style="margin-top:12px"><div class="campo"><label>Nome</label><input id="uNome" placeholder="Ex.: Esposa"></div>
        <div class="campo"><label>PIN (6 a 12 números)</label><input id="uPin" inputmode="numeric" maxlength="12"></div></div>
        <div class="form-acoes"><button class="btn" id="uAdd">Adicionar pessoa</button></div>
        <p class="mut" style="font-size:13px;margin-bottom:0">Mande o link do app e o PIN para a pessoa. Para tirar o acesso, remova-a da lista.</p>`
        : '<p class="mut" style="font-size:13.5px;margin-bottom:0">Só o administrador pode adicionar ou remover pessoas.</p>'}</div></section>
      <section class="secao"><div class="secao-cab"><h2>Cópia de segurança</h2></div><div class="painel painel-pad">
        <p class="mut" style="font-size:13.5px;margin-top:0">Os dados ficam na planilha do Drive (que guarda histórico de versões). Se quiser, baixe também uma cópia em arquivo.</p>
        <button class="btn" onclick="baixarBackup()">Baixar cópia (.json)</button></div></section>`,
      depois() {
        aSalvar.onclick = () => comBotao(aSalvar, async () => {
          const pares = [['saldoInicial', U.lerValor(aSaldo.value)], ['empresaNome', aNome.value.trim()], ['empresaContato', aContato.value.trim()], ['empresaPix', aPix.value.trim()]];
          for (const [k, v] of pares) { await Api.chamar('api_salvarConfig', k, v); D.config[k] = v; }
          aviso('Ajustes salvos.'); Rota.render();
        });
        if (!D.usuario.admin) return;
        const listar = async () => {
          const us = await Api.chamar('api_usuarios');
          listaUsuarios.innerHTML = `<table class="tab"><tbody>${us.map(u => `<tr><td><b>${U.esc(u.nome)}</b>${u.admin ? ' <span class="selo">administrador</span>' : ''}</td>
            <td class="n">${u.admin ? '' : `<button class="btn btn-perigo" onclick="removerUsuario('${u.id}','${U.esc(u.nome)}')">Remover</button>`}</td></tr>`).join('')}</tbody></table>`;
        };
        window.removerUsuario = async (id, nome) => {
          if (!confirm(`Tirar o acesso de ${nome}?`)) return;
          try { await Api.chamar('api_removerUsuario', id); aviso('Acesso removido.'); listar(); } catch (e) { aviso('Erro: ' + e.message); }
        };
        uAdd.onclick = () => comBotao(uAdd, async () => {
          if (!uNome.value.trim() || !/^\d{6,12}$/.test(uPin.value.trim())) throw new Error('Informe o nome e um PIN de 6 a 12 números.');
          await Api.chamar('api_adicionarUsuario', uNome.value.trim(), uPin.value.trim());
          aviso('Pessoa adicionada.'); uNome.value = uPin.value = ''; uAdd.disabled = false; uAdd.innerHTML = 'Adicionar pessoa'; listar();
        });
        listar().catch(e => listaUsuarios.textContent = e.message);
      }
    };
  },

  relatorio(r) {
    const o = Busca.obra(r.id);
    if (!o) return { titulo: 'Relatório', html: '<div class="painel vazio">Obra não encontrada.</div>' };
    return {
      titulo: 'Relatório · ' + o.nome,
      html: `<p class="nota">Este é o extrato que o cliente vai receber: etapas contratadas, pagamentos feitos e quanto falta. Não aparecem custos, empreiteiros nem retiradas.</p>
        <div class="barra-ferr"><button class="btn btn-primario" id="rPdf">${ic('doc')}${navigator.canShare ? 'Gerar e enviar PDF' : 'Gerar PDF'}</button><span id="rLink"></span></div>
        <div class="painel"><iframe id="rFrame" class="rel-frame" title="Relatório"></iframe></div>`,
      depois() {
        Api.chamar('api_relatorioHtml', o.id).then(html => {
          rFrame.srcdoc = html;
          rFrame.onload = () => { try { rFrame.style.height = (rFrame.contentDocument.body.scrollHeight + 40) + 'px'; } catch (e) { } };
        }).catch(e => aviso('Erro: ' + e.message));
        rPdf.onclick = () => comBotao(rPdf, async () => {
          const res = await Api.chamar('api_relatorioPdf', o.id);
          const como = await entregarPdf(res);
          rLink.innerHTML = `<span class="mut" style="font-size:13px">${como === 'baixado' ? 'PDF baixado. ' : ''}Uma cópia fica no Drive, em "Relatórios para clientes".</span>`;
          rPdf.disabled = false; rPdf.innerHTML = ic('doc') + (navigator.canShare ? 'Gerar e enviar PDF' : 'Gerar PDF');
        });
      }
    };
  }
};

/* ---------- Formulários ---------- */
const sel = (lista, atual, vazio) => (vazio !== undefined ? `<option value="">${vazio}</option>` : '') +
  lista.map(([v, t]) => `<option value="${U.esc(v)}" ${String(v) === String(atual ?? '') ? 'selected' : ''}>${U.esc(t)}</option>`).join('');

const Form = {
  ultimaObra: '',

  lancamento(tipo, id, obraId) {
    if (!D.obras.length) return aviso('Cadastre uma obra primeiro.');
    const reg = id ? (tipo === 'e' ? D.entradas : D.saidas).find(x => x.id === id) : null;
    let modo = tipo || 'e';
    let tipoSaida = reg && tipo === 's' ? reg.tipo : 'Empreiteiro';
    const ativas = D.obras.filter(o => o.status !== 'Finalizada' || (reg && reg.obraId === o.id) || o.id === obraId);
    const r = Rota.atual();
    const obraDaTela = (r.pag === 'obra' || r.pag === 'relatorio') ? r.id : '';
    const obraIni = reg ? reg.obraId : (obraId || obraDaTela || Form.ultimaObra || (ativas[0] || D.obras[0]).id);

    Folha.abrir(reg ? 'Editar lançamento' : 'Novo lançamento', `
      <form id="fl" class="campos" autocomplete="off">
        ${reg ? '' : `<div class="segmento"><button type="button" data-m="e">Entrada (recebi)</button><button type="button" data-m="s">Saída (paguei)</button></div>`}
        <div class="campo campo-valor cheio"><label>Valor (R$)</label><input id="lValor" inputmode="decimal" required placeholder="0,00" value="${reg ? U.valorParaCampo(reg.valor) : ''}"></div>
        <div class="campo"><label>Data</label><input id="lData" type="date" required value="${reg ? reg.data : U.hoje()}"></div>
        <div class="campo"><label>Obra</label><select id="lObra">${sel(ativas.map(o => [o.id, o.nome]), obraIni)}</select></div>
        <div class="campo cheio so-s"><label>Tipo de saída</label><div class="chips" id="lTipos">${TIPOS_SAIDA.map(t => `<button type="button" data-t="${t}">${t}</button>`).join('')}</div></div>
        <div class="campo cheio so-ret" id="lParte"></div>
        <div class="campo cheio so-e"><label>Referente à etapa do contrato</label><select id="lEtapaC"></select></div>
        <div class="campo cheio so-emp"><label>Etapa do empreiteiro</label><select id="lEtapaE"></select></div>
        <div class="campo cheio so-emp"><label>Empreiteiro</label><input id="lEmp" list="dlEmp" value="${U.esc(reg?.empreiteiro || '')}"><datalist id="dlEmp">${[...new Set(D.etapasEmpreiteiro.map(e => e.empreiteiro))].map(n => `<option value="${U.esc(n)}">`).join('')}</datalist></div>
        <div class="campo"><label>Forma de pagamento</label><select id="lForma">${sel(FORMAS.map(f => [f, f]), reg?.formaPagamento || 'Pix')}</select></div>
        <div class="campo cheio"><label>Observação</label><textarea id="lObs" rows="2">${U.esc(reg?.observacao || '')}</textarea></div>
        <div class="form-acoes cheio">${reg ? '<button type="button" class="btn btn-perigo" id="lExcluir">Excluir</button>' : ''}<button class="btn btn-primario btn-bloco" id="lSalvar">Salvar</button></div>
      </form>`);

    const atualiza = () => {
      document.querySelectorAll('#fl [data-m]').forEach(b => b.classList.toggle('ativo', b.dataset.m === modo));
      document.querySelectorAll('#lTipos button').forEach(b => b.classList.toggle('ativo', b.dataset.t === tipoSaida));
      document.querySelectorAll('.so-e').forEach(el => el.hidden = modo !== 'e');
      document.querySelectorAll('.so-s').forEach(el => el.hidden = modo !== 's');
      document.querySelectorAll('.so-emp').forEach(el => el.hidden = !(modo === 's' && tipoSaida === 'Empreiteiro'));
      minhaParte();
      const ob = lObra.value;
      const etC = D.etapasContrato.filter(e => e.obraId === ob).sort((a, b) => a.ordem - b.ordem);
      const atualC = lEtapaC.value || reg?.etapaId || '';
      lEtapaC.innerHTML = sel(etC.map(e => [e.id, `${e.descricao} — falta ${U.moeda(e.valor - Calc.pagoEtapaContrato(e.id))}`]), atualC, etC.length ? '(sem etapa)' : 'Obra sem etapas cadastradas');
      if (!atualC && etC.length === 1) lEtapaC.value = etC[0].id;
      const etE = D.etapasEmpreiteiro.filter(e => e.obraId === ob && (e.status !== 'Concluída' || e.id === reg?.etapaEmpreiteiroId));
      const atualE = lEtapaE.value || reg?.etapaEmpreiteiroId || '';
      lEtapaE.innerHTML = sel(etE.map(e => [e.id, `${e.empreiteiro} — ${e.descricao} (falta ${U.moeda(e.valor - Calc.pagoEtapaEmp(e.id))})`]), atualE, '(sem etapa)');
    };
    document.querySelectorAll('#fl [data-m]').forEach(b => b.onclick = () => { modo = b.dataset.m; atualiza(); });
    document.querySelectorAll('#lTipos button').forEach(b => b.onclick = () => { tipoSaida = b.dataset.t; atualiza(); });
    // Retirada: mostra quanto ainda é seu em cada obra, para não deixar nenhuma negativa
    const ehRetirada = () => modo === 's' && ['Retirada pessoal', 'Despesa da empresa'].includes(tipoSaida);
    const minhaParte = () => {
      lParte.hidden = !ehRetirada();
      if (lParte.hidden) return;
      const valor = U.lerValor(lValor.value);
      const linhas = ativas.map(o => {
        let disp = Calc.obra(o).aindaDisponivel;
        if (reg && tipo === 's' && reg.obraId === o.id && ['Retirada pessoal', 'Despesa da empresa'].includes(reg.tipo)) disp += Number(reg.valor); // editando: devolve o valor antigo
        const sel = o.id === lObra.value, depois = disp - (sel ? valor : 0);
        return `<button type="button" class="parte-linha ${sel ? 'ativo' : ''}" data-obra="${o.id}">
          <span class="parte-nome">${U.esc(o.nome)}</span>
          <span class="parte-val ${U.sinal(disp)}">${U.moeda(disp)}</span>
          ${sel && valor ? `<span class="parte-depois ${U.sinal(depois)}">depois desta: ${U.moeda(depois)}</span>` : ''}</button>`;
      }).join('');
      const s = ativas.find(o => o.id === lObra.value);
      const dispSel = s ? (Calc.obra(s).aindaDisponivel + (reg && tipo === 's' && reg.obraId === s.id && ['Retirada pessoal', 'Despesa da empresa'].includes(reg.tipo) ? Number(reg.valor) : 0)) : 0;
      const alerta = s && valor && dispSel - valor < 0 ? `<p class="parte-alerta">Essa retirada deixa <b>${U.esc(s.nome)}</b> negativa. Escolha outra obra ou divida o valor.</p>` : '';
      lParte.innerHTML = `<label>Sua parte disponível em cada obra (toque para escolher)</label><div class="parte-lista">${linhas}</div>${alerta}`;
      lParte.querySelectorAll('[data-obra]').forEach(b => b.onclick = () => { lObra.value = b.dataset.obra; lObra.onchange(); });
    };
    lValor.addEventListener('input', minhaParte);
    lObra.onchange = () => { lEtapaC.value = ''; lEtapaE.value = ''; atualiza(); };
    lEtapaE.onchange = () => { const e = Busca.etapaE(lEtapaE.value); if (e) lEmp.value = e.empreiteiro; };
    atualiza();
    if (!reg) setTimeout(() => lValor.focus(), 80);

    fl.onsubmit = ev => {
      ev.preventDefault();
      const valor = U.lerValor(lValor.value);
      if (!valor) return aviso('Informe o valor.');
      Form.ultimaObra = lObra.value;
      comBotao(lSalvar, async () => {
        const base = { id: reg?.id || '', data: lData.value, obraId: lObra.value, valor, formaPagamento: lForma.value, observacao: lObs.value.trim(), criadoPor: reg?.criadoPor || '', criadoEm: reg?.criadoEm || '' };
        if (modo === 'e') await salvar('entradas', { ...base, etapaId: lEtapaC.value }, 'Entrada salva.');
        else {
          const emp = tipoSaida === 'Empreiteiro';
          await salvar('saidas', { ...base, tipo: tipoSaida, etapaEmpreiteiroId: emp ? lEtapaE.value : '', empreiteiro: emp ? lEmp.value.trim() : '' }, 'Saída salva.');
        }
        Folha.fechar();
      });
    };
    if (reg) lExcluir.onclick = () => {
      if (!confirm('Excluir este lançamento?')) return;
      comBotao(lExcluir, async () => { await excluir(tipo === 'e' ? 'entradas' : 'saidas', reg.id, 'Lançamento excluído.'); Folha.fechar(); });
    };
  },

  obra(id) {
    const o = id ? Busca.obra(id) : null;
    Folha.abrir(o ? 'Editar obra' : 'Nova obra', `
      <form id="fo" class="campos">
        <div class="campo cheio"><label>Nome da obra</label><input id="oNome" required value="${U.esc(o?.nome || '')}"></div>
        <div class="campo"><label>Cliente</label><input id="oCli" required value="${U.esc(o?.cliente || '')}"></div>
        <div class="campo"><label>Telefone do cliente</label><input id="oTel" inputmode="tel" value="${U.esc(o?.telefone || '')}"></div>
        <div class="campo"><label>Cidade</label><input id="oCid" value="${U.esc(o?.cidade || '')}"></div>
        <div class="campo"><label>Status</label><select id="oSt">${sel(STATUS_OBRA.map(s => [s, s]), o?.status || 'Em andamento')}</select></div>
        <div class="campo cheio"><label>Endereço</label><input id="oEnd" value="${U.esc(o?.endereco || '')}"></div>
        <div class="campo"><label>Início</label><input id="oIni" type="date" value="${o?.dataInicio || ''}"></div>
        <div class="campo"><label>Previsão de término</label><input id="oFim" type="date" value="${o?.dataFim || ''}"></div>
        <div class="campo"><label>Reserva p/ custos extras (%)</label><input id="oRes" type="number" inputmode="decimal" min="0" max="50" step="0.5" value="${o ? Calc.reservaPct(o) : 10}">
          <span class="ajuda">Estimativa de gastos fora do contrato, sobre os custos da obra. Comum: 10 a 15%.</span></div>
        <div class="campo cheio"><label>Observação</label><textarea id="oObs">${U.esc(o?.observacao || '')}</textarea></div>
        ${o ? '' : '<p class="mut cheio" style="font-size:13px;margin:0">Depois de salvar, cadastre as etapas do contrato na aba "Contrato" da obra.</p>'}
        <div class="form-acoes cheio">${o ? '<button type="button" class="btn btn-perigo" id="oExcluir">Excluir</button>' : ''}<button class="btn btn-primario btn-bloco" id="oSalvar">Salvar</button></div>
      </form>`);
    fo.onsubmit = ev => {
      ev.preventDefault();
      comBotao(oSalvar, async () => {
        const r = await salvar('obras', { id: o?.id || '', nome: oNome.value.trim(), cliente: oCli.value.trim(), telefone: oTel.value.trim(), cidade: oCid.value.trim(), endereco: oEnd.value.trim(), dataInicio: oIni.value, dataFim: oFim.value, status: oSt.value, observacao: oObs.value.trim(), reservaPct: oRes.value === '' ? 10 : Math.max(0, Math.min(50, Number(String(oRes.value).replace(',', '.')) || 0)) }, 'Obra salva.');
        Folha.fechar();
        if (!o) Rota.ir('obra/' + r.id + '/contrato');
      });
    };
    if (o) oExcluir.onclick = () => {
      const n = D.entradas.filter(e => e.obraId === o.id).length + D.saidas.filter(s => s.obraId === o.id).length;
      if (n) return aviso(`Esta obra tem ${n} lançamento(s). Exclua-os antes ou mude o status para Finalizada.`);
      if (!confirm('Excluir esta obra?')) return;
      comBotao(oExcluir, async () => { await excluir('obras', o.id, 'Obra excluída.'); Folha.fechar(); Rota.ir('obras'); });
    };
  },

  etapaContrato(obraId, id) {
    const e = id ? Busca.etapaC(id) : null;
    const ordem = e ? e.ordem : Math.max(0, ...D.etapasContrato.filter(x => x.obraId === obraId).map(x => x.ordem)) + 1;
    Folha.abrir(e ? 'Editar etapa do contrato' : 'Nova etapa do contrato', `
      <form id="fe" class="campos">
        <div class="campo cheio"><label>Descrição (aparece para o cliente)</label><input id="eDesc" required placeholder="Ex.: Pintura externa, Aditivo churrasqueira…" value="${U.esc(e?.descricao || '')}"></div>
        <div class="campo campo-valor"><label>Valor contratado (R$)</label><input id="eVal" inputmode="decimal" required value="${e ? U.valorParaCampo(e.valor) : ''}"></div>
        <div class="campo"><label>Ordem</label><input id="eOrd" type="number" min="1" value="${ordem}"></div>
        <div class="campo cheio"><label>Observação interna</label><input id="eObs" value="${U.esc(e?.observacao || '')}"></div>
        <div class="form-acoes cheio">${e ? '<button type="button" class="btn btn-perigo" id="eExcluir">Excluir</button>' : ''}<button class="btn btn-primario btn-bloco" id="eSalvar">Salvar</button></div>
      </form>`);
    fe.onsubmit = ev => {
      ev.preventDefault();
      comBotao(eSalvar, async () => { await salvar('etapasContrato', { id: e?.id || '', obraId, ordem: Number(eOrd.value) || ordem, descricao: eDesc.value.trim(), valor: U.lerValor(eVal.value), observacao: eObs.value.trim() }, 'Etapa salva.'); Folha.fechar(); });
    };
    if (e) eExcluir.onclick = () => {
      if (D.entradas.some(x => x.etapaId === e.id)) return aviso('Há recebimentos ligados a esta etapa. Mude-os de etapa antes de excluir.');
      if (!confirm('Excluir esta etapa?')) return;
      comBotao(eExcluir, async () => { await excluir('etapasContrato', e.id, 'Etapa excluída.'); Folha.fechar(); });
    };
  },

  etapaEmp(obraId, id) {
    const e = id ? Busca.etapaE(id) : null;
    Folha.abrir(e ? 'Editar etapa de empreiteiro' : 'Nova etapa de empreiteiro', `
      <form id="fx" class="campos">
        <div class="campo"><label>Empreiteiro</label><input id="xEmp" required list="dlEmp2" value="${U.esc(e?.empreiteiro || '')}"><datalist id="dlEmp2">${[...new Set(D.etapasEmpreiteiro.map(x => x.empreiteiro))].map(n => `<option value="${U.esc(n)}">`).join('')}</datalist></div>
        <div class="campo"><label>Status</label><select id="xSt">${sel([['Em andamento', 'Em andamento'], ['Concluída', 'Concluída']], e?.status || 'Em andamento')}</select></div>
        <div class="campo cheio"><label>Serviço / etapa</label><input id="xDesc" required value="${U.esc(e?.descricao || '')}"></div>
        <div class="campo campo-valor cheio"><label>Valor combinado (R$)</label><input id="xVal" inputmode="decimal" required value="${e ? U.valorParaCampo(e.valor) : ''}"></div>
        <div class="campo"><label>Início</label><input id="xIni" type="date" value="${e?.dataInicio || ''}"></div>
        <div class="campo"><label>Prazo</label><input id="xPrazo" type="date" value="${e?.prazo || ''}"></div>
        <div class="campo" id="xConclWrap"><label>Concluída em</label><input id="xConcl" type="date" value="${e?.dataConclusao || ''}"></div>
        ${e ? `<p class="mut cheio" style="font-size:13px;margin:0">Já pago: <b>${U.moeda(Calc.pagoEtapaEmp(e.id))}</b>. Pagamentos são lançados como Saída → Empreiteiro.</p>` : ''}
        <div class="form-acoes cheio">${e ? '<button type="button" class="btn btn-perigo" id="xExcluir">Excluir</button>' : ''}<button class="btn btn-primario btn-bloco" id="xSalvar">Salvar</button></div>
      </form>`);
    const vis = () => { xConclWrap.hidden = xSt.value !== 'Concluída'; if (xSt.value === 'Concluída' && !xConcl.value) xConcl.value = U.hoje(); };
    xSt.onchange = vis; vis();
    fx.onsubmit = ev => {
      ev.preventDefault();
      comBotao(xSalvar, async () => { await salvar('etapasEmpreiteiro', { id: e?.id || '', obraId, empreiteiro: xEmp.value.trim(), descricao: xDesc.value.trim(), valor: U.lerValor(xVal.value), dataInicio: xIni.value, prazo: xPrazo.value, status: xSt.value, dataConclusao: xSt.value === 'Concluída' ? xConcl.value : '' }, 'Etapa salva.'); Folha.fechar(); });
    };
    if (e) xExcluir.onclick = () => {
      if (D.saidas.some(s => s.etapaEmpreiteiroId === e.id)) return aviso('Há pagamentos ligados a esta etapa. Não dá para excluir.');
      if (!confirm('Excluir esta etapa?')) return;
      comBotao(xExcluir, async () => { await excluir('etapasEmpreiteiro', e.id, 'Etapa excluída.'); Folha.fechar(); });
    };
  }
};

function baixarBackup() {
  const blob = new Blob([JSON.stringify({ geradoEm: new Date().toISOString(), ...D }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `backup-correia-obras-${U.hoje()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- Entrada por PIN ---------- */
const Entrada = {
  primeiro: false,
  async mostrar(msg) {
    document.getElementById('carregando').style.display = 'none';
    document.getElementById('entrada').hidden = false;
    entErro.textContent = msg && msg !== 'PIN' ? msg : '';
    try {
      const st = await Api.chamar('api_status');
      Entrada.primeiro = !st.temUsuarios;
    } catch (e) { entErro.textContent = 'Sem conexão com o servidor.'; }
    campoNome.hidden = campoPin2.hidden = !Entrada.primeiro;
    entNome.required = Entrada.primeiro;
    entradaTexto.textContent = Entrada.primeiro ? 'Primeiro acesso: crie o administrador (você). Use um PIN de 6 a 12 números.' : 'Digite seu PIN para entrar.';
    entBotao.textContent = Entrada.primeiro ? 'Criar e entrar' : 'Entrar';
    setTimeout(() => (Entrada.primeiro ? entNome : entPin).focus(), 50);
  },
  async enviar(ev) {
    ev.preventDefault();
    const pin = entPin.value.trim();
    if (!/^\d{6,12}$/.test(pin)) { entErro.textContent = 'O PIN deve ter de 6 a 12 números.'; return; }
    if (Entrada.primeiro && pin !== entPin2.value.trim()) { entErro.textContent = 'Os PINs não conferem.'; return; }
    entBotao.disabled = true; entErro.textContent = '';
    try {
      if (Entrada.primeiro) await Api.chamar('api_primeiroAcesso', entNome.value.trim(), pin);
      Sessao.pin = pin;
      await Api.chamar('api_entrar');
      entrada.hidden = true; entPin.value = entPin2.value = '';
      await iniciar();
    } catch (e) { entErro.textContent = e.message; Sessao.pin = ''; }
    entBotao.disabled = false;
  }
};
formEntrada.onsubmit = Entrada.enviar;

function sair() { if (!confirm('Sair deste aparelho? Vai precisar digitar o PIN de novo.')) return; Sessao.pin = ''; location.hash = ''; location.reload(); }

/* ---------- PDF: baixa ou abre o compartilhar do celular (WhatsApp etc.) ---------- */
async function entregarPdf(res) {
  const bytes = Uint8Array.from(atob(res.base64), c => c.charCodeAt(0));
  const arq = new File([bytes], res.nome, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [arq] })) {
    try { await navigator.share({ files: [arq], title: res.nome }); return 'compartilhado'; } catch (e) { if (e.name === 'AbortError') return 'cancelado'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(arq); a.download = res.nome;
  document.body.appendChild(a); a.click(); a.remove();
  return 'baixado';
}

/* ---------- Início ---------- */
async function iniciar() {
  if (!Sessao.pin) return Entrada.mostrar();
  try {
    document.getElementById('carregando').style.display = 'flex';
    D = await Api.chamar('api_carregar');
    document.getElementById('usuarioLateral').innerHTML = `${U.esc(D.usuario.nome)} · <a class="link" style="color:#c9c5bb" onclick="sair()">sair</a>`;
    Rota.render();
  } catch (e) {
    if (Sessao.pin) document.getElementById('conteudo').innerHTML = `<div class="painel painel-pad"><b>Não foi possível abrir os dados.</b><p class="mut">${U.esc(e.message || e)}</p><button class="btn" onclick="location.reload()">Tentar de novo</button></div>`;
  } finally {
    document.getElementById('carregando').style.display = 'none';
  }
}
iniciar();