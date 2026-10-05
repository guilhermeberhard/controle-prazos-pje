/*
 * Importação de dados do PJE sem digitação.
 *
 * Três formas de entrada, todas processadas localmente no navegador:
 *   1. Texto copiado da tela do PJE (Ctrl+A / Ctrl+C / colar);
 *   2. PDF(s) do expediente/despacho baixados do PJE (leitura com pdf.js);
 *   3. Botão de favorito ("bookmarklet") que lê a tela do PJE aberta e envia
 *      o conteúdo para esta janela via postMessage (sem passar por servidor).
 *
 * O texto é analisado por regras (expressões regulares) que identificam número
 * CNJ do processo, nº do IP, datas, prazo em dias, vara, tipo de diligência etc.
 * O resultado é mostrado numa prévia editável antes de gravar.
 */
(function () {
  'use strict';
  const P = window.PrazosPJE;
  const $ = s => document.querySelector(s);
  const esc = P.esc;

  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

  // =================================================================== ANALISADOR
  const RE_CNJ = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g;
  const RE_CNJ_1 = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/;
  const RE_DATA = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;

  const REGRAS_TIPO = [
    [/laudo/i, 'Juntada de laudo'],
    [/per[íi]cia|exame (?:de |pericial|cadav|toxicol|necrop)|corpo de delito/i, 'Perícia / exame'],
    [/oitiva|ouvir|inquiri[çcr]|depoimento|termo de declara/i, 'Oitiva / termo de declarações'],
    [/relat[óo]rio final|conclus[ãa]o do (?:inqu[ée]rito|ip|procedimento)|remessa dos autos|devolu[çc][ãa]o dos autos|devolvam-se/i, 'Relatório final / remessa do IP'],
    [/mandado de (?:busca|pris[ãa]o|apreens)/i, 'Cumprimento de mandado'],
    [/representa[çc][ãa]o/i, 'Representação'],
    [/informe|informa[çc][õo]es|esclare[çc]a|esclarecimento/i, 'Informações ao Juízo / MP'],
    [/intim/i, 'Intimação']
  ];

  function limpar(t) {
    return String(t || '').replace(/\r/g, '').replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n');
  }
  function isoDe(d, m, a) {
    d = Number(d); m = Number(m); a = Number(a);
    if (m < 1 || m > 12 || d < 1 || d > 31 || a < 2000 || a > 2100) return null;
    return a + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  function datasCom(seg) {
    const r = [];
    for (const m of seg.matchAll(RE_DATA)) {
      const iso = isoDe(m[1], m[2], m[3]);
      if (iso) r.push({ iso, antes: seg.slice(Math.max(0, m.index - 70), m.index).toLowerCase() });
    }
    return r;
  }
  function ultimaPalavraChave(antes, re) {
    // considera apenas o trecho após a última quebra de campo para evitar "herdar" rótulos anteriores
    const corte = antes.split(/\n|\t|\|/).slice(-2).join(' ');
    return re.test(corte);
  }

  /** Extrai os campos de um trecho de texto referente a UM processo/expediente. */
  function extrair(seg, processoForcado) {
    const cfg = P.config();
    const r = {
      processo: processoForcado || ((seg.match(RE_CNJ) || [])[0] || ''),
      inquerito: '', tipo: 'Outras diligências', requisitante: 'Juiz(a)', orgao: '',
      recebimento: '', prazoPje: '', prazoInterno: '', descricao: '', idPje: '', reuPreso: false,
      notas: []
    };
    const low = seg.toLowerCase();

    // Inquérito / procedimento policial
    const ip = seg.match(/\b(?:IP|I\.P\.|IPL|inqu[ée]rito policial|procedimento policial|TCO|APF|auto de pris[ãa]o em flagrante)\s*(?:n[º°o.]*|n[úu]mero)?\s*[:\-]?\s*(\d[\d./-]{1,22}\d)/i);
    if (ip && !RE_CNJ_1.test(ip[1])) {
      const rotulo = /tco/i.test(ip[0]) ? 'TCO' : /apf|flagrante/i.test(ip[0]) ? 'APF' : 'IP';
      r.inquerito = rotulo + ' nº ' + ip[1];
    }

    // ID do documento
    const id = seg.match(/\bID\s*(?:n[º°o.]*\s*)?[:\-]?\s*(\d{6,12})\b/i);
    if (id) r.idPje = id[1];

    // Vara / órgão
    const org = seg.match(/((?:\d{1,2}\s?[ªaº°]\s*)?(?:Vara|Juizado|Ju[íi]zo|Promotoria|Tribunal do J[úu]ri|Central de Inqu[ée]ritos|N[úu]cleo)[^\n\t|;]{0,90})/i);
    if (org) r.orgao = org[1].replace(/\s{2,}/g, ' ').replace(/[\s\-–,.:]+$/, '').trim();

    // Requisitante
    if (/promotor|promotoria|requisi[çc][ãa]o ministerial|cota ministerial|minist[ée]rio p[úu]blico\s+(?:requer|requisita|solicita|pugna)/i.test(seg)) {
      r.requisitante = 'Ministério Público';
    }

    // Tipo
    for (const [re, tipo] of REGRAS_TIPO) if (re.test(seg)) { r.tipo = tipo; break; }

    // Preso
    r.reuPreso = /r[ée]u preso|investigad[oa] pres[oa]|indiciad[oa] pres[oa]|autuad[oa] pres[oa]|pris[ãa]o preventiva|pris[ãa]o em flagrante|custodiad[oa]/i.test(seg);

    // Datas
    const datas = datasCom(seg);
    const RE_PRAZO = /limite|final|vencimento|vence|t[ée]rmino|fim do prazo|prazo at[ée]|at[ée] o dia|at[ée]:/;
    const RE_RECEB = /ci[êe]ncia|expedi|disponibiliza|intima|publica|receb|cria[çd]|registr|data/;
    const dPrazo = datas.find(d => ultimaPalavraChave(d.antes, RE_PRAZO));
    // a contagem começa da ciência; na falta dela, da expedição/publicação
    const dReceb = datas.find(d => d !== dPrazo && ultimaPalavraChave(d.antes, /ci[êe]ncia|tomou conhecimento|intimad[oa] em/))
      || datas.find(d => d !== dPrazo && ultimaPalavraChave(d.antes, RE_RECEB));
    if (dPrazo) r.prazoPje = dPrazo.iso;
    if (dReceb) r.recebimento = dReceb.iso;
    if (!r.recebimento) {
      const hojeISO = P.toISO(P.hoje());
      const passadas = datas.map(d => d.iso).filter(x => x <= hojeISO && x !== r.prazoPje).sort();
      if (passadas.length) r.recebimento = passadas[passadas.length - 1];
    }

    // Prazo em dias ("Prazo: 10 dias", "no prazo de 05 (cinco) dias úteis", "em 48 horas")
    const pd = seg.match(/prazo[^0-9\n]{0,25}?(\d{1,3})\s*(?:\([^)]{1,25}\)\s*)?dias?(\s+(?:[úu]teis|corridos))?/i);
    const ph = seg.match(/(?:prazo|em|dentro de)[^0-9\n]{0,15}?(\d{2,3})\s*(?:\([^)]{1,25}\)\s*)?horas/i);
    let dias = pd ? Number(pd[1]) : ph ? Math.ceil(Number(ph[1]) / 24) : 0;
    if (!r.prazoPje && dias > 0) {
      const modo = pd && pd[2] && /[úu]teis/i.test(pd[2]) ? 'uteis' : cfg.contagem;
      const base = r.recebimento || P.toISO(P.hoje());
      r.prazoPje = P.calcularPrazo(base, dias, modo, cfg.prorrogar) || '';
      r.notas.push(`prazo calculado: ${dias} dia(s)${modo === 'uteis' ? ' úteis' : ''} a partir de ${P.fmt(base)}${r.recebimento ? '' : ' (hoje)'}`);
    }
    if (!r.prazoPje) r.notas.push('prazo não identificado');
    if (!r.processo) r.notas.push('nº do processo não identificado');

    // Descrição: frase com a determinação, se houver; senão o próprio trecho
    const det = seg.match(/[^.\n]{0,160}(?:determino|requisit|oficie-se|intime-se|intimem-se|proceda|providencie|encaminhe|junte|autoridade policial|delegad)[^]{0,420}/i);
    r.descricao = (det ? det[0] : seg).replace(/\s+/g, ' ').trim().slice(0, 500);
    return r;
  }

  /** Divide um texto com vários processos (lista de expedientes) em trechos. */
  function analisarLista(texto) {
    texto = limpar(texto);
    const ocorr = [...texto.matchAll(RE_CNJ)];
    if (!ocorr.length) return [];
    // agrupa ocorrências consecutivas do mesmo número (ex.: número repetido na mesma linha/bloco)
    const grupos = [];
    ocorr.forEach(m => {
      const g = grupos[grupos.length - 1];
      if (g && g.num === m[0] && m.index - g.ultimo < 400) g.ultimo = m.index;
      else grupos.push({ num: m[0], ini: m.index, ultimo: m.index });
    });
    return grupos.map((g, i) => {
      const inicioLinha = texto.lastIndexOf('\n', g.ini) + 1;
      // inclui a linha anterior quando curta (ex.: tipo do ato acima do número)
      const linhaAnt = texto.lastIndexOf('\n', inicioLinha - 2) + 1;
      const fimAnterior = i > 0 ? grupos[i - 1].ultimo + grupos[i - 1].num.length : 0;
      let ini = inicioLinha - linhaAnt < 60 ? linhaAnt : inicioLinha;
      ini = Math.max(ini, fimAnterior);
      const fim = i + 1 < grupos.length ? texto.lastIndexOf('\n', grupos[i + 1].ini) : texto.length;
      const seg = texto.slice(ini, Math.max(fim, g.ultimo + 25));
      return extrair(seg, g.num);
    });
  }

  /** Um documento (PDF) = uma diligência; usa o nº de processo mais frequente. */
  function analisarDocumento(texto) {
    texto = limpar(texto);
    const cont = {};
    (texto.match(RE_CNJ) || []).forEach(n => { cont[n] = (cont[n] || 0) + 1; });
    const proc = Object.keys(cont).sort((a, b) => cont[b] - cont[a])[0] || '';
    return extrair(texto, proc);
  }

  // =================================================================== PRÉVIA
  let itens = [];

  function marcarDuplicadas(lista) {
    const existentes = P.diligencias().filter(d => d.status !== 'respondida');
    lista.forEach(it => {
      it.dup = !!it.processo && existentes.some(d => d.processo === it.processo && (!it.prazoPje || !d.prazoPje || d.prazoPje === it.prazoPje));
      it.sel = !it.dup;
    });
    return lista;
  }

  function mostrarPrevia(lista, origem) {
    itens = marcarDuplicadas(lista);
    if (!itens.length) {
      alert('Não foi encontrado nenhum número de processo (formato 0000000-00.0000.0.00.0000) no conteúdo. Verifique se copiou a tela correta do PJE.');
      return;
    }
    const dups = itens.filter(i => i.dup).length;
    $('#imp-resumo-texto').innerHTML = `<b>${itens.length}</b> expediente(s) encontrado(s)${origem ? ' em ' + esc(origem) : ''}${dups ? ` · ${dups} já cadastrado(s)` : ''}.`;
    const optT = sel => P.TIPOS.map(t => `<option${t === sel ? ' selected' : ''}>${esc(t)}</option>`).join('');
    const optR = sel => P.REQUISITANTES.map(t => `<option${t === sel ? ' selected' : ''}>${esc(t)}</option>`).join('');
    $('#imp-tbody').innerHTML = itens.map((it, i) => `
      <tr data-i="${i}" class="${it.dup ? 'dup' : ''}">
        <td><input type="checkbox" class="imp-sel" ${it.sel ? 'checked' : ''}></td>
        <td>
          <input data-k="processo" value="${esc(it.processo)}" placeholder="Nº do processo">
          <input data-k="inquerito" value="${esc(it.inquerito)}" placeholder="Nº do IP">
          ${it.dup ? '<span class="badge atencao">já cadastrada</span>' : ''}
          ${it.reuPreso ? '<span class="badge preso">PRESO</span>' : ''}
        </td>
        <td><select data-k="tipo">${optT(it.tipo)}</select><select data-k="requisitante">${optR(it.requisitante)}</select></td>
        <td><input type="date" data-k="recebimento" value="${esc(it.recebimento)}"></td>
        <td><input type="date" data-k="prazoPje" value="${esc(it.prazoPje)}">${it.notas.map(n => `<span class="nota">${esc(n)}</span>`).join('')}</td>
        <td><input type="date" data-k="prazoInterno" value="${esc(it.prazoInterno)}"></td>
        <td><input data-k="orgao" value="${esc(it.orgao)}" placeholder="Vara / órgão"><textarea data-k="descricao" rows="3">${esc(it.descricao)}</textarea></td>
      </tr>`).join('');
    $('#imp-marcar-todos').checked = itens.every(i => i.sel);
    etapa(2);
  }

  function lerPrevia() {
    document.querySelectorAll('#imp-tbody tr').forEach(tr => {
      const it = itens[Number(tr.dataset.i)];
      it.sel = tr.querySelector('.imp-sel').checked;
      tr.querySelectorAll('[data-k]').forEach(el => { it[el.dataset.k] = el.value.trim(); });
    });
  }

  function confirmar() {
    lerPrevia();
    const sel = itens.filter(i => i.sel);
    if (!sel.length) { alert('Nenhuma linha selecionada.'); return; }
    const semProc = sel.filter(i => !i.processo && !i.inquerito);
    if (semProc.length) { alert('Há linha(s) selecionada(s) sem número de processo ou IP.'); return; }
    const hojeISO = P.toISO(P.hoje());
    P.adicionar(sel.map(i => ({
      processo: i.processo, inquerito: i.inquerito, tipo: i.tipo, requisitante: i.requisitante, orgao: i.orgao,
      descricao: i.descricao, recebimento: i.recebimento, prazoPje: i.prazoPje, prazoInterno: i.prazoInterno,
      responsavel: '', idPje: i.idPje, reuPreso: !!i.reuPreso, obs: '',
      andamentos: [{ data: hojeISO, texto: 'Importada do PJE' + (i.notas.length ? ' (' + i.notas.join('; ') + ')' : '') }]
    })));
    $('#dlg-importar').close();
    P.toast(`${sel.length} diligência(s) importada(s).`);
  }

  // =================================================================== PDF
  let pdfjsPromise = null;
  function carregarPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfjsPromise) {
      pdfjsPromise = new Promise((ok, erro) => {
        const s = document.createElement('script');
        s.src = PDFJS + 'pdf.min.js';
        s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); };
        s.onerror = () => { pdfjsPromise = null; erro(new Error('Não foi possível carregar o leitor de PDF (verifique a conexão com a internet).')); };
        document.head.appendChild(s);
      });
    }
    return pdfjsPromise;
  }
  async function textoDoPdf(arquivo) {
    const lib = await carregarPdfJs();
    const doc = await lib.getDocument({ data: await arquivo.arrayBuffer() }).promise;
    let texto = '';
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = await doc.getPage(p);
      const c = await pg.getTextContent();
      texto += c.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join('') + '\n';
    }
    return texto;
  }
  async function processarPdfs(arquivos) {
    const lista = [];
    const st = $('#imp-pdf-status');
    const falhas = [];
    for (const [n, arq] of Array.from(arquivos).entries()) {
      st.textContent = `Lendo ${n + 1} de ${arquivos.length}: ${arq.name}...`;
      try {
        const t = await textoDoPdf(arq);
        if (t.replace(/\s/g, '').length < 30) { falhas.push(arq.name + ' (sem texto – documento escaneado?)'); continue; }
        const it = analisarDocumento(t);
        it.notas.push('arquivo: ' + arq.name);
        lista.push(it);
      } catch (e) {
        falhas.push(arq.name + ' (' + e.message + ')');
      }
    }
    st.textContent = falhas.length ? 'Não foi possível ler: ' + falhas.join('; ') : '';
    if (lista.length) mostrarPrevia(lista, arquivos.length + ' PDF(s)');
  }

  // =================================================================== FAVORITO (bookmarklet)
  function codigoFavorito() {
    const url = location.href.split('#')[0];
    const destino = url.startsWith('file:') ? '*' : location.origin;
    const js = `(function(){var U=${JSON.stringify(url)},O=${JSON.stringify(destino)},t=String(getSelection()||'');` +
      `function g(w){try{t+='\\n'+w.document.body.innerText;for(var i=0;i<w.frames.length;i++)g(w.frames[i])}catch(e){}}` +
      `if(t.trim().length<20){t='';g(window)}` +
      `var id=Date.now()+'',w=window.open(U+'#importar-pje','controlePrazosPJE'),n=0,ok=0;` +
      `function h(e){if(e.data&&e.data.tipo==='pces-recebido'&&e.data.id===id){ok=1;removeEventListener('message',h)}}addEventListener('message',h);` +
      `var iv=setInterval(function(){if(ok||++n>40){clearInterval(iv);if(!ok)alert('Não foi possível enviar ao Controle de Prazos. Copie o conteúdo (Ctrl+A, Ctrl+C) e cole na tela Importar do PJE.');return}` +
      `try{w.postMessage({tipo:'pces-importar',id:id,texto:t,origem:location.hostname},O)}catch(e){}},500)})();`;
    return 'javascript:' + encodeURIComponent(js);
  }

  let ultimoId = null;
  window.addEventListener('message', e => {
    const d = e.data;
    if (!d || d.tipo !== 'pces-importar' || typeof d.texto !== 'string') return;
    try { e.source.postMessage({ tipo: 'pces-recebido', id: d.id }, e.origin === 'null' ? '*' : e.origin); } catch (er) { /* ignorado */ }
    if (d.id === ultimoId) return;
    ultimoId = d.id;
    window.focus();
    abrir();
    mostrarPrevia(analisarLista(d.texto), 'página ' + (d.origem || e.origin));
  });

  // =================================================================== UI
  function etapa(n) {
    $('#imp-etapa1').classList.toggle('hidden', n !== 1);
    $('#imp-etapa2').classList.toggle('hidden', n !== 2);
    $('#imp-voltar').classList.toggle('hidden', n !== 2);
    $('#imp-confirmar').classList.toggle('hidden', n !== 2);
  }
  function aba(nome) {
    document.querySelectorAll('[data-imp-tab]').forEach(b => b.classList.toggle('active', b.dataset.impTab === nome));
    document.querySelectorAll('.imp-tab').forEach(t => t.classList.toggle('hidden', t.id !== 'imp-tab-' + nome));
  }
  function abrir(nomeAba) {
    const dlg = $('#dlg-importar');
    if (!dlg.open) { etapa(1); $('#imp-pdf-status').textContent = ''; dlg.showModal(); }
    if (nomeAba) aba(nomeAba);
  }

  $('#imp-bookmarklet').setAttribute('href', codigoFavorito());
  $('#imp-bookmarklet').addEventListener('click', e => {
    e.preventDefault();
    alert('Não clique aqui: arraste este botão para a barra de favoritos do navegador. Depois use-o com o PJE aberto.');
  });

  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-imp-tab]');
    if (t) { aba(t.dataset.impTab); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    switch (el.dataset.action) {
      case 'importar-pje': abrir('colar'); break;
      case 'imp-analisar': {
        const txt = $('#imp-texto').value;
        if (!txt.trim()) { alert('Cole o conteúdo copiado do PJE.'); break; }
        mostrarPrevia(analisarLista(txt), 'texto colado');
        break;
      }
      case 'imp-colar-clipboard':
        try { $('#imp-texto').value = await navigator.clipboard.readText(); }
        catch (er) { alert('O navegador não permitiu ler a área de transferência. Clique na caixa de texto e use Ctrl+V.'); }
        break;
      case 'imp-voltar': etapa(1); break;
      case 'imp-confirmar': confirmar(); break;
    }
  });
  $('#imp-marcar-todos').addEventListener('change', e => {
    document.querySelectorAll('#imp-tbody .imp-sel').forEach(c => { c.checked = e.target.checked; });
  });
  $('#imp-pdf').addEventListener('change', e => { if (e.target.files.length) processarPdfs(e.target.files); e.target.value = ''; });
  const drop = $('#imp-drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => {
    const pdfs = Array.from(e.dataTransfer.files).filter(f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
    if (pdfs.length) processarPdfs(pdfs);
  });

  // Aberto pelo favorito: aguarda os dados
  if (location.hash.startsWith('#importar-pje')) {
    history.replaceState(null, '', location.pathname + location.search);
    P.toast('Recebendo dados do PJE...');
  }

  // exposto para testes
  P.importacao = { analisarLista, analisarDocumento, extrair, codigoFavorito };
})();
