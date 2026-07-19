/* ============================================================
   Teaching Mode — Teacher Presentation Engine  (v1.0 / MVP)
   ------------------------------------------------------------
   Reusable, category-agnostic presentation engine.
   Works with any resource {id, title, type, url}:
     - type "pdf"   → PDF.js page-by-page canvas rendering
     - type "image" → single image slide
   (future: html slides can be added as another Source)

   Public API:
     Teaching.open({ id, title, type, url })
     Teaching.close()
     Teaching.isOpen()

   Requires: pdfjsLib already loaded (vendor/pdfjs/pdf.min.js)
   No downloads, no printing, no source URL exposed in the UI.
   ============================================================ */
window.Teaching = (function () {
  "use strict";

  /* ----------------------------------------------------------
     TeachingProgressManager — remembers last page per resource
     ---------------------------------------------------------- */
  const ProgressManager = {
    key(id) { return "orshq_teach_progress:" + id; },
    get(id) {
      try {
        const raw = localStorage.getItem(this.key(id));
        if (!raw) return null;
        const v = JSON.parse(raw);
        return (v && typeof v.page === "number") ? v : null;
      } catch (e) { return null; }
    },
    set(id, page) {
      try {
        localStorage.setItem(this.key(id), JSON.stringify({ page: page, ts: Date.now() }));
      } catch (e) { /* storage full / private mode — non fatal */ }
    }
  };

  /* ----------------------------------------------------------
     PdfSource — PDF.js adapter (loads the whole file up front
     so a signed URL expiring mid-lesson can never break class)
     ---------------------------------------------------------- */
  function PdfSource() {
    this.doc = null;
    this.numPages = 0;
    this._baseSizes = {};      // pageNum -> {w,h} at scale 1
  }
  PdfSource.prototype.load = async function (url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const buf = await resp.arrayBuffer();
    this.doc = await pdfjsLib.getDocument({ data: buf }).promise;
    this.numPages = this.doc.numPages;
  };
  PdfSource.prototype.pageSize = async function (n) {
    if (this._baseSizes[n]) return this._baseSizes[n];
    const page = await this.doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const s = { w: vp.width, h: vp.height };
    this._baseSizes[n] = s;
    return s;
  };
  /* renders page n at CSS scale `scale` (dpr handled internally) */
  PdfSource.prototype.render = async function (n, scale, dpr) {
    const page = await this.doc.getPage(n);
    const vp = page.getViewport({ scale: scale * dpr });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.style.width = Math.floor(vp.width / dpr) + "px";
    canvas.style.height = Math.floor(vp.height / dpr) + "px";
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    return canvas;
  };
  PdfSource.prototype.renderThumb = async function (n, widthPx) {
    const page = await this.doc.getPage(n);
    const vp1 = page.getViewport({ scale: 1 });
    const scale = widthPx / vp1.width;
    const vp = page.getViewport({ scale: scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    return canvas;
  };
  PdfSource.prototype.destroy = function () {
    if (this.doc) { try { this.doc.destroy(); } catch (e) {} }
    this.doc = null; this._baseSizes = {};
  };

  /* ----------------------------------------------------------
     ImageSetSource — multi-image deck adapter
     pages: [{url, label}] — each image is one slide; images are
     loaded lazily so a 50-page deck opens instantly
     ---------------------------------------------------------- */
  function ImageSetSource(pages) {
    this.pages = pages || [];
    this.numPages = this.pages.length;
    this._imgs = {};            // n -> HTMLImageElement (loaded)
    this._loading = {};         // n -> Promise
  }
  ImageSetSource.prototype._img = function (n) {
    if (this._imgs[n]) return Promise.resolve(this._imgs[n]);
    if (this._loading[n]) return this._loading[n];
    const self = this;
    this._loading[n] = new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { self._imgs[n] = img; delete self._loading[n]; resolve(img); };
      img.onerror = function () { delete self._loading[n]; reject(new Error("圖片載入失敗 (第 " + n + " 頁)")); };
      img.src = self.pages[n - 1].url;
    });
    return this._loading[n];
  };
  ImageSetSource.prototype.load = function () {
    if (!this.numPages) return Promise.reject(new Error("此組沒有圖片"));
    return this._img(1);        // open fast: only first slide up-front
  };
  ImageSetSource.prototype.pageSize = async function (n) {
    const img = await this._img(n);
    return { w: img.naturalWidth, h: img.naturalHeight };
  };
  ImageSetSource.prototype.render = async function (n, scale, dpr) {
    const img = await this._img(n);
    const w = Math.floor(img.naturalWidth * scale);
    const h = Math.floor(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  };
  ImageSetSource.prototype.renderThumb = async function (n, widthPx) {
    const img = await this._img(n);
    const scale = widthPx / img.naturalWidth;
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = Math.max(1, Math.floor(img.naturalHeight * scale));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  };
  ImageSetSource.prototype.destroy = function () { this._imgs = {}; this._loading = {}; };

  /* ----------------------------------------------------------
     ImageSource — single-slide image adapter
     ---------------------------------------------------------- */
  function ImageSource() {
    this.img = null;
    this.numPages = 1;
  }
  ImageSource.prototype.load = function (url) {
    const self = this;
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { self.img = img; resolve(); };
      img.onerror = function () { reject(new Error("圖片載入失敗")); };
      img.src = url;
    });
  };
  ImageSource.prototype.pageSize = async function () {
    return { w: this.img.naturalWidth, h: this.img.naturalHeight };
  };
  ImageSource.prototype.render = async function (n, scale, dpr) {
    const w = Math.floor(this.img.naturalWidth * scale);
    const h = Math.floor(this.img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    canvas.getContext("2d").drawImage(this.img, 0, 0, canvas.width, canvas.height);
    return canvas;
  };
  ImageSource.prototype.renderThumb = async function (n, widthPx) {
    const scale = widthPx / this.img.naturalWidth;
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = Math.floor(this.img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(this.img, 0, 0, canvas.width, canvas.height);
    return canvas;
  };
  ImageSource.prototype.destroy = function () { this.img = null; };

  /* ----------------------------------------------------------
     FullscreenController
     ---------------------------------------------------------- */
  const Fullscreen = {
    supported: function () {
      const el = document.documentElement;
      return !!(el.requestFullscreen || el.webkitRequestFullscreen);
    },
    isActive: function () {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    },
    enter: function (el) {
      if (el.requestFullscreen) return el.requestFullscreen();
      if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    },
    exit: function () {
      if (!this.isActive()) return;
      if (document.exitFullscreen) return document.exitFullscreen();
      if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    }
  };

  /* ----------------------------------------------------------
     TeachingPlayer — the controller
     ---------------------------------------------------------- */
  const ZOOM_STEP = 1.25, ZOOM_MAX = 4, ZOOM_MIN = 0.5;
  const THUMB_W = 176;          // css px
  const CACHE_LIMIT = 8;        // rendered full-size pages kept in memory

  const P = {
    root: null, el: {},
    src: null, res: null,
    page: 1, zoom: 1,           // zoom 1 == fit-to-screen
    fitScale: 1, dpr: 1,
    open: false,
    _cache: new Map(),          // pageNum -> {canvas, key}
    _cacheKey: "",              // invalidates cache on zoom/resize
    _seq: 0,                    // render race guard
    _thumbsBuilt: false,
    _thumbObserver: null,
    _loadingTimer: null,
    _resizeTimer: null,
    _toastTimer: null,

    /* ---------- DOM ---------- */
    buildDom: function () {
      if (this.root) return;
      const root = document.createElement("div");
      root.id = "teachView";
      root.className = "hidden";
      root.innerHTML =
        '<div class="tm-topbar">' +
          '<span class="tm-title" id="tmTitle"></span>' +
          '<button class="tm-btn" id="tmThumbBtn" title="頁面縮圖">🗂 縮圖</button>' +
          '<span class="tm-sep"></span>' +
          '<button class="tm-btn" id="tmZoomOut" title="縮小">−</button>' +
          '<button class="tm-btn" id="tmZoomReset" title="恢復原始比例">100%</button>' +
          '<button class="tm-btn" id="tmZoomIn" title="放大">＋</button>' +
          '<span class="tm-sep"></span>' +
          '<button class="tm-btn" id="tmFsBtn" title="全螢幕">⛶ 全螢幕</button>' +
          '<button class="tm-btn tm-btn-exit" id="tmExit">✕ 離開授課</button>' +
        '</div>' +
        '<div class="tm-main">' +
          '<div class="tm-thumbs hidden" id="tmThumbs"></div>' +
          '<div class="tm-stage" id="tmStage">' +
            '<div class="tm-canvas-wrap" id="tmWrap"></div>' +
            '<button class="tm-turn tm-turn-prev" id="tmTurnPrev" aria-label="上一頁">‹</button>' +
            '<button class="tm-turn tm-turn-next" id="tmTurnNext" aria-label="下一頁">›</button>' +
            '<div class="tm-loading hidden" id="tmLoading">' +
              '<div class="tm-spinner"></div><span id="tmLoadingText">教材載入中…</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="tm-bottombar">' +
          '<button class="tm-btn tm-nav-btn" id="tmPrev">‹ 上一頁</button>' +
          '<span class="tm-pageinfo">第 <input id="tmPageInput" type="text" inputmode="numeric" autocomplete="off"> / <span id="tmPageTotal">–</span> 頁</span>' +
          '<button class="tm-btn tm-nav-btn" id="tmNext">下一頁 ›</button>' +
        '</div>' +
        '<div class="tm-toast" id="tmToast"></div>' +
        '<div class="tm-hint" id="tmHint">👈 左右滑動翻頁　・　輕點畫面顯示工具列 👆</div>';
      document.body.appendChild(root);
      this.root = root;

      const ids = ["tmTitle","tmThumbBtn","tmZoomOut","tmZoomReset","tmZoomIn","tmFsBtn","tmExit",
                   "tmThumbs","tmStage","tmWrap","tmTurnPrev","tmTurnNext","tmLoading","tmLoadingText",
                   "tmPrev","tmNext","tmPageInput","tmPageTotal","tmToast"];
      const el = this.el;
      ids.forEach(function (i) { el[i] = document.getElementById(i); });

      /* protect content: no context menu inside teaching mode */
      root.addEventListener("contextmenu", function (e) { e.preventDefault(); });

      /* toolbar */
      el.tmExit.addEventListener("click", function () { Teaching.close(); });
      el.tmPrev.addEventListener("click", function () { P.prev(); });
      el.tmNext.addEventListener("click", function () { P.next(); });
      el.tmTurnPrev.addEventListener("click", function () { P.prev(); });
      el.tmTurnNext.addEventListener("click", function () { P.next(); });
      el.tmZoomIn.addEventListener("click", function () { P.setZoom(P.zoom * ZOOM_STEP); });
      el.tmZoomOut.addEventListener("click", function () { P.setZoom(P.zoom / ZOOM_STEP); });
      el.tmZoomReset.addEventListener("click", function () { P.setZoom(1); });
      el.tmThumbBtn.addEventListener("click", function () { P.toggleThumbs(); });

      /* fullscreen */
      if (Fullscreen.supported()) {
        el.tmFsBtn.addEventListener("click", function () {
          if (Fullscreen.isActive()) Fullscreen.exit();
          else Fullscreen.enter(P.root);
        });
        const onFsChange = function () {
          el.tmFsBtn.classList.toggle("tm-active", Fullscreen.isActive());
          el.tmFsBtn.innerHTML = Fullscreen.isActive() ? "⛶ 離開全螢幕" : "⛶ 全螢幕";
          /* page & zoom state live in JS — leaving fullscreen never resets them */
        };
        document.addEventListener("fullscreenchange", onFsChange);
        document.addEventListener("webkitfullscreenchange", onFsChange);
      } else {
        el.tmFsBtn.style.display = "none";
      }

      /* jump-to-page input */
      el.tmPageInput.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Enter") {
          const n = parseInt(el.tmPageInput.value, 10);
          if (n >= 1 && n <= P.src.numPages) P.goto(n);
          else P.toast("請輸入 1–" + P.src.numPages + " 的頁碼");
          el.tmPageInput.blur();
        }
      });
      el.tmPageInput.addEventListener("blur", function () { P.updatePageUi(); });

      /* keyboard */
      this._onKey = this.onKey.bind(this);

      /* touch swipe / pan (Pointer Events) */
      this.bindPointer();

      /* control bars auto-hide when idle.
         mouse: any movement wakes them (desktop habit)
         touch/pen (IWB): ONLY a clean tap toggles them — swiping to flip
         pages must never summon the toolbar */
      root.addEventListener("pointermove", function (e) {
        if (e.pointerType === "mouse") P.wakeBars();
      });
      root.addEventListener("pointerdown", function (e) {
        if (e.target.closest(".tm-topbar") || e.target.closest(".tm-bottombar")) P.wakeBars();
      });

      /* window resize → refit */
      this._onResize = function () {
        if (!P.open) return;
        clearTimeout(P._resizeTimer);
        P._resizeTimer = setTimeout(function () { P.refit(); }, 160);
      };
    },

    /* ---------- open / close ---------- */
    openResource: async function (res) {
      this.buildDom();
      if (this.open) this.teardownSource();

      this.res = res;
      this.page = 1; this.zoom = 1;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this._cache.clear(); this._cacheKey = ""; this._thumbsBuilt = false;
      this.el.tmThumbs.classList.add("hidden");
      this.el.tmThumbBtn.classList.remove("tm-active");
      this.el.tmWrap.innerHTML = "";
      this.el.tmTitle.textContent = res.title || "";
      this.el.tmPageTotal.textContent = "–";
      this.root.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      this.open = true;
      this.wakeBars();
      this.showLoading("教材載入中…");
      window.addEventListener("keydown", this._onKey, true);
      window.addEventListener("resize", this._onResize);

      try {
        if (res.type === "pdf") this.src = new PdfSource();
        else if (res.type === "imageset") this.src = new ImageSetSource(res.pages);
        else if (res.type === "image") this.src = new ImageSource();
        else throw new Error("此檔案格式（" + String(res.type).toUpperCase() + "）尚不支援授課模式");
        await this.src.load(res.url);
      } catch (err) {
        this.hideLoading();
        this.el.tmWrap.innerHTML =
          '<div style="color:#fff;text-align:center;font-size:16px;line-height:2;padding:40px;">' +
          '教材載入失敗，請關閉後重試。<br><span style="opacity:.65;font-size:14px;">' +
          String(err && err.message || err).replace(/[<>]/g, "") + "</span></div>";
        return;
      }

      this.el.tmPageTotal.textContent = this.src.numPages;
      const multi = this.src.numPages > 1;
      this.el.tmPrev.style.display = multi ? "" : "none";
      this.el.tmNext.style.display = multi ? "" : "none";
      this.el.tmTurnPrev.style.display = multi ? "" : "none";
      this.el.tmTurnNext.style.display = multi ? "" : "none";
      this.el.tmThumbBtn.style.display = multi ? "" : "none";

      /* start position: an explicitly clicked slide (startAt) wins;
         otherwise offer to resume from the saved position */
      const saved = ProgressManager.get(res.id);
      let startPage = 1;
      if (res.startAt && res.startAt > 1 && res.startAt <= this.src.numPages) {
        startPage = res.startAt;
      } else if (saved && saved.page > 1 && saved.page <= this.src.numPages) {
        startPage = saved.page;
        this.showResumeDialog(saved.page);
      }
      this.page = startPage;
      this.hideLoading();
      await this.refit();

      /* brief touch hint so IWB teachers know the two gestures */
      const hint = document.getElementById("tmHint");
      if (hint && this.src.numPages > 1) {
        hint.classList.add("tm-show");
        clearTimeout(this._hintTimer);
        this._hintTimer = setTimeout(function () { hint.classList.remove("tm-show"); }, 3200);
      }
    },

    close: function () {
      if (!this.open) return;
      if (this.res && this.src && this.src.numPages) ProgressManager.set(this.res.id, this.page);
      if (Fullscreen.isActive()) Fullscreen.exit();
      clearTimeout(this._idleTimer);
      this.root.classList.remove("tm-idle");
      window.removeEventListener("keydown", this._onKey, true);
      window.removeEventListener("resize", this._onResize);
      this.teardownSource();
      this.root.classList.add("hidden");
      document.body.style.overflow = "";
      this.open = false;
    },

    teardownSource: function () {
      if (this.src) { this.src.destroy(); this.src = null; }
      this._cache.clear();
      if (this._thumbObserver) { this._thumbObserver.disconnect(); this._thumbObserver = null; }
      this.el.tmThumbs.innerHTML = "";
      this.el.tmWrap.innerHTML = "";
      const d = this.root.querySelector(".tm-resume"); if (d) d.remove();
    },

    /* ---------- resume dialog ---------- */
    showResumeDialog: function (savedPage) {
      const dlg = document.createElement("div");
      dlg.className = "tm-resume";
      dlg.innerHTML =
        '<div class="tm-resume-card">' +
          '<h3>上次授課到第 ' + savedPage + ' 頁</h3>' +
          '<p>要從上次的進度繼續嗎？</p>' +
          '<button class="tm-btn tm-btn-gold" id="tmResumeGo">▶ 繼續上次進度</button>' +
          '<button class="tm-btn" id="tmResumeRestart">從第一頁開始</button>' +
        '</div>';
      this.root.appendChild(dlg);
      dlg.querySelector("#tmResumeGo").addEventListener("click", function () {
        dlg.remove();
      });
      dlg.querySelector("#tmResumeRestart").addEventListener("click", function () {
        dlg.remove(); P.goto(1);
      });
    },

    /* ---------- layout / rendering ---------- */
    stageSize: function () {
      const r = this.el.tmStage.getBoundingClientRect();
      /* edge-to-edge: the slide may use the entire stage */
      return { w: Math.max(60, r.width), h: Math.max(60, r.height) };
    },

    /* ---------- control bars: wake / auto-hide ---------- */
    wakeBars: function () {
      this.root.classList.remove("tm-idle");
      clearTimeout(this._idleTimer);
      const self = this;
      this._idleTimer = setTimeout(function () {
        if (self.open) self.root.classList.add("tm-idle");
      }, 3500);
    },
    hideBars: function () {
      clearTimeout(this._idleTimer);
      this.root.classList.add("tm-idle");
    },
    toggleBars: function () {
      if (this.root.classList.contains("tm-idle")) this.wakeBars();
      else this.hideBars();
    },

    refit: async function () {
      if (!this.src) return;
      this._cache.clear();   // stage size changed — re-render at new fit
      await this.show(this.page, true);
    },

    /* fit-to-stage scale for page n — computed per page so image decks
       with mixed page sizes are each fully visible (never cropped) */
    fitFor: async function (n) {
      const size = await this.src.pageSize(n);
      const st = this.stageSize();
      return Math.min(st.w / size.w, st.h / size.h);
    },

    getRendered: async function (n) {
      const fit = await this.fitFor(n);
      const key = fit.toFixed(4) + "@" + this.zoom.toFixed(3) + "x" + this.dpr;
      const hit = this._cache.get(n);
      if (hit && hit.key === key) return hit.canvas;
      const canvas = await this.src.render(n, fit * this.zoom, this.dpr);
      this._cache.set(n, { canvas: canvas, key: key });
      /* simple LRU-ish trim */
      if (this._cache.size > CACHE_LIMIT) {
        const first = this._cache.keys().next().value;
        this._cache.delete(first);
      }
      return canvas;
    },

    show: async function (n, force) {
      if (!this.src) return;
      if (!force && n === this.page && this.el.tmWrap.firstChild) return;
      this.page = n;
      this.updatePageUi();
      const seq = ++this._seq;

      /* show spinner only if rendering takes noticeably long */
      clearTimeout(this._loadingTimer);
      this._loadingTimer = setTimeout(function () {
        if (P._seq === seq) P.showLoading("頁面準備中…");
      }, 220);

      let canvas;
      try { canvas = await this.getRendered(n); }
      catch (e) { if (this._seq === seq) { this.hideLoading(); this.toast("此頁渲染失敗"); } return; }
      if (this._seq !== seq) return;      // user already flipped elsewhere

      clearTimeout(this._loadingTimer);
      this.hideLoading();
      this.el.tmWrap.innerHTML = "";
      this.el.tmWrap.appendChild(canvas);
      this.el.tmStage.classList.toggle("tm-zoomed", this.zoom > 1.001);
      this.updateZoomUi();
      this.updateThumbHighlight();
      if (this.res) ProgressManager.set(this.res.id, this.page);
      this.preload(n);
    },

    preload: function (n) {
      const self = this;
      [n + 1, n - 1].forEach(function (m) {
        if (m >= 1 && m <= self.src.numPages) {
          self.getRendered(m).catch(function () {});   // cache-aware
        }
      });
    },

    /* ---------- navigation ---------- */
    prev: function () { if (this.src && this.page > 1) this.show(this.page - 1); },
    next: function () { if (this.src && this.page < this.src.numPages) this.show(this.page + 1); },
    goto: function (n) {
      if (!this.src) return;
      n = Math.max(1, Math.min(this.src.numPages, n));
      this.show(n);
    },

    updatePageUi: function () {
      this.el.tmPageInput.value = this.page;
      this.el.tmPrev.disabled = this.page <= 1;
      this.el.tmNext.disabled = this.src ? this.page >= this.src.numPages : true;
    },

    /* ---------- zoom ---------- */
    setZoom: function (z) {
      z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
      if (Math.abs(z - this.zoom) < 0.001) return;
      this.zoom = z;
      this._cache.clear(); this._cacheKey = "";
      this.show(this.page, true);
    },
    updateZoomUi: function () {
      this.el.tmZoomReset.textContent = Math.round(this.zoom * 100) + "%";
      this.el.tmZoomOut.disabled = this.zoom <= ZOOM_MIN + 0.001;
      this.el.tmZoomIn.disabled = this.zoom >= ZOOM_MAX - 0.001;
    },

    /* ---------- thumbnails ---------- */
    toggleThumbs: function () {
      const on = this.el.tmThumbs.classList.contains("hidden");
      this.el.tmThumbs.classList.toggle("hidden", !on);
      this.el.tmThumbBtn.classList.toggle("tm-active", on);
      if (on && !this._thumbsBuilt) this.buildThumbs();
      if (on) this.updateThumbHighlight(true);
      /* drawer changes stage width → refit */
      this.refit();
    },

    buildThumbs: function () {
      const self = this;
      this._thumbsBuilt = true;
      const frag = document.createDocumentFragment();
      for (let i = 1; i <= this.src.numPages; i++) {
        const t = document.createElement("div");
        t.className = "tm-thumb";
        t.dataset.page = i;
        t.innerHTML = '<div class="tm-thumb-ph" style="height:100px;"></div>' +
                      '<span class="tm-thumb-num">' + i + "</span>";
        t.addEventListener("click", function () { self.goto(parseInt(this.dataset.page, 10)); });
        frag.appendChild(t);
      }
      this.el.tmThumbs.appendChild(frag);
      /* lazy-render thumbnails only when visible */
      this._thumbObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          const holder = en.target;
          self._thumbObserver.unobserve(holder);
          const n = parseInt(holder.dataset.page, 10);
          self.src.renderThumb(n, THUMB_W * Math.min(self.dpr, 1.5)).then(function (cv) {
            const ph = holder.querySelector(".tm-thumb-ph");
            if (ph) holder.replaceChild(cv, ph);
          }).catch(function () {});
        });
      }, { root: this.el.tmThumbs, rootMargin: "260px" });
      this.el.tmThumbs.querySelectorAll(".tm-thumb").forEach(function (t) {
        self._thumbObserver.observe(t);
      });
    },

    updateThumbHighlight: function (scroll) {
      if (!this._thumbsBuilt) return;
      const self = this;
      this.el.tmThumbs.querySelectorAll(".tm-thumb").forEach(function (t) {
        const cur = parseInt(t.dataset.page, 10) === self.page;
        t.classList.toggle("tm-current", cur);
        if (cur && (scroll || !self.el.tmThumbs.classList.contains("hidden"))) {
          t.scrollIntoView({ block: "nearest" });
        }
      });
    },

    /* ---------- keyboard ---------- */
    onKey: function (e) {
      if (!this.open) return;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key) {
        case "ArrowRight": case "PageDown":
          e.preventDefault(); this.next(); break;
        case " ":
          e.preventDefault(); if (e.shiftKey) this.prev(); else this.next(); break;
        case "ArrowLeft": case "PageUp":
          e.preventDefault(); this.prev(); break;
        case "Home": e.preventDefault(); this.goto(1); break;
        case "End": e.preventDefault(); this.goto(this.src ? this.src.numPages : 1); break;
        case "+": case "=": e.preventDefault(); this.setZoom(this.zoom * ZOOM_STEP); break;
        case "-": e.preventDefault(); this.setZoom(this.zoom / ZOOM_STEP); break;
        case "0": e.preventDefault(); this.setZoom(1); break;
        case "Escape":
          /* first Esc leaves fullscreen, second Esc closes teaching mode */
          if (Fullscreen.isActive()) { Fullscreen.exit(); }
          else { e.preventDefault(); Teaching.close(); }
          break;
      }
    },

    /* ---------- touch: swipe to flip / drag to pan ---------- */
    bindPointer: function () {
      const stage = this.el.tmStage;
      let startX = 0, startY = 0, startT = 0, tracking = false, panning = false;
      let scrollX0 = 0, scrollY0 = 0, pointerId = null;

      stage.addEventListener("pointerdown", function (e) {
        if (e.target.closest(".tm-turn")) return;   // side buttons handle themselves
        tracking = true; pointerId = e.pointerId;
        startX = e.clientX; startY = e.clientY; startT = Date.now();
        panning = P.zoom > 1.001;
        if (panning) {
          scrollX0 = stage.scrollLeft; scrollY0 = stage.scrollTop;
          stage.classList.add("tm-panning");
          stage.setPointerCapture(e.pointerId);
        }
      });
      stage.addEventListener("pointermove", function (e) {
        if (!tracking || e.pointerId !== pointerId) return;
        if (panning) {
          stage.scrollLeft = scrollX0 - (e.clientX - startX);
          stage.scrollTop = scrollY0 - (e.clientY - startY);
        }
      });
      const end = function (e) {
        if (!tracking || e.pointerId !== pointerId) return;
        tracking = false;
        stage.classList.remove("tm-panning");
        if (panning) return;                        // pan gesture, not a flip
        const dx = e.clientX - startX, dy = e.clientY - startY;
        const dt = Date.now() - startT;
        /* deliberate horizontal swipe: fast & mostly horizontal */
        if (Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 900) {
          if (dx < 0) P.next(); else P.prev();
          return;
        }
        /* clean tap on the slide: touch/pen toggles the control bars
           (mouse users wake them just by moving, so a mouse tap only hides) */
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && dt < 500) {
          if (e.pointerType === "mouse") P.hideBars();
          else P.toggleBars();
        }
      };
      stage.addEventListener("pointerup", end);
      stage.addEventListener("pointercancel", function () { tracking = false; stage.classList.remove("tm-panning"); });
    },

    /* ---------- helpers ---------- */
    showLoading: function (text) {
      this.el.tmLoadingText.textContent = text || "載入中…";
      this.el.tmLoading.classList.remove("hidden");
    },
    hideLoading: function () { this.el.tmLoading.classList.add("hidden"); },
    toast: function (msg) {
      const t = this.el.tmToast;
      t.textContent = msg; t.classList.add("tm-show");
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(function () { t.classList.remove("tm-show"); }, 1800);
    }
  };

  /* ----------------------------------------------------------
     Public API
     ---------------------------------------------------------- */
  return {
    open: function (res) {
      const hasContent = res && (res.url || (Array.isArray(res.pages) && res.pages.length));
      if (!res || !res.id || !hasContent) { console.warn("Teaching.open: invalid resource"); return; }
      const p = P.openResource(res);   // makes #teachView visible synchronously
      /* 上課模式：direct-to-fullscreen while we still hold the click's
         user activation (best effort — some browsers/iPads may refuse) */
      if (res.autoFullscreen !== false && Fullscreen.supported() && !Fullscreen.isActive()) {
        try {
          const fp = Fullscreen.enter(P.root);
          if (fp && fp.catch) fp.catch(function () {});
        } catch (e) { /* non-fatal */ }
      }
      return p;
    },
    close: function () { P.close(); },
    isOpen: function () { return P.open; }
  };
})();
