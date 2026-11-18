const GITHUB_OWNER = 'Aanticamperos';
const GITHUB_REPO = 'Mundo-de-las-tenis';
const GITHUB_BRANCH = 'main';
const GITHUB_FILE_PATH = 'descuentos.json';

const DRAFT_STORAGE_KEY = 'mdt-discounts-draft';
const PREVIEW_STORAGE_KEY = 'mdt-discounts-preview';
const TOKEN_SESSION_KEY = 'mdt-gh-token-session';
const TOKEN_LOCAL_KEY = 'mdt-gh-token-local';
const ADMIN_PAGE_SIZE = 30;

const FALLBACK_SHOE_SVG =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="none">
      <rect width="400" height="400" fill="#F2F3F6"/>
      <path d="M68 242h240c20 0 34-12 34-28 0-17-14-30-38-34l-64-10-54-58c-7-8-18-6-24 3l-24 36c-16 23-42 37-76 43l-34 6c-14 3-22 12-22 23 0 11 9 19 22 19Z" stroke="#9AA1AF" stroke-width="10" stroke-linejoin="round"/>
      <path d="M54 270h288" stroke="#C5CAD4" stroke-width="10" stroke-linecap="round"/>
    </svg>`
  );

const COLOR_PHRASES = [
  ['azul-claro', 'Azul Claro'],
  ['azul-marino', 'Azul Marino'],
  ['azul-oscuro', 'Azul Oscuro'],
  ['verde-neon', 'Verde Neón'],
  ['verde-azulado', 'Verde Azulado'],
  ['verde-oscuro', 'Verde Oscuro'],
  ['gris-claro', 'Gris Claro'],
  ['rojo-oscuro', 'Rojo Oscuro'],
  ['rosa-pastel', 'Rosa Pastel']
];

const COLOR_WORDS = {
  negro: 'Negro',
  blanco: 'Blanco',
  rojo: 'Rojo',
  azul: 'Azul',
  gris: 'Gris',
  verde: 'Verde',
  amarillo: 'Amarillo',
  naranja: 'Naranja',
  morado: 'Morado',
  lila: 'Lila',
  rosa: 'Rosa',
  marron: 'Marrón',
  beige: 'Beige',
  crema: 'Crema',
  turquesa: 'Turquesa',
  plateado: 'Plateado',
  fucsia: 'Fucsia',
  leopardo: 'Leopardo',
  dorado: 'Dorado',
  cafe: 'Café',
  vino: 'Vino'
};

let catalogProducts = [];
let publishedMap = {};
let workingMap = {};
let searchTerm = '';
let activeBrand = 'Todas';
let activeStatus = 'all';
let visibleLimit = ADMIN_PAGE_SIZE;
let toastTimer = null;
let activeToken = '';
let activeGithubLogin = '';
let workspaceEventsBound = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function priceNumber(value) {
  return Number(String(value ?? '').replace(/[^0-9]/g, '')) || 0;
}

function formatDots(value) {
  const num = Number(value) || 0;
  return num > 0 ? new Intl.NumberFormat('es-CO').format(num) : '';
}

function peso(value) {
  return '$ ' + new Intl.NumberFormat('es-CO').format(Number(value) || 0);
}

function normalizeDisplayName(rawName) {
  return String(rawName || '')
    .replace(/lecoq\s+sportif\s+lecoq\s+sportif/gi, 'Le Coq Sportif')
    .replace(/\bAdidas Sl\b/gi, 'Adidas SL')
    .replace(/\bNike Sb\b/gi, 'Nike SB')
    .replace(/\bNike Tn\b/gi, 'Nike TN')
    .trim();
}

function detectBrand(cleanName) {
  const lower = cleanName.toLowerCase();
  if (lower.startsWith('jordan')) return 'Jordan';
  if (lower.startsWith('nike')) return 'Nike';
  if (lower.startsWith('adidas')) return 'Adidas';
  if (lower.startsWith('asics')) return 'Asics';
  if (lower.startsWith('skechers')) return 'Skechers';
  if (lower.startsWith('lacoste')) return 'Lacoste';
  if (lower.startsWith('le coq')) return 'Le Coq Sportif';
  if (lower.startsWith('louis vuitton')) return 'Louis Vuitton';
  if (lower.startsWith('dc shoes')) return 'DC Shoes';
  return cleanName.split(/\s+/)[0] || 'Sneakers';
}

function extractColorway(id) {
  const match = String(id || '').match(/-(?:hombre|mujer|unisex|sin-genero)-(.+)$/i);
  if (!match) return '';
  let tail = match[1].toLowerCase();
  const found = [];

  for (const [slug, label] of COLOR_PHRASES) {
    if (tail.includes(slug)) {
      found.push(label);
      tail = tail.replaceAll(slug, ' ');
    }
  }

  for (const token of tail.split('-')) {
    if (COLOR_WORDS[token] && !found.includes(COLOR_WORDS[token])) {
      found.push(COLOR_WORDS[token]);
    }
  }

  return found.slice(0, 3).join(' / ');
}

function detectGenderLabel(id, sizes) {
  const nums = sizes.map((s) => Number(s)).filter((n) => !Number.isNaN(n));
  const hasSmall = nums.some((n) => n <= 38);
  const hasLarge = nums.some((n) => n >= 41);
  if ((hasSmall && hasLarge) || /-unisex-/i.test(id)) return 'Unisex';
  if (/-hombre-/i.test(id)) return 'Hombre';
  if (/-mujer-/i.test(id)) return 'Mujer';
  return hasSmall && !hasLarge ? 'Mujer' : 'Hombre';
}

function toAdminRenderImage(rawUrl) {
  const cleaned = String(rawUrl || '').trim();
  if (!cleaned) return FALLBACK_SHOE_SVG;
  if (/^https?:\/\/mundodelastenis\.online\//i.test(cleaned)) {
    return cleaned.replace(/^https?:\/\/mundodelastenis\.online\//i, '../');
  }
  if (/^(https?:|data:|\.\.\/)/i.test(cleaned)) return cleaned;
  return '../' + cleaned.replace(/^\/+/, '');
}

function parseCSV(text) {
  const rows = [];
  let current = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"' && quoted && next === '"') {
      value += '"';
      i++;
    } else if (c === '"') {
      quoted = !quoted;
    } else if (c === ',' && !quoted) {
      current.push(value);
      value = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && next === '\n') i++;
      current.push(value);
      if (current.some((v) => v.trim())) rows.push(current);
      current = [];
      value = '';
    } else {
      value += c;
    }
  }

  if (value || current.length) {
    current.push(value);
    rows.push(current);
  }

  const [headers = [], ...data] = rows;
  return data.map((row) =>
    Object.fromEntries(headers.map((h, idx) => [h.trim(), (row[idx] || '').trim()]))
  );
}

function showToast(message) {
  const toast = $('#adminToast');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 4200);
}

function sanitizeOverrideEntry(entry, basePriceNum) {
  if (!entry || typeof entry !== 'object') return null;
  const sale = priceNumber(entry.precio ?? entry.precioDescuento);
  const old = priceNumber(entry.precioAnterior ?? entry.precioNormal);

  const normalPrice = old > 0 ? old : sale > 0 ? sale : basePriceNum;
  const finalPrice = sale > 0 ? sale : normalPrice;

  if (finalPrice === basePriceNum && normalPrice === basePriceNum) {
    return null;
  }

  if (finalPrice > 0 && finalPrice < normalPrice) {
    const pct = Math.round(((normalPrice - finalPrice) / normalPrice) * 100);
    if (pct >= 1) {
      return { precio: finalPrice, precioAnterior: normalPrice };
    }
  }

  if (normalPrice > 0 && normalPrice !== basePriceNum) {
    return { precio: normalPrice };
  }
  return null;
}

function sanitizeDiscountMap(rawMap) {
  const clean = {};
  if (!rawMap || typeof rawMap !== 'object') return clean;

  const byId = new Map(catalogProducts.map((p) => [p.id, p]));
  for (const [id, entry] of Object.entries(rawMap)) {
    const prod = byId.get(id);
    if (!prod) continue;
    const normalized = sanitizeOverrideEntry(entry, prod.basePriceNum);
    if (normalized) clean[id] = normalized;
  }
  return clean;
}

function getItemPricingState(product) {
  const entry = workingMap[product.id];
  if (!entry) {
    return {
      normalPrice: product.basePriceNum,
      salePrice: product.basePriceNum,
      discountPercent: 0,
      hasDiscount: false,
      isAdjusted: false
    };
  }

  const normalPrice = entry.precioAnterior > 0 ? entry.precioAnterior : entry.precio;
  const salePrice = entry.precio;
  const discountPercent =
    salePrice > 0 && normalPrice > salePrice
      ? Math.round(((normalPrice - salePrice) / normalPrice) * 100)
      : 0;
  const hasDiscount = discountPercent >= 1;
  const isAdjusted = !hasDiscount && salePrice !== product.basePriceNum;

  return {
    normalPrice,
    salePrice,
    discountPercent,
    hasDiscount,
    isAdjusted
  };
}

function setProductPricing(product, normalPrice, salePrice) {
  const cleanNormal = Math.max(0, Math.round(Number(normalPrice) || 0));
  const cleanSale = Math.max(0, Math.round(Number(salePrice) || 0));

  if (cleanNormal <= 0) {
    delete workingMap[product.id];
  } else if (cleanSale > 0 && cleanSale < cleanNormal) {
    const pct = Math.round(((cleanNormal - cleanSale) / cleanNormal) * 100);
    if (pct >= 1) {
      workingMap[product.id] = { precio: cleanSale, precioAnterior: cleanNormal };
    } else if (cleanNormal !== product.basePriceNum) {
      workingMap[product.id] = { precio: cleanNormal };
    } else {
      delete workingMap[product.id];
    }
  } else if (cleanNormal !== product.basePriceNum) {
    workingMap[product.id] = { precio: cleanNormal };
  } else {
    delete workingMap[product.id];
  }

  saveDraft();
  updateStats();
}

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(workingMap));
  } catch {
    // ignore storage quota issues
  }
}

function updateStats() {
  let discounted = 0;
  let adjusted = 0;

  for (const product of catalogProducts) {
    const state = getItemPricingState(product);
    if (state.hasDiscount) discounted += 1;
    else if (state.isAdjusted) adjusted += 1;
  }

  $('#statTotal').textContent = String(catalogProducts.length);
  $('#statDiscounted').textContent = String(discounted);
  $('#statAdjusted').textContent = String(adjusted);
}

function populateBrands() {
  const brands = [...new Set(catalogProducts.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, 'es'));
  const select = $('#adminBrandSelect');
  select.innerHTML =
    '<option value="Todas">Todas</option>' +
    brands.map((brand) => `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`).join('');
}

function getFilteredProducts() {
  return catalogProducts.filter((product) => {
    if (activeBrand !== 'Todas' && product.brand !== activeBrand) return false;

    const state = getItemPricingState(product);
    if (activeStatus === 'discounted' && !state.hasDiscount) return false;
    if (activeStatus === 'adjusted' && !state.isAdjusted) return false;
    if (activeStatus === 'base' && (state.hasDiscount || state.isAdjusted)) return false;

    if (searchTerm) {
      const haystack = `${product.cleanName} ${product.brand} ${product.categoria} ${product.colorway} ${product.gender} ${product.id}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }

    return true;
  });
}

function syncItemRowVisual(rowEl, product, { syncNormalInput = false, syncPctInput = false, syncSaleInput = false, warningText = '' } = {}) {
  const state = getItemPricingState(product);
  const normalInput = rowEl.querySelector('[data-field="normal"]');
  const pctInput = rowEl.querySelector('[data-field="percent"]');
  const saleInput = rowEl.querySelector('[data-field="sale"]');
  const hint = rowEl.querySelector('.admin-field-hint');
  const statusLabel = rowEl.querySelector('.admin-preview-status');
  const badge = rowEl.querySelector('.admin-preview-badge');
  const finalStrong = rowEl.querySelector('.admin-preview-final');
  const oldDel = rowEl.querySelector('.admin-preview-old');
  const savingsText = rowEl.querySelector('.admin-preview-savings');

  if (syncNormalInput && normalInput) normalInput.value = formatDots(state.normalPrice);
  if (syncPctInput && pctInput) pctInput.value = state.discountPercent > 0 ? String(state.discountPercent) : '';
  if (syncSaleInput && saleInput) saleInput.value = formatDots(state.salePrice);

  rowEl.classList.toggle('has-discount', state.hasDiscount);
  rowEl.classList.toggle('is-adjusted', state.isAdjusted);

  rowEl.querySelectorAll('[data-quick-pct]').forEach((btn) => {
    const pctVal = Number(btn.dataset.quickPct);
    btn.classList.toggle('active', pctVal > 0 && state.discountPercent === pctVal);
  });

  if (hint) {
    hint.hidden = !warningText;
    hint.textContent = warningText;
  }

  if (state.hasDiscount) {
    statusLabel.textContent = 'En oferta activa';
    badge.hidden = false;
    badge.textContent = `-${state.discountPercent}%`;
    finalStrong.textContent = peso(state.salePrice);
    oldDel.hidden = false;
    oldDel.textContent = peso(state.normalPrice);
    savingsText.textContent = `El cliente ahorra ${peso(state.normalPrice - state.salePrice)}`;
  } else if (state.isAdjusted) {
    statusLabel.textContent = 'Precio ajustado';
    badge.hidden = true;
    badge.textContent = '';
    finalStrong.textContent = peso(state.salePrice);
    oldDel.hidden = true;
    oldDel.textContent = '';
    savingsText.textContent = `Catálogo CSV original: ${peso(product.basePriceNum)}`;
  } else {
    statusLabel.textContent = 'Precio normal';
    badge.hidden = true;
    badge.textContent = '';
    finalStrong.textContent = peso(product.basePriceNum);
    oldDel.hidden = true;
    oldDel.textContent = '';
    savingsText.textContent = 'Sin modificaciones frente al catálogo';
  }
}

function buildAdminRow(product) {
  const state = getItemPricingState(product);
  const article = document.createElement('article');
  article.className = 'admin-item';
  article.dataset.productId = product.id;

  article.innerHTML = `
    <div class="admin-item-info">
      <img class="admin-item-thumb" loading="lazy" src="${escapeHtml(product.renderImage)}" alt="${escapeHtml(product.cleanName)}" />
      <div class="admin-item-meta">
        <p class="admin-item-kicker">${escapeHtml(product.brand)} · ${escapeHtml(product.categoria)} · ${escapeHtml(product.gender)}</p>
        <h2 class="admin-item-title">${escapeHtml(product.cleanName)}</h2>
        <p class="admin-item-sub">${product.colorway ? `${escapeHtml(product.colorway)} · ` : ''}CSV: ${escapeHtml(peso(product.basePriceNum))}</p>
        <p class="admin-item-id" title="${escapeHtml(product.id)}">${escapeHtml(product.id)}</p>
      </div>
    </div>

    <div class="admin-item-controls">
      <div class="admin-inputs-grid">
        <div class="admin-field">
          <label>Precio normal (COP)</label>
          <div class="admin-input-box">
            <span class="admin-input-prefix">$</span>
            <input type="text" inputmode="numeric" data-field="normal" value="${escapeHtml(formatDots(state.normalPrice))}" aria-label="Precio normal de ${escapeHtml(product.cleanName)}" />
          </div>
        </div>

        <div class="admin-field">
          <label>Descuento</label>
          <div class="admin-input-box">
            <input type="text" inputmode="numeric" data-field="percent" placeholder="0" value="${state.discountPercent > 0 ? escapeHtml(String(state.discountPercent)) : ''}" aria-label="Porcentaje de descuento de ${escapeHtml(product.cleanName)}" />
            <span class="admin-input-suffix">%</span>
          </div>
        </div>

        <div class="admin-field">
          <label>Precio con descuento</label>
          <div class="admin-input-box">
            <span class="admin-input-prefix">$</span>
            <input type="text" inputmode="numeric" data-field="sale" value="${escapeHtml(formatDots(state.salePrice))}" aria-label="Precio final con descuento de ${escapeHtml(product.cleanName)}" />
          </div>
        </div>
      </div>

      <div class="admin-quick-row">
        <span class="admin-quick-label">Rápido:</span>
        <button class="admin-quick-chip" type="button" data-quick-pct="10">-10%</button>
        <button class="admin-quick-chip" type="button" data-quick-pct="15">-15%</button>
        <button class="admin-quick-chip" type="button" data-quick-pct="20">-20%</button>
        <button class="admin-quick-chip" type="button" data-quick-pct="25">-25%</button>
        <button class="admin-quick-chip is-reset" type="button" data-action="clear-discount">Quitar descuento</button>
        <button class="admin-quick-chip is-reset" type="button" data-action="reset-base">Restablecer CSV</button>
      </div>

      <p class="admin-field-hint" hidden></p>
    </div>

    <div class="admin-item-preview">
      <div class="admin-preview-top">
        <span class="admin-preview-status">Precio normal</span>
        <span class="admin-preview-badge" hidden></span>
      </div>
      <div class="admin-preview-prices">
        <strong class="admin-preview-final"></strong>
        <del class="admin-preview-old" hidden></del>
      </div>
      <p class="admin-preview-savings"></p>
    </div>
  `;

  const img = article.querySelector('img');
  img.addEventListener('error', () => {
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = '1';
    img.src = FALLBACK_SHOE_SVG;
  });

  const normalInput = article.querySelector('[data-field="normal"]');
  const pctInput = article.querySelector('[data-field="percent"]');
  const saleInput = article.querySelector('[data-field="sale"]');

  [normalInput, saleInput].forEach((input) => {
    input.addEventListener('focus', () => {
      const raw = priceNumber(input.value);
      input.value = raw > 0 ? String(raw) : '';
      input.select();
    });
  });

  normalInput.addEventListener('input', () => {
    const newNormal = priceNumber(normalInput.value);
    const activePct = Math.min(90, Math.max(0, priceNumber(pctInput.value)));
    if (newNormal <= 0) return;

    const newSale =
      activePct > 0 ? Math.max(1000, Math.round(newNormal * (1 - activePct / 100))) : newNormal;
    setProductPricing(product, newNormal, newSale);
    syncItemRowVisual(article, product, { syncSaleInput: true });
  });

  normalInput.addEventListener('blur', () => {
    const val = priceNumber(normalInput.value);
    if (val <= 0) {
      const stateNow = getItemPricingState(product);
      setProductPricing(product, product.basePriceNum, stateNow.salePrice);
    }
    syncItemRowVisual(article, product, { syncNormalInput: true, syncPctInput: true, syncSaleInput: true });
  });

  pctInput.addEventListener('input', () => {
    let pct = priceNumber(pctInput.value);
    if (pct > 90) {
      pct = 90;
      pctInput.value = '90';
    }
    const currentNormal = priceNumber(normalInput.value) || getItemPricingState(product).normalPrice;
    const newSale =
      pct > 0 ? Math.max(1000, Math.round(currentNormal * (1 - pct / 100))) : currentNormal;
    setProductPricing(product, currentNormal, newSale);
    syncItemRowVisual(article, product, { syncSaleInput: true });
  });

  pctInput.addEventListener('blur', () => {
    syncItemRowVisual(article, product, { syncPctInput: true, syncSaleInput: true });
  });

  saleInput.addEventListener('input', () => {
    const newSale = priceNumber(saleInput.value);
    const currentNormal = priceNumber(normalInput.value) || getItemPricingState(product).normalPrice;
    if (newSale <= 0) return;

    let warningText = '';
    if (newSale >= currentNormal) {
      warningText = `Para mostrar descuento debe ser menor a ${peso(currentNormal)}.`;
      setProductPricing(product, currentNormal, currentNormal);
      syncItemRowVisual(article, product, { syncPctInput: true, warningText });
      return;
    }

    setProductPricing(product, currentNormal, newSale);
    syncItemRowVisual(article, product, { syncPctInput: true });
  });

  saleInput.addEventListener('blur', () => {
    const rawSale = priceNumber(saleInput.value);
    const currentNormal = priceNumber(normalInput.value) || getItemPricingState(product).normalPrice;
    if (rawSale <= 0) {
      setProductPricing(product, currentNormal, currentNormal);
    }
    syncItemRowVisual(article, product, { syncNormalInput: true, syncPctInput: true, syncSaleInput: true });
  });

  article.querySelectorAll('[data-quick-pct]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pct = Number(btn.dataset.quickPct) || 0;
      const currentNormal = priceNumber(normalInput.value) || getItemPricingState(product).normalPrice;
      const newSale = Math.max(1000, Math.round(currentNormal * (1 - pct / 100)));
      setProductPricing(product, currentNormal, newSale);
      syncItemRowVisual(article, product, { syncNormalInput: true, syncPctInput: true, syncSaleInput: true });
    });
  });

  article.querySelector('[data-action="clear-discount"]').addEventListener('click', () => {
    const currentNormal = priceNumber(normalInput.value) || getItemPricingState(product).normalPrice;
    setProductPricing(product, currentNormal, currentNormal);
    syncItemRowVisual(article, product, { syncNormalInput: true, syncPctInput: true, syncSaleInput: true });
  });

  article.querySelector('[data-action="reset-base"]').addEventListener('click', () => {
    delete workingMap[product.id];
    saveDraft();
    updateStats();
    syncItemRowVisual(article, product, { syncNormalInput: true, syncPctInput: true, syncSaleInput: true });
  });

  syncItemRowVisual(article, product);
  return article;
}

function renderList() {
  const list = $('#adminList');
  const pagination = $('#adminPagination');
  const filtered = getFilteredProducts();
  const total = filtered.length;
  const shown = filtered.slice(0, visibleLimit);

  list.innerHTML = '';

  if (!total) {
    pagination.hidden = true;
    list.innerHTML =
      '<div class="admin-message">No hay zapatillas que coincidan con ese filtro o búsqueda.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  shown.forEach((product) => {
    fragment.append(buildAdminRow(product));
  });
  list.append(fragment);

  if (total > shown.length) {
    pagination.hidden = false;
    const remaining = total - shown.length;
    $('#adminPaginationStatus').textContent = `Mostrando ${shown.length} de ${total} referencias`;
    $('#adminLoadMoreBtn').hidden = false;
    $('#adminLoadMoreBtn').textContent = `Mostrar ${Math.min(ADMIN_PAGE_SIZE, remaining)} más (quedan ${remaining})`;
    $('#adminShowAllBtn').hidden = false;
  } else {
    pagination.hidden = true;
  }
}

function downloadJsonFile() {
  const cleanExport = sanitizeDiscountMap(workingMap);
  try {
    localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(cleanExport));
  } catch {
    // ignore storage errors
  }

  const content = JSON.stringify(cleanExport, null, 2) + '\n';
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'descuentos.json';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  const count = Object.keys(cleanExport).length;
  showToast(
    count > 0
      ? `Se descargó descuentos.json con ${count} ${count === 1 ? 'referencia modificada' : 'referencias modificadas'}. Súbelo a tu repo en GitHub para publicar.`
      : 'Se descargó descuentos.json vacío (todas las zapatillas con precio de catálogo).'
  );
}

function openStorePreview() {
  const cleanExport = sanitizeDiscountMap(workingMap);
  try {
    localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(cleanExport));
  } catch {
    showToast('No pudimos guardar la vista previa en este navegador.');
    return;
  }
  window.open('../?preview=1', '_blank', 'noopener');
}

function encodeUtf8Base64(text) {
  const bytes = new TextEncoder().encode(String(text || ''));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeUtf8Base64(base64) {
  const cleaned = String(base64 || '').replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function githubHeaders(token, includeContentType = false) {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function verifyGithubToken(token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) {
    throw new Error('Ingresa un token personal de GitHub.');
  }

  const [repoRes, userRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`, {
      headers: githubHeaders(cleanToken),
      cache: 'no-store'
    }),
    fetch('https://api.github.com/user', {
      headers: githubHeaders(cleanToken),
      cache: 'no-store'
    }).catch(() => null)
  ]);

  if (repoRes.status === 401) {
    throw new Error('El token es inválido o ya expiró. Revisa o genera uno nuevo en GitHub.');
  }
  if (repoRes.status === 403 || repoRes.status === 404) {
    throw new Error(`El token no tiene acceso al repositorio ${GITHUB_OWNER}/${GITHUB_REPO}.`);
  }
  if (!repoRes.ok) {
    throw new Error(`No pudimos validar el token con GitHub (error ${repoRes.status}).`);
  }

  const repoData = await repoRes.json();
  if (!repoData.permissions || !repoData.permissions.push) {
    throw new Error('Tu token no tiene permisos de escritura (Contents: Read and write) sobre este repositorio.');
  }

  let userLogin = GITHUB_OWNER;
  if (userRes && userRes.ok) {
    try {
      const userData = await userRes.json();
      if (userData && userData.login) userLogin = userData.login;
    } catch {
      // ignore optional user profile parse issue
    }
  }

  return { token: cleanToken, userLogin };
}

async function fetchFileFromGithub(token) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}?ref=${GITHUB_BRANCH}&t=${Date.now()}`;
  const res = await fetch(url, {
    headers: githubHeaders(token),
    cache: 'no-store'
  });

  if (res.status === 404) {
    return { sha: null, contentText: '{}' };
  }
  if (!res.ok) {
    throw new Error(`Error al consultar ${GITHUB_FILE_PATH} en GitHub (${res.status}).`);
  }
  const data = await res.json();
  return {
    sha: data.sha || null,
    contentText: data.content ? decodeUtf8Base64(data.content) : '{}'
  };
}

async function publishDiscountsToGithub() {
  if (!activeToken) {
    showToast('Tu sesión expiró. Vuelve a ingresar tu token.');
    logoutAdmin();
    return;
  }

  const publishBtn = $('#publishStoreBtn');
  const originalLabel = publishBtn.textContent;
  publishBtn.disabled = true;
  publishBtn.textContent = 'Publicando...';

  try {
    const cleanExport = sanitizeDiscountMap(workingMap);
    const jsonText = JSON.stringify(cleanExport, null, 2) + '\n';
    const encodedContent = encodeUtf8Base64(jsonText);
    const count = Object.keys(cleanExport).length;
    const commitMessage =
      count > 0
        ? `Actualizar descuentos (${count} ${count === 1 ? 'referencia' : 'referencias'})`
        : 'Restablecer precios base del catálogo';

    const putFile = async (sha) => {
      const body = {
        message: commitMessage,
        content: encodedContent,
        branch: GITHUB_BRANCH
      };
      if (sha) body.sha = sha;

      return fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
        {
          method: 'PUT',
          headers: githubHeaders(activeToken, true),
          body: JSON.stringify(body)
        }
      );
    };

    const currentFile = await fetchFileFromGithub(activeToken);
    let putRes = await putFile(currentFile.sha);

    if (putRes.status === 409) {
      const latestFile = await fetchFileFromGithub(activeToken);
      putRes = await putFile(latestFile.sha);
    }

    if (putRes.status === 401) {
      throw new Error('Tu token expiró. Vuelve a iniciar sesión.');
    }
    if (putRes.status === 403 || putRes.status === 404) {
      throw new Error('El token no tiene permiso "Contents: Read and write". Actualízalo en GitHub e intenta de nuevo.');
    }
    if (!putRes.ok) {
      let detail = '';
      try {
        const errData = await putRes.json();
        if (errData && errData.message) detail = ` (${errData.message})`;
      } catch {
        // ignore
      }
      throw new Error(`No pudimos guardar en GitHub${detail}.`);
    }

    publishedMap = cleanExport;
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(cleanExport));
    } catch {
      // ignore storage errors
    }

    $('#adminBannerMsg').hidden = true;
    showToast(
      count > 0
        ? `Publicado en GitHub (${count} ${count === 1 ? 'referencia' : 'referencias'}). La tienda en línea se actualizará en ~1 minuto.`
        : 'Publicado en GitHub: todos los pares volvieron a su precio de catálogo.'
    );
  } catch (error) {
    showToast(error.message || 'Ocurrió un error al publicar en GitHub.');
  } finally {
    publishBtn.disabled = false;
    publishBtn.textContent = originalLabel;
  }
}

function saveTokenToStorage(token, remember) {
  try {
    sessionStorage.setItem(TOKEN_SESSION_KEY, token);
    if (remember) {
      localStorage.setItem(TOKEN_LOCAL_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_LOCAL_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function getStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_SESSION_KEY) || localStorage.getItem(TOKEN_LOCAL_KEY) || '';
  } catch {
    return '';
  }
}

function clearStoredToken() {
  try {
    sessionStorage.removeItem(TOKEN_SESSION_KEY);
    localStorage.removeItem(TOKEN_LOCAL_KEY);
  } catch {
    // ignore
  }
}

function logoutAdmin() {
  activeToken = '';
  activeGithubLogin = '';
  clearStoredToken();
  $('#adminAuthActions').hidden = true;
  $('#adminMain').hidden = true;
  $('#adminAuthGate').hidden = false;
  $('#githubTokenInput').value = '';
  $('#authError').hidden = true;
  $('#adminList').innerHTML = '';
}

function bindWorkspaceEvents() {
  if (workspaceEventsBound) return;
  workspaceEventsBound = true;

  $('#adminSearchInput').addEventListener('input', (event) => {
    searchTerm = event.target.value.trim().toLowerCase();
    visibleLimit = ADMIN_PAGE_SIZE;
    renderList();
  });

  $('#adminBrandSelect').addEventListener('change', (event) => {
    activeBrand = event.target.value;
    visibleLimit = ADMIN_PAGE_SIZE;
    renderList();
  });

  $$('#adminStatusFilters [data-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeStatus = btn.dataset.status;
      $$('#adminStatusFilters [data-status]').forEach((b) =>
        b.classList.toggle('active', b.dataset.status === activeStatus)
      );
      visibleLimit = ADMIN_PAGE_SIZE;
      renderList();
    });
  });

  $('#adminLoadMoreBtn').addEventListener('click', () => {
    visibleLimit += ADMIN_PAGE_SIZE;
    renderList();
  });

  $('#adminShowAllBtn').addEventListener('click', () => {
    visibleLimit = catalogProducts.length;
    renderList();
  });

  $('#publishStoreBtn').addEventListener('click', publishDiscountsToGithub);
  $('#downloadJsonBtn').addEventListener('click', downloadJsonFile);
  $('#previewStoreBtn').addEventListener('click', openStorePreview);
  $('#logoutBtn').addEventListener('click', logoutAdmin);

  $('#importJsonBtn').addEventListener('click', () => {
    $('#importJsonInput').click();
  });

  $('#importJsonInput').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      workingMap = sanitizeDiscountMap(parsed);
      saveDraft();
      updateStats();
      renderList();
      showToast(`Importado ${file.name} correctamente.`);
    } catch {
      showToast('El archivo seleccionado no es un JSON válido.');
    }
  });

  $('#restorePublishedBtn').addEventListener('click', () => {
    workingMap = sanitizeDiscountMap(publishedMap);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    $('#adminBannerMsg').hidden = true;
    updateStats();
    renderList();
    showToast('Se restauraron los precios publicados actualmente en descuentos.json.');
  });

  $('#clearAllBtn').addEventListener('click', () => {
    workingMap = {};
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    $('#adminBannerMsg').hidden = true;
    updateStats();
    renderList();
    showToast('Se limpiaron todos los ajustes y descuentos.');
  });
}

async function loadAdminCatalog() {
  bindWorkspaceEvents();
  $('#adminBannerMsg').hidden = true;

  try {
    const [csvRes, githubFile] = await Promise.all([
      fetch(`../catalogo.csv?v=${Date.now()}`),
      fetchFileFromGithub(activeToken).catch(async () => {
        const fallbackRes = await fetch(`../descuentos.json?v=${Date.now()}`).catch(() => null);
        if (!fallbackRes || !fallbackRes.ok) return { contentText: '{}' };
        return { contentText: await fallbackRes.text() };
      })
    ]);

    if (!csvRes.ok) throw new Error('No se encontró catalogo.csv');
    const parsedRows = parseCSV(await csvRes.text());

    catalogProducts = parsedRows
      .filter((row) => row.id && row.nombre)
      .map((row, index) => {
        const cleanName = normalizeDisplayName(row.nombre);
        const sizes = String(row.tallas || '')
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean);
        return {
          ...row,
          index,
          cleanName,
          brand: detectBrand(cleanName),
          colorway: extractColorway(row.id),
          gender: detectGenderLabel(row.id, sizes),
          basePriceNum: priceNumber(row.precio),
          renderImage: toAdminRenderImage(row.imagen)
        };
      })
      .reverse();

    try {
      publishedMap = sanitizeDiscountMap(JSON.parse(githubFile.contentText || '{}'));
    } catch {
      publishedMap = {};
    }

    let draftLoaded = false;
    try {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        workingMap = sanitizeDiscountMap(JSON.parse(savedDraft));
        draftLoaded = Object.keys(workingMap).length > 0;
      } else {
        workingMap = sanitizeDiscountMap(publishedMap);
      }
    } catch {
      workingMap = sanitizeDiscountMap(publishedMap);
    }

    populateBrands();
    updateStats();
    renderList();

    if (draftLoaded) {
      $('#adminBannerMsg').hidden = false;
      $('#adminBannerMsg').innerHTML =
        'Tienes cambios guardados en tu borrador local. Cuando termines, usa <strong>Vista previa</strong> o <strong>Publicar en la tienda</strong>.';
    }
  } catch {
    $('#adminBannerMsg').hidden = false;
    $('#adminBannerMsg').innerHTML =
      '<strong>No pudimos cargar el catálogo.</strong> Abre la tienda desde un servidor local (por ejemplo Live Server) o desde tu sitio publicado para leer <code>catalogo.csv</code>.';
  }
}

async function unlockAdminPanel(token, userLogin, remember) {
  activeToken = token;
  activeGithubLogin = userLogin;
  saveTokenToStorage(token, remember);
  $('#authUserDisplay').textContent = userLogin;
  $('#adminAuthGate').hidden = true;
  $('#adminAuthActions').hidden = false;
  $('#adminMain').hidden = false;
  await loadAdminCatalog();
}

function bindAuthEvents() {
  const tokenInput = $('#githubTokenInput');
  const toggleBtn = $('#toggleTokenVisibility');
  const authForm = $('#authForm');
  const authError = $('#authError');
  const submitBtn = $('#authSubmitBtn');
  const rememberCheck = $('#rememberTokenCheck');

  toggleBtn.addEventListener('click', () => {
    const isSecret = tokenInput.type === 'password';
    tokenInput.type = isSecret ? 'text' : 'password';
    toggleBtn.textContent = isSecret ? 'Ocultar' : 'Mostrar';
  });

  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    authError.hidden = true;
    const rawToken = tokenInput.value.trim();
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verificando con GitHub...';

    try {
      const verified = await verifyGithubToken(rawToken);
      await unlockAdminPanel(verified.token, verified.userLogin, rememberCheck.checked);
    } catch (error) {
      authError.hidden = false;
      authError.textContent = error.message || 'No pudimos verificar el token.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

async function initAuth() {
  bindAuthEvents();
  const savedToken = getStoredToken();
  if (!savedToken) return;

  const submitBtn = $('#authSubmitBtn');
  const rememberCheck = $('#rememberTokenCheck');
  let isLocalRemembered = false;
  try {
    isLocalRemembered = Boolean(localStorage.getItem(TOKEN_LOCAL_KEY));
  } catch {
    isLocalRemembered = false;
  }
  rememberCheck.checked = isLocalRemembered;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Restaurando sesión...';

  try {
    const verified = await verifyGithubToken(savedToken);
    await unlockAdminPanel(verified.token, verified.userLogin, isLocalRemembered);
  } catch {
    clearStoredToken();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Verificar y entrar →';
  }
}

initAuth();
