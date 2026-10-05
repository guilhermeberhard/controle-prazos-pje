/*
 * Controle de Prazos e Diligências – PJE
 * Aplicação 100% local (HTML + JavaScript). Os dados ficam no localStorage do navegador.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'pces-controle-prazos-v1';

  const TIPOS = [
    'Intimação',
    'Juntada de laudo',
    'Oitiva / termo de declarações',
    'Perícia / exame',
    'Cumprimento de mandado',
    'Informações ao Juízo / MP',
    'Relatório final / remessa do IP',
    'Representação',
    'Outras diligências'
  ];
  const REQUISITANTES = ['Juiz(a)', 'Ministério Público', 'Outro'];
  const STATUS = {
    pendente: 'Pendente',
    andamento: 'Em andamento',
    aguardando: 'Aguardando terceiros',
    dilacao: 'Dilação solicitada',
    cumprida: 'Cumprida – responder no PJE',
    respondida: 'Respondida no PJE'
  };
  const PLACEHOLDERS = {
    processo: 'Nº do processo no PJE',
    inquerito: 'Nº do inquérito/procedimento',
    tipo: 'Tipo de diligência',
    descricao: 'Descrição da requisição',
    requisitante: 'Requisitante (Juiz/MP)',
    autoridade: 'Tratamento da autoridade (ex.: Juiz(a) de Direito)',
    orgao: 'Vara / órgão',
    prazo_pje: 'Prazo PJE (dd/mm/aaaa)',
    prazo_interno: 'Prazo interno (dd/mm/aaaa)',
    recebimento: 'Data de recebimento no PJE',
    responsavel: 'Responsável pela diligência',
    id_pje: 'ID do documento no PJE',
    data_hoje: 'Data de hoje (dd/mm/aaaa)',
    data_extenso: 'Data de hoje por extenso',
    ano: 'Ano atual',
    delegado: 'Nome da autoridade policial',
    cargo: 'Cargo',
    delegacia: 'Unidade policial',
    cidade: 'Cidade'
  };

  const CONFIG_PADRAO = {
    delegado: '',
    cargo: 'Delegado(a) de Polícia',
    delegacia: '',
    cidade: '',
    margem: 5,
    contagem: 'corridos',
    prorrogar: true,
    feriados: '',
    logo: '',
    ultimoBackup: null
  };

  // ------------------------------------------------------------------ Estado
  let state = carregar();
  let mesCal = (() => { const h = hoje(); return new Date(h.getFullYear(), h.getMonth(), 1); })();
  let andamentosForm = [];

  function carregar() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = {};
    s.diligencias = Array.isArray(s.diligencias) ? s.diligencias : [];
    s.config = Object.assign({}, CONFIG_PADRAO, s.config || {});
    if (!Array.isArray(s.modelos)) s.modelos = modelosPadrao();
    return s;
  }
  function salvar() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      alert('Não foi possível salvar os dados neste navegador. Verifique o espaço disponível ou se o navegador está em modo privativo.');
    }
  }
  function modelosPadrao() {
    return (window.MODELOS_PADRAO || []).map(m => Object.assign({ id: uid() }, m));
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // ------------------------------------------------------------------ Datas
  function hoje() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function toISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function parseISO(s) {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }
  function fmt(s) {
    const d = typeof s === 'string' ? parseISO(s) : s;
    if (!d) return '';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }
  function extenso(d) {
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
  }
  function diasAte(s) {
    const d = parseISO(s);
    if (!d) return null;
    return Math.round((d - hoje()) / 86400000);
  }
  function addDias(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

  function pascoa(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mes - 1, dia);
  }
  const cacheFeriados = {};
  function feriadosDoAno(y) {
    const chave = y + '|' + state.config.feriados;
    if (cacheFeriados[chave]) return cacheFeriados[chave];
    const mapa = new Map();
    const fixos = [
      ['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'],
      ['09-07', 'Independência'], ['10-12', 'N. Sra. Aparecida'], ['11-02', 'Finados'],
      ['11-15', 'Proclamação da República'], ['11-20', 'Consciência Negra'], ['12-25', 'Natal']
    ];
    fixos.forEach(([md, nome]) => mapa.set(y + '-' + md, nome));
    const p = pascoa(y);
    mapa.set(toISO(addDias(p, -48)), 'Carnaval');
    mapa.set(toISO(addDias(p, -47)), 'Carnaval');
    mapa.set(toISO(addDias(p, -2)), 'Sexta-feira Santa');
    mapa.set(toISO(addDias(p, 60)), 'Corpus Christi');
    (state.config.feriados || '').split('\n').forEach(linha => {
      const m = linha.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s*(.*)$/);
      if (!m) return;
      const ano = m[3] ? Number(m[3]) : y;
      if (ano !== y) return;
      const iso = ano + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
      mapa.set(iso, (m[4] || 'Feriado/suspensão').replace(/^[(\-–\s]+|[)\s]+$/g, '') || 'Feriado/suspensão');
    });
    cacheFeriados[chave] = mapa;
    return mapa;
  }
  function nomeFeriado(d) { return feriadosDoAno(d.getFullYear()).get(toISO(d)) || null; }
  function diaUtil(d) { const w = d.getDay(); return w !== 0 && w !== 6 && !nomeFeriado(d); }

  /** Conta o prazo excluindo o dia do começo e incluindo o do vencimento. */
  function calcularPrazo(inicioISO, dias, modo, prorrogar) {
    let d = parseISO(inicioISO);
    if (!d || !(dias > 0)) return null;
    if (modo === 'uteis') {
      let n = 0;
      while (n < dias) { d = addDias(d, 1); if (diaUtil(d)) n++; }
    } else {
      d = addDias(d, dias);
      if (prorrogar) while (!diaUtil(d)) d = addDias(d, 1);
    }
    return toISO(d);
  }

  // ------------------------------------------------------------------ Utilidades
  const $ = sel => document.querySelector(sel);
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function baixar(nome, conteudo, tipo) {
    const blob = new Blob([conteudo], { type: tipo });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function opcoes(sel, lista, vazio) {
    const el = $(sel);
    el.innerHTML = (vazio ? `<option value="">${esc(vazio)}</option>` : '') +
      lista.map(o => Array.isArray(o) ? `<option value="${esc(o[0])}">${esc(o[1])}</option>` : `<option>${esc(o)}</option>`).join('');
  }

  const ativa = d => d.status !== 'respondida';
  function urgencia(dias) {
    if (dias === null) return 'neutro';
    if (dias < 0) return 'vencido';
    if (dias === 0) return 'hoje';
    if (dias <= 2) return 'critico';
    if (dias <= Number(state.config.margem || 5)) return 'atencao';
    return 'ok';
  }
  function badgePrazo(iso, ativo) {
    if (!iso) return '<span class="muted">—</span>';
    if (!ativo) return `<span class="badge neutro">${fmt(iso)}</span>`;
    const dias = diasAte(iso);
    let rot;
    if (dias < 0) rot = `Vencido há ${-dias} dia${dias === -1 ? '' : 's'}`;
    else if (dias === 0) rot = 'Vence hoje';
    else if (dias === 1) rot = 'Vence amanhã';
    else rot = `${dias} dias`;
    return `<span class="badge ${urgencia(dias)}">${rot}</span><span class="date-sub">${fmt(iso)}</span>`;
  }
  const statusTag = s => `<span class="st st-${s}">${esc(STATUS[s] || s)}</span>`;
  const tituloDil = d => [d.processo, d.inquerito].filter(Boolean).join(' · ') || '(sem número)';
  function ordenarPorPrazo(a, b) {
    const pa = a.prazoPje || a.prazoInterno || '9999-12-31';
    const pb = b.prazoPje || b.prazoInterno || '9999-12-31';
    if (a.reuPreso !== b.reuPreso && pa === pb) return a.reuPreso ? -1 : 1;
    return pa.localeCompare(pb);
  }

  // ------------------------------------------------------------------ Navegação
  function mostrar(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    render();
    try { sessionStorage.setItem('pces-view', view); } catch (e) { /* ignorado */ }
  }
  function viewAtual() {
    const v = document.querySelector('.view.active');
    return v ? v.id.replace('view-', '') : 'painel';
  }

  function render() {
    renderMarca();
    renderAvisoBackup();
    const v = viewAtual();
    if (v === 'painel') renderPainel();
    else if (v === 'diligencias') renderLista();
    else if (v === 'calendario') renderCalendario();
    else if (v === 'modelos') renderModelos();
    else if (v === 'config') renderConfig();
  }

  function renderMarca() {
    const img = $('#logo');
    const fb = $('#logo-fallback');
    const src = state.config.logo || 'assets/logo-pces.png';
    if (img.getAttribute('src') !== src) { img.style.display = ''; fb.style.display = 'none'; img.src = src; }
    const c = state.config;
    $('#brand-unidade').textContent = c.delegacia ? c.delegacia + ' – Controle de Prazos PJE' : 'Controle de Prazos e Diligências – PJE';
  }

  function renderAvisoBackup() {
    const el = $('#aviso-backup');
    const total = state.diligencias.length;
    const ult = state.config.ultimoBackup ? new Date(state.config.ultimoBackup) : null;
    const dias = ult ? Math.floor((Date.now() - ult.getTime()) / 86400000) : null;
    if (total > 0 && (dias === null || dias >= 7)) {
      el.innerHTML = `${dias === null ? 'Você ainda não fez cópia de segurança dos dados.' : `Último backup há ${dias} dias.`}
        <button class="btn sm" data-action="exportar-json">Baixar backup agora</button>`;
      el.classList.remove('hidden');
    } else el.classList.add('hidden');
  }

  // ------------------------------------------------------------------ Painel
  function itemHTML(d, ref) {
    const iso = ref === 'interno' ? d.prazoInterno : d.prazoPje;
    return `<div class="item" data-action="editar" data-id="${d.id}">
      <div>${badgePrazo(iso, true)}</div>
      <div class="info">
        <div class="t">${esc(d.tipo)} ${d.reuPreso ? '<span class="badge preso">PRESO</span>' : ''}</div>
        <div class="s">${esc(tituloDil(d))} — ${esc(d.requisitante)}${d.orgao ? ' · ' + esc(d.orgao) : ''}</div>
        <div class="s">${statusTag(d.status)} ${d.prazoInterno && ref !== 'interno' ? 'Prazo interno: ' + fmt(d.prazoInterno) : ''}</div>
      </div>
      <button class="icon-btn" data-action="resposta" data-id="${d.id}" title="Gerar resposta">Responder</button>
    </div>`;
  }

  function renderPainel() {
    const at = state.diligencias.filter(ativa);
    const margem = Number(state.config.margem || 5);
    const comPrazo = at.filter(d => d.prazoPje && d.status !== 'cumprida');
    const vencidas = comPrazo.filter(d => diasAte(d.prazoPje) < 0);
    const hojeL = comPrazo.filter(d => diasAte(d.prazoPje) === 0);
    const proximas = comPrazo.filter(d => { const x = diasAte(d.prazoPje); return x > 0 && x <= margem; });
    const responder = at.filter(d => d.status === 'cumprida');
    const mesAtual = toISO(hoje()).slice(0, 7);
    const respMes = state.diligencias.filter(d => d.status === 'respondida' && (d.concluidoEm || '').slice(0, 7) === mesAtual);

    $('#stats').innerHTML = [
      ['red', vencidas.length, 'Prazo PJE vencido', 'vencido'],
      ['orange', hojeL.length, 'Vencem hoje', 'hoje'],
      ['yellow', proximas.length, `Vencem em até ${margem} dias`, 'semana'],
      ['blue', at.length, 'Diligências em aberto', ''],
      ['orange', responder.length, 'Cumpridas – responder no PJE', 'cumprida'],
      ['green', respMes.length, 'Respondidas neste mês', 'respondida']
    ].map(([cor, n, l, f]) => `<div class="stat ${cor}" data-action="filtrar" data-filtro="${f}"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');

    const urg = comPrazo.filter(d => diasAte(d.prazoPje) <= margem).sort(ordenarPorPrazo);
    $('#lista-urgentes').innerHTML = urg.length ? urg.map(d => itemHTML(d)).join('') : '<div class="vazio">Nenhum prazo crítico. </div>';

    const dil = at.filter(d => {
      if (!d.prazoPje || d.status === 'cumprida' || d.status === 'dilacao') return false;
      const x = diasAte(d.prazoPje);
      const internoMaior = d.prazoInterno && d.prazoInterno > d.prazoPje;
      const dependeTerceiros = d.status === 'aguardando' && x <= margem;
      return internoMaior || dependeTerceiros;
    }).sort(ordenarPorPrazo);
    $('#lista-dilacao').innerHTML = dil.length ? dil.map(d => itemHTML(d)).join('') : '<div class="vazio">Nenhuma diligência nesta situação.</div>';

    $('#lista-responder').innerHTML = responder.length
      ? responder.sort(ordenarPorPrazo).map(d => itemHTML(d)).join('')
      : '<div class="vazio">Nenhuma diligência cumprida pendente de resposta.</div>';
  }

  // ------------------------------------------------------------------ Lista
  function prepararFiltros() {
    opcoes('#flt-status', [['ativas', 'Em aberto (todas não respondidas)'], ['todas', 'Todos os status']].concat(Object.entries(STATUS)));
    opcoes('#flt-requisitante', REQUISITANTES, 'Todos os requisitantes');
    opcoes('#flt-tipo', TIPOS, 'Todos os tipos');
    opcoes('#f-tipo', TIPOS);
    opcoes('#f-requisitante', REQUISITANTES);
    opcoes('#f-status', Object.entries(STATUS));
    ['#flt-busca', '#flt-status', '#flt-requisitante', '#flt-tipo', '#flt-urgencia'].forEach(s =>
      $(s).addEventListener('input', renderLista));
  }

  function filtradas() {
    const busca = $('#flt-busca').value.trim().toLowerCase();
    const st = $('#flt-status').value;
    const req = $('#flt-requisitante').value;
    const tipo = $('#flt-tipo').value;
    const urg = $('#flt-urgencia').value;
    return state.diligencias.filter(d => {
      if (st === 'ativas' && !ativa(d)) return false;
      if (st !== 'ativas' && st !== 'todas' && d.status !== st) return false;
      if (req && d.requisitante !== req) return false;
      if (tipo && d.tipo !== tipo) return false;
      if (urg) {
        const x = diasAte(d.prazoPje);
        if (urg === 'vencido' && !(x !== null && x < 0)) return false;
        if (urg === 'hoje' && x !== 0) return false;
        if (urg === 'semana' && !(x !== null && x >= 0 && x <= 7)) return false;
        if (urg === 'reupreso' && !d.reuPreso) return false;
      }
      if (busca) {
        const alvo = [d.processo, d.inquerito, d.orgao, d.descricao, d.responsavel, d.obs, d.tipo, d.idPje].join(' ').toLowerCase();
        if (!alvo.includes(busca)) return false;
      }
      return true;
    }).sort(ordenarPorPrazo);
  }

  function renderLista() {
    const lista = filtradas();
    $('#tbody-diligencias').innerHTML = lista.map(d => {
      const at = ativa(d);
      return `<tr class="${at ? '' : 'final'}">
        <td>${badgePrazo(d.prazoPje, at && d.status !== 'cumprida')}</td>
        <td>${badgePrazo(d.prazoInterno, at)}</td>
        <td><strong>${esc(d.processo || '—')}</strong><br><span class="muted small">${esc(d.inquerito || '')}</span></td>
        <td>${esc(d.tipo)} ${d.reuPreso ? '<span class="badge preso">PRESO</span>' : ''}<div class="desc">${esc(d.descricao || '')}</div></td>
        <td>${esc(d.requisitante)}<br><span class="muted small">${esc(d.orgao || '')}</span></td>
        <td>${esc(d.responsavel || '—')}</td>
        <td>${statusTag(d.status)}</td>
        <td class="no-print">
          <button class="icon-btn" data-action="editar" data-id="${d.id}">Editar</button>
          <button class="icon-btn" data-action="resposta" data-id="${d.id}">Responder</button>
          ${d.status !== 'cumprida' && at ? `<button class="icon-btn" data-action="marcar" data-status="cumprida" data-id="${d.id}">Cumprida</button>` : ''}
          ${at ? `<button class="icon-btn" data-action="marcar" data-status="respondida" data-id="${d.id}">Respondida</button>` : `<button class="icon-btn" data-action="marcar" data-status="andamento" data-id="${d.id}">Reabrir</button>`}
        </td>
      </tr>`;
    }).join('');
    $('#sem-resultados').classList.toggle('hidden', lista.length > 0);
  }

  // ------------------------------------------------------------------ Calendário
  function renderCalendario() {
    const mes = mesCal.getMonth();
    const tit = mesCal.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    $('#cal-titulo').textContent = tit.charAt(0).toUpperCase() + tit.slice(1);
    const inicio = addDias(mesCal, -mesCal.getDay());
    const hojeISO = toISO(hoje());
    const porDia = {};
    state.diligencias.forEach(d => {
      if (d.prazoPje) (porDia[d.prazoPje] = porDia[d.prazoPje] || []).push(['pje', d]);
      if (d.prazoInterno) (porDia[d.prazoInterno] = porDia[d.prazoInterno] || []).push(['interno', d]);
    });
    let html = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(x => `<div class="cal-dow">${x}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const dia = addDias(inicio, i);
      const iso = toISO(dia);
      const fer = nomeFeriado(dia);
      const cls = ['cal-dia', dia.getMonth() !== mes ? 'fora' : '', (dia.getDay() === 0 || dia.getDay() === 6) ? 'fds' : '', iso === hojeISO ? 'hoje' : ''].join(' ');
      const evs = (porDia[iso] || []).map(([tipo, d]) => {
        const feito = !ativa(d) || (tipo === 'pje' && d.status === 'cumprida');
        return `<span class="cal-ev ${feito ? 'feito' : tipo}" data-action="editar" data-id="${d.id}" title="${esc(d.tipo + ' – ' + tituloDil(d))}">${tipo === 'pje' ? 'PJE' : 'INT'} · ${esc(d.processo || d.inquerito || d.tipo)}</span>`;
      }).join('');
      html += `<div class="${cls}"><div class="num"><span>${dia.getDate()}</span>${fer ? `<span class="chip feriado" title="${esc(fer)}">${esc(fer.length > 14 ? fer.slice(0, 13) + '…' : fer)}</span>` : ''}</div>${evs}</div>`;
    }
    $('#calendario').innerHTML = html;
  }

  // ------------------------------------------------------------------ Diligência (form)
  function abrirDiligencia(id) {
    const d = id ? state.diligencias.find(x => x.id === id) : null;
    const f = d || {
      processo: '', inquerito: '', tipo: TIPOS[0], requisitante: REQUISITANTES[0], orgao: '', descricao: '',
      recebimento: toISO(hoje()), prazoPje: '', prazoInterno: '', responsavel: '', status: 'pendente',
      idPje: '', reuPreso: false, obs: '', andamentos: []
    };
    $('#dlg-dil-titulo').textContent = d ? 'Editar diligência' : 'Nova diligência';
    $('#f-id').value = d ? d.id : '';
    ['processo', 'inquerito', 'tipo', 'requisitante', 'orgao', 'descricao', 'recebimento', 'prazoPje', 'prazoInterno', 'responsavel', 'status', 'idPje', 'obs']
      .forEach(k => { $('#f-' + k).value = f[k] || ''; });
    $('#f-reuPreso').checked = !!f.reuPreso;
    $('#calc-modo').value = state.config.contagem;
    $('#calc-info').textContent = '';
    andamentosForm = (f.andamentos || []).slice();
    $('#and-data').value = toISO(hoje());
    $('#and-texto').value = '';
    renderAndamentos();
    $('#btn-excluir-dil').classList.toggle('hidden', !d);
    $('#dlg-diligencia').showModal();
  }
  function renderAndamentos() {
    const ord = andamentosForm.map((a, i) => [a, i]).sort((x, y) => y[0].data.localeCompare(x[0].data));
    $('#lista-andamentos').innerHTML = ord.length
      ? ord.map(([a, i]) => `<li><b>${fmt(a.data)}</b><span>${esc(a.texto)}</span><button type="button" class="icon-btn" data-action="del-andamento" data-i="${i}">remover</button></li>`).join('')
      : '<li class="muted">Nenhum andamento registrado.</li>';
  }
  function salvarDiligencia() {
    const id = $('#f-id').value;
    const dados = {};
    ['processo', 'inquerito', 'tipo', 'requisitante', 'orgao', 'descricao', 'recebimento', 'prazoPje', 'prazoInterno', 'responsavel', 'status', 'idPje', 'obs']
      .forEach(k => { dados[k] = $('#f-' + k).value.trim(); });
    dados.reuPreso = $('#f-reuPreso').checked;
    // inclui andamento digitado e não adicionado
    if ($('#and-texto').value.trim()) andamentosForm.push({ data: $('#and-data').value || toISO(hoje()), texto: $('#and-texto').value.trim() });
    dados.andamentos = andamentosForm;
    if (!dados.processo && !dados.inquerito) { alert('Informe o número do processo ou do inquérito.'); return false; }
    if (!dados.prazoPje && !dados.prazoInterno) {
      if (!confirm('Nenhum prazo foi informado. Deseja salvar mesmo assim?')) return false;
    }
    const agora = new Date().toISOString();
    if (id) {
      const d = state.diligencias.find(x => x.id === id);
      const statusAnterior = d.status;
      Object.assign(d, dados, { atualizadoEm: agora });
      aplicarMudancaStatus(d, statusAnterior);
    } else {
      const d = Object.assign({ id: uid(), criadoEm: agora, atualizadoEm: agora }, dados);
      aplicarMudancaStatus(d, null);
      state.diligencias.push(d);
    }
    salvar();
    render();
    toast('Diligência salva.');
    return true;
  }
  function aplicarMudancaStatus(d, anterior) {
    if (d.status === anterior) return;
    if (d.status === 'respondida') d.concluidoEm = toISO(hoje());
    else d.concluidoEm = '';
    if (anterior !== null) {
      d.andamentos = d.andamentos || [];
      d.andamentos.push({ data: toISO(hoje()), texto: 'Status alterado para: ' + STATUS[d.status] });
    }
  }
  function marcarStatus(id, status) {
    const d = state.diligencias.find(x => x.id === id);
    if (!d) return;
    const ant = d.status;
    d.status = status;
    d.atualizadoEm = new Date().toISOString();
    aplicarMudancaStatus(d, ant);
    salvar();
    render();
    toast('Status atualizado: ' + STATUS[status]);
  }

  // ------------------------------------------------------------------ Modelos
  function categorias() {
    return Array.from(new Set(state.modelos.map(m => m.categoria).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }
  function renderModelos() {
    const sel = $('#mod-categoria');
    const atual = sel.value;
    opcoes('#mod-categoria', categorias(), 'Todas as categorias');
    sel.value = categorias().includes(atual) ? atual : '';
    $('#categorias-list').innerHTML = categorias().map(c => `<option value="${esc(c)}">`).join('');
    const busca = $('#mod-busca').value.trim().toLowerCase();
    const lista = state.modelos
      .filter(m => (!sel.value || m.categoria === sel.value) && (!busca || (m.titulo + ' ' + m.texto + ' ' + m.categoria).toLowerCase().includes(busca)))
      .sort((a, b) => (a.categoria + a.titulo).localeCompare(b.categoria + b.titulo, 'pt-BR'));
    $('#grid-modelos').innerHTML = lista.length ? lista.map(m => `
      <div class="card modelo">
        <span class="cat">${esc(m.categoria)}</span>
        <h3>${esc(m.titulo)}</h3>
        <pre>${esc(m.texto)}</pre>
        <div class="btn-row">
          <button class="btn sm primary" data-action="usar-modelo" data-id="${m.id}">Usar</button>
          <button class="btn sm" data-action="copiar-modelo" data-id="${m.id}">Copiar</button>
          <button class="btn sm" data-action="editar-modelo" data-id="${m.id}">Editar</button>
          <button class="btn sm" data-action="duplicar-modelo" data-id="${m.id}">Duplicar</button>
          <button class="btn sm danger" data-action="excluir-modelo" data-id="${m.id}">Excluir</button>
        </div>
      </div>`).join('') : '<p class="muted">Nenhum modelo encontrado.</p>';
    $('#lista-placeholders').innerHTML = Object.entries(PLACEHOLDERS)
      .map(([k, v]) => `<div><code data-action="copiar-ph" data-ph="${k}" title="Clique para copiar">{{${k}}}</code> ${esc(v)}</div>`).join('');
  }
  function abrirModelo(id, duplicar) {
    const m = id ? state.modelos.find(x => x.id === id) : null;
    $('#dlg-mod-titulo').textContent = m && !duplicar ? 'Editar modelo' : 'Novo modelo';
    $('#m-id').value = m && !duplicar ? m.id : '';
    $('#m-titulo').value = m ? m.titulo + (duplicar ? ' (cópia)' : '') : '';
    $('#m-categoria').value = m ? m.categoria : '';
    $('#m-texto').value = m ? m.texto : '';
    $('#dlg-modelo').showModal();
  }
  function salvarModelo() {
    const id = $('#m-id').value;
    const dados = { titulo: $('#m-titulo').value.trim(), categoria: $('#m-categoria').value.trim(), texto: $('#m-texto').value };
    if (!dados.titulo || !dados.texto.trim()) { alert('Preencha o título e o texto.'); return false; }
    if (id) Object.assign(state.modelos.find(x => x.id === id), dados);
    else state.modelos.push(Object.assign({ id: uid() }, dados));
    salvar();
    render();
    toast('Modelo salvo.');
    return true;
  }

  function valoresPara(d) {
    const c = state.config;
    const h = hoje();
    const autoridade = !d ? '' : d.requisitante === 'Juiz(a)' ? 'Juiz(a) de Direito'
      : d.requisitante === 'Ministério Público' ? 'Promotor(a) de Justiça' : '';
    return {
      processo: d && d.processo, inquerito: d && d.inquerito, tipo: d && d.tipo ? d.tipo.toLowerCase() : '',
      descricao: d && d.descricao, requisitante: d && d.requisitante, autoridade,
      orgao: d && d.orgao, prazo_pje: d && fmt(d.prazoPje), prazo_interno: d && fmt(d.prazoInterno),
      recebimento: d && fmt(d.recebimento), responsavel: d && d.responsavel, id_pje: d && d.idPje,
      data_hoje: fmt(h), data_extenso: extenso(h), ano: String(h.getFullYear()),
      delegado: c.delegado, cargo: c.cargo, delegacia: c.delegacia, cidade: c.cidade
    };
  }
  function preencher(texto, d) {
    const v = valoresPara(d);
    return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k) => {
      k = k.toLowerCase();
      if (!(k in v)) return m;
      return v[k] ? v[k] : '______';
    });
  }

  function abrirResposta(dilId, modId) {
    const ativas = state.diligencias.filter(ativa).sort(ordenarPorPrazo);
    const dSel = dilId ? state.diligencias.find(x => x.id === dilId) : null;
    const listaD = dSel && !ativa(dSel) ? [dSel].concat(ativas) : ativas;
    opcoes('#r-diligencia', listaD.map(d => [d.id, `${d.prazoPje ? fmt(d.prazoPje) + ' – ' : ''}${d.tipo} – ${tituloDil(d)}`]), '(sem diligência – preencher manualmente)');
    const mods = state.modelos.slice().sort((a, b) => (a.categoria + a.titulo).localeCompare(b.categoria + b.titulo, 'pt-BR'));
    opcoes('#r-modelo', mods.map(m => [m.id, `${m.categoria} – ${m.titulo}`]));
    $('#r-diligencia').value = dilId || '';
    let modelo = modId;
    if (!modelo && dSel) modelo = sugerirModelo(dSel, mods);
    if (modelo) $('#r-modelo').value = modelo;
    atualizarResposta();
    $('#dlg-resposta').showModal();
  }
  function sugerirModelo(d, mods) {
    const acha = t => (mods.find(m => m.titulo.toLowerCase().includes(t)) || {}).id;
    if (d.prazoPje && d.prazoInterno && d.prazoInterno > d.prazoPje && d.status !== 'cumprida') return acha('prazo suplementar');
    if (d.tipo === 'Intimação') return acha('intimação cumprida');
    if (d.tipo === 'Juntada de laudo') return d.status === 'aguardando' ? acha('laudo pendente') : acha('juntada de laudo');
    if (d.tipo.startsWith('Oitiva')) return acha('oitiva');
    if (d.tipo.startsWith('Relatório')) return acha('relatório final');
    if (d.tipo.startsWith('Informações')) return acha('andamento');
    return acha('genérica');
  }
  function atualizarResposta() {
    const d = state.diligencias.find(x => x.id === $('#r-diligencia').value) || null;
    const m = state.modelos.find(x => x.id === $('#r-modelo').value);
    $('#r-texto').value = m ? preencher(m.texto, d) : '';
    $('#btn-marcar-respondida').classList.toggle('hidden', !d || !ativa(d));
  }
  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('Texto copiado. Cole no PJE.');
  }

  // ------------------------------------------------------------------ Configurações
  function renderConfig() {
    const c = state.config;
    $('#cfg-delegado').value = c.delegado;
    $('#cfg-cargo').value = c.cargo;
    $('#cfg-delegacia').value = c.delegacia;
    $('#cfg-cidade').value = c.cidade;
    $('#cfg-margem').value = c.margem;
    $('#cfg-contagem').value = c.contagem;
    $('#cfg-prorrogar').checked = !!c.prorrogar;
    $('#cfg-feriados').value = c.feriados;
    const prev = $('#cfg-logo-preview');
    prev.src = c.logo || 'assets/logo-pces.png';
    $('#info-backup').textContent = c.ultimoBackup
      ? 'Último backup: ' + new Date(c.ultimoBackup).toLocaleString('pt-BR')
      : 'Nenhum backup realizado ainda.';
  }
  function salvarConfig(e) {
    e.preventDefault();
    Object.assign(state.config, {
      delegado: $('#cfg-delegado').value.trim(),
      cargo: $('#cfg-cargo').value.trim(),
      delegacia: $('#cfg-delegacia').value.trim(),
      cidade: $('#cfg-cidade').value.trim(),
      margem: Math.max(0, Number($('#cfg-margem').value) || 0),
      contagem: $('#cfg-contagem').value,
      prorrogar: $('#cfg-prorrogar').checked,
      feriados: $('#cfg-feriados').value
    });
    salvar();
    render();
    toast('Configurações salvas.');
  }

  // ------------------------------------------------------------------ Backup / exportação
  function exportarJSON() {
    state.config.ultimoBackup = new Date().toISOString();
    salvar();
    const copia = Object.assign({}, state, { exportadoEm: new Date().toISOString(), versao: 1 });
    baixar(`backup-prazos-pje-${toISO(hoje())}.json`, JSON.stringify(copia, null, 2), 'application/json');
    render();
    toast('Backup gerado.');
  }
  function importarJSON(arquivo) {
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const dados = JSON.parse(leitor.result);
        if (!dados || !Array.isArray(dados.diligencias)) throw new Error('formato');
        if (!confirm(`O backup contém ${dados.diligencias.length} diligência(s) e ${(dados.modelos || []).length} modelo(s). Os dados atuais serão SUBSTITUÍDOS. Continuar?`)) return;
        state = {
          diligencias: dados.diligencias,
          modelos: Array.isArray(dados.modelos) ? dados.modelos : modelosPadrao(),
          config: Object.assign({}, CONFIG_PADRAO, dados.config || {})
        };
        salvar();
        render();
        toast('Backup restaurado.');
      } catch (e) {
        alert('Arquivo inválido. Selecione um backup gerado por este sistema.');
      }
    };
    leitor.readAsText(arquivo);
  }
  function exportarCSV() {
    const cab = ['Processo', 'Inquérito', 'Tipo', 'Requisitante', 'Órgão', 'Descrição', 'Recebimento', 'Prazo PJE', 'Prazo interno', 'Dias p/ prazo PJE', 'Responsável', 'Status', 'Réu preso', 'ID PJE', 'Observações'];
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
    const linhas = filtradas().map(d => [
      d.processo, d.inquerito, d.tipo, d.requisitante, d.orgao, d.descricao, fmt(d.recebimento), fmt(d.prazoPje), fmt(d.prazoInterno),
      d.prazoPje ? diasAte(d.prazoPje) : '', d.responsavel, STATUS[d.status], d.reuPreso ? 'Sim' : 'Não', d.idPje, d.obs
    ].map(q).join(';'));
    baixar(`diligencias-${toISO(hoje())}.csv`, '﻿' + [cab.map(q).join(';')].concat(linhas).join('\r\n'), 'text/csv;charset=utf-8');
  }

  // ------------------------------------------------------------------ Eventos
  function filtrarPeloPainel(f) {
    $('#flt-busca').value = '';
    $('#flt-requisitante').value = '';
    $('#flt-tipo').value = '';
    $('#flt-status').value = 'ativas';
    $('#flt-urgencia').value = '';
    if (f === 'vencido' || f === 'hoje' || f === 'semana') $('#flt-urgencia').value = f;
    if (f === 'cumprida' || f === 'respondida') $('#flt-status').value = f;
    mostrar('diligencias');
  }

  document.addEventListener('click', e => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) { closeBtn.closest('dialog').close(); return; }
    const tab = e.target.closest('#tabs button');
    if (tab) { mostrar(tab.dataset.view); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const id = el.dataset.id;
    switch (el.dataset.action) {
      case 'nova-diligencia': abrirDiligencia(null); break;
      case 'editar': abrirDiligencia(id); break;
      case 'resposta': e.stopPropagation(); abrirResposta(id); break;
      case 'marcar': marcarStatus(id, el.dataset.status); break;
      case 'filtrar': filtrarPeloPainel(el.dataset.filtro); break;
      case 'excluir-diligencia': {
        const fid = $('#f-id').value;
        if (fid && confirm('Excluir definitivamente esta diligência?')) {
          state.diligencias = state.diligencias.filter(x => x.id !== fid);
          salvar(); $('#dlg-diligencia').close(); render(); toast('Diligência excluída.');
        }
        break;
      }
      case 'calc-pje':
      case 'calc-interno': {
        const inicio = $('#f-recebimento').value;
        if (!inicio) { alert('Informe a data de recebimento no PJE.'); break; }
        const modo = $('#calc-modo').value;
        const n = Number($('#calc-dias').value);
        const r = calcularPrazo(inicio, n, modo, state.config.prorrogar);
        if (!r) break;
        $(el.dataset.action === 'calc-pje' ? '#f-prazoPje' : '#f-prazoInterno').value = r;
        $('#calc-info').textContent = `${n} dias ${modo === 'uteis' ? 'úteis' : 'corridos'} a partir de ${fmt(inicio)} = ${fmt(r)} (${parseISO(r).toLocaleDateString('pt-BR', { weekday: 'long' })})`;
        break;
      }
      case 'add-andamento': {
        const t = $('#and-texto').value.trim();
        if (!t) break;
        andamentosForm.push({ data: $('#and-data').value || toISO(hoje()), texto: t });
        $('#and-texto').value = '';
        renderAndamentos();
        break;
      }
      case 'del-andamento': andamentosForm.splice(Number(el.dataset.i), 1); renderAndamentos(); break;
      case 'exportar-csv': exportarCSV(); break;
      case 'imprimir': window.print(); break;
      case 'mes-anterior': mesCal = new Date(mesCal.getFullYear(), mesCal.getMonth() - 1, 1); renderCalendario(); break;
      case 'mes-proximo': mesCal = new Date(mesCal.getFullYear(), mesCal.getMonth() + 1, 1); renderCalendario(); break;
      case 'mes-atual': { const h = hoje(); mesCal = new Date(h.getFullYear(), h.getMonth(), 1); renderCalendario(); break; }
      case 'novo-modelo': abrirModelo(null); break;
      case 'editar-modelo': abrirModelo(id); break;
      case 'duplicar-modelo': abrirModelo(id, true); break;
      case 'excluir-modelo':
        if (confirm('Excluir este modelo?')) { state.modelos = state.modelos.filter(m => m.id !== id); salvar(); render(); }
        break;
      case 'usar-modelo': abrirResposta('', id); break;
      case 'copiar-modelo': { const m = state.modelos.find(x => x.id === id); if (m) copiar(preencher(m.texto, null)); break; }
      case 'copiar-ph': copiar('{{' + el.dataset.ph + '}}'); break;
      case 'gerar-resposta': abrirResposta(''); break;
      case 'copiar-resposta': copiar($('#r-texto').value); break;
      case 'baixar-resposta': baixar(`resposta-${toISO(hoje())}.txt`, $('#r-texto').value, 'text/plain;charset=utf-8'); break;
      case 'marcar-respondida-dlg': {
        const did = $('#r-diligencia').value;
        if (did) { marcarStatus(did, 'respondida'); atualizarResposta(); }
        break;
      }
      case 'exportar-json': exportarJSON(); break;
      case 'remover-logo': state.config.logo = ''; salvar(); render(); break;
      case 'restaurar-modelos':
        if (confirm('Adicionar novamente os modelos padrão? Seus modelos personalizados serão mantidos; modelos padrão com o mesmo título serão substituídos.')) {
          const titulos = new Set(modelosPadrao().map(m => m.titulo));
          state.modelos = state.modelos.filter(m => !titulos.has(m.titulo)).concat(modelosPadrao());
          salvar(); render(); toast('Modelos padrão restaurados.');
        }
        break;
      case 'apagar-tudo':
        if (confirm('ATENÇÃO: todos os dados (diligências, modelos e configurações) serão apagados deste navegador. Recomenda-se baixar um backup antes. Continuar?') &&
          prompt('Digite APAGAR para confirmar:') === 'APAGAR') {
          localStorage.removeItem(STORAGE_KEY);
          state = carregar();
          salvar(); render(); toast('Dados apagados.');
        }
        break;
    }
  });

  $('#form-diligencia').addEventListener('submit', e => {
    e.preventDefault();
    if (salvarDiligencia()) $('#dlg-diligencia').close();
  });
  $('#form-modelo').addEventListener('submit', e => {
    e.preventDefault();
    if (salvarModelo()) $('#dlg-modelo').close();
  });
  $('#form-config').addEventListener('submit', salvarConfig);
  $('#r-diligencia').addEventListener('change', atualizarResposta);
  $('#r-modelo').addEventListener('change', atualizarResposta);
  $('#mod-busca').addEventListener('input', renderModelos);
  $('#mod-categoria').addEventListener('change', renderModelos);
  $('#and-texto').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); document.querySelector('[data-action="add-andamento"]').click(); }
  });
  $('#importar-json').addEventListener('change', e => {
    if (e.target.files[0]) importarJSON(e.target.files[0]);
    e.target.value = '';
  });
  $('#cfg-logo').addEventListener('change', e => {
    const arq = e.target.files[0];
    e.target.value = '';
    if (!arq) return;
    if (arq.size > 1.5 * 1024 * 1024) { alert('Imagem muito grande (máx. 1,5 MB).'); return; }
    const r = new FileReader();
    r.onload = () => { state.config.logo = r.result; salvar(); render(); toast('Logotipo atualizado.'); };
    r.readAsDataURL(arq);
  });
  $('#logo').addEventListener('error', () => {
    $('#logo').style.display = 'none';
    $('#logo-fallback').style.display = 'flex';
  });
  { const img = $('#logo'); if (img.complete && img.naturalWidth === 0) { img.style.display = 'none'; $('#logo-fallback').style.display = 'flex'; } }
  // Fecha diálogos clicando fora
  document.querySelectorAll('dialog').forEach(dlg => dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }));

  // Atualiza contagens ao virar o dia / voltar à aba
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  // ------------------------------------------------------------------ Início
  prepararFiltros();
  salvar();
  let inicial = 'painel';
  try { inicial = sessionStorage.getItem('pces-view') || 'painel'; } catch (e) { /* ignorado */ }
  mostrar(inicial);
  const urgentes = state.diligencias.filter(d => ativa(d) && d.status !== 'cumprida' && d.prazoPje && diasAte(d.prazoPje) <= 0).length;
  document.title = (urgentes ? `(${urgentes}) ` : '') + 'Controle de Prazos PJE – PCES';

  // expõe utilitários para testes no console
  window.PrazosPJE = {
    calcularPrazo, feriadosDoAno, preencher, fmt, toISO, parseISO, hoje, esc, toast, opcoes,
    TIPOS, REQUISITANTES, STATUS,
    config: () => state.config,
    diligencias: () => state.diligencias,
    /** Recebe uma lista de diligências já normalizadas e grava. */
    adicionar(lista) {
      const agora = new Date().toISOString();
      lista.forEach(d => state.diligencias.push(Object.assign({
        id: uid(), criadoEm: agora, atualizadoEm: agora, status: 'pendente', andamentos: []
      }, d)));
      salvar();
      render();
    },
    abrirDiligencia
  };
})();
