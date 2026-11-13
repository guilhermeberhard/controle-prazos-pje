/*
 * Controle de Prazos e Diligências – PJE
 * Aplicação 100% local (HTML + JavaScript). Os dados ficam no localStorage do navegador.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'pces-controle-prazos-v1';

  const TIPOS = [
    'A definir (ler o ato no PJE)',
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
    respondida: 'Finalizada no PJE (respondida/ciente)'
  };
  const CAMPOS_FORM = ['unidade', 'processo', 'inquerito', 'tipo', 'requisitante', 'orgao', 'descricao', 'recebimento', 'prazoPje', 'prazoInterno', 'responsavel', 'status', 'idPje', 'obs', 'fase', 'ato', 'limiteCiencia', 'dataCiencia', 'prazoDias', 'classe', 'partes'];
  const FASES = { ciencia: 'Tomar ciência', responder: 'Responder' };
  /** Prazo legal para a ciência da intimação eletrônica (Lei 11.419/2006, art. 5º, § 3º). */
  const DIAS_CIENCIA = 10;
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
    id_pje: 'ID do expediente/documento no PJE',
    ato: 'Ato do PJE (Decisão, Intimação eletrônica...)',
    classe: 'Classe / assunto',
    partes: 'Partes',
    data_ciencia: 'Data da ciência',
    prazo_dias: 'Prazo para resposta (dias)',
    enderecamento: 'Excelentíssimo Senhor Doutor Juiz de Direito da 2ª Vara de Afonso Cláudio/ES',
    unidade: 'Nome curto da unidade (DP ...)',
    data_hoje: 'Data de hoje (dd/mm/aaaa)',
    data_extenso: 'Data de hoje por extenso',
    ano: 'Ano atual',
    delegado: 'Nome da autoridade policial',
    cargo: 'Cargo',
    delegacia: 'Unidade policial (conforme a DP selecionada)',
    cidade: 'Cidade (conforme a DP selecionada)'
  };

  const UNIDADES_PADRAO = [
    { id: 'afonso', nome: 'DP Afonso Cláudio', delegacia: 'Delegacia de Polícia de Afonso Cláudio', cidade: 'Afonso Cláudio', cor: '#1f5fbf' },
    { id: 'laranja', nome: 'DP Laranja da Terra', delegacia: 'Delegacia de Polícia de Laranja da Terra', cidade: 'Laranja da Terra', cor: '#2e7d32' }
  ];
  const ENDERECAMENTO = 'Excelentíssimo Senhor Doutor Juiz de Direito da 2ª Vara de Afonso Cláudio/ES';
  const ENDERECAMENTO_ANTIGO = /^Excelentíssimo\(a\) Senhor\(a\) \{\{autoridade\}\}\n\{\{orgao\}\}/;
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
    return normalizar(s);
  }
  /**
   * Garante a estrutura atual dos dados e migra versões anteriores sem perder nada:
   * - cria as unidades (DP Afonso Cláudio e DP Laranja da Terra);
   * - diligências antigas, sem unidade, passam a pertencer à DP Afonso Cláudio;
   * - o endereçamento dos modelos padrão antigos é trocado pelo endereçamento fixo.
   */
  function normalizar(s) {
    if (!s || typeof s !== 'object') s = {};
    s.diligencias = Array.isArray(s.diligencias) ? s.diligencias : [];
    s.config = Object.assign({}, CONFIG_PADRAO, s.config || {});
    if (!Array.isArray(s.modelos)) s.modelos = modelosPadrao();
    if (!Array.isArray(s.unidades) || !s.unidades.length) {
      s.unidades = UNIDADES_PADRAO.map(u => Object.assign({}, u));
      // dados de versões anteriores pertencem à DP Afonso Cláudio
      if (s.config.delegacia) s.unidades[0].delegacia = s.config.delegacia;
      if (s.config.cidade) s.unidades[0].cidade = s.config.cidade;
    }
    s.diligencias.forEach(d => { if (!d.unidade) d.unidade = s.unidades[0].id; });
    if (!Array.isArray(s.importacoes)) s.importacoes = [];
    if (!s.unidades.some(u => u.id === s.unidadeAtual)) s.unidadeAtual = s.unidades[0].id;
    if (!s.config.migEnderecamento) {
      s.modelos.forEach(m => { m.texto = m.texto.replace(ENDERECAMENTO_ANTIGO, ENDERECAMENTO); });
      s.config.migEnderecamento = true;
    }
    return s;
  }
  // ----- Unidades
  const unidade = (id) => state.unidades.find(u => u.id === (id || state.unidadeAtual)) || state.unidades[0];
  const daUnidade = d => (d.unidade || state.unidades[0].id) === state.unidadeAtual;
  /** Diligências da unidade selecionada. */
  const dils = () => state.diligencias.filter(daUnidade);
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
  function badgePrazo(iso, ativo, extra) {
    if (!iso) return '<span class="muted">—</span>';
    if (!ativo) return `<span class="badge neutro">${fmt(iso)}</span>`;
    const dias = diasAte(iso);
    let rot;
    if (dias < 0) rot = `Vencido há ${-dias} dia${dias === -1 ? '' : 's'}`;
    else if (dias === 0) rot = 'Vence hoje';
    else if (dias === 1) rot = 'Vence amanhã';
    else rot = `${dias} dias`;
    return `<span class="badge ${urgencia(dias)} ${extra || ''}">${rot}</span><span class="date-sub">${fmt(iso)}</span>`;
  }
  // ----- Fases do PJE
  const fase = d => d.fase === 'ciencia' ? 'ciencia' : 'responder';
  const faseTag = d => `<span class="fase fase-${fase(d)}">${fase(d) === 'ciencia' ? 'Tomar ciência' : 'Responder'}</span>`;
  const temPrazoResposta = d => Number(d.prazoDias) > 0;
  /** Estimativa da data limite de resposta contando o prazo a partir de uma data de ciência. */
  function respostaEstimada(d, cienciaISO) {
    if (!temPrazoResposta(d) || !cienciaISO) return null;
    return calcularPrazo(cienciaISO, Number(d.prazoDias), state.config.contagem, state.config.prorrogar);
  }
  /** Data que define a urgência: limite de ciência (fase ciência) ou limite de manifestação (fase responder). */
  const dataRef = d => fase(d) === 'ciencia' ? d.limiteCiencia : d.prazoPje;
  function badgeResposta(d, ativo) {
    if (fase(d) === 'ciencia') {
      const est = respostaEstimada(d, d.limiteCiencia);
      return `<span class="small muted">Ciência até</span><br>${badgePrazo(d.limiteCiencia, ativo, 'cie')}` +
        (temPrazoResposta(d) ? `<span class="date-sub">resposta: ${d.prazoDias} dias${est ? ' (≈ ' + fmt(est) + ' se tácita)' : ''}</span>` : '<span class="date-sub">sem prazo de resposta</span>');
    }
    if (!d.prazoPje) return temPrazoResposta(d) ? `<span class="badge neutro">${d.prazoDias} dias</span><span class="date-sub">sem data limite</span>` : '<span class="muted">sem prazo</span>';
    return badgePrazo(d.prazoPje, ativo && d.status !== 'cumprida') + (d.prazoEstimado ? '<span class="date-sub est">≈ estimado – confirmar no PJE</span>' : '');
  }
  /** Converte em "Responder" os expedientes cujo limite de ciência já passou (ciência tácita). */
  function aplicarCienciaTacita() {
    const hojeISO = toISO(hoje());
    let mudou = false;
    state.diligencias.forEach(d => {
      if (!ativa(d) || fase(d) !== 'ciencia' || !d.limiteCiencia || d.limiteCiencia >= hojeISO) return;
      d.fase = 'responder';
      d.dataCiencia = d.limiteCiencia;
      if (!d.prazoPje && temPrazoResposta(d)) { d.prazoPje = respostaEstimada(d, d.limiteCiencia); d.prazoEstimado = true; }
      d.andamentos = d.andamentos || [];
      d.andamentos.push({ data: hojeISO, texto: `Ciência tácita em ${fmt(d.limiteCiencia)} (limite para ciência). ` + (temPrazoResposta(d) ? `Prazo de resposta estimado até ${fmt(d.prazoPje)} – confirmar no PJE.` : 'Expediente sem prazo de resposta.') });
      mudou = true;
    });
    if (mudou) salvar();
  }
  function registrarCiencia(id) {
    const d = state.diligencias.find(x => x.id === id);
    if (!d) return;
    const hojeISO = toISO(hoje());
    d.fase = 'responder';
    d.dataCiencia = hojeISO;
    d.andamentos = d.andamentos || [];
    if (temPrazoResposta(d)) {
      d.prazoPje = respostaEstimada(d, hojeISO);
      d.prazoEstimado = true;
      d.andamentos.push({ data: hojeISO, texto: `Ciência registrada no PJE. Prazo de ${d.prazoDias} dias – resposta estimada até ${fmt(d.prazoPje)} (confirmar no PJE).` });
      toast(`Ciência registrada. Resposta estimada até ${fmt(d.prazoPje)} – confira a data no PJE.`);
    } else {
      d.andamentos.push({ data: hojeISO, texto: 'Ciência registrada no PJE (expediente sem prazo de resposta).' });
      if (confirm('Este expediente não tem prazo de resposta. Marcar como finalizado?')) {
        const ant = d.status; d.status = 'respondida'; aplicarMudancaStatus(d, ant);
      }
      toast('Ciência registrada.');
    }
    d.atualizadoEm = new Date().toISOString();
    salvar();
    render();
  }
  const statusTag = s => `<span class="st st-${s}">${esc(STATUS[s] || s)}</span>`;
  const tituloDil = d => [d.processo, d.inquerito].filter(Boolean).join(' · ') || '(sem número)';
  const subtitulo = d => [d.classe, d.ato && (d.ato + (d.idPje ? ' (' + d.idPje + ')' : ''))].filter(Boolean).join(' · ');
  function ordenarPorPrazo(a, b) {
    if (fase(a) !== fase(b)) return fase(a) === 'responder' ? -1 : 1; // "Responder" sempre antes de "Tomar ciência"
    const pa = dataRef(a) || a.prazoInterno || '9999-12-31';
    const pb = dataRef(b) || b.prazoInterno || '9999-12-31';
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
    aplicarCienciaTacita();
    renderMarca();
    renderAvisoBackup();
    renderAvisoImportacao();
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
    const u = unidade();
    $('#brand-unidade').textContent = u.delegacia + ' – Controle de Prazos PJE';
    document.documentElement.style.setProperty('--unidade', u.cor || '#1f5fbf');
    $('#seletor-unidade').innerHTML = state.unidades.map(x => {
      const n = state.diligencias.filter(d => (d.unidade || state.unidades[0].id) === x.id && ativa(d) && fase(d) === 'responder' &&
        d.status !== 'cumprida' && d.prazoPje && diasAte(d.prazoPje) <= Number(state.config.margem || 5)).length;
      return `<button data-action="trocar-unidade" data-un="${esc(x.id)}" class="${x.id === u.id ? 'active' : ''}" style="--c:${esc(x.cor || '#1f5fbf')}">
        ${esc(x.nome)}${n ? `<span class="cont" title="Prazos de resposta vencidos ou próximos">${n}</span>` : ''}</button>`;
    }).join('');
    $('#faixa-unidade').innerHTML = `Unidade selecionada: <b>${esc(u.nome)}</b> – tudo o que for cadastrado ou importado agora vai para esta unidade.`;
  }
  function trocarUnidade(id) {
    if (!state.unidades.some(u => u.id === id) || id === state.unidadeAtual) return;
    state.unidadeAtual = id;
    salvar();
    render();
    toast('Unidade: ' + unidade().nome);
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
  /** Partes com os órgãos abreviados, para caber na linha (PCES / MPES). */
  function partesCurtas(d) {
    return String(d.partes || '')
      .replace(/POL[ÍI]CIA CIVIL DO ESTADO DO ESP[ÍI]RITO SANTO/gi, 'PCES')
      .replace(/MINIST[ÉE]RIO P[ÚU]BLICO DO ESTADO DO ESP[ÍI]RITO SANTO/gi, 'MPES')
      .replace(/\s+/g, ' ').trim();
  }
  const linhaPartes = d => d.partes ? `<div class="partes" title="${esc(d.partes)}">👤 ${esc(partesCurtas(d))}</div>` : '';

  function itemHTML(d) {
    return `<div class="item" data-action="editar" data-id="${d.id}">
      <div class="item-prazo">${badgeResposta(d, true)}</div>
      <div class="info">
        <div class="t">${esc(d.processo || d.inquerito || '(sem número)')} ${d.reuPreso ? '<span class="badge preso">PRESO</span>' : ''}</div>
        <div class="s">${esc(subtitulo(d) || d.tipo)}</div>
        <div class="s">${esc(d.tipo)}${d.orgao ? ' · ' + esc(d.orgao) : ''}</div>
        <div class="s">${statusTag(d.status)} ${d.prazoInterno ? 'Prazo interno: ' + fmt(d.prazoInterno) : ''} ${d.responsavel ? '· ' + esc(d.responsavel) : ''}</div>
        ${linhaPartes(d)}
      </div>
      <button class="icon-btn" data-action="resposta" data-id="${d.id}" title="Gerar minuta de resposta">Minuta</button>
    </div>`;
  }

  function renderPainel() {
    const at = dils().filter(ativa);
    const margem = Number(state.config.margem || 5);
    const resp = at.filter(d => fase(d) === 'responder');
    const cien = at.filter(d => fase(d) === 'ciencia');
    const correndo = resp.filter(d => d.prazoPje && d.status !== 'cumprida');
    const vencidas = correndo.filter(d => diasAte(d.prazoPje) < 0);
    const hojeL = correndo.filter(d => diasAte(d.prazoPje) === 0);
    const proximas = correndo.filter(d => { const x = diasAte(d.prazoPje); return x > 0 && x <= margem; });
    const cumpridas = resp.filter(d => d.status === 'cumprida');
    const mesAtual = toISO(hoje()).slice(0, 7);
    const finalMes = dils().filter(d => d.status === 'respondida' && (d.concluidoEm || '').slice(0, 7) === mesAtual);
    const card = ([cor, n, l, f]) => `<div class="stat ${cor}" data-action="filtrar" data-filtro="${f}"><div class="n">${n}</div><div class="l">${l}</div></div>`;

    $('#stats-responder').innerHTML = [
      ['red', vencidas.length, 'Prazo de resposta vencido', 'vencido'],
      ['orange', hojeL.length, 'Vencem hoje', 'hoje'],
      ['yellow', proximas.length, `Vencem em até ${margem} dias`, 'semana'],
      ['blue', resp.length, 'Total a responder', 'responder'],
      ['orange', cumpridas.length, 'Cumpridas – protocolar no PJE', 'cumprida'],
      ['green', finalMes.length, 'Finalizadas neste mês', 'respondida']
    ].map(card).join('');

    const cienCurta = cien.filter(d => { const x = diasAte(d.limiteCiencia); return x !== null && x <= 2; });
    const hojeISO = toISO(hoje());
    const nascem = cien.filter(d => { const e = respostaEstimada(d, hojeISO); return e && diasAte(e) <= 15; });
    $('#stats-ciencia').innerHTML = [
      ['cie', cien.length, 'Aguardando ciência', 'ciencia'],
      ['cie', cienCurta.length, 'Ciência tácita em até 2 dias', 'ciencia'],
      ['cie', cien.filter(d => !temPrazoResposta(d)).length, 'Sem prazo de resposta (só ciência)', 'ciencia'],
      ['cie', nascem.length, 'Se der ciência hoje, vencem em ≤ 15 dias', 'ciencia']
    ].map(card).join('');

    const urg = correndo.filter(d => diasAte(d.prazoPje) <= margem).sort(ordenarPorPrazo);
    $('#lista-urgentes').innerHTML = urg.length ? urg.map(itemHTML).join('') : '<div class="vazio">Nenhum prazo de resposta crítico.</div>';

    const dil = resp.filter(d => {
      if (!d.prazoPje || d.status === 'cumprida' || d.status === 'dilacao') return false;
      const x = diasAte(d.prazoPje);
      const internoMaior = d.prazoInterno && d.prazoInterno > d.prazoPje;
      const dependeTerceiros = d.status === 'aguardando' && x <= margem;
      return internoMaior || dependeTerceiros;
    }).sort(ordenarPorPrazo);
    $('#lista-dilacao').innerHTML = dil.length ? dil.map(itemHTML).join('') : '<div class="vazio">Nenhuma diligência nesta situação.</div>';

    $('#lista-responder').innerHTML = cumpridas.length
      ? cumpridas.sort(ordenarPorPrazo).map(itemHTML).join('')
      : '<div class="vazio">Nenhuma diligência cumprida pendente de protocolo.</div>';

    const listaC = cien.slice().sort(ordenarPorPrazo);
    $('#tbody-ciencia').innerHTML = listaC.map(d => {
      const seHoje = respostaEstimada(d, hojeISO);
      const seTacita = respostaEstimada(d, d.limiteCiencia);
      const ganho = seHoje && seTacita ? diasAte(seTacita) - diasAte(seHoje) : 0;
      return `<tr>
        <td>${badgePrazo(d.limiteCiencia, true, 'cie')}</td>
        <td><strong>${esc(d.processo || '—')}</strong><br><span class="muted small">${esc(d.classe || d.inquerito || '')}</span>${d.reuPreso ? ' <span class="badge preso">PRESO</span>' : ''}${linhaPartes(d)}</td>
        <td>${esc(d.ato || d.tipo)}${d.idPje ? `<br><span class="muted small">ID ${esc(d.idPje)}</span>` : ''}</td>
        <td>${temPrazoResposta(d) ? `<b>${d.prazoDias} dias</b>` : '<span class="muted">sem prazo</span>'}</td>
        <td>${seHoje ? fmt(seHoje) : '—'}</td>
        <td>${seTacita ? fmt(seTacita) + (ganho > 0 ? `<span class="date-sub">+${ganho} dia(s) em relação a hoje</span>` : '') : '—'}</td>
        <td class="no-print">
          <button class="icon-btn" data-action="ciencia" data-id="${d.id}">Dei ciência hoje</button>
          <button class="icon-btn" data-action="editar" data-id="${d.id}">Abrir</button>
        </td>
      </tr>`;
    }).join('');
    $('#ciencia-vazio').classList.toggle('hidden', listaC.length > 0);
  }

  // ------------------------------------------------------------------ Lista
  function prepararFiltros() {
    opcoes('#flt-status', [['ativas', 'Em aberto (todas não respondidas)'], ['todas', 'Todos os status']].concat(Object.entries(STATUS)));
    opcoes('#flt-requisitante', REQUISITANTES, 'Todos os requisitantes');
    opcoes('#flt-tipo', TIPOS, 'Todos os tipos');
    opcoes('#f-tipo', TIPOS);
    opcoes('#f-requisitante', REQUISITANTES);
    opcoes('#f-status', Object.entries(STATUS));
    ['#flt-busca', '#flt-fase', '#flt-status', '#flt-requisitante', '#flt-tipo', '#flt-urgencia'].forEach(s =>
      $(s).addEventListener('input', renderLista));
  }

  function filtradas() {
    const busca = $('#flt-busca').value.trim().toLowerCase();
    const st = $('#flt-status').value;
    const req = $('#flt-requisitante').value;
    const tipo = $('#flt-tipo').value;
    const urg = $('#flt-urgencia').value;
    const fs = $('#flt-fase').value;
    return dils().filter(d => {
      if (fs && fase(d) !== fs) return false;
      if (st === 'ativas' && !ativa(d)) return false;
      if (st !== 'ativas' && st !== 'todas' && d.status !== st) return false;
      if (req && d.requisitante !== req) return false;
      if (tipo && d.tipo !== tipo) return false;
      if (urg) {
        const x = diasAte(dataRef(d));
        if (urg === 'vencido' && !(x !== null && x < 0)) return false;
        if (urg === 'hoje' && x !== 0) return false;
        if (urg === 'semana' && !(x !== null && x >= 0 && x <= 7)) return false;
        if (urg === 'reupreso' && !d.reuPreso) return false;
      }
      if (busca) {
        const alvo = [d.processo, d.inquerito, d.orgao, d.descricao, d.responsavel, d.obs, d.tipo, d.idPje, d.classe, d.partes, d.ato].join(' ').toLowerCase();
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
        <td>${faseTag(d)}</td>
        <td>${badgeResposta(d, at)}</td>
        <td>${badgePrazo(d.prazoInterno, at)}</td>
        <td><strong>${esc(d.processo || '—')}</strong><br><span class="muted small">${esc([d.inquerito, subtitulo(d)].filter(Boolean).join(' · '))}</span>${linhaPartes(d)}</td>
        <td>${esc(d.tipo)} ${d.reuPreso ? '<span class="badge preso">PRESO</span>' : ''}<div class="desc">${esc(d.descricao || '')}</div></td>
        <td>${esc(d.requisitante)}<br><span class="muted small">${esc(d.orgao || '')}</span></td>
        <td>${esc(d.responsavel || '—')}</td>
        <td>${statusTag(d.status)}</td>
        <td class="no-print">
          <button class="icon-btn" data-action="editar" data-id="${d.id}">Editar</button>
          ${at && fase(d) === 'ciencia' ? `<button class="icon-btn" data-action="ciencia" data-id="${d.id}">Dei ciência</button>` : ''}
          <button class="icon-btn" data-action="resposta" data-id="${d.id}">Minuta</button>
          ${d.status !== 'cumprida' && at ? `<button class="icon-btn" data-action="marcar" data-status="cumprida" data-id="${d.id}">Cumprida</button>` : ''}
          ${at ? `<button class="icon-btn" data-action="marcar" data-status="respondida" data-id="${d.id}">Finalizar</button>` : `<button class="icon-btn" data-action="marcar" data-status="andamento" data-id="${d.id}">Reabrir</button>`}
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
    const add = (iso, tipo, d) => { if (iso) (porDia[iso] = porDia[iso] || []).push([tipo, d]); };
    dils().forEach(d => {
      if (fase(d) === 'ciencia') add(d.limiteCiencia, 'cie', d);
      else add(d.prazoPje, d.prazoEstimado ? 'est' : 'pje', d);
      add(d.prazoInterno, 'interno', d);
    });
    const ROT = { pje: 'RESP', est: '≈RESP', cie: 'CIÊN', interno: 'INT' };
    let html = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(x => `<div class="cal-dow">${x}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const dia = addDias(inicio, i);
      const iso = toISO(dia);
      const fer = nomeFeriado(dia);
      const cls = ['cal-dia', dia.getMonth() !== mes ? 'fora' : '', (dia.getDay() === 0 || dia.getDay() === 6) ? 'fds' : '', iso === hojeISO ? 'hoje' : ''].join(' ');
      const evs = (porDia[iso] || []).map(([tipo, d]) => {
        const feito = !ativa(d) || ((tipo === 'pje' || tipo === 'est') && d.status === 'cumprida');
        return `<span class="cal-ev ${feito ? 'feito' : tipo}" data-action="editar" data-id="${d.id}" title="${esc((subtitulo(d) || d.tipo) + ' – ' + tituloDil(d) + (d.partes ? ' – ' + partesCurtas(d) : ''))}">${ROT[tipo]} · ${esc(d.processo || d.inquerito || d.tipo)}</span>`;
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
      idPje: '', reuPreso: false, obs: '', andamentos: [], fase: 'ciencia',
      limiteCiencia: toISO(addDias(hoje(), DIAS_CIENCIA)), dataCiencia: '', prazoDias: '', ato: '', classe: '', partes: ''
    };
    $('#dlg-dil-titulo').textContent = d ? 'Editar diligência' : 'Nova diligência';
    $('#f-id').value = d ? d.id : '';
    CAMPOS_FORM
      .forEach(k => { $('#f-' + k).value = f[k] == null ? '' : f[k]; });
    opcoes('#f-unidade', state.unidades.map(u => [u.id, u.nome]));
    $('#f-unidade').value = f.unidade || state.unidadeAtual;
    $('#f-fase').value = fase(f);
    $('#f-reuPreso').checked = !!f.reuPreso;
    $('#f-prazoEstimado').checked = !!f.prazoEstimado;
    if (Number(f.prazoDias) > 0) $('#calc-dias').value = f.prazoDias;
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
    CAMPOS_FORM
      .forEach(k => { dados[k] = $('#f-' + k).value.trim(); });
    dados.reuPreso = $('#f-reuPreso').checked;
    dados.prazoEstimado = $('#f-prazoEstimado').checked && !!dados.prazoPje;
    dados.prazoDias = dados.prazoDias === '' ? '' : Math.max(0, Number(dados.prazoDias) || 0);
    // inclui andamento digitado e não adicionado
    if ($('#and-texto').value.trim()) andamentosForm.push({ data: $('#and-data').value || toISO(hoje()), texto: $('#and-texto').value.trim() });
    dados.andamentos = andamentosForm;
    if (!dados.processo && !dados.inquerito) { alert('Informe o número do processo ou do inquérito.'); return false; }
    if (dados.fase === 'responder' && !dados.dataCiencia && dados.limiteCiencia && dados.limiteCiencia < toISO(hoje())) dados.dataCiencia = dados.limiteCiencia;
    if (!dados.prazoPje && !dados.prazoInterno && !dados.limiteCiencia) {
      if (!confirm('Nenhum prazo foi informado. Deseja salvar mesmo assim?')) return false;
    }
    const agora = new Date().toISOString();
    if (id) {
      const d = state.diligencias.find(x => x.id === id);
      const statusAnterior = d.status;
      Object.assign(d, dados, { atualizadoEm: agora });
      aplicarMudancaStatus(d, statusAnterior);
    } else {
      const d = Object.assign({ id: uid(), criadoEm: agora, atualizadoEm: agora, unidade: state.unidadeAtual }, dados);
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
    const u = unidade(d && d.unidade);
    const h = hoje();
    const autoridade = !d ? '' : d.requisitante === 'Juiz(a)' ? 'Juiz(a) de Direito'
      : d.requisitante === 'Ministério Público' ? 'Promotor(a) de Justiça' : '';
    return {
      processo: d && d.processo, inquerito: d && (d.inquerito || d.classe), tipo: d && d.tipo ? d.tipo.toLowerCase() : '',
      descricao: d && d.descricao, requisitante: d && d.requisitante, autoridade,
      orgao: d && d.orgao, prazo_pje: d && fmt(d.prazoPje), prazo_interno: d && fmt(d.prazoInterno),
      recebimento: d && fmt(d.recebimento), responsavel: d && d.responsavel, id_pje: d && d.idPje,
      ato: d && d.ato, classe: d && d.classe, partes: d && d.partes, data_ciencia: d && fmt(d.dataCiencia),
      prazo_dias: d && d.prazoDias ? String(d.prazoDias) : '',
      data_hoje: fmt(h), data_extenso: extenso(h), ano: String(h.getFullYear()),
      delegado: c.delegado, cargo: c.cargo, delegacia: u.delegacia, cidade: u.cidade, unidade: u.nome, enderecamento: ENDERECAMENTO
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
    const ativas = dils().filter(ativa).sort(ordenarPorPrazo);
    const dSel = dilId ? state.diligencias.find(x => x.id === dilId) : null;
    const listaD = dSel && !ativa(dSel) ? [dSel].concat(ativas) : ativas;
    opcoes('#r-diligencia', listaD.map(d => [d.id, `${FASES[fase(d)]}${dataRef(d) ? ' até ' + fmt(dataRef(d)) : ''} – ${tituloDil(d)} – ${d.ato || d.tipo}${d.partes ? ' – ' + partesCurtas(d).slice(0, 70) : ''}`]), '(sem diligência – preencher manualmente)');
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
    renderUnidadesConfig();
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

      margem: Math.max(0, Number($('#cfg-margem').value) || 0),
      contagem: $('#cfg-contagem').value,
      prorrogar: $('#cfg-prorrogar').checked,
      feriados: $('#cfg-feriados').value
    });
    document.querySelectorAll('#cfg-unidades [data-un]').forEach(row => {
      const u = state.unidades.find(x => x.id === row.dataset.un);
      if (!u) return;
      row.querySelectorAll('[data-k]').forEach(el => { u[el.dataset.k] = el.value.trim() || u[el.dataset.k]; });
    });
    salvar();
    render();
    toast('Configurações salvas.');
  }

  function renderUnidadesConfig() {
    $('#cfg-unidades').innerHTML = state.unidades.map(u => {
      const n = state.diligencias.filter(d => d.unidade === u.id).length;
      return `<div class="un-cfg" data-un="${esc(u.id)}" style="--c:${esc(u.cor || '#1f5fbf')}">
        <div class="row2">
          <label>Nome curto (botão)<input data-k="nome" value="${esc(u.nome)}"></label>
          <label>Cor<input type="color" data-k="cor" value="${esc(u.cor || '#1f5fbf')}"></label>
        </div>
        <div class="row2">
          <label>Nome completo (usado nas respostas)<input data-k="delegacia" value="${esc(u.delegacia)}"></label>
          <label>Cidade (local e data)<input data-k="cidade" value="${esc(u.cidade)}"></label>
        </div>
        <div class="small muted">${n} registro(s) ${state.unidades.length > 1 ? `· <button type="button" class="icon-btn" data-action="del-unidade" data-un="${esc(u.id)}">remover unidade</button>` : ''}</div>
      </div>`;
    }).join('');
  }
  function adicionarUnidade() {
    const nome = prompt('Nome curto da nova unidade (ex.: DP Itarana):');
    if (!nome || !nome.trim()) return;
    const cidade = nome.replace(/^\s*(DP|DEPOL|Delegacia( de Polícia)?( de)?)\s*/i, '').trim();
    state.unidades.push({ id: uid(), nome: nome.trim(), delegacia: 'Delegacia de Polícia de ' + cidade, cidade, cor: '#8a5a00' });
    salvar(); renderUnidadesConfig(); render(); toast('Unidade adicionada. Ajuste os dados e salve.');
  }
  function removerUnidade(id) {
    const u = state.unidades.find(x => x.id === id);
    if (!u) return;
    const n = state.diligencias.filter(d => d.unidade === id).length;
    if (n) { alert(`A unidade ${u.nome} tem ${n} registro(s). Exclua ou finalize-os antes de remover a unidade.`); return; }
    if (!confirm(`Remover a unidade ${u.nome}?`)) return;
    state.unidades = state.unidades.filter(x => x.id !== id);
    if (state.unidadeAtual === id) state.unidadeAtual = state.unidades[0].id;
    salvar(); render();
  }

  // ------------------------------------------------------------------ Histórico de importações (desfazer)
  const MAX_IMPORTACOES = 15;
  function registrarImportacao(lote) {
    state.importacoes.unshift(Object.assign({ id: uid(), em: new Date().toISOString(), unidade: state.unidadeAtual, desfeita: false, oculta: false }, lote));
    state.importacoes = state.importacoes.slice(0, MAX_IMPORTACOES);
    salvar();
    render();
  }
  const nomeUn = id => (state.unidades.find(u => u.id === id) || { nome: '(unidade removida)' }).nome;
  const quando = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  /**
   * Importações feitas antes deste recurso existir não têm registro de lote.
   * Elas são reconstruídas pelos registros criados juntos (mesmo horário de criação)
   * cujo primeiro andamento é "Importado do PJE".
   */
  function lotesReconstruidos() {
    const registrados = new Set();
    state.importacoes.forEach(l => (l.novos || []).forEach(id => registrados.add(id)));
    const grupos = {};
    state.diligencias.forEach(d => {
      if (registrados.has(d.id) || !d.criadoEm) return;
      const a0 = (d.andamentos || [])[0];
      if (!a0 || !/^Importad[oa] do PJE/.test(a0.texto)) return;
      const k = d.criadoEm + '|' + d.unidade;
      (grupos[k] = grupos[k] || { id: 'rec-' + k, em: d.criadoEm, unidade: d.unidade, origem: 'importação anterior (reconstruída)', novos: [], atualizados: [], reconstruido: true }).novos.push(d.id);
    });
    return Object.values(grupos);
  }
  function todosLotes() {
    return state.importacoes.filter(l => !l.desfeita).concat(lotesReconstruidos())
      .map(l => Object.assign({}, l, { novos: (l.novos || []).filter(id => state.diligencias.some(d => d.id === id)) }))
      .filter(l => l.novos.length || (l.atualizados || []).length)
      .sort((a, b) => b.em.localeCompare(a.em));
  }
  function acharLote(id) { return todosLotes().find(l => l.id === id); }
  /** Registros alterados à mão depois da importação (para avisar antes de desfazer). */
  function editadosDepois(l) {
    const lim = new Date(new Date(l.em).getTime() + 5000).toISOString();
    return l.novos.filter(id => { const d = state.diligencias.find(x => x.id === id); return d && d.atualizadoEm && d.atualizadoEm > lim; }).length;
  }
  function marcarDesfeita(l) {
    const reg = state.importacoes.find(x => x.id === l.id);
    if (reg) reg.desfeita = true;
  }

  function desfazerImportacao(loteId) {
    const l = acharLote(loteId);
    if (!l) return;
    const ed = editadosDepois(l);
    const nAt = (l.atualizados || []).length;
    let msg = `Desfazer a importação de ${quando(l.em)} em ${nomeUn(l.unidade)}?\n\n` +
      `• ${l.novos.length} registro(s) criado(s) por ela serão EXCLUÍDOS` +
      (nAt ? `\n• ${nAt} registro(s) atualizado(s) por ela voltarão ao estado anterior` : '');
    if (ed) msg += `\n\nATENÇÃO: ${ed} desses registros foram alterados depois da importação; essas alterações também serão perdidas.`;
    if (!confirm(msg)) return;
    const excluir = new Set(l.novos);
    state.diligencias = state.diligencias.filter(d => !excluir.has(d.id));
    (l.atualizados || []).forEach(a => {
      const i = state.diligencias.findIndex(d => d.id === a.id);
      if (i >= 0 && a.antes) state.diligencias[i] = a.antes;
    });
    marcarDesfeita(l);
    salvar(); render(); renderHistorico();
    toast(`Importação desfeita: ${l.novos.length} excluído(s)${nAt ? `, ${nAt} restaurado(s)` : ''}.`);
  }

  function moverImportacao(loteId, destino) {
    const l = acharLote(loteId);
    if (!l || !destino || destino === l.unidade) return;
    const nAt = (l.atualizados || []).length;
    if (!confirm(`Mover ${l.novos.length} registro(s) da importação de ${quando(l.em)} de ${nomeUn(l.unidade)} para ${nomeUn(destino)}?` +
      (nAt ? `\n\nOs ${nAt} registro(s) que a importação apenas ATUALIZOU continuam em ${nomeUn(l.unidade)} e voltam ao estado anterior (eram de lá).` : ''))) return;
    const hojeISO = toISO(hoje());
    let duplicados = 0;
    const excluir = new Set();
    l.novos.forEach(id => {
      const d = state.diligencias.find(x => x.id === id);
      if (!d) return;
      const jaExiste = d.idPje && state.diligencias.some(x => x.id !== d.id && x.unidade === destino && String(x.idPje) === String(d.idPje));
      if (jaExiste) { excluir.add(d.id); duplicados++; return; }
      d.unidade = destino;
      d.andamentos = d.andamentos || [];
      d.andamentos.push({ data: hojeISO, texto: `Movido de ${nomeUn(l.unidade)} para ${nomeUn(destino)} (importação feita na unidade errada).` });
    });
    state.diligencias = state.diligencias.filter(d => !excluir.has(d.id));
    (l.atualizados || []).forEach(a => {
      const i = state.diligencias.findIndex(d => d.id === a.id);
      if (i >= 0 && a.antes) state.diligencias[i] = a.antes;
    });
    marcarDesfeita(l);
    salvar(); render(); renderHistorico();
    toast(`${l.novos.length - duplicados} registro(s) movido(s) para ${nomeUn(destino)}` + (duplicados ? ` (${duplicados} já existiam lá e foram descartados)` : '') + '.');
  }

  function renderHistorico() {
    const el = $('#lista-historico');
    if (!el) return;
    const lotes = todosLotes();
    el.innerHTML = lotes.length ? lotes.map((l, i) => {
      const procs = l.novos.map(id => state.diligencias.find(d => d.id === id)).filter(Boolean);
      const outras = state.unidades.filter(u => u.id !== l.unidade);
      return `<div class="lote ${i === 0 ? 'ultimo' : ''}">
        <div class="lote-cab">
          <div><b>${quando(l.em)}</b> ${i === 0 ? '<span class="badge critico">mais recente</span>' : ''}<br>
            <span class="small">Importado em <b>${esc(nomeUn(l.unidade))}</b> · ${procs.length} novo(s)${(l.atualizados || []).length ? ` · ${(l.atualizados || []).length} atualizado(s)` : ''} · <span class="muted">${esc(l.origem || '')}</span></span></div>
          <div class="btn-row">
            ${outras.length ? `<select class="lote-destino" data-lote="${esc(l.id)}">${outras.map(u => `<option value="${esc(u.id)}">${esc(u.nome)}</option>`).join('')}</select>
            <button class="btn sm" data-action="mover-lote" data-lote="${esc(l.id)}">Mover para a unidade</button>` : ''}
            <button class="btn sm danger" data-action="desfazer-lote" data-lote="${esc(l.id)}">↶ Desfazer (excluir)</button>
          </div>
        </div>
        <details><summary class="small">Ver processos</summary>
          <ul class="small">${procs.map(d => `<li>${esc(d.processo || d.inquerito || '—')} – ${esc(d.ato || d.tipo)}${d.idPje ? ' (ID ' + esc(d.idPje) + ')' : ''}</li>`).join('')}</ul>
        </details>
      </div>`;
    }).join('') : '<p class="muted">Nenhuma importação para desfazer.</p>';
  }
  function abrirHistorico() { renderHistorico(); $('#dlg-historico').showModal(); }

  /** Barra exibida logo após uma importação, com o botão Desfazer. */
  function renderAvisoImportacao() {
    const el = $('#aviso-importacao');
    const l = state.importacoes.find(x => !x.desfeita);
    const ok = l && !l.oculta && state.importacoes[0] === l && (Date.now() - new Date(l.em).getTime()) < 24 * 3600 * 1000 &&
      (l.novos || []).some(id => state.diligencias.some(d => d.id === id));
    if (!ok) { el.classList.add('hidden'); return; }
    const n = l.novos.filter(id => state.diligencias.some(d => d.id === id)).length;
    const outras = state.unidades.filter(u => u.id !== l.unidade);
    el.innerHTML = `<span>Última importação do PJE (${quando(l.em)}): <b>${n} novo(s)${(l.atualizados || []).length ? ', ' + l.atualizados.length + ' atualizado(s)' : ''}</b> em <b>${esc(nomeUn(l.unidade))}</b>.</span>
      <button class="btn sm danger" data-action="desfazer-lote" data-lote="${esc(l.id)}">↶ Desfazer importação</button>
      ${outras.map(u => `<button class="btn sm" data-action="mover-lote" data-lote="${esc(l.id)}" data-destino="${esc(u.id)}">Mover para ${esc(u.nome)}</button>`).join('')}
      <button class="btn sm" data-action="ocultar-aviso-imp" data-lote="${esc(l.id)}">Está certo ✓</button>`;
    el.classList.remove('hidden');
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
        if (!confirm(`O backup contém ${dados.diligencias.length} diligência(s) (todas as unidades) e ${(dados.modelos || []).length} modelo(s). Os dados atuais serão SUBSTITUÍDOS. Continuar?`)) return;
        state = normalizar(dados);
        delete state.exportadoEm; delete state.versao;
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
    const cab = ['Fase', 'Processo', 'Inquérito', 'Classe/assunto', 'Partes', 'Ato', 'ID PJE', 'Tipo', 'Requisitante', 'Órgão', 'Descrição', 'Expedição', 'Limite ciência', 'Ciência em', 'Prazo (dias)', 'Limite manifestação', 'Estimado?', 'Prazo interno', 'Dias p/ prazo', 'Responsável', 'Status', 'Réu preso', 'Observações'];
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
    const linhas = filtradas().map(d => [
      FASES[fase(d)], d.processo, d.inquerito, d.classe, d.partes, d.ato, d.idPje, d.tipo, d.requisitante, d.orgao, d.descricao,
      fmt(d.recebimento), fmt(d.limiteCiencia), fmt(d.dataCiencia), d.prazoDias, fmt(d.prazoPje), d.prazoEstimado ? 'Sim' : '',
      fmt(d.prazoInterno), dataRef(d) ? diasAte(dataRef(d)) : '', d.responsavel, STATUS[d.status], d.reuPreso ? 'Sim' : 'Não', d.obs
    ].map(q).join(';'));
    baixar(`diligencias-${unidade().nome.replace(/[^\wÀ-ÿ]+/g, '-')}-${toISO(hoje())}.csv`, '﻿' + [cab.map(q).join(';')].concat(linhas).join('\r\n'), 'text/csv;charset=utf-8');
  }

  // ------------------------------------------------------------------ Eventos
  function filtrarPeloPainel(f) {
    $('#flt-busca').value = '';
    $('#flt-requisitante').value = '';
    $('#flt-tipo').value = '';
    $('#flt-status').value = 'ativas';
    $('#flt-urgencia').value = '';
    $('#flt-fase').value = '';
    if (f === 'vencido' || f === 'hoje' || f === 'semana' || f === 'responder' || f === 'cumprida') $('#flt-fase').value = 'responder';
    if (f === 'ciencia') $('#flt-fase').value = 'ciencia';
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
      case 'trocar-unidade': trocarUnidade(el.dataset.un); break;
      case 'historico-importacoes': abrirHistorico(); break;
      case 'desfazer-lote': desfazerImportacao(el.dataset.lote); break;
      case 'mover-lote': {
        const sel = document.querySelector(`.lote-destino[data-lote="${CSS.escape(el.dataset.lote)}"]`);
        moverImportacao(el.dataset.lote, el.dataset.destino || (sel && sel.value));
        break;
      }
      case 'ocultar-aviso-imp': { const l = state.importacoes.find(x => x.id === el.dataset.lote); if (l) { l.oculta = true; salvar(); render(); } break; }
      case 'add-unidade': adicionarUnidade(); break;
      case 'del-unidade': removerUnidade(el.dataset.un); break;
      case 'ciencia': e.stopPropagation(); registrarCiencia(id); break;
      case 'filtrar': filtrarPeloPainel(el.dataset.filtro); break;
      case 'excluir-diligencia': {
        const fid = $('#f-id').value;
        if (fid && confirm('Excluir definitivamente esta diligência?')) {
          state.diligencias = state.diligencias.filter(x => x.id !== fid);
          salvar(); $('#dlg-diligencia').close(); render(); toast('Diligência excluída.');
        }
        break;
      }
      case 'calc-resposta': {
        const dias = Number($('#f-prazoDias').value);
        const base = $('#f-dataCiencia').value || $('#f-limiteCiencia').value;
        if (!(dias > 0)) { alert('Informe o prazo para resposta (em dias).'); break; }
        if (!base) { alert('Informe a data da ciência (ou o limite para ciência).'); break; }
        const r = calcularPrazo(base, dias, state.config.contagem, state.config.prorrogar);
        $('#f-prazoPje').value = r;
        $('#f-prazoEstimado').checked = true;
        $('#calc-info').textContent = `Resposta: ${dias} dias a partir de ${fmt(base)}${$('#f-dataCiencia').value ? '' : ' (ciência tácita)'} = ${fmt(r)} – estimativa; confira a data no PJE.`;
        break;
      }
      case 'calc-interno': {
        const b = $('#calc-base').value;
        const inicio = b === 'ciencia' ? ($('#f-dataCiencia').value || $('#f-limiteCiencia').value)
          : b === 'expedicao' ? $('#f-recebimento').value : toISO(hoje());
        if (!inicio) { alert('A data base escolhida não está preenchida.'); break; }
        const modo = $('#calc-modo').value;
        const n = Number($('#calc-dias').value);
        const r = calcularPrazo(inicio, n, modo, state.config.prorrogar);
        if (!r) break;
        $('#f-prazoInterno').value = r;
        $('#calc-info').textContent = `Prazo interno: ${n} dias ${modo === 'uteis' ? 'úteis' : 'corridos'} a partir de ${fmt(inicio)} = ${fmt(r)} (${parseISO(r).toLocaleDateString('pt-BR', { weekday: 'long' })})`;
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
  const urgentes = state.diligencias.filter(d => ativa(d) && fase(d) === 'responder' && d.status !== 'cumprida' && d.prazoPje && diasAte(d.prazoPje) <= 0).length;
  document.title = (urgentes ? `(${urgentes}) ` : '') + 'Controle de Prazos PJE – PCES';

  // expõe utilitários para testes no console
  window.PrazosPJE = {
    calcularPrazo, feriadosDoAno, preencher, fmt, toISO, parseISO, hoje, esc, toast, opcoes,
    TIPOS, REQUISITANTES, STATUS, FASES, DIAS_CIENCIA, addDias, respostaEstimada,
    config: () => state.config,
    diligencias: () => dils(),
    unidades: () => state.unidades,
    unidadeAtual: () => state.unidadeAtual,
    trocarUnidade,
    /** Recebe uma lista de diligências já normalizadas e grava. */
    adicionar(lista) {
      const agora = new Date().toISOString();
      const ids = [];
      lista.forEach(d => {
        const nd = Object.assign({ id: uid(), criadoEm: agora, atualizadoEm: agora, status: 'pendente', andamentos: [], unidade: state.unidadeAtual }, d);
        state.diligencias.push(nd);
        ids.push(nd.id);
      });
      salvar();
      render();
      return ids;
    },
    /** Cópia integral de um registro (para poder desfazer uma importação). */
    copia(id) { const d = state.diligencias.find(x => x.id === id); return d ? JSON.parse(JSON.stringify(d)) : null; },
    registrarImportacao,
    /** Atualiza um registro existente com dados vindos do PJE. */
    atualizar(id, campos, nota) {
      const d = state.diligencias.find(x => x.id === id);
      if (!d) return;
      Object.assign(d, campos, { atualizadoEm: new Date().toISOString() });
      d.andamentos = d.andamentos || [];
      if (nota) d.andamentos.push({ data: toISO(hoje()), texto: nota });
    },
    salvarERender() { salvar(); render(); },
    abrirDiligencia
  };
})();
