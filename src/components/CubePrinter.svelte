<script>
  // ================================================================
  //  CONSTANTS
  // ================================================================
  const CARD_W = 63;   // mm — standard Magic card width
  const CARD_H = 88;   // mm — standard Magic card height
  const MARGIN = 12.5; // mm — margin on every side

  const PAPER = {
    letter: { w: 215.9, h: 279.4, label: 'Letter (8.5×11″)' },
    legal:  { w: 215.9, h: 355.6, label: 'Legal (8.5×14″)' },
    a4:     { w: 210,   h: 297,   label: 'A4' },
    a3:     { w: 297,   h: 420,   label: 'A3' },
  };

  // ================================================================
  //  STATE (Svelte 5 runes)
  // ================================================================
  let cubeUrl = $state('');
  let paperKey = $state('a4');
  let gapMm = $state(2);
  let loading = $state(false);
  let error = $state('');
  let info = $state('');
  let cardImages = $state(/** @type {string[]} */ ([]));
  let windowWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1024);

  // -- Load saved settings from localStorage on mount --
  $effect(() => {
    try {
      const raw = localStorage.getItem('mtg-cube-printer-settings');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.cubeUrl) cubeUrl = s.cubeUrl;
        if (s.paperKey && PAPER[s.paperKey]) paperKey = s.paperKey;
        if (typeof s.gapMm === 'number') gapMm = s.gapMm;
      }
    } catch { /* ignore */ }
  });

  // -- Persist settings when they change --
  $effect(() => {
    try {
      localStorage.setItem('mtg-cube-printer-settings', JSON.stringify({
        cubeUrl, paperKey, gapMm,
      }));
    } catch { /* ignore */ }
  });

  // -- Listen to window resize (debounced) --
  $effect(() => {
    let timer;
    function onResize() {
      clearTimeout(timer);
      timer = setTimeout(() => windowWidth = window.innerWidth, 150);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  // ================================================================
  //  DERIVED
  // ================================================================
  let paper = $derived(PAPER[paperKey]);
  let gap = $derived(parseFloat(String(gapMm)) || 0);

  let layout = $derived.by(() => {
    const usableW = paper.w - 2 * MARGIN;
    const usableH = paper.h - 2 * MARGIN;
    const across = Math.max(1, Math.floor((usableW + gap) / (CARD_W + gap)));
    const down   = Math.max(1, Math.floor((usableH + gap) / (CARD_H + gap)));
    return { across, down, perPage: across * down };
  });

  let pages = $derived.by(() => {
    const result = [];
    for (let i = 0; i < cardImages.length; i += layout.perPage) {
      result.push(cardImages.slice(i, i + layout.perPage));
    }
    return result;
  });

  let totalPages = $derived(pages.length);

  let printCss = $derived(
    `@page { size: ${paper.w}mm ${paper.h}mm; margin: ${MARGIN}mm; }`
  );

  let pageSummary = $derived(
    totalPages === 0 ? '' :
    `${totalPages} page${totalPages !== 1 ? 's' : ''}  ·  ${layout.across}×${layout.down} cards/page  ·  gap ${gap} mm  ·  margin ${MARGIN} mm`
  );

  // ---- Preview scale (fit pages to ~380px wide) ----
  const PX_PER_MM = 96 / 25.4;
  let previewScale = $derived(
    Math.min(380, Math.max(200, windowWidth - 80)) / (paper.w * PX_PER_MM)
  );

  // Compensate vertical space the scale transform doesn't reclaim
  let marginCompensation = $derived.by(() => {
    if (totalPages === 0) return 0;
    const rawPageHeightPx = paper.h * PX_PER_MM + 32; // 32 px ≈ gap between pages
    return -((1 - previewScale) * rawPageHeightPx * totalPages);
  });

  // ================================================================
  //  PRINT CSS INJECTION — creates a global <style media="print">
  //  in <head> and updates it whenever paperKey changes
  // ================================================================
  $effect(() => {
    let el = document.getElementById('print-page-css');
    if (!el) {
      el = document.createElement('style');
      el.id = 'print-page-css';
      el.media = 'print';
      document.head.appendChild(el);
    }
    el.textContent = printCss;
  });

  // ================================================================
  //  HELPERS
  // ================================================================

  /** Pull the cube id from a Cube Cobra URL (or a plain id string). */
  function extractCubeId(raw) {
    const s = raw.trim();
    if (!s) return '';
    // If it doesn't look like a URL, treat as a raw cube ID
    if (!s.includes('/') && !s.includes('cubecobra.com')) return s;
    try {
      const u = new URL(s);
      const parts = u.pathname.split('/').filter(Boolean);
      // Cube Cobra paths are /cube/<view>/<id> — the ID is always the last segment
      return parts[parts.length - 1] || '';
    } catch {
      return s;
    }
  }

  /** Try to extract an image URL from a Cube Cobra card object. */
  function getImageUrl(card) {
    if (!card) return null;
    // Direct imgUrl (mainboard cards)
    if (card.imgUrl) return card.imgUrl;
    // Nested details (basics / older format)
    const d = card.details || {};
    return d.image_normal || d.image_small || d.image_url ||
      (d.image_uris && d.image_uris.normal) || null;
  }

  // ================================================================
  //  LOAD CUBE
  // ================================================================
  async function loadCube() {
    const raw = cubeUrl.trim();
    if (!raw) {
      error = 'Paste a Cube Cobra URL or cube ID first.';
      return;
    }

    const cubeId = extractCubeId(raw);
    if (!cubeId) {
      error = 'Could not find a cube ID in that URL.';
      return;
    }

    loading = true;
    error = '';
    info = 'Loading cube “' + cubeId + '” …';
    cardImages = [];

    try {
      // 1) Try fetching directly from Cube Cobra (CORS-enabled public API)
      const directUrl = 'https://cubecobra.com/cube/api/cubeJSON/' + cubeId;
      let resp;
      let usedProxy = false;
      try {
        resp = await fetch(directUrl);
        // status === 0 means opaque response (CORS blocked in some browsers)
        if (resp.status === 0 || !resp.ok) throw new Error('Direct fetch failed');
      } catch {
        // Direct fetch blocked — fall back to our server-side proxy
        resp = await fetch('/api/cube?id=' + encodeURIComponent(cubeId));
        usedProxy = true;
      }

      if (!resp.ok) {
        let body = {};
        try { body = await resp.json(); } catch { /* not JSON */ }
        throw new Error(body.error || 'HTTP ' + resp.status + (usedProxy ? ' (via proxy)' : ''));
      }

      const data = await resp.json();

      // Cube Cobra returns: { cards: { mainboard: [...], maybeboard: [...], basics: [...] } }
      const boards = data.cards;
      if (!boards || typeof boards !== 'object') {
        throw new Error('Unexpected API response (no cards object).');
      }

      // Flatten all boards (mainboard first, then maybeboard, then basics)
      const allCards = [];
      for (const key of ['mainboard', 'maybeboard', 'basics']) {
        if (Array.isArray(boards[key])) allCards.push(...boards[key]);
      }
      // Also accept a flat array as fallback
      if (allCards.length === 0 && Array.isArray(boards)) allCards.push(...boards);

      const urls = allCards.map(getImageUrl).filter(Boolean);

      if (urls.length === 0) {
        error = 'Cube loaded, but no cards have image URLs.';
        return;
      }

      cardImages = urls;
      info = '✅ Loaded ' + urls.length + ' cards from “' + cubeId + '”.';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error(err);
    } finally {
      loading = false;
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') loadCube();
  }

  function printAll() {
    window.print();
  }
</script>

<!-- ================================================================ -->
<!--  TEMPLATE                                                        -->
<!-- ================================================================ -->
<div class="app">
  <!-- HEADER -->
  <header class="header">
    <h1>&#x1F0CF; MTG Cube Printer</h1>
    <p>Load a Cube Cobra cube &amp; print proxy sheets</p>
  </header>

  <!-- CONTROLS -->
  <div class="controls">
    <div class="ctrl-group url-group">
      <label for="cubeUrl">Cube Cobra URL</label>
      <input
        type="text"
        id="cubeUrl"
        bind:value={cubeUrl}
        onkeydown={handleKeydown}
        placeholder="https://cubecobra.com/cube/list/your-cube"
        disabled={loading}
      />
    </div>
    <div class="ctrl-group">
      <label for="paperSize">Paper size</label>
      <select id="paperSize" bind:value={paperKey} disabled={loading}>
        {#each Object.entries(PAPER) as [key, p]}
          <option value={key}>{p.label}</option>
        {/each}
      </select>
    </div>
    <div class="ctrl-group">
      <label for="gapMm">Gap (mm)</label>
      <input
        type="number"
        id="gapMm"
        bind:value={gapMm}
        min="0" max="20" step="0.5"
        disabled={loading}
      />
    </div>
    <button class="btn btn-primary" onclick={loadCube} disabled={loading}>
      Load Cube
    </button>
    {#if loading}
      <div class="spinner"></div>
    {/if}
  </div>

  <!-- INFO / ERROR BAR -->
  {#if info || error}
    <div class="info-bar" class:error={!!error} role="alert">
      {error ? '❌ ' : ''}{error || info}
    </div>
  {/if}

  <!-- ACTIONS BAR -->
  {#if cardImages.length > 0}
    <div class="actions-bar">
      <button class="btn btn-print" onclick={printAll}>🖨️ Print all pages</button>
      <span class="page-summary">{pageSummary}</span>
    </div>
  {/if}

  <!-- PAGE PREVIEWS -->
  {#if totalPages > 0}
    <div class="preview">
      <div
        class="pages-wrapper"
        style="transform: scale({previewScale}); margin-bottom: {marginCompensation}px"
      >
        {#each pages as pageCards, pageIdx}
          <div class="page" style="width: {paper.w}mm; height: {paper.h}mm">
            <div
              class="cards-grid"
              style="grid-template-columns: repeat({layout.across}, {CARD_W}mm); grid-template-rows: repeat({layout.down}, {CARD_H}mm); gap: {gap}mm"
            >
              {#each pageCards as imgUrl, cardIdx}
                <div class="card">
                  <img
                    src={imgUrl}
                    alt="Card {pageIdx * layout.perPage + cardIdx + 1}"
                    loading="lazy"
                    onerror={(e) => {
                      const el = e.currentTarget;
                      el.remove();
                      el.parentElement?.classList.add('card-placeholder');
                    }}
                  />
                </div>
              {/each}
              {#each Array(layout.perPage - pageCards.length) as _}
                <div class="card card-placeholder"></div>
              {/each}
            </div>
            <span class="page-num">p. {pageIdx + 1} / {totalPages}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- ================================================================ -->
<!--  STYLES (scoped by Svelte)                                       -->
<!-- ================================================================ -->
<style>
  /* ===== RESET ===== */
  .app { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }

  /* ===== HEADER ===== */
  .header {
    background: #1a1a2e;
    color: #fff;
    padding: 1.25rem 2rem;
    text-align: center;
  }
  .header h1 { font-size: 1.6rem; letter-spacing: -0.02em; margin: 0; }
  .header p  { font-size: 0.85rem; opacity: 0.65; margin: 0.15rem 0 0; }

  /* ===== CONTROLS ===== */
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: #fff;
    border-bottom: 1px solid #d0d5dd;
  }
  .ctrl-group {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .ctrl-group label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #6b7280;
  }
  .ctrl-group input,
  .ctrl-group select {
    padding: 0.5rem 0.6rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.875rem;
    background: #fff;
    outline: none;
    transition: border-color 0.15s;
  }
  .ctrl-group input:focus,
  .ctrl-group select:focus {
    border-color: #1a1a2e;
    box-shadow: 0 0 0 3px rgb(26 26 46 / 0.1);
  }
  .ctrl-group input[type="number"] { width: 75px; }
  .url-group { flex: 1; min-width: 240px; }

  .btn {
    padding: 0.5rem 1.4rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-primary { background: #1a1a2e; color: #fff; }
  .btn-primary:hover:not(:disabled) { background: #2d2d4a; }
  .btn-print   { background: #166534; color: #fff; font-size: 1rem; padding: 0.7rem 2rem; }
  .btn-print:hover:not(:disabled) { background: #15803d; }

  .spinner {
    width: 22px; height: 22px;
    border: 3px solid #d0d5dd;
    border-top-color: #1a1a2e;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    align-self: end;
    margin-bottom: 2px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ===== INFO BAR ===== */
  .info-bar {
    padding: 0.7rem 2rem;
    font-size: 0.875rem;
    background: #f0fdf4;
    border-bottom: 1px solid #bbf7d0;
    color: #166534;
  }
  .info-bar.error {
    background: #fef2f2;
    border-color: #fecaca;
    color: #991b1b;
  }

  /* ===== ACTIONS BAR ===== */
  .actions-bar {
    padding: 0.75rem 2rem;
    background: #fff;
    border-bottom: 1px solid #d0d5dd;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .page-summary { font-size: 0.85rem; color: #6b7280; }

  /* ===== PREVIEW ===== */
  .preview {
    padding: 2rem;
    display: flex;
    justify-content: center;
  }
  .pages-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    transform-origin: top center;
  }

  /* ===== PAGE ===== */
  .page {
    background: #fff;
    box-shadow: 0 2px 16px rgb(0 0 0 / 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12.5mm;
    position: relative;
  }
  .page-num {
    position: absolute;
    bottom: 3mm;
    right: 5mm;
    font-size: 7pt;
    color: #9ca3af;
  }

  /* ===== CARDS GRID ===== */
  .cards-grid {
    display: grid;
  }
  .card {
    overflow: hidden;
    border-radius: 4.75% / 3.4%;
    background: #d1d5db;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.15);
  }
  .card img {
    display: block;
    width: 100%;
    height: 100%;
  }
  .card-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 7pt;
    color: #9ca3af;
    user-select: none;
  }

  /* ===== PRINT OVERRIDES ===== */
  @media print {
    .header,
    .controls,
    .actions-bar,
    .info-bar    { display: none !important; }
    .preview     { padding: 0 !important; }
    .pages-wrapper { transform: none !important; gap: 0; margin-bottom: 0 !important; }
    .page {
      box-shadow: none !important;
      break-after: page;
      page-break-after: always;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: auto !important;
    }
    .page:last-child { break-after: auto; page-break-after: auto; }
  }
</style>
