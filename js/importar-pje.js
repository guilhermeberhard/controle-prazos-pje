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

  /** Divide um texto com vários processos (layout genérico) em trechos. */
  function analisarListaGenerica(texto) {
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

  // =================================================================== LAYOUT DO PJE-TJES (Expedientes)
  /*
   * Cada expediente na tela "Expedientes" do PJE tem este formato (copiado com Ctrl+A / Ctrl+C):
   *   [TOMAR CIÊNCIA | RESPONDER]
   *   POLÍCIA CIVIL DO ESTADO DO ESPÍRITO SANTO
   *   Decisão (19987444)                                  <- ato e ID do expediente
   *   Expedição eletrônica (06/10/2026 16:24)
   *   Prazo:10 dias | Prazo: sem prazo
   *   [O sistema registrou ciência em 01/10/2026 23:59]
   *   [Data limite prevista para ciência: 16/10/2026 23:59]
   *   [Data limite prevista para manifestação: 19/10/2026 23:59]
   *   AuPrFl 5001881-17.2026.8.08.0001  Homicídio Qualificado
   *   POLÍCIA CIVIL DO ESTADO DO ESPÍRITO SANTO X FULANO
   *   /Afonso Cláudio - 2ª Vara
   *   Último movimento: 08/10/2026 15:55 - Juntada de ...
   */
  const SIGLAS = {
    IP: 'Inquérito Policial',
    AuPrFl: 'Auto de Prisão em Flagrante',
    PePrPr: 'Pedido de Prisão Preventiva',
    MPCA: 'Medida de Proteção à Criança e Adolescente',
    TCO: 'Termo Circunstanciado de Ocorrência'
  };
  const RE_ATO = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{2,45}?)\s*\((\d{6,12})\)/g;
  const D = '(\\d{1,2}\\/\\d{1,2}\\/\\d{4})';
  const pega = (txt, re) => { const m = txt.match(re); return m ? m[1] : ''; };
  const isoBR = br => { if (!br) return ''; const [d, m, a] = br.split('/'); return isoDe(d, m, a) || ''; };

  function ehLayoutExpedientes(texto) {
    return /Expedi[çc][ãa]o eletr[ôo]nica|limite prevista para (?:ci[êe]ncia|manifesta)|registrou ci[êe]ncia/i.test(texto);
  }

  function analisarExpedientes(texto) {
    texto = limpar(texto);
    // âncoras: "Ato (ID)" seguidos, no mesmo bloco, de "Expedição"
    const ancoras = [...texto.matchAll(RE_ATO)].filter(m => {
      const depois = texto.slice(m.index, m.index + 250);
      return /Expedi[çc][ãa]o/i.test(depois) && !/expedi[çc][ãa]o/i.test(m[1]);
    });
    const cfg = P.config();
    return ancoras.map((a, k) => {
      const ini = a.index;
      const fimBruto = k + 1 < ancoras.length ? ancoras[k + 1].index : texto.length;
      let bloco = texto.slice(ini, fimBruto);
      const um = bloco.match(/[ÚU]ltimo movimento:[^\n\t]*/);
      if (um) bloco = bloco.slice(0, um.index + um[0].length);
      // trecho antes do ato (botão TOMAR CIÊNCIA / RESPONDER e destinatário)
      const antes = texto.slice(k > 0 ? ancoras[k - 1].index : 0, ini);
      const umAnt = [...antes.matchAll(/[ÚU]ltimo movimento:[^\n\t]*/g)].pop();
      const preambulo = umAnt ? antes.slice(umAnt.index + umAnt[0].length) : antes.slice(-250);

      const r = {
        processo: pega(bloco, /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/), inquerito: '',
        ato: a[1].replace(/^(?:TOMAR CI[ÊE]NCIA|RESPONDER)\s*/i, '').trim(), idPje: a[2],
        tipo: 'A definir (ler o ato no PJE)', requisitante: 'Juiz(a)', orgao: '', descricao: '',
        recebimento: isoBR(pega(bloco, new RegExp('Expedi[çc][ãa]o[^(\\n]*\\(\\s*' + D, 'i'))),
        limiteCiencia: isoBR(pega(bloco, new RegExp('limite prevista para ci[êe]ncia:?\\s*' + D, 'i'))),
        dataCiencia: isoBR(pega(bloco, new RegExp('(?:registrou ci[êe]ncia em|ci[êe]ncia registrada em|ci[êe]ncia em)\\s*' + D, 'i'))),
        prazoPje: isoBR(pega(bloco, new RegExp('limite prevista para (?:manifesta[çc][ãa]o|resposta)[^\\d\\n]{0,5}' + D, 'i'))),
        prazoDias: '', prazoEstimado: false, prazoInterno: '', classe: '', partes: '', obs: '',
        reuPreso: false, notas: []
      };
      const pz = bloco.match(/Prazo:\s*(\d{1,3})\s*(dias?|horas?)/i);
      if (pz) r.prazoDias = /hora/i.test(pz[2]) ? Math.max(1, Math.ceil(Number(pz[1]) / 24)) : Number(pz[1]);
      const semPrazo = /Prazo:\s*sem prazo/i.test(bloco);

      // fase: pelos dados do expediente; na falta, pelo botão exibido no PJE
      if (r.dataCiencia || r.prazoPje) r.fase = 'responder';
      else if (r.limiteCiencia) r.fase = 'ciencia';
      else if (/TOMAR CI[ÊE]NCIA/i.test(preambulo)) r.fase = 'ciencia';
      else if (/RESPONDER/i.test(preambulo)) r.fase = 'responder';
      else r.fase = 'ciencia';

      if (r.fase === 'ciencia' && !r.limiteCiencia && r.recebimento) {
        r.limiteCiencia = P.toISO(P.addDias(P.parseISO(r.recebimento), P.DIAS_CIENCIA));
        r.notas.push(`limite de ciência calculado (expedição + ${P.DIAS_CIENCIA} dias)`);
      }
      if (r.fase === 'responder' && !r.prazoPje && r.prazoDias && (r.dataCiencia || r.limiteCiencia)) {
        r.prazoPje = P.respostaEstimada(r, r.dataCiencia || r.limiteCiencia);
        r.prazoEstimado = true;
        r.notas.push('data de resposta estimada – confirmar no PJE');
      }
      if (semPrazo) r.notas.push('sem prazo de resposta');

      // classe, assunto, partes, vara
      const cl = bloco.match(/([A-Za-z]{2,10})\s+\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}[ \t]*([^\n\t]*)/);
      if (cl) {
        const sigla = cl[1];
        const assunto = cl[2].replace(/^[^A-Za-zÀ-ÿ]+/, '').trim();
        r.classe = (SIGLAS[sigla] ? `${sigla} – ${SIGLAS[sigla]}` : sigla) + (assunto ? ' · ' + assunto : '');
      }
      r.partes = pega(bloco, /\n[ \t]*([^\n\t]{3,200}?\sX\s[^\n\t]{2,200})/).trim();
      const vara = pega(bloco, /(?:^|\n|\t)[ \t]*\/\s*([^\n\t]+)/).trim();
      if (vara) { const pt = vara.split(/\s+-\s+/); r.orgao = pt.length === 2 ? `${pt[1]} de ${pt[0]}` : vara; }
      const mov = pega(bloco, /[ÚU]ltimo movimento:\s*([^\n\t]+)/).trim();
      if (mov) r.obs = 'Último movimento no PJE: ' + mov;
      r.descricao = ''; // o que foi determinado só se sabe lendo o ato no PJE
      if (/minist[ée]rio p[úu]blico|promotor/i.test(r.ato)) r.requisitante = 'Ministério Público';
      if (!r.processo) r.notas.push('nº do processo não identificado');
      return r;
    });
  }

  /** Ponto de entrada para texto colado/enviado pelo favorito. */
  function analisarLista(texto) {
    if (ehLayoutExpedientes(texto)) {
      const r = analisarExpedientes(texto);
      if (r.length) return r;
    }
    return analisarListaGenerica(texto).map(normalizarGenerico);
  }
  /** Itens lidos por regras genéricas (outros layouts e PDFs) entram na fase "Responder". */
  function normalizarGenerico(it) {
    const estimado = it.notas.some(n => /calculado/.test(n));
    return Object.assign({ fase: 'responder', ato: '', limiteCiencia: '', dataCiencia: '', prazoDias: '', classe: '', partes: '', obs: '' },
      it, { prazoEstimado: estimado });
  }

  // =================================================================== PRÉVIA
  let itens = [];

  /** Procura o mesmo expediente já cadastrado: pelo ID do PJE ou por processo + ato + data de expedição. */
  function encontrar(it) {
    const todas = P.diligencias();
    if (it.idPje) {
      const d = todas.find(x => x.idPje && String(x.idPje) === String(it.idPje));
      if (d) return d;
    }
    if (it.processo && it.recebimento) {
      return todas.find(x => x.processo === it.processo && x.recebimento === it.recebimento && (x.ato || '') === (it.ato || '')) || null;
    }
    return null;
  }
  /** Campos que o PJE trouxe e que mudaram em relação ao registro existente. */
  function diferencas(d, it) {
    const c = {};
    const faseD = d.fase === 'ciencia' ? 'ciencia' : 'responder';
    if (faseD === 'ciencia' && it.fase === 'responder') c.fase = 'responder';
    if (it.limiteCiencia && it.limiteCiencia !== d.limiteCiencia) c.limiteCiencia = it.limiteCiencia;
    if (it.dataCiencia && it.dataCiencia !== d.dataCiencia) c.dataCiencia = it.dataCiencia;
    if (it.prazoDias !== '' && Number(it.prazoDias) !== Number(d.prazoDias)) c.prazoDias = it.prazoDias;
    if (it.prazoPje && !it.prazoEstimado && (it.prazoPje !== d.prazoPje || d.prazoEstimado)) { c.prazoPje = it.prazoPje; c.prazoEstimado = false; }
    if (it.prazoPje && it.prazoEstimado && !d.prazoPje) { c.prazoPje = it.prazoPje; c.prazoEstimado = true; }
    if (it.obs && it.obs !== d.obs && !d.obs) c.obs = it.obs;
    ['ato', 'classe', 'partes', 'orgao'].forEach(k => { if (it[k] && !d[k]) c[k] = it[k]; });
    if (it.idPje && !d.idPje) c.idPje = it.idPje;
    return c;
  }
  const ROTULOS = { fase: 'fase → Responder', limiteCiencia: 'limite de ciência', dataCiencia: 'data da ciência', prazoDias: 'prazo (dias)', prazoPje: 'data limite de manifestação' };

  function classificar(lista) {
    lista.forEach(it => {
      const d = encontrar(it);
      it.existente = d ? d.id : null;
      if (!d) { it.situacao = 'novo'; it.sel = true; return; }
      if (d.status === 'respondida') { it.situacao = 'finalizado'; it.sel = false; return; }
      it.mudancas = diferencas(d, it);
      const relevantes = Object.keys(it.mudancas).filter(k => ROTULOS[k]);
      it.situacao = relevantes.length ? 'atualizar' : 'igual';
      it.sel = relevantes.length > 0;
      it.textoMudancas = relevantes.map(k => ROTULOS[k] + (k === 'prazoPje' || k.endsWith('Ciencia') ? ': ' + P.fmt(it.mudancas[k]) : k === 'prazoDias' ? ': ' + it.mudancas[k] : '')).join('; ');
    });
    return lista;
  }

  function mostrarPrevia(lista, origem) {
    itens = classificar(lista);
    if (!itens.length) {
      alert('Não foi encontrado nenhum expediente/número de processo no conteúdo. Verifique se copiou a tela de Expedientes do PJE.');
      return;
    }
    const n = t => itens.filter(i => i.situacao === t).length;
    const nc = itens.filter(i => i.fase === 'ciencia').length;
    $('#imp-resumo-texto').innerHTML = `<b>${itens.length}</b> expediente(s)${origem ? ' em ' + esc(origem) : ''}: ` +
      `<span class="fase fase-responder">${itens.length - nc} responder</span> <span class="fase fase-ciencia">${nc} tomar ciência</span> · ` +
      `${n('novo')} novo(s), ${n('atualizar')} a atualizar, ${n('igual') + n('finalizado')} sem alteração.`;
    const optT = sel => P.TIPOS.map(t => `<option${t === sel ? ' selected' : ''}>${esc(t)}</option>`).join('');
    const optR = sel => P.REQUISITANTES.map(t => `<option${t === sel ? ' selected' : ''}>${esc(t)}</option>`).join('');
    const SIT = {
      novo: '<span class="badge ok">novo</span>',
      atualizar: '<span class="badge critico">atualizar</span>',
      igual: '<span class="badge neutro">já cadastrado – sem alteração</span>',
      finalizado: '<span class="badge neutro">já finalizado</span>'
    };
    $('#imp-tbody').innerHTML = itens.map((it, i) => {
      const ex = !!it.existente;
      return `
      <tr data-i="${i}" class="${it.situacao === 'novo' ? '' : 'dup'}">
        <td><input type="checkbox" class="imp-sel" ${it.sel ? 'checked' : ''}></td>
        <td>${SIT[it.situacao]}${it.textoMudancas ? `<span class="nota">${esc(it.textoMudancas)}</span>` : ''}</td>
        <td><select data-k="fase"><option value="responder"${it.fase === 'responder' ? ' selected' : ''}>Responder</option><option value="ciencia"${it.fase === 'ciencia' ? ' selected' : ''}>Tomar ciência</option></select></td>
        <td>
          <input data-k="processo" value="${esc(it.processo)}" placeholder="Nº do processo">
          <span class="small muted">${esc(it.classe || it.inquerito || '')}</span>
          ${it.partes ? `<span class="small muted d-block">${esc(it.partes)}</span>` : ''}
        </td>
        <td><input data-k="ato" value="${esc(it.ato || '')}" placeholder="Ato"><input data-k="idPje" value="${esc(it.idPje || '')}" placeholder="ID"></td>
        <td class="datas">
          <span>Expedição</span><input type="date" data-k="recebimento" value="${esc(it.recebimento)}">
          <span>Limite ciência</span><input type="date" data-k="limiteCiencia" value="${esc(it.limiteCiencia || '')}">
          <span>Ciência em</span><input type="date" data-k="dataCiencia" value="${esc(it.dataCiencia || '')}">
        </td>
        <td class="datas">
          <span>Prazo (dias)</span><input type="number" min="0" data-k="prazoDias" value="${esc(it.prazoDias)}" placeholder="sem prazo">
          <span>Limite manifestação</span><input type="date" data-k="prazoPje" value="${esc(it.prazoPje)}">
          ${it.notas.map(x => `<span class="nota">${esc(x)}</span>`).join('')}
        </td>
        <td>${ex ? '<span class="small muted">mantém tipo, responsável e status já cadastrados</span>'
          : `<select data-k="tipo">${optT(it.tipo)}</select><select data-k="requisitante">${optR(it.requisitante)}</select>`}</td>
      </tr>`;
    }).join('');
    $('#imp-marcar-todos').checked = itens.every(i => i.sel);
    etapa(2);
  }

  function lerPrevia() {
    document.querySelectorAll('#imp-tbody tr').forEach(tr => {
      const it = itens[Number(tr.dataset.i)];
      const antes = { prazoPje: it.prazoPje };
      it.sel = tr.querySelector('.imp-sel').checked;
      tr.querySelectorAll('[data-k]').forEach(el => { it[el.dataset.k] = el.value.trim(); });
      if (it.prazoDias !== '') it.prazoDias = Number(it.prazoDias) || '';
      if (it.prazoPje !== antes.prazoPje) it.prazoEstimado = false; // editado manualmente
    });
  }

  function confirmar() {
    lerPrevia();
    const sel = itens.filter(i => i.sel);
    if (!sel.length) { alert('Nenhuma linha selecionada.'); return; }
    if (sel.some(i => !i.existente && !i.processo && !i.inquerito)) { alert('Há linha(s) selecionada(s) sem número de processo.'); return; }
    const hojeISO = P.toISO(P.hoje());
    const novos = sel.filter(i => !i.existente);
    const atual = sel.filter(i => i.existente);
    atual.forEach(i => {
      const d = P.diligencias().find(x => x.id === i.existente);
      const c = diferencas(d, i);
      if (c.fase === 'responder' && !c.dataCiencia && !d.dataCiencia) c.dataCiencia = i.dataCiencia || d.limiteCiencia || hojeISO;
      const txt = Object.keys(c).filter(k => ROTULOS[k]).map(k => ROTULOS[k] + (/prazoPje|Ciencia/.test(k) ? ' ' + P.fmt(c[k]) : k === 'prazoDias' ? ' ' + c[k] : '')).join('; ');
      P.atualizar(i.existente, c, 'Atualizado pela importação do PJE' + (txt ? ': ' + txt : '') + (c.prazoEstimado ? ' (estimado)' : ''));
    });
    if (novos.length) {
      P.adicionar(novos.map(i => ({
        fase: i.fase, processo: i.processo, inquerito: i.inquerito || '', classe: i.classe || '', partes: i.partes || '',
        ato: i.ato || '', idPje: i.idPje || '', tipo: i.tipo, requisitante: i.requisitante, orgao: i.orgao || '',
        descricao: i.descricao || '', recebimento: i.recebimento || '', limiteCiencia: i.limiteCiencia || '',
        dataCiencia: i.dataCiencia || '', prazoDias: i.prazoDias, prazoPje: i.prazoPje || '', prazoEstimado: !!i.prazoEstimado && !!i.prazoPje,
        prazoInterno: i.prazoInterno || '', responsavel: '', reuPreso: !!i.reuPreso, obs: i.obs || '',
        andamentos: [{ data: hojeISO, texto: 'Importado do PJE' + (i.notas.length ? ' (' + i.notas.join('; ') + ')' : '') }]
      })));
    } else {
      P.salvarERender();
    }
    $('#dlg-importar').close();
    P.toast(`${novos.length} novo(s) e ${atual.length} atualizado(s).`);
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
    if (lista.length) mostrarPrevia(lista.map(normalizarGenerico), arquivos.length + ' PDF(s)');
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
  P.importacao = { analisarLista, analisarExpedientes, analisarDocumento, extrair, codigoFavorito };
})();
