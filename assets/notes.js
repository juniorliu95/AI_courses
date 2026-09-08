/* ============================================================
   AI Course Notes — shared behaviour
   Auto-runs on any page that uses the templates.
   ============================================================ */
(function () {
  'use strict';
  var doc = document;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };

  /* ---------- Theme ---------- */
  var THEME_KEY = 'notes-theme';
  function currentTheme() {
    return doc.documentElement.dataset.theme ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function setTheme(t) {
    doc.documentElement.dataset.theme = t;
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    $$('[data-theme-toggle]').forEach(function (b) {
      b.textContent = t === 'dark' ? '☀' : '☾';
      b.setAttribute('aria-label', 'Switch to ' + (t === 'dark' ? 'light' : 'dark') + ' theme');
    });
  }
  function initTheme() {
    setTheme(currentTheme());
    $$('[data-theme-toggle]').forEach(function (b) {
      b.addEventListener('click', function () { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); });
    });
  }

  /* ---------- Slugify + heading anchors + TOC ---------- */
  function slug(s) {
    return s.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || 'section';
  }
  function buildToc() {
    var content = $('#content');
    var toc = $('#toc');
    if (!content) return [];
    var heads = $$('h2, h3', content).filter(function (h) { return !h.closest('.no-toc'); });
    var used = {};
    heads.forEach(function (h) {
      if (!h.id) {
        var base = slug(h.textContent);
        used[base] = (used[base] || 0) + 1;
        h.id = used[base] > 1 ? base + '-' + used[base] : base;
      }
      var a = doc.createElement('a');
      a.className = 'anchor'; a.href = '#' + h.id; a.textContent = '#';
      a.setAttribute('aria-label', 'Link to this section');
      h.appendChild(a);
    });
    if (!toc) return heads;
    if (!heads.length) { toc.innerHTML = ''; return heads; }
    var ul = doc.createElement('ul');
    heads.forEach(function (h) {
      var li = doc.createElement('li');
      li.className = 'toc-' + h.tagName.toLowerCase();
      var a = doc.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.replace(/#$/, '').trim();
      a.dataset.target = h.id;
      li.appendChild(a); ul.appendChild(li);
    });
    toc.innerHTML = '';
    toc.appendChild(ul);
    return heads;
  }

  /* ---------- Scroll spy ---------- */
  function initSpy(heads) {
    var links = $$('#toc a');
    if (!links.length || !heads.length) return;
    var map = {};
    links.forEach(function (a) { map[a.dataset.target] = a; });
    var visible = {};
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      var active = null;
      for (var i = 0; i < heads.length; i++) {
        if (visible[heads[i].id]) { active = heads[i].id; break; }
      }
      if (!active) {
        for (var j = heads.length - 1; j >= 0; j--) {
          if (heads[j].getBoundingClientRect().top < 120) { active = heads[j].id; break; }
        }
      }
      links.forEach(function (a) { a.classList.toggle('is-active', a.dataset.target === active); });
    }, { rootMargin: '-70px 0px -65% 0px', threshold: 0 });
    heads.forEach(function (h) { obs.observe(h); });
  }

  /* ---------- Code blocks: language label + copy ---------- */
  function initCode() {
    $$('pre > code').forEach(function (code) {
      var pre = code.parentNode;
      if (pre.parentNode.classList.contains('codeblock')) return;
      var wrap = doc.createElement('div');
      wrap.className = 'codeblock';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      var lang = (code.className.match(/language-([\w+#-]+)/) || [])[1];
      if (lang) {
        var tag = doc.createElement('span');
        tag.className = 'codeblock__lang'; tag.textContent = lang;
        wrap.appendChild(tag);
      }
      var btn = doc.createElement('button');
      btn.className = 'copybtn'; btn.type = 'button'; btn.textContent = 'Copy';
      btn.addEventListener('click', function () {
        var txt = code.textContent;
        var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1400); };
        if (navigator.clipboard) { navigator.clipboard.writeText(txt).then(done, done); }
        else {
          var ta = doc.createElement('textarea'); ta.value = txt; doc.body.appendChild(ta);
          ta.select(); try { doc.execCommand('copy'); } catch (e) {} doc.body.removeChild(ta); done();
        }
      });
      wrap.appendChild(btn);
    });
    if (window.hljs) {
      $$('pre code').forEach(function (c) { try { window.hljs.highlightElement(c); } catch (e) {} });
    }
  }

  /* ---------- Math ---------- */
  function initMath() {
    if (!window.renderMathInElement) return;
    window.renderMathInElement(doc.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$', right: '$', display: false }
      ],
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'],
      throwOnError: false
    });
  }

  /* ---------- Reading progress ---------- */
  function initProgress() {
    var bar = $('#progressBar');
    if (!bar) return;
    var tick = function () {
      var h = doc.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    };
    doc.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
    tick();
  }

  /* ---------- Mobile sidebar ---------- */
  function initSidebar() {
    var btn = $('[data-sidebar-toggle]');
    var sb = $('#sidebar');
    if (!btn || !sb) return;
    btn.addEventListener('click', function (e) { e.stopPropagation(); sb.classList.toggle('is-open'); });
    sb.addEventListener('click', function (e) { if (e.target.tagName === 'A') sb.classList.remove('is-open'); });
    doc.addEventListener('click', function (e) {
      if (sb.classList.contains('is-open') && !sb.contains(e.target)) sb.classList.remove('is-open');
    });
  }

  /* ---------- Filter (index + course pages) ---------- */
  function initFilter() {
    var input = $('#filter');
    if (!input) return;
    var items = $$('[data-searchable]');
    var count = $('#filterCount');
    var total = items.length;
    var apply = function () {
      var q = input.value.trim().toLowerCase();
      var n = 0;
      items.forEach(function (el) {
        var hit = !q || (el.dataset.searchable || el.textContent).toLowerCase().indexOf(q) > -1;
        el.classList.toggle('is-hidden', !hit);
        if (hit) n++;
      });
      if (count) count.textContent = q ? n + ' of ' + total + ' shown' : total + ' total';
    };
    input.addEventListener('input', apply);
    apply();
    doc.addEventListener('keydown', function (e) {
      if (e.key === '/' && doc.activeElement !== input && !/input|textarea/i.test(doc.activeElement.tagName)) {
        e.preventDefault(); input.focus(); input.select();
      }
      if (e.key === 'Escape' && doc.activeElement === input) { input.value = ''; apply(); input.blur(); }
    });
  }

  /* ---------- Keyboard nav: j/k prev-next lecture, t theme ---------- */
  function initKeys() {
    doc.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/input|textarea|select/i.test(doc.activeElement.tagName)) return;
      if (e.key === 't') setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
      if (e.key === 'ArrowRight' || e.key === 'n') { var nx = $('.pager a.next:not(.empty)'); if (nx) nx.click(); }
      if (e.key === 'ArrowLeft' || e.key === 'p') { var pv = $('.pager a.prev:not(.empty)'); if (pv) pv.click(); }
    });
  }

  /* ---------- Tables get a scroll wrapper ---------- */
  function initTables() {
    $$('.content > table').forEach(function (t) {
      var w = doc.createElement('div'); w.className = 'table-wrap';
      t.parentNode.insertBefore(w, t); w.appendChild(t);
    });
  }

  function boot() {
    initTheme();
    initTables();
    initCode();
    var heads = buildToc();
    initSpy(heads);
    initProgress();
    initSidebar();
    initFilter();
    initKeys();
    initMath();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
