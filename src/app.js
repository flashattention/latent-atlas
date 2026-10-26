/* Latent Atlas — page logic: routing, language, rail, concept pages, index search. */
(function () {
  const REG = window.ATLAS_REG;
  const BASE = window.ATLAS_BASE || { f: {}, c: {} };
  const FLAGS = window.ATLAS_FLAGS, LANGS = window.ATLAS_LANGS;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ITEMS = REG.items.map((x, i) => ({ id: x[0], cat: x[1], en: x[2], type: x[3], params: x[4], i }));
  const BYID = Object.fromEntries(ITEMS.map((x) => [x.id, x]));
  const CATS = REG.cats.map(([id, en], i) => ({ id, en, no: i + 1, items: ITEMS.filter((x) => x.cat === id) }));
  const CATBY = Object.fromEntries(CATS.map((c) => [c.id, c]));
  const FEATURED = 'moe';

  /* ---------- language ---------- */
  window.__ATLAS_I18N = window.__ATLAS_I18N || {};
  const FONTS = {
    ko: 'Noto+Serif+KR:wght@400;500;600&family=Noto+Sans+KR:wght@400;500',
    ja: 'Noto+Serif+JP:wght@400;500;600&family=Noto+Sans+JP:wght@400;500',
    zh: 'Noto+Serif+SC:wght@400;500;600&family=Noto+Sans+SC:wght@400;500',
    ar: 'Noto+Naskh+Arabic:wght@400;500;600&family=Noto+Sans+Arabic:wght@400;500',
    hi: 'Noto+Serif+Devanagari:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;500',
    ru: 'Noto+Serif:wght@400;500',
  };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };
  function detectLang() {
    const saved = store.get('atlas.lang');
    if (saved && LANGS.some((l) => l[0] === saved)) return saved;
    const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']);
    for (const p of prefs) {
      const base = String(p).toLowerCase().split('-')[0];
      if (LANGS.some((l) => l[0] === base)) return base;
    }
    return 'en';
  }
  let lang = 'en', D = null; // D = active dictionary
  const loading = {};
  function loadLang(code) {
    if (window.__ATLAS_I18N[code]) return Promise.resolve(window.__ATLAS_I18N[code]);
    if (loading[code]) return loading[code];
    loading[code] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'i18n/' + code + '.js';
      s.onload = () => (window.__ATLAS_I18N[code] ? res(window.__ATLAS_I18N[code]) : rej(new Error('empty ' + code)));
      s.onerror = () => rej(new Error('load ' + code));
      document.head.appendChild(s);
    });
    return loading[code];
  }
  window.__ATLAS_SET = (code, data) => { window.__ATLAS_I18N[code] = data; };

  const EN = () => window.__ATLAS_I18N.en || { ui: {}, cats: {}, items: {}, legend: {} };
  function t(key, vars) {
    let s = (D && D.ui && D.ui[key]) || EN().ui[key] || key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  const nm = (id) => (D && D.items[id] && D.items[id].n) || (EN().items[id] && EN().items[id].n) || BYID[id].en;
  const enName = (id) => (EN().items[id] && EN().items[id].n) || BYID[id].en;
  const catName = (c) => (D && D.cats && D.cats[c]) || CATBY[c].en;
  const field = (id, f) => (D && D.items[id] && D.items[id][f]) || (EN().items[id] && EN().items[id][f]);
  const legendText = (s) => (D && D.legend && D.legend[s]) || s;

  async function setLang(code, rerender = true) {
    lang = code;
    document.documentElement.lang = code;
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
    $('#langfont').href = FONTS[code] ? 'https://fonts.googleapis.com/css2?family=' + FONTS[code] + '&display=swap' : 'data:text/css,';
    $('#langFlag').innerHTML = FLAGS[code];
    $('#langName').textContent = LANGS.find((l) => l[0] === code)[1];
    store.set('atlas.lang', code);
    try {
      await loadLang('en');
      D = await loadLang(code);
    } catch (e) {
      console.warn(e); D = EN();
    }
    paintChrome();
    if (rerender) route(true);
  }

  function buildLangMenu() {
    const m = $('#langMenu');
    m.innerHTML = LANGS.map(([c, n]) => `<button type="button" role="menuitemradio" data-l="${c}" aria-checked="${c === lang}">${FLAGS[c]}<span>${n}</span><span class="code">${c.toUpperCase()}</span></button>`).join('');
    m.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { closeLang(); setLang(b.dataset.l); }));
  }
  function openLang() { buildLangMenu(); $('#langMenu').hidden = false; $('#langBtn').setAttribute('aria-expanded', 'true'); const cur = $('#langMenu [aria-checked="true"]'); cur && cur.focus(); }
  function closeLang() { $('#langMenu').hidden = true; $('#langBtn').setAttribute('aria-expanded', 'false'); }
  $('#langBtn').addEventListener('click', (e) => { e.stopPropagation(); $('#langMenu').hidden ? openLang() : closeLang(); });
  document.addEventListener('click', (e) => { if (!$('#langMenu').hidden && !e.target.closest('.langwrap')) closeLang(); });

  function paintChrome() {
    $('#brand').textContent = t('brand');
    $('#searchLbl').textContent = t('searchShort');
    $('#closeIx').textContent = t('close');
    $('#langBtn').setAttribute('aria-label', t('language'));
    $('#themeBtn').setAttribute('aria-label', t('darkMode'));
    $('#themeBtn').title = t('darkMode');
    renderRail();
  }

  /* ---------- theme (initial value set by the inline script in index.html) ---------- */
  const darkQuery = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme(th) {
    document.documentElement.dataset.theme = th;
    $('#themeBtn').setAttribute('aria-pressed', String(th === 'dark'));
    window.ATLAS_K.setTheme(th);
    if (stage) stage.rebuild();
  }
  $('#themeBtn').setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'dark'));
  $('#themeBtn').addEventListener('click', () => {
    const th = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    store.set('atlas.theme', th); applyTheme(th);
  });
  if (darkQuery) darkQuery.addEventListener('change', (e) => {
    const saved = store.get('atlas.theme');
    if (saved !== 'light' && saved !== 'dark') applyTheme(e.matches ? 'dark' : 'light');
  });

  /* ---------- stage (one canvas, moved between views) ---------- */
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  let stage = null;
  function ensureStage() {
    if (!stage) stage = window.AtlasStage(canvas, {});
    return stage;
  }

  /* ---------- rail ---------- */
  let openCat = null;
  function renderRail(activeId, keepOpen) {
    const rail = $('#rail');
    const cur = activeId || (curId && curId !== 'home' ? curId : null);
    if (cur && !keepOpen) openCat = BYID[cur].cat;
    rail.innerHTML = `<h2>${esc(t('chapters'))}</h2><ol>${CATS.map((c) => `
      <li><button class="chap" type="button" data-cat="${c.id}" aria-expanded="${openCat === c.id}"><span class="no">${c.no}</span><span>${esc(catName(c.id))}</span><span class="ct">${c.items.length}</span></button>
      ${openCat === c.id ? `<div class="sub">${c.items.map((x) => `<a href="#${x.id}" ${x.id === cur ? 'aria-current="page"' : ''}>${esc(nm(x.id))}</a>`).join('')}</div>` : ''}</li>`).join('')}</ol>`;
    rail.querySelectorAll('.chap').forEach((b) => b.addEventListener('click', () => {
      openCat = openCat === b.dataset.cat ? null : b.dataset.cat; renderRail(cur, true);
    }));
    const a = rail.querySelector('[aria-current="page"]');
    if (a) { const r = a.getBoundingClientRect(), rr = rail.getBoundingClientRect(); if (r.top < rr.top || r.bottom > rr.bottom) a.scrollIntoView({ block: 'center' }); }
  }

  /* ---------- python highlighter ---------- */
  const KW = new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' '));
  function hl(code) {
    const out = []; let i = 0; const n = code.length;
    while (i < n) {
      const ch = code[i];
      if (ch === '#') { let j = code.indexOf('\n', i); if (j < 0) j = n; out.push(`<span class="tk-c">${esc(code.slice(i, j))}</span>`); i = j; continue; }
      if (ch === '"' || ch === "'") {
        const triple = code.substr(i, 3) === ch.repeat(3); const q = triple ? ch.repeat(3) : ch;
        let j = i + q.length;
        while (j < n && code.substr(j, q.length) !== q) { if (code[j] === '\\') j++; if (!triple && code[j] === '\n') break; j++; }
        j = Math.min(n, j + q.length);
        let s = i; while (s > 0 && /[rbfuRBFU]/.test(code[s - 1])) s--;
        out.push(`<span class="tk-s">${esc(code.slice(i, j))}</span>`); i = j; continue;
      }
      if (/[0-9]/.test(ch) && !/[A-Za-z_]/.test(code[i - 1] || '')) { let j = i; while (j < n && /[0-9._eE]/.test(code[j])) j++; out.push(`<span class="tk-n">${esc(code.slice(i, j))}</span>`); i = j; continue; }
      if (/[A-Za-z_]/.test(ch)) {
        let j = i; while (j < n && /[A-Za-z0-9_]/.test(code[j])) j++;
        const w = code.slice(i, j);
        if (KW.has(w)) out.push(`<span class="tk-k">${w}</span>`);
        else if (code[j] === '(') out.push(`<span class="tk-f">${w}</span>`);
        else out.push(esc(w));
        i = j; continue;
      }
      out.push(esc(ch)); i++;
    }
    return out.join('');
  }

  /* ---------- views ---------- */
  let curId = null;
  const main = $('#main');

  function legendHTML(legend) {
    if (!legend || !legend.length) return '';
    const col = (c) => ({ acc: 'var(--acc)', a: 'var(--acc)', b: 'var(--blue)', g: 'var(--green)', y: 'var(--gold)', ink: 'var(--ink)', mute: 'var(--ink-3)' }[c] || c);
    return `<div class="legend">${legend.map((l) => `<span><i style="background:${col(l.c)}"></i>${esc(legendText(l.t))}</span>`).join('')}</div>`;
  }

  function ctlHTML(ctl, vals) {
    if (!ctl || !ctl.length) return '';
    const c = ctl[0]; const v = vals[c.key] != null ? vals[c.key] : c.value;
    if (c.options) {
      return `<div class="ctlrow"><label for="ctl0">${esc(c.label || c.key)}</label><select id="ctl0">${c.options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label || o.value)}</option>`).join('')}</select></div>`;
    }
    return `<div class="ctlrow"><label for="ctl0">${esc(c.label || c.key)}</label><input id="ctl0" type="range" min="${c.min}" max="${c.max}" step="${c.step || 'any'}" value="${v}"><output id="ctl0o">${fmt(v, c.step)}</output></div>`;
  }
  function fmt(v, step) {
    const d = step ? Math.max(0, Math.min(3, (String(step).split('.')[1] || '').length)) : 2;
    return Number(v).toFixed(d);
  }

  function mountStage(host, item, metaHost, so) {
    ensureStage();
    host.appendChild(canvas);
    const onControls = (ctl, vals, set) => {
      const box = metaHost.querySelector('.ctlslot');
      if (!box) return;
      box.innerHTML = ctlHTML(ctl, vals);
      const el = box.querySelector('#ctl0');
      if (!el) return;
      const c = ctl[0];
      let pending = null;
      el.addEventListener(c.options ? 'change' : 'input', () => {
        const val = c.options ? (isNaN(+el.value) ? el.value : +el.value) : +el.value;
        const o = box.querySelector('#ctl0o'); if (o) o.textContent = fmt(val, c.step);
        if (pending) cancelAnimationFrame(pending);
        pending = requestAnimationFrame(() => set(c.key, val));
      });
    };
    onControls.after = (built) => { const lg = metaHost.querySelector('.legendslot'); if (lg) lg.innerHTML = legendHTML(built.legend); };
    const built = stage.show({ id: item.id, type: item.type, params: item.params }, onControls, so);
    const lg = metaHost.querySelector('.legendslot'); if (lg) lg.innerHTML = legendHTML(built && built.legend);
    stage.resume();
  }

  function renderHome() {
    curId = 'home';
    document.title = 'Latent Atlas';
    const f = BYID[FEATURED];
    main.innerHTML = `<section class="home fade">
      <div class="homehead">
        <div>
          <h1>${esc(t('brand'))}</h1>
          <p class="lead">${esc(t('lead'))}</p>
          <div class="stats"><div><b>${ITEMS.length}</b>${esc(t('statConcepts'))}</div><div><b>${CATS.length}</b>${esc(t('statChapters'))}</div><div><b>${LANGS.length}</b>${esc(t('statLanguages'))}</div></div>
          <a class="cta" href="#${CATS[0].items[0].id}">${esc(t('start'))}</a>
        </div>
        <figure class="feat" style="margin:0">
          <div class="stage" id="stageHost"></div>
          <figcaption><span>${esc(t('featured'))}</span><a href="#${f.id}">${esc(nm(f.id))}</a></figcaption>
          <div class="sr"><span class="legendslot"></span><span class="ctlslot"></span></div>
        </figure>
      </div>
      <section class="herosearch" aria-label="${esc(t('searchShort'))}"><div id="heroField"></div><div id="heroRes" class="sx-res" aria-live="polite"></div></section>
      <section class="toc" aria-labelledby="tocH">
        <h2 id="tocH">${esc(t('chapters'))}</h2>
        ${CATS.map((c) => `<div class="tocrow"><span class="no">${c.no}</span><h3>${esc(catName(c.id))}<small>${c.items.length} ${esc(t('statConcepts'))}</small></h3>
          <div class="list">${c.items.map((x) => `<a href="#${x.id}">${esc(nm(x.id))}</a>`).join('')}</div></div>`).join('')}
      </section>
      <footer>${esc(t('footer'))}</footer>
    </section>`;
    mountStage($('#stageHost'), f, main.querySelector('.feat'), { fit: 0.62 });
    const toc = main.querySelector('.toc');
    makeSearch($('#heroField'), null, { onResults(v, res) {
      const on = !!v.trim();
      if (!$('#heroRes')) return;
      $('#heroRes').innerHTML = on ? resultsHTML(v, res, 80) : '';
      toc.hidden = on;
    } });
    renderRail();
    window.scrollTo(0, 0);
  }

  function renderConcept(id) {
    const it = BYID[id];
    curId = id;
    const c = CATBY[it.cat];
    const pos = c.items.indexOf(it) + 1;
    const prev = ITEMS[(it.i - 1 + ITEMS.length) % ITEMS.length], next = ITEMS[(it.i + 1) % ITEMS.length];
    const full = nm(id), en = enName(id);
    // big title: drop a trailing Latin-script gloss like "(Random Forest)"; the English term is shown underneath anyway
    let name = full;
    const mm = lang !== 'en' && full.match(/^(.+?)\s*[(\uFF08]([^()\uFF08\uFF09]+)[)\uFF09]\s*$/);
    if (mm && /[A-Za-z]/.test(mm[2]) && !/[^\x00-\x7F\u2010-\u2015\u00B2\u00C0-\u017F]/.test(mm[2]) && /[^\x00-\x7F]/.test(mm[1])) name = mm[1];
    const d = field(id, 'd'), u = field(id, 'u') || [], x = field(id, 'x');
    const f = BASE.f[id], code = BASE.c[id];
    document.title = name + ' — Latent Atlas';
    const paras = d ? d.split(/\n\s*\n/).map((p) => `<p>${esc(p)}</p>`).join('') : `<p class="skel">${esc(t('loading'))}</p>`;
    const usesList = u.length ? `<ul class="uses">${u.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '';
    const plus = '<span class="pm" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.3"/></svg></span>';
    main.innerHTML = `<article class="fade" aria-labelledby="cname">
      <div class="stagewrap">
        <div class="stagebox">
          <div class="stage" id="stageHost" role="img" aria-label="${esc(name)}"></div>
          <div class="zoombar" role="group" aria-label="${esc(t('zoom'))}">
            <button type="button" id="zoomIn" aria-label="${esc(t('zoomIn'))}"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.4"/></svg></button>
            <input type="range" id="zoom" min="0.5" max="2.5" step="0.01" value="1" aria-label="${esc(t('zoom'))}">
            <button type="button" id="zoomOut" aria-label="${esc(t('zoomOut'))}"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h10" stroke="currentColor" stroke-width="1.4"/></svg></button>
          </div>
        </div>
        <div class="stagemeta"><span class="legendslot"></span><span class="sp"></span><span class="hint">${esc(t('dragHint'))}</span><button class="linkbtn" type="button" id="resetV">${esc(t('resetView'))}</button></div>
        <div class="ctlslot"></div>
      </div>
      <div class="crumb"><button type="button" id="crumbCat">${esc(t('chapter', { n: c.no }))}, ${esc(catName(c.id))}</button><span class="pos">${esc(t('conceptOf', { i: pos, n: c.items.length }))}</span></div>
      <h1 class="name" id="cname">${esc(name)}</h1>
      ${lang !== 'en' && en !== name ? `<p class="term" lang="en">${esc(en)}</p>` : ''}
      <div class="body">
        <div class="prose">${paras}</div>
        <aside class="aside">
          ${f ? `<div><h3>${esc(t('formula'))}</h3><p class="formula" dir="ltr">${esc(f)}</p></div>` : ''}
        </aside>
      </div>
      <div class="accs">
        ${usesList ? `<details class="acc"><summary>${esc(t('useCases'))}<span class="sm">${u.length}</span>${plus}</summary><div class="in">${usesList}</div></details>` : ''}
        ${x ? `<details class="acc"><summary>${esc(t('industry'))}${plus}</summary><div class="in"><p>${esc(x)}</p></div></details>` : ''}
        ${code ? `<details class="acc"><summary>${esc(t('code'))}<span class="sm">Python</span>${plus}</summary><div class="in"><div class="code"><button class="cp" type="button">${esc(t('copy'))}</button><pre><code>${hl(code)}</code></pre></div></div></details>` : ''}
      </div>
      <nav class="pn" aria-label="${esc(t('prev'))} / ${esc(t('next'))}">
        <a href="#${prev.id}" rel="prev"><small>${esc(t('prev'))}</small><span>${esc(nm(prev.id))}</span></a>
        <a href="#${next.id}" rel="next"><small>${esc(t('next'))}</small><span>${esc(nm(next.id))}</span></a>
      </nav>
      <p class="keys hide-sm">${esc(t('keys'))}</p>
    </article>`;
    mountStage($('#stageHost'), it, main.querySelector('.stagewrap'));
    const zoom = $('#zoom');
    const setZoom = (z) => { stage.setZoom(z); zoom.value = stage.getZoom(); };
    zoom.addEventListener('input', () => stage.setZoom(+zoom.value));
    $('#zoomIn').addEventListener('click', () => setZoom(stage.getZoom() + 0.25));
    $('#zoomOut').addEventListener('click', () => setZoom(stage.getZoom() - 0.25));
    $('#resetV').addEventListener('click', () => { stage.resetView(); zoom.value = 1; });
    $('#crumbCat').addEventListener('click', () => { openCat = it.cat; openIndex(catName(it.cat), true); });
    const cp = main.querySelector('.cp');
    if (cp) cp.addEventListener('click', () => {
      const done = () => { cp.textContent = t('copied'); setTimeout(() => { cp.textContent = t('copy'); }, 1600); };
      const sel = () => { const r = document.createRange(); r.selectNodeContents(main.querySelector('pre')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
      try { navigator.clipboard.writeText(code).then(done, sel); } catch (e) { sel(); }
    });
    renderRail(id);
  }

  function route(keepScroll) {
    const h = decodeURIComponent((location.hash || '').slice(1));
    if (h && BYID[h]) {
      const same = curId === h;
      renderConcept(h);
      if (!keepScroll || !same) window.scrollTo(0, 0);
    } else renderHome();
  }
  window.addEventListener('hashchange', () => { closeIndex(); route(false); });

  /* ---------- search: live results + autocomplete ---------- */
  const ix = $('#ix');
  let lastFocus = null;
  function norm(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').replace(/[\u2010-\u2015]/g, '-'); }
  const acronyms = (s) => {
    const out = [];
    String(s || '').replace(/[(（]([^()（）]+)[)）]/g, (m, a) => { a.split(/[,/]/).forEach((x) => out.push(x.trim())); return m; });
    (String(s).match(/\b[A-Z][A-Za-z0-9-]*[A-Z0-9][A-Za-z0-9-]*\b/g) || []).forEach((x) => out.push(x));
    return out.filter((x) => x && x.length > 1);
  };
  let SIX = null, SIXLANG = null;
  function searchIndex() {
    if (SIX && SIXLANG === lang + (D ? Object.keys(D.items).length : 0)) return SIX;
    SIXLANG = lang + (D ? Object.keys(D.items).length : 0);
    SIX = ITEMS.map((x) => {
      const n = nm(x.id), e = enName(x.id), d = field(x.id, 'd') || '', ed = (EN().items[x.id] && EN().items[x.id].d) || '';
      const names = [n, e, ...acronyms(n), ...acronyms(e), x.id];
      return { x, n, e, names, nn: names.map(norm), cat: norm(catName(x.cat)), d, nd: norm(d), ned: lang === 'en' ? '' : norm(ed) };
    });
    return SIX;
  }
  function scoreOne(r, q) {
    let best = 0;
    for (const s of r.nn) {
      if (!s) continue;
      if (s === q) best = Math.max(best, 100);
      else if (s.startsWith(q)) best = Math.max(best, 80 - Math.min(20, s.length - q.length) * 0.5);
      else if (new RegExp('(^|[\\s(/\\-])' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(s)) best = Math.max(best, 62);
      else if (s.includes(q)) best = Math.max(best, 44);
    }
    if (!best && r.cat.includes(q)) best = 18;
    if (!best && (r.nd.includes(q) || r.ned.includes(q))) best = 8 + Math.min(6, r.nd.split(q).length - 1);
    return best;
  }
  function runSearch(raw) {
    const q = norm(raw.trim());
    if (!q) return [];
    const toks = q.split(/\s+/).filter(Boolean);
    const out = [];
    for (const r of searchIndex()) {
      let sc = scoreOne(r, q);
      if (!sc && toks.length > 1) {
        let all = 0, ok = true;
        for (const tk of toks) { const v = scoreOne(r, tk); if (!v) { ok = false; break; } all += v; }
        if (ok) sc = all / toks.length * 0.8;
      }
      if (sc) out.push({ r, sc });
    }
    out.sort((a, b) => b.sc - a.sc || a.r.x.i - b.r.x.i);
    return out;
  }
  function suggest(raw) {
    const q = norm(raw.trim());
    if (!q) return [];
    const seen = new Set(), out = [];
    for (const r of searchIndex()) {
      r.names.forEach((term, k) => {
        if (k === r.names.length - 1) return; // skip raw id
        const nt = r.nn[k]; if (!nt || seen.has(nt)) return;
        let sc = 0;
        if (nt.startsWith(q)) sc = 3; else if (new RegExp('(^|[\\s(/\\-])' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(nt)) sc = 2;
        if (!sc) return;
        seen.add(nt); out.push({ term, id: r.x.id, sc: sc + (k < 2 ? 0.5 : 0), len: term.length });
      });
    }
    out.sort((a, b) => b.sc - a.sc || a.len - b.len);
    return out.slice(0, 7);
  }
  function hlText(s, raw) {
    const q = norm(raw.trim()); const ns = norm(s);
    if (!q || ns.length !== s.length) return esc(s);
    const k = ns.indexOf(q); if (k < 0) return esc(s);
    return esc(s.slice(0, k)) + '<mark>' + esc(s.slice(k, k + q.length)) + '</mark>' + esc(s.slice(k + q.length));
  }
  function snippet(d, raw) {
    if (!d) return '';
    const first = d.split(/\n\s*\n/)[0];
    const q = norm(raw.trim()); const nd = norm(d);
    const k = q ? nd.indexOf(q) : -1;
    if (k > 140 && nd.length === d.length) { const a = Math.max(0, k - 60); return '…' + hlText(d.slice(a, a + 180), raw) + '…'; }
    const s = first.length > 180 ? first.slice(0, 178).replace(/\s+\S*$/, '') + '…' : first;
    return hlText(s, raw);
  }
  function resultsHTML(raw, list, limit) {
    if (!list.length) return `<p class="sx-empty">${esc(t('noResults', { q: raw.trim() }))}</p>`;
    return `<p class="sx-count">${esc(t('resultsCount', { n: list.length }))}</p><ol class="sx-list">${list.slice(0, limit).map(({ r }) => `
      <li><a href="#${r.x.id}" class="sx-row"><span class="sx-ch">${esc(catName(r.x.cat))}</span>
        <span class="sx-nm">${hlText(r.n, raw)}${lang !== 'en' && r.e !== r.n ? ` <small lang="en">${hlText(r.e, raw)}</small>` : ''}</span>
        <span class="sx-sn">${snippet(r.d, raw)}</span></a></li>`).join('')}</ol>`;
  }

  /* one search component: field + autocomplete listbox; results go to a host element */
  let sxCount = 0;
  function makeSearch(host, resHost, opts = {}) {
    const k = ++sxCount;
    host.innerHTML = `<div class="sx">
      <div class="sx-field"><svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="m11 11 3.5 3.5" stroke="currentColor" stroke-width="1.3"/></svg>
        <input id="sx${k}" type="search" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="sxl${k}" placeholder="${esc(t('searchHero'))}">
        <button type="button" class="sx-clear" aria-label="${esc(t('close'))}" hidden>×</button></div>
      <ul class="sx-sug" id="sxl${k}" role="listbox" hidden></ul></div>`;
    const input = host.querySelector('input'), list = host.querySelector('.sx-sug'), clr = host.querySelector('.sx-clear');
    let sug = [], act = -1;
    function paintSug() {
      if (!sug.length || document.activeElement !== input) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
      list.innerHTML = sug.map((s, i) => `<li role="option" id="sxo${k}-${i}" aria-selected="${i === act}" data-i="${i}"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="m11 11 3.5 3.5" stroke="currentColor" stroke-width="1.3"/></svg><span>${hlText(s.term, input.value)}</span><small>${esc(catName(BYID[s.id].cat))}</small></li>`).join('');
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
      input.setAttribute('aria-activedescendant', act >= 0 ? `sxo${k}-${act}` : '');
    }
    function update() {
      const v = input.value;
      clr.hidden = !v;
      sug = suggest(v); act = -1; paintSug();
      const res = runSearch(v);
      if (opts.onResults) opts.onResults(v, res);
      else if (resHost) resHost.innerHTML = v.trim() ? resultsHTML(v, res, 80) : '';
    }
    let tmr = 0;
    input.addEventListener('input', () => { cancelAnimationFrame(tmr); tmr = requestAnimationFrame(update); });
    input.addEventListener('focus', () => paintSug());
    input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); }, 120));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' && sug.length) { e.preventDefault(); act = (act + 1) % sug.length; paintSug(); }
      else if (e.key === 'ArrowUp' && sug.length) { e.preventDefault(); act = act <= 0 ? sug.length - 1 : act - 1; paintSug(); }
      else if ((e.key === 'Tab' || e.key === 'ArrowRight') && sug.length && input.selectionStart === input.value.length && !e.shiftKey) {
        const s = sug[act >= 0 ? act : 0]; if (norm(s.term) !== norm(input.value)) { e.preventDefault(); input.value = s.term; update(); }
      }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (act >= 0 && sug[act]) { location.hash = sug[act].id; return; }
        const res = runSearch(input.value); if (res.length) location.hash = res[0].r.x.id;
      }
      else if (e.key === 'Escape' && !list.hidden) { e.stopPropagation(); list.hidden = true; }
    });
    list.addEventListener('mousedown', (e) => { const li = e.target.closest('li'); if (!li) return; e.preventDefault(); location.hash = sug[+li.dataset.i].id; });
    clr.addEventListener('click', () => { input.value = ''; update(); input.focus(); });
    return { input, update, set(v) { input.value = v; update(); } };
  }

  function fullIndexHTML() {
    return `<div class="ix-grid">${CATS.map((c) => `<section class="ix-sec"><h3>${esc(catName(c.id))}<span>${c.no}</span></h3>${c.items.map((x) => {
      const n = nm(x.id), e = enName(x.id);
      return `<a href="#${x.id}">${esc(n)}${lang !== 'en' && e !== n ? `<small lang="en">${esc(e)}</small>` : ''}</a>`;
    }).join('')}</section>`).join('')}</div>`;
  }
  let ixSearch = null;
  function openIndex(prefill, chapterOnly) {
    lastFocus = document.activeElement;
    ix.hidden = false; document.body.style.overflow = 'hidden';
    ixSearch = makeSearch($('#ixField'), null, { onResults(v, res) { if (ix.hidden) return; $('#ixBody').innerHTML = v.trim() ? `<div class="ix-res">${resultsHTML(v, res, 120)}</div>` : fullIndexHTML(); } });
    ixSearch.set(chapterOnly ? '' : (prefill || ''));
    if (chapterOnly && prefill) {
      const h = [...ix.querySelectorAll('.ix-sec h3')].find((x) => x.textContent.startsWith(prefill));
      if (h) h.scrollIntoView({ block: 'start' });
    }
    setTimeout(() => ixSearch.input.focus(), 30);
  }
  function closeIndex() { if (ix.hidden) return; ix.hidden = true; document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  $('#openIndex').addEventListener('click', () => openIndex(''));
  $('#closeIx').addEventListener('click', closeIndex);

  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '');
    if (e.key === 'Escape') { closeIndex(); closeLang(); return; }
    if (typing) return;
    if ((e.key === '/' || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)))) { e.preventDefault(); openIndex(''); return; }
    if (!ix.hidden || !curId || curId === 'home') return;
    const it = BYID[curId];
    const rtl = document.documentElement.dir === 'rtl';
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const fwd = (e.key === 'ArrowRight') !== rtl;
      const nx = ITEMS[(it.i + (fwd ? 1 : -1) + ITEMS.length) % ITEMS.length];
      location.hash = nx.id;
    }
  });

  const bar = $('#bar');
  window.addEventListener('scroll', () => bar.classList.toggle('scrolled', window.scrollY > 8), { passive: true });
  document.addEventListener('visibilitychange', () => { if (!stage) return; document.hidden ? stage.pause() : stage.resume(); });

  /* ---------- boot ---------- */
  const first = detectLang();
  setLang(first, false).then(() => route(false));
  route(false); // render immediately with registry names while text loads
})();
