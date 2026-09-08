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
      if (lb && lb.isOpen()) return;
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

  /* ---------- Image lightbox: click to open at 1:1, drag to pan, wheel to zoom ---------- */
  var lb = null;

  function buildLightbox() {
    var el = doc.createElement('div');
    el.className = 'lightbox';
    el.innerHTML =
      '<div class="lightbox__stage"><img class="lightbox__img" alt=""></div>' +
      '<div class="lightbox__bar">' +
        '<span class="lightbox__title"></span>' +
        '<button class="iconbtn" data-lb="out" aria-label="Zoom out">−</button>' +
        '<span class="lightbox__zoom">100%</span>' +
        '<button class="iconbtn" data-lb="in" aria-label="Zoom in">+</button>' +
        '<button class="iconbtn" data-lb="fit" aria-label="Fit to screen">Fit</button>' +
        '<button class="iconbtn" data-lb="reset" aria-label="Original size">1:1</button>' +
        '<button class="iconbtn" data-lb="close" aria-label="Close">✕</button>' +
      '</div>' +
      '<div class="lightbox__hint">drag to pan · scroll to zoom · double-click to fit · esc to close</div>';
    doc.body.appendChild(el);

    var stage = $('.lightbox__stage', el);
    var img = $('.lightbox__img', el);
    var zoomLabel = $('.lightbox__zoom', el);
    var title = $('.lightbox__title', el);
    var hint = $('.lightbox__hint', el);

    var st = { scale: 1, x: 0, y: 0, nw: 0, nh: 0 };
    var pointers = {};       // active pointers, for drag + pinch
    var pinchStart = null;
    var moved = false;
    var hintTimer = null;

    function apply() {
      img.style.transform = 'translate(' + st.x + 'px,' + st.y + 'px) scale(' + st.scale + ')';
      zoomLabel.textContent = Math.round(st.scale * 100) + '%';
    }
    function clampScale(v) { return Math.min(24, Math.max(0.05, v)); }

    function fitScale() {
      if (!st.nw || !st.nh) return 1;
      var pad = 72;
      return Math.min(1, Math.min(
        (window.innerWidth - pad) / st.nw,
        (window.innerHeight - pad) / st.nh
      ));
    }
    function center(scale) {
      st.scale = scale;
      st.x = (window.innerWidth - st.nw * scale) / 2;
      st.y = (window.innerHeight - st.nh * scale) / 2;
      apply();
    }
    // zoom keeping the point under the cursor fixed
    function zoomAt(cx, cy, factor) {
      var next = clampScale(st.scale * factor);
      var k = next / st.scale;
      st.x = cx - (cx - st.x) * k;
      st.y = cy - (cy - st.y) * k;
      st.scale = next;
      apply();
    }

    function open(src, label) {
      title.textContent = label || '';
      img.alt = label || '';
      img.src = src;
      el.classList.add('is-open');
      doc.body.style.overflow = 'hidden';
      hint.classList.remove('is-faded');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(function () { hint.classList.add('is-faded'); }, 2600);
      var start = function () {
        st.nw = img.naturalWidth || img.width;
        st.nh = img.naturalHeight || img.height;
        center(1); // open at original size, as asked
      };
      if (img.complete && img.naturalWidth) start();
      else img.onload = start;
    }
    function close() {
      el.classList.remove('is-open');
      doc.body.style.overflow = '';
      img.removeAttribute('src');
      pointers = {}; pinchStart = null;
      stage.classList.remove('is-panning');
    }

    /* --- wheel zoom (and trackpad pinch, which arrives as ctrlKey+wheel) --- */
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;       // lines -> px
      else if (e.deltaMode === 2) d *= 400; // pages -> px
      zoomAt(e.clientX, e.clientY, Math.exp(-d * 0.0022));
    }, { passive: false });

    /* --- drag to pan, two fingers to pinch --- */
    function ptrList() { return Object.keys(pointers).map(function (k) { return pointers[k]; }); }

    stage.addEventListener('pointerdown', function (e) {
      stage.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      moved = false;
      var p = ptrList();
      if (p.length === 2) {
        pinchStart = {
          dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y),
          scale: st.scale
        };
      }
      stage.classList.add('is-panning');
    });

    stage.addEventListener('pointermove', function (e) {
      var prev = pointers[e.pointerId];
      if (!prev) return;
      var dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) moved = true;

      var p = ptrList();
      if (p.length === 2 && pinchStart) {
        var dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        var mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
        if (pinchStart.dist > 0) {
          var target = clampScale(pinchStart.scale * (dist / pinchStart.dist));
          zoomAt(mx, my, target / st.scale);
        }
        return;
      }
      st.x += dx; st.y += dy;
      apply();
    });

    function release(e) {
      delete pointers[e.pointerId];
      if (ptrList().length < 2) pinchStart = null;
      if (!ptrList().length) stage.classList.remove('is-panning');
      // a click on the empty backdrop (not a drag, not the image) closes
      if (e.type === 'pointerup' && !moved && e.target === stage) close();
    }
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);

    stage.addEventListener('dblclick', function (e) {
      e.preventDefault();
      var f = fitScale();
      // toggle between fit and 1:1, zooming around the cursor when going to 1:1
      if (Math.abs(st.scale - 1) < 0.01) center(f);
      else zoomAt(e.clientX, e.clientY, 1 / st.scale);
    });

    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lb]');
      if (!b) return;
      var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      var act = b.dataset.lb;
      if (act === 'in') zoomAt(cx, cy, 1.25);
      else if (act === 'out') zoomAt(cx, cy, 0.8);
      else if (act === 'fit') center(fitScale());
      else if (act === 'reset') center(1);
      else if (act === 'close') close();
    });

    window.addEventListener('resize', function () { if (el.classList.contains('is-open')) apply(); });

    return { el: el, open: open, close: close, isOpen: function () { return el.classList.contains('is-open'); },
             zoomAt: zoomAt, center: center, fitScale: fitScale, state: st };
  }

  function initLightbox() {
    var imgs = $$('#content img, .page img').filter(function (i) { return !i.closest('.lightbox'); });
    if (!imgs.length) return;
    lb = lb || buildLightbox();
    imgs.forEach(function (i) {
      i.classList.add('is-zoomable');
      i.addEventListener('click', function (e) {
        e.preventDefault();
        var fig = i.closest('figure');
        var cap = fig && $('figcaption', fig);
        lb.open(i.currentSrc || i.src, i.alt || (cap ? cap.textContent.trim().slice(0, 140) : ''));
      });
      // a figure wrapped in a link (Notion exports do this) shouldn't navigate away
      var a = i.closest('a');
      if (a && a.getAttribute('href') === i.getAttribute('src')) {
        a.addEventListener('click', function (e) { e.preventDefault(); });
      }
    });
    doc.addEventListener('keydown', function (e) {
      if (!lb.isOpen()) return;
      var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      if (e.key === 'Escape') { e.preventDefault(); lb.close(); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); lb.zoomAt(cx, cy, 1.25); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); lb.zoomAt(cx, cy, 0.8); }
      else if (e.key === '0') { e.preventDefault(); lb.center(1); }
      else if (e.key === 'f') { e.preventDefault(); lb.center(lb.fitScale()); }
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
    initLightbox();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
