<script>
  import { onMount } from 'svelte';

  // ================================================================
  //  CONSTANTS
  // ================================================================
  const CARD_W = 63;   // mm — standard Magic card width
  const CARD_H = 88;   // mm — standard Magic card height
  const MARGIN = 12.5; // mm — margin on every side

  const DEFAULT_PAPER = 'a4';
  const DEFAULT_GAP = 2;
  const NO_BOARD = 'no board';
  const CUT_MARK_LEN = 5; // mm

  const PAPER = {
    letter: { w: 215.9, h: 279.4, label: 'Letter (8.5×11″)' },
    legal:  { w: 215.9, h: 355.6, label: 'Legal (8.5×14″)' },
    a4:     { w: 210,   h: 297,   label: 'A4' },
    a3:     { w: 297,   h: 420,   label: 'A3' },
    '13x19': { w: 330.2, h: 482.6, label: '13×19″' },
  };

  const COLOR_OPTIONS = [
    { code: 'W', label: 'White (W)' },
    { code: 'U', label: 'Blue (U)' },
    { code: 'B', label: 'Black (B)' },
    { code: 'R', label: 'Red (R)' },
    { code: 'G', label: 'Green (G)' },
    { code: 'C', label: 'Colorless (C)' },
  ];
  const COLOR_CODES = COLOR_OPTIONS.map((c) => c.code);

  // ================================================================
  //  STATE (Svelte 5 runes)
  // ================================================================
  let cubeInput = $state('');
  let loadedCubeId = $state('');
  let paperKey = $state(DEFAULT_PAPER);
  let gapMm = $state(DEFAULT_GAP);
  let loading = $state(false);
  let error = $state('');
  let info = $state('');
  let cards = $state(/** @type {{ name: string, imageUrl: string, typeLine: string, colors: string[], tags: string[], board: string }[]} */ ([]));
  let typeQuery = $state('');
  let selectedTags = $state(/** @type {string[]} */ ([]));
  let selectedColors = $state(/** @type {string[]} */ ([]));
  let includeMulticolor = $state(false);
  let multicolorOnly = $state(false);
  let selectedBoards = $state(/** @type {string[]} */ ([]));
  let windowWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1024);

  let mounted = false;
  let suppressUrlUpdate = false;

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

  let tagOptions = $derived(getTagOptions(cards));
  let boardOptions = $derived(getBoardOptions(cards));
  let filteredCards = $derived(cards.filter(matchesFilters));

  let pages = $derived.by(() => {
    const result = [];
    for (let i = 0; i < filteredCards.length; i += layout.perPage) {
      result.push(filteredCards.slice(i, i + layout.perPage));
    }
    return result;
  });

  let totalPages = $derived(pages.length);

  let gridMetrics = $derived.by(() => {
    const w = layout.across * CARD_W + Math.max(0, layout.across - 1) * gap;
    const h = layout.down * CARD_H + Math.max(0, layout.down - 1) * gap;
    return {
      w,
      h,
      x: (paper.w - w) / 2,
      y: (paper.h - h) / 2,
    };
  });

  let cutMarks = $derived.by(() => {
    const vertical = [];
    for (let col = 0; col < layout.across; col += 1) {
      const left = gridMetrics.x + col * (CARD_W + gap);
      vertical.push(left, left + CARD_W);
    }

    const horizontal = [];
    for (let row = 0; row < layout.down; row += 1) {
      const top = gridMetrics.y + row * (CARD_H + gap);
      horizontal.push(top, top + CARD_H);
    }

    return { vertical, horizontal };
  });

  let printCss = $derived(
    `@page { size: ${paper.w}mm ${paper.h}mm; margin: 0; }`
  );

  let pageSummary = $derived(
    totalPages === 0 ? '' :
    `${totalPages} page${totalPages !== 1 ? 's' : ''}  ·  ${layout.across}×${layout.down} cards/page  ·  gap ${gap} mm  ·  margin ${MARGIN} mm`
  );

  let filterCount = $derived.by(() => {
    if (cards.length === 0) return '';
    if (filteredCards.length === cards.length) return `Showing ${cards.length} printable cards`;
    return `Showing ${filteredCards.length} of ${cards.length} printable cards`;
  });

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
  //  URL STATE
  // ================================================================
  onMount(() => {
    const urlState = readUrlState();
    suppressUrlUpdate = true;
    applyUrlState(urlState);
    suppressUrlUpdate = false;
    writeUrl('replace');

    if (urlState.cube) loadCubeById(urlState.cube);

    function onPopState() {
      const previousCubeId = loadedCubeId;
      const nextState = readUrlState();
      suppressUrlUpdate = true;
      applyUrlState(nextState);
      suppressUrlUpdate = false;

      if (!nextState.cube) {
        cards = [];
        info = '';
        error = '';
        return;
      }

      if (nextState.cube !== previousCubeId) loadCubeById(nextState.cube);
    }

    window.addEventListener('popstate', onPopState);
    mounted = true;
    return () => window.removeEventListener('popstate', onPopState);
  });

  $effect(() => {
    paperKey;
    gapMm;
    typeQuery;
    selectedTags.join('\u0000');
    selectedColors.join('\u0000');
    includeMulticolor;
    multicolorOnly;
    selectedBoards.join('\u0000');
    loadedCubeId;

    if (!mounted || suppressUrlUpdate) return;
    writeUrl('replace');
  });

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    return {
      cube: extractCubeId(params.get('cube') || ''),
      paper: normalizePaper(params.get('paper')),
      gap: normalizeGap(params.get('gap')),
      type: params.get('type') || '',
      tags: uniqueStrings(params.getAll('tag')),
      colors: normalizeColors(params.getAll('color')),
      includeMulticolor: params.get('multicolor') === '1',
      multicolorOnly: params.get('multicolorOnly') === '1',
      boards: uniqueStrings(params.getAll('board')),
    };
  }

  function applyUrlState(state) {
    paperKey = state.paper;
    gapMm = state.gap;
    typeQuery = state.type;
    selectedTags = state.tags;
    selectedColors = state.colors;
    includeMulticolor = state.includeMulticolor;
    multicolorOnly = state.multicolorOnly;
    selectedBoards = state.boards;
    loadedCubeId = state.cube;
    cubeInput = state.cube;
  }

  function writeUrl(mode) {
    const params = new URLSearchParams();
    const cubeId = loadedCubeId.trim();
    if (cubeId) params.set('cube', cubeId);
    params.set('paper', normalizePaper(paperKey));
    params.set('gap', String(normalizeGap(gapMm)));

    const type = typeQuery.trim();
    if (type) params.set('type', type);

    for (const tag of selectedTags) params.append('tag', tag);
    for (const color of normalizeColors(selectedColors)) params.append('color', color);
    if (includeMulticolor && !multicolorOnly) params.set('multicolor', '1');
    if (multicolorOnly) params.set('multicolorOnly', '1');
    for (const board of selectedBoards) params.append('board', board);

    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    if (mode === 'push') window.history.pushState(null, '', next);
    else window.history.replaceState(null, '', next);
  }

  // ================================================================
  //  EFFECTS
  // ================================================================

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

  function normalizePaper(value) {
    return value && PAPER[value] ? value : DEFAULT_PAPER;
  }

  function normalizeGap(value) {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    if (!Number.isFinite(n)) return DEFAULT_GAP;
    return Math.min(20, Math.max(0, n));
  }

  function normalizeColors(values) {
    const requested = new Set(values.map((value) => String(value).toUpperCase()));
    return COLOR_CODES.filter((code) => requested.has(code));
  }

  function uniqueStrings(values) {
    const result = [];
    for (const value of values) {
      const s = String(value);
      if (s && !result.includes(s)) result.push(s);
    }
    return result;
  }

  function uniqueCaseInsensitive(values) {
    const seen = new Set();
    const result = [];
    for (const value of values) {
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(value);
    }
    return result;
  }

  function canonicalizeSelection(selection, options) {
    const requested = selection.map((value) => value.toLowerCase());
    return options.filter((option) => requested.includes(option.toLowerCase()));
  }

  function getImageUrl(card) {
    return card?.details?.image_normal || '';
  }

  function getTypeLine(card) {
    return card?.details?.type || '';
  }

  function getColors(card) {
    const rawColors = card?.details?.color_identity;

    return Array.isArray(rawColors)
      ? uniqueStrings(rawColors.map((color) => String(color).toUpperCase()).filter((color) => COLOR_CODES.includes(color)))
      : [];
  }

  function normalizeCard(card, board) {
    return {
      name: typeof card.name === 'string' ? card.name : '',
      imageUrl: getImageUrl(card),
      typeLine: getTypeLine(card),
      colors: getColors(card),
      tags: Array.isArray(card.tags) ? uniqueStrings(card.tags.filter((tag) => typeof tag === 'string')) : [],
      board,
    };
  }

  function getPrintableCards(data) {
    const boards = data.cards;
    const printable = [];
    let skippedWithoutImages = 0;

    function addCard(card, board) {
      const normalized = normalizeCard(card, board);
      if (!normalized.imageUrl) {
        skippedWithoutImages += 1;
        return;
      }
      printable.push(normalized);
    }

    if (Array.isArray(boards)) {
      for (const card of boards) addCard(card, NO_BOARD);
    } else if (boards && typeof boards === 'object') {
      for (const [board, boardCards] of Object.entries(boards)) {
        if (!Array.isArray(boardCards)) continue;
        for (const card of boardCards) addCard(card, board || NO_BOARD);
      }
    } else {
      throw new Error('Unexpected API response (no cards object).');
    }

    return { printable, skippedWithoutImages };
  }

  function getTagOptions(sourceCards) {
    const tags = [];
    for (const card of sourceCards) tags.push(...card.tags);
    return uniqueStrings(tags).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  function getBoardOptions(sourceCards) {
    return uniqueStrings(sourceCards.map((card) => card.board));
  }

  function matchesFilters(card) {
    const fragments = typeQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (fragments.length > 0) {
      const typeLine = card.typeLine.toLowerCase();
      if (!fragments.every((fragment) => typeLine.includes(fragment))) return false;
    }

    if (selectedTags.length > 0) {
      const selected = selectedTags.map((tag) => tag.toLowerCase());
      if (!card.tags.some((tag) => selected.includes(tag.toLowerCase()))) return false;
    }

    if (multicolorOnly && card.colors.length <= 1) return false;

    if (selectedColors.length > 0) {
      if (includeMulticolor || multicolorOnly) {
        if (!card.colors.some((color) => selectedColors.includes(color))) return false;
      } else if (card.colors.length !== 1 || !selectedColors.includes(card.colors[0])) {
        return false;
      }
    }

    if (selectedBoards.length > 0) {
      const selected = selectedBoards.map((board) => board.toLowerCase());
      if (!selected.includes(card.board.toLowerCase())) return false;
    }

    return true;
  }

  function multiSummary(label, selected) {
    if (selected.length === 0) return `${label}: Any`;
    if (selected.length <= 2) return `${label}: ${selected.join(', ')}`;
    return `${label}: ${selected.length} selected`;
  }

  function toggleValue(values, value, checked, options) {
    const next = checked ? [...values, value] : values.filter((item) => item !== value);
    return options.filter((option) => next.includes(option));
  }

  function toggleTag(tag, checked) {
    selectedTags = toggleValue(selectedTags, tag, checked, tagOptions);
  }

  function toggleColor(color, checked) {
    selectedColors = toggleValue(selectedColors, color, checked, COLOR_CODES);
  }

  function toggleBoard(board, checked) {
    selectedBoards = toggleValue(selectedBoards, board, checked, boardOptions);
  }

  function resetFilters() {
    typeQuery = '';
    selectedTags = [];
    selectedColors = [];
    includeMulticolor = false;
    multicolorOnly = false;
    selectedBoards = [];
  }

  function canonicalizeLoadedSelections(printableCards) {
    const tags = getTagOptions(printableCards);
    const boards = getBoardOptions(printableCards);
    selectedTags = uniqueCaseInsensitive(canonicalizeSelection(selectedTags, tags));
    selectedBoards = uniqueCaseInsensitive(canonicalizeSelection(selectedBoards, boards));
    selectedColors = normalizeColors(selectedColors);
  }

  // ================================================================
  //  LOAD CUBE
  // ================================================================
  async function loadCubeById(cubeId) {
    loading = true;
    error = '';
    info = 'Loading cube “' + cubeId + '” …';
    cards = [];

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
      const { printable, skippedWithoutImages } = getPrintableCards(data);

      if (printable.length === 0) {
        error = 'Cube loaded, but no printable cards have image URLs.';
        return;
      }

      cards = printable;
      canonicalizeLoadedSelections(printable);
      writeUrl('replace');

      const skipped = skippedWithoutImages > 0
        ? ` (${skippedWithoutImages} skipped without images)`
        : '';
      info = '✅ Loaded ' + printable.length + ' printable cards from “' + cubeId + '”.' + skipped;
    } catch (err) {
      cards = [];
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error(err);
    } finally {
      loading = false;
    }
  }

  async function loadCube() {
    const raw = cubeInput.trim();
    if (!raw) {
      error = 'Paste a Cube Cobra URL or cube ID first.';
      return;
    }

    const cubeId = extractCubeId(raw);
    if (!cubeId) {
      error = 'Could not find a cube ID in that URL.';
      return;
    }

    suppressUrlUpdate = true;
    cubeInput = cubeId;
    loadedCubeId = cubeId;
    typeQuery = '';
    selectedTags = [];
    selectedColors = [];
    includeMulticolor = false;
    multicolorOnly = false;
    selectedBoards = [];
    suppressUrlUpdate = false;
    writeUrl('push');

    await loadCubeById(cubeId);
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
      <label for="cubeInput">Cube ID or URL</label>
      <input
        type="text"
        id="cubeInput"
        bind:value={cubeInput}
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

  <!-- FILTERS -->
  {#if cards.length > 0}
    <div class="filters-bar">
      <div class="ctrl-group type-filter">
        <label for="typeQuery">Type</label>
        <input
          type="text"
          id="typeQuery"
          bind:value={typeQuery}
          placeholder="land creature artifact"
          disabled={loading}
        />
      </div>

      <div class="multi-select">
        <button type="button" class="multi-trigger tags-trigger" popovertarget="tags-popover">
          {multiSummary('Tags', selectedTags)}
        </button>
        <div id="tags-popover" class="multi-panel tags-popover" popover="auto">
          <button type="button" class="link-btn" onclick={() => selectedTags = []}>Clear</button>
          {#if tagOptions.length === 0}
            <div class="empty-option">No tags</div>
          {:else}
            {#each tagOptions as tag}
              <label class="check-row">
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onchange={(e) => toggleTag(tag, e.currentTarget.checked)}
                />
                <span>{tag}</span>
              </label>
            {/each}
          {/if}
        </div>
      </div>

      <div class="multi-select color-select">
        <button type="button" class="multi-trigger colors-trigger" popovertarget="colors-popover">
          {multiSummary('Color Identity', selectedColors)}
        </button>
        <div id="colors-popover" class="multi-panel colors-popover" popover="auto">
          <button type="button" class="link-btn" onclick={() => selectedColors = []}>Clear</button>
          {#each COLOR_OPTIONS as color}
            <label class="check-row">
              <input
                type="checkbox"
                checked={selectedColors.includes(color.code)}
                onchange={(e) => toggleColor(color.code, e.currentTarget.checked)}
              />
              <span>{color.label}</span>
            </label>
          {/each}
        </div>
      </div>

      <label class="inline-check" class:muted={multicolorOnly}>
        <input type="checkbox" bind:checked={includeMulticolor} disabled={multicolorOnly} />
        <span>Include multicolor</span>
      </label>

      <label class="inline-check">
        <input type="checkbox" bind:checked={multicolorOnly} />
        <span>Multicolor only</span>
      </label>

      <div class="multi-select">
        <button type="button" class="multi-trigger boards-trigger" popovertarget="boards-popover">
          {multiSummary('Boards', selectedBoards)}
        </button>
        <div id="boards-popover" class="multi-panel boards-popover" popover="auto">
          <button type="button" class="link-btn" onclick={() => selectedBoards = []}>Clear</button>
          {#if boardOptions.length === 0}
            <div class="empty-option">No boards</div>
          {:else}
            {#each boardOptions as board}
              <label class="check-row">
                <input
                  type="checkbox"
                  checked={selectedBoards.includes(board)}
                  onchange={(e) => toggleBoard(board, e.currentTarget.checked)}
                />
                <span>{board}</span>
              </label>
            {/each}
          {/if}
        </div>
      </div>

      <button type="button" class="btn btn-secondary" onclick={resetFilters}>Reset filters</button>
      <span class="filter-count">{filterCount}</span>
    </div>
  {/if}

  <!-- ACTIONS BAR -->
  {#if cards.length > 0}
    <div class="actions-bar">
      <button class="btn btn-print" onclick={printAll}>🖨️ Print</button>
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
            {#each cutMarks.vertical as x}
              <span
                class="cut-mark cut-mark-v"
                style="left: {x}mm; top: {gridMetrics.y - CUT_MARK_LEN}mm"
              ></span>
              <span
                class="cut-mark cut-mark-v"
                style="left: {x}mm; top: {gridMetrics.y + gridMetrics.h}mm"
              ></span>
            {/each}
            {#each cutMarks.horizontal as y}
              <span
                class="cut-mark cut-mark-h"
                style="left: {gridMetrics.x - CUT_MARK_LEN}mm; top: {y}mm"
              ></span>
              <span
                class="cut-mark cut-mark-h"
                style="left: {gridMetrics.x + gridMetrics.w}mm; top: {y}mm"
              ></span>
            {/each}
            <div
              class="cards-grid"
              style="grid-template-columns: repeat({layout.across}, {CARD_W}mm); grid-template-rows: repeat({layout.down}, {CARD_H}mm); gap: {gap}mm"
            >
              {#each pageCards as card, cardIdx}
                <div class="card">
                  <img
                    src={card.imageUrl}
                    alt={card.name || `Card ${pageIdx * layout.perPage + cardIdx + 1}`}
                    loading="lazy"
                    onerror={(e) => {
                      const el = e.currentTarget;
                      el.remove();
                      el.parentElement?.classList.add('card-placeholder');
                    }}
                  />
                </div>
              {/each}
            </div>
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
  .controls,
  .filters-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: #fff;
    border-bottom: 1px solid #d0d5dd;
  }
  .filters-bar {
    align-items: center;
    background: #f8fafc;
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
  .type-filter { min-width: 220px; }

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
  .btn-secondary { background: #e5e7eb; color: #111827; }
  .btn-secondary:hover:not(:disabled) { background: #d1d5db; }
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

  /* ===== FILTERS ===== */
  .multi-select {
    position: relative;
  }
  .multi-trigger {
    padding: 0.5rem 0.75rem;
    min-width: 130px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #fff;
    font-size: 0.875rem;
    cursor: pointer;
    user-select: none;
    text-align: left;
  }
  .multi-trigger:hover,
  .multi-trigger:focus-visible,
  .multi-trigger:popover-open {
    border-color: #1a1a2e;
    box-shadow: 0 0 0 3px rgb(26 26 46 / 0.1);
    outline: none;
  }
  .tags-trigger { anchor-name: --tags-trigger; }
  .colors-trigger { anchor-name: --colors-trigger; }
  .boards-trigger { anchor-name: --boards-trigger; }
  .multi-panel {
    position: absolute;
    inset: auto;
    width: max-content;
    min-width: 210px;
    max-width: 320px;
    max-height: 280px;
    overflow: auto;
    padding: 0.45rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 12px 28px rgb(0 0 0 / 0.16);
  }
  .tags-popover {
    position-anchor: --tags-trigger;
    top: anchor(bottom);
    left: anchor(left);
    margin-top: 0.35rem;
  }
  .colors-popover {
    position-anchor: --colors-trigger;
    top: anchor(bottom);
    left: anchor(left);
    margin-top: 0.35rem;
  }
  .boards-popover {
    position-anchor: --boards-trigger;
    top: anchor(bottom);
    left: anchor(left);
    margin-top: 0.35rem;
  }
  .check-row,
  .inline-check {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.875rem;
  }
  .check-row {
    padding: 0.3rem 0.35rem;
    border-radius: 5px;
    white-space: nowrap;
  }
  .check-row:hover { background: #f3f4f6; }
  .inline-check {
    align-self: center;
    white-space: nowrap;
  }
  .inline-check.muted {
    color: #9ca3af;
  }
  .link-btn {
    padding: 0.2rem 0.35rem;
    margin-bottom: 0.25rem;
    border: none;
    background: transparent;
    color: #1d4ed8;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .link-btn:hover { text-decoration: underline; }
  .empty-option,
  .filter-count {
    font-size: 0.85rem;
    color: #6b7280;
  }
  .empty-option { padding: 0.35rem; }
  .filter-count { margin-left: auto; }

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
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12.5mm;
    position: relative;
  }
  .cut-mark {
    position: absolute;
    z-index: 2;
    display: block;
    pointer-events: none;
  }
  .cut-mark-v {
    width: 0;
    height: 5mm;
    border-left: 0.2mm solid #000;
    transform: translateX(-0.1mm);
  }
  .cut-mark-h {
    width: 5mm;
    height: 0;
    border-top: 0.2mm solid #000;
    transform: translateY(-0.1mm);
  }
  /* ===== CARDS GRID ===== */
  .cards-grid {
    display: grid;
  }
  .card {
    overflow: hidden;
    border-radius: 4.75% / 3.4%;
    background: #d1d5db;
    box-shadow: none;
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
    .filters-bar,
    .actions-bar,
    .info-bar    { display: none !important; }
    .preview     { padding: 0 !important; }
    .pages-wrapper { transform: none !important; gap: 0; margin-bottom: 0 !important; }
    .page {
      box-shadow: none !important;
      break-after: page;
      page-break-after: always;
      margin: 0 !important;
      padding: 12.5mm !important;
    }
    .cut-mark {
      display: block !important;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .page:last-child { break-after: auto; page-break-after: auto; }
  }
</style>
