const WHATSAPP = '573217430829';
const PAGE_SIZE = 16;
const HERO_AUTOPLAY_MS = 7500;
// Opcional: si no agregas la columna `precio_anterior` en catalogo.csv,
// puedes indicar aquí el precio anterior real de las referencias en oferta.
// Ejemplo: 'nike-cortez-hombre-blanco-negro': 180000
const PREVIOUS_PRICES = {};

const FALLBACK_SHOE_SVG =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="none">
      <rect width="400" height="400" fill="#F2F3F6"/>
      <path d="M68 242h240c20 0 34-12 34-28 0-17-14-30-38-34l-64-10-54-58c-7-8-18-6-24 3l-24 36c-16 23-42 37-76 43l-34 6c-14 3-22 12-22 23 0 11 9 19 22 19Z" stroke="#9AA1AF" stroke-width="10" stroke-linejoin="round"/>
      <path d="M54 270h288" stroke="#C5CAD4" stroke-width="10" stroke-linecap="round"/>
      <text x="200" y="330" text-anchor="middle" fill="#6B7280" font-family="sans-serif" font-size="16" font-weight="600">Imagen no disponible</text>
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

let products = [];
let activeGender = 'Todos';
let activeCategory = 'Todas';
let activeBrand = 'Todas';
let activeSize = 'Todas';
let sortBy = 'recent';
let searchTerm = '';
let visibleCount = PAGE_SIZE;
let activeSlide = 0;
let heroTimer = null;
let cart = [];

try {
  cart = JSON.parse(localStorage.getItem('mdt-cart') || '[]');
  if (!Array.isArray(cart)) cart = [];
} catch {
  cart = [];
}

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

function money(value) {
  return value || '$ 0';
}

function priceNumber(price) {
  return Number(String(price || '').replace(/[^0-9]/g, '')) || 0;
}

function peso(value) {
  return '$ ' + new Intl.NumberFormat('es-CO').format(value);
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

function detectGenderInfo(id, sizes) {
  const nums = sizes.map((s) => Number(s)).filter((n) => !Number.isNaN(n));
  const hasSmall = nums.some((n) => n <= 38);
  const hasLarge = nums.some((n) => n >= 41);

  if ((hasSmall && hasLarge) || /-unisex-/i.test(id)) {
    return { gender: 'Unisex', isHombre: true, isMujer: true };
  }
  if (/-hombre-/i.test(id)) {
    return { gender: 'Hombre', isHombre: true, isMujer: false };
  }
  if (/-mujer-/i.test(id)) {
    return { gender: 'Mujer', isHombre: false, isMujer: true };
  }
  return {
    gender: hasSmall && !hasLarge ? 'Mujer' : 'Hombre',
    isHombre: hasLarge || !hasSmall,
    isMujer: hasSmall
  };
}

function toLocalRenderImage(rawUrl) {
  const cleaned = String(rawUrl || '').trim();
  if (!cleaned) return FALLBACK_SHOE_SVG;
  return cleaned.replace(/^https?:\/\/mundodelastenis\.online\//i, '');
}

function toWhatsappImageUrl(rawUrl) {
  const cleaned = String(rawUrl || '').trim();
  if (!cleaned) return '';
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  try {
    return new URL(cleaned, location.href).href;
  } catch {
    return cleaned;
  }
}

function attachImageFallback(imgElement) {
  imgElement.addEventListener('error', () => {
    if (imgElement.dataset.fallbackApplied) return;
    imgElement.dataset.fallbackApplied = '1';
    imgElement.src = FALLBACK_SHOE_SVG;
  });
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

function isDiscountPreviewMode() {
  try {
    return new URLSearchParams(location.search).get('preview') === '1';
  } catch {
    return false;
  }
}

function renderPreviewBanner() {
  if (document.querySelector('.preview-mode-banner')) return;
  const bar = document.createElement('div');
  bar.className = 'preview-mode-banner';
  bar.innerHTML = `
    <span><strong>Vista previa local activa:</strong> estás viendo los precios y descuentos editados en este navegador (aún no publicados en <code>descuentos.json</code>).</span>
    <div class="preview-mode-actions">
      <a href="gestion-descuentos/">Volver al editor</a>
      <a href="${escapeHtml(location.pathname)}">Salir de vista previa</a>
    </div>
  `;
  document.body.prepend(bar);
}

async function loadDiscounts() {
  if (isDiscountPreviewMode()) {
    try {
      const raw = localStorage.getItem('mdt-discounts-preview');
      renderPreviewBanner();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore invalid preview JSON
    }
  }

  try {
    const response = await fetch(`descuentos.json?v=${Date.now()}`);
    if (!response.ok) return {};
    const parsed = await response.json();
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function enrichProducts(rawRows, discountsMap = {}) {
  const valid = rawRows.filter((p) => p.id && p.nombre);
  const total = valid.length;
  return valid.map((row, index) => {
    const cleanName = normalizeDisplayName(row.nombre);
    const brand = detectBrand(cleanName);
    const sizes = String(row.tallas || '')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    const genderInfo = detectGenderInfo(row.id, sizes);
    const colorway = extractColorway(row.id);

    const override = discountsMap && typeof discountsMap === 'object' ? discountsMap[row.id] : null;
    const basePriceNum = priceNumber(row.precio);
    const overridePriceNum =
      override && typeof override === 'object' ? priceNumber(override.precio ?? override.precioDescuento) : 0;
    const priceNum = overridePriceNum > 0 ? overridePriceNum : basePriceNum;
    const effectivePrecio = overridePriceNum > 0 ? peso(overridePriceNum) : row.precio;

    const rawPreviousPrice =
      (override && typeof override === 'object' ? override.precioAnterior ?? override.precioNormal : '') ||
      row.precio_anterior ||
      row.precioAnterior ||
      PREVIOUS_PRICES[row.id] ||
      '';
    const previousPriceNum = priceNumber(rawPreviousPrice);
    const discountPercent =
      priceNum > 0 && previousPriceNum > priceNum
        ? Math.round(((previousPriceNum - priceNum) / previousPriceNum) * 100)
        : 0;
    const hasDiscount = discountPercent >= 1;

    return {
      ...row,
      precio: effectivePrecio,
      index,
      isNewDrop: total - index <= 12,
      cleanName,
      brand,
      sizes,
      colorway,
      gender: genderInfo.gender,
      isHombre: genderInfo.isHombre,
      isMujer: genderInfo.isMujer,
      priceNum,
      previousPriceNum: hasDiscount ? previousPriceNum : 0,
      previousPriceText: hasDiscount ? peso(previousPriceNum) : '',
      discountPercent,
      hasDiscount,
      renderImage: toLocalRenderImage(row.imagen),
      whatsappImage: toWhatsappImageUrl(row.imagen)
    };
  });
}

function syncHeroAndStoryFromCatalog() {
  if (!products.length) return;
  const newestFirst = [...products].reverse();
  const preferredIds = [
    'nike-air-ultra-p6000-hombre-negro',
    'jordan-retro-hombre-azul-blanco-negro-verde-neon',
    'asics-superblast-hombre-azul-blanco-gris'
  ];
  const heroCards = $$('#heroShowcase [data-hero-product]');
  const pickByCategory = (category, fallbackIndex) =>
    newestFirst.find((p) => p.categoria === category) || newestFirst[fallbackIndex] || newestFirst[0];

  const targets = [
    products.find((p) => p.id === preferredIds[0]) || pickByCategory('Lifestyle', 0),
    products.find((p) => p.id === preferredIds[1]) || pickByCategory('Retro', 1),
    products.find((p) => p.id === preferredIds[2]) || pickByCategory('Running', 2)
  ];

  heroCards.forEach((card, idx) => {
    const prod = targets[idx];
    if (!prod) return;
    card.dataset.heroProduct = prod.id;
    const img = card.querySelector('img');
    const kicker = card.querySelector('.hero-card-meta span');
    const title = card.querySelector('.hero-card-meta strong');
    const price = card.querySelector('.hero-card-price');
    const oldPrice = card.querySelector('.hero-card-price-old');
    const discountBadge = card.querySelector('.hero-card-discount');
    if (img) {
      img.src = prod.renderImage;
      img.alt = prod.cleanName;
      attachImageFallback(img);
    }
    if (kicker) kicker.textContent = `${prod.brand} · ${prod.categoria}`;
    if (title) title.textContent = prod.cleanName;
    if (price) {
      price.textContent = money(prod.precio);
      price.classList.toggle('is-discounted', prod.hasDiscount);
    }
    if (oldPrice) {
      oldPrice.hidden = !prod.hasDiscount;
      oldPrice.textContent = prod.hasDiscount ? prod.previousPriceText : '';
    }
    if (discountBadge) {
      discountBadge.hidden = !prod.hasDiscount;
      discountBadge.textContent = prod.hasDiscount ? `-${prod.discountPercent}%` : '';
    }
  });

  const storyImg = $('.story-media img');
  if (storyImg) {
    const storyProd = targets[1] || targets[0];
    storyImg.src = storyProd.renderImage;
    storyImg.alt = `${storyProd.cleanName} en Mundo de las Tenis`;
    attachImageFallback(storyImg);
  }
}

async function loadCatalog() {
  try {
    const [response, discountsMap] = await Promise.all([
      fetch(`catalogo.csv?v=${Date.now()}`),
      loadDiscounts()
    ]);
    if (!response.ok) throw new Error('No se encontró el catálogo');
    const parsed = parseCSV(await response.text());
    products = enrichProducts(parsed, discountsMap);

    if (!products.length) {
      renderEmptyCatalog();
      return;
    }

    const featuredSection = $('.featured-section');
    const brandsSection = $('.brands-section');
    if (featuredSection) featuredSection.hidden = false;
    if (brandsSection) brandsSection.hidden = false;

    syncHeroAndStoryFromCatalog();
    populateSelects();
    renderBrands();
    renderFeaturedCarousel();
    renderCatalog();
  } catch (error) {
    $('#catalogMessage').hidden = false;
    $('#catalogMessage').innerHTML =
      '<strong>No pudimos cargar el catálogo.</strong> Abre la tienda desde un servidor local o en línea para leer <code>catalogo.csv</code>.';
    $('#productTotal').textContent = 'Catálogo no disponible';
  }
}

function renderEmptyCatalog() {
  const featuredSection = $('.featured-section');
  const brandsSection = $('.brands-section');
  if (featuredSection) featuredSection.hidden = true;
  if (brandsSection) brandsSection.hidden = true;
  $('#productTotal').textContent = 'Nueva colección próximamente';
  $('#catalogMessage').hidden = true;
  $('#catalogPagination').hidden = true;
  $('#productGrid').innerHTML =
    '<div class="no-results"><p>Estamos preparando el próximo drop. Síguenos en Instagram para conocer las próximas referencias.</p><a class="btn btn-dark" href="https://instagram.com/mundodelastenis" target="_blank" rel="noreferrer">Ver Instagram ↗</a></div>';
}

function populateSelects() {
  const brands = [...new Set(products.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, 'es'));
  const brandSelect = $('#brandSelect');
  brandSelect.innerHTML =
    '<option value="Todas">Todas</option>' +
    brands.map((brand) => `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`).join('');

  const allSizes = [...new Set(products.flatMap((p) => p.sizes))].sort((a, b) => Number(a) - Number(b));
  const sizeSelect = $('#sizeSelect');
  sizeSelect.innerHTML =
    '<option value="Todas">Todas</option>' +
    allSizes.map((size) => `<option value="${escapeHtml(size)}">EUR ${escapeHtml(size)}</option>`).join('');
}

function renderBrands() {
  const counts = new Map();
  for (const product of products) {
    counts.set(product.brand, (counts.get(product.brand) || 0) + 1);
  }
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  $('#brandsGrid').innerHTML = ordered
    .map(
      ([brand, count]) => `
        <button class="brand-tile ${activeBrand === brand ? 'active' : ''}" type="button" data-brand-tile="${escapeHtml(brand)}">
          <span class="brand-tile-mark">${escapeHtml(brand)}</span>
          <span>${count} ${count === 1 ? 'referencia' : 'referencias'}</span>
        </button>
      `
    )
    .join('');

  $$('[data-brand-tile]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetBrand = btn.dataset.brandTile;
      activeBrand = activeBrand === targetBrand ? 'Todas' : targetBrand;
      $('#brandSelect').value = activeBrand;
      visibleCount = PAGE_SIZE;
      renderBrands();
      renderCatalog();
      $('#catalogo').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function buildProductCardNode(product, { isFeatured = false, eager = false } = {}) {
  const node = $('#productTemplate').content.cloneNode(true);
  const card = node.querySelector('.product-card');
  const mediaBtn = node.querySelector('.product-media');
  const img = node.querySelector('img');
  const discountBadge = node.querySelector('.badge-discount');
  const dropBadge = node.querySelector('.badge-drop');
  const genderBadge = node.querySelector('.badge-gender');
  const kicker = node.querySelector('.product-kicker');
  const title = node.querySelector('.product-title');
  const colorway = node.querySelector('.product-colorway');
  const price = node.querySelector('.product-price');
  const oldPrice = node.querySelector('.product-price-old');
  const sizesHint = node.querySelector('.product-sizes-hint');
  const cta = node.querySelector('.product-cta');

  if (eager) img.loading = 'eager';
  img.src = product.renderImage;
  img.alt = `${product.cleanName}${product.colorway ? ` — ${product.colorway}` : ''}`;
  attachImageFallback(img);

  card.classList.toggle('has-discount', product.hasDiscount);
  if (discountBadge) {
    discountBadge.hidden = !product.hasDiscount;
    discountBadge.textContent = product.hasDiscount ? `-${product.discountPercent}%` : '';
  }

  if (isFeatured) {
    dropBadge.hidden = false;
    dropBadge.textContent = 'Top Drop';
  } else if (product.isNewDrop) {
    dropBadge.hidden = false;
    dropBadge.textContent = 'Nuevo';
  }

  genderBadge.textContent = product.gender;
  kicker.textContent = `${product.brand} · ${product.categoria}`;
  title.textContent = product.cleanName;

  if (product.colorway) {
    colorway.textContent = product.colorway;
  } else {
    colorway.hidden = true;
  }

  price.textContent = money(product.precio);
  price.classList.toggle('is-discounted', product.hasDiscount);
  if (oldPrice) {
    oldPrice.hidden = !product.hasDiscount;
    oldPrice.textContent = product.hasDiscount ? product.previousPriceText : '';
  }

  if (product.sizes.length > 1) {
    sizesHint.textContent = `EUR ${product.sizes[0]}–${product.sizes[product.sizes.length - 1]}`;
  } else if (product.sizes.length === 1) {
    sizesHint.textContent = `Talla EUR ${product.sizes[0]}`;
  }

  const openHandler = () => openProduct(product.id);
  mediaBtn.addEventListener('click', openHandler);
  cta.addEventListener('click', openHandler);
  card.dataset.productId = product.id;
  return node;
}

function renderFeaturedCarousel() {
  const track = $('#featuredTrack');
  if (!track || !products.length) return;

  const picked = [];
  const usedBrands = new Set();
  const newestFirst = [...products].reverse();

  for (const item of newestFirst) {
    if (!usedBrands.has(item.brand)) {
      picked.push(item);
      usedBrands.add(item.brand);
    }
    if (picked.length === 8) break;
  }

  if (picked.length < 8) {
    for (const item of newestFirst) {
      if (!picked.some((p) => p.id === item.id)) {
        picked.push(item);
      }
      if (picked.length === 8) break;
    }
  }

  track.innerHTML = '';
  picked.forEach((product) => {
    track.append(buildProductCardNode(product, { isFeatured: true, eager: true }));
  });
}

function getFilteredProducts() {
  const filtered = products.filter((p) => {
    if (activeGender === 'Hombre' && !p.isHombre) return false;
    if (activeGender === 'Mujer' && !p.isMujer) return false;
    if (activeCategory !== 'Todas' && p.categoria !== activeCategory) return false;
    if (activeBrand !== 'Todas' && p.brand !== activeBrand) return false;
    if (activeSize !== 'Todas' && !p.sizes.includes(activeSize)) return false;

    if (searchTerm) {
      const haystack = `${p.cleanName} ${p.brand} ${p.categoria} ${p.colorway} ${p.gender} ${p.id} ${p.descripcion}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });

  if (sortBy === 'recent') {
    return [...filtered].sort((a, b) => b.index - a.index);
  }
  if (sortBy === 'price-asc') {
    return [...filtered].sort((a, b) => a.priceNum - b.priceNum || b.index - a.index);
  }
  if (sortBy === 'price-desc') {
    return [...filtered].sort((a, b) => b.priceNum - a.priceNum || b.index - a.index);
  }
  if (sortBy === 'name') {
    return [...filtered].sort((a, b) => a.cleanName.localeCompare(b.cleanName, 'es'));
  }
  return filtered;
}

function renderFilterPills() {
  const genders = ['Todos', 'Hombre', 'Mujer'];
  $('#genderFilters').innerHTML = genders
    .map(
      (g) =>
        `<button class="filter-pill is-gender ${g === activeGender ? 'active' : ''}" type="button" data-gender="${g}">${g}</button>`
    )
    .join('');

  const categories = ['Todas', ...new Set(products.map((p) => p.categoria).filter(Boolean))];
  $('#categoryFilters').innerHTML = categories
    .map(
      (c) =>
        `<button class="filter-pill ${c === activeCategory ? 'active' : ''}" type="button" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    )
    .join('');

  $$('[data-gender]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeGender = btn.dataset.gender;
      visibleCount = PAGE_SIZE;
      renderCatalog();
    });
  });

  $$('[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.category;
      visibleCount = PAGE_SIZE;
      renderCatalog();
    });
  });
}

function hasActiveFilters() {
  return (
    activeGender !== 'Todos' ||
    activeCategory !== 'Todas' ||
    activeBrand !== 'Todas' ||
    activeSize !== 'Todas' ||
    Boolean(searchTerm)
  );
}

function resetAllFilters() {
  activeGender = 'Todos';
  activeCategory = 'Todas';
  activeBrand = 'Todas';
  activeSize = 'Todas';
  searchTerm = '';
  sortBy = 'recent';
  visibleCount = PAGE_SIZE;
  $('#searchInput').value = '';
  $('#brandSelect').value = 'Todas';
  $('#sizeSelect').value = 'Todas';
  $('#sortSelect').value = 'recent';
  renderBrands();
  renderCatalog();
}

function renderCatalog() {
  renderFilterPills();

  const selection = getFilteredProducts();
  const total = selection.length;
  const shown = selection.slice(0, visibleCount);

  $('#clearFilters').hidden = !hasActiveFilters();
  $('#productTotal').textContent =
    total === products.length
      ? `${total} referencias disponibles`
      : `${total} de ${products.length} referencias`;

  const grid = $('#productGrid');
  grid.innerHTML = '';

  if (!total) {
    $('#catalogPagination').hidden = true;
    grid.innerHTML =
      '<div class="no-results"><p>No encontramos referencias con esos filtros o búsqueda.</p><button id="resetEmptyBtn" class="btn btn-dark" type="button">Mostrar todo el catálogo</button></div>';
    $('#resetEmptyBtn').addEventListener('click', resetAllFilters);
    return;
  }

  shown.forEach((product, idx) => {
    grid.append(buildProductCardNode(product, { eager: idx < 8 }));
  });

  const pagination = $('#catalogPagination');
  if (total > PAGE_SIZE) {
    pagination.hidden = false;
    const remaining = total - shown.length;
    $('#paginationStatus').textContent = `Mostrando ${shown.length} de ${total} referencias`;
    $('#paginationFill').style.width = `${Math.round((shown.length / total) * 100)}%`;

    const loadMoreBtn = $('#loadMoreBtn');
    const showAllBtn = $('#showAllBtn');
    if (remaining > 0) {
      loadMoreBtn.hidden = false;
      showAllBtn.hidden = false;
      loadMoreBtn.textContent = `Cargar ${Math.min(PAGE_SIZE, remaining)} más (quedan ${remaining})`;
    } else {
      loadMoreBtn.hidden = true;
      showAllBtn.hidden = true;
    }
  } else {
    pagination.hidden = true;
  }
}

function buildSingleItemWhatsAppUrl(product, size, qty) {
  const lines = [
    '¡Hola, Mundo de las Tenis! 👟',
    '',
    'Quiero pedir este par:',
    `• ${qty}x ${product.cleanName}${product.colorway ? ` (${product.colorway})` : ''} — Talla EUR ${size} — ${product.precio}`,
    `   Ref: ${product.id}`
  ];
  if (product.whatsappImage) {
    lines.push(`   Foto: ${product.whatsappImage}`);
  }
  lines.push(
    '',
    `Subtotal estimado: ${peso(product.priceNum * qty)}`,
    '',
    'Mi nombre es: ',
    'Mi ciudad/dirección: ',
    '',
    'Quedo atento(a) para confirmar disponibilidad, envío y método de pago.'
  );
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`;
}

function openProduct(id) {
  const product = products.find((item) => item.id === id);
  if (!product) return;

  const sizes = product.sizes;
  const autoSize = sizes.length === 1 ? sizes[0] : '';
  let selectedSize = autoSize;
  let qty = 1;

  $('#dialogContent').innerHTML = `
    <div class="dialog-layout">
      <div class="dialog-media">
        <img class="dialog-main-img" src="${escapeHtml(product.renderImage)}" alt="${escapeHtml(product.cleanName)}" />
        <div class="dialog-media-meta">
          <span class="dialog-media-chip">${escapeHtml(product.gender)}</span>
          <span class="dialog-media-chip">Ref: ${escapeHtml(product.id.slice(0, 28))}</span>
        </div>
      </div>

      <div class="dialog-info">
        <p class="dialog-breadcrumb">${escapeHtml(product.brand)} · ${escapeHtml(product.categoria)} · ${escapeHtml(product.gender)}</p>
        <h2>${escapeHtml(product.cleanName)}</h2>
        ${product.colorway ? `<p class="dialog-colorway">Color: ${escapeHtml(product.colorway)}</p>` : ''}

        <div class="dialog-price-row">
          <strong class="dialog-price ${product.hasDiscount ? 'is-discounted' : ''}">${escapeHtml(money(product.precio))} COP</strong>
          ${
            product.hasDiscount
              ? `<del class="dialog-price-old">${escapeHtml(product.previousPriceText)} COP</del><span class="dialog-discount-badge">-${product.discountPercent}%</span>`
              : ''
          }
        </div>

        <div class="dialog-shipping-pill">
          ✓ Envíos a toda Colombia · Confirmas disponibilidad y medio de pago por WhatsApp
        </div>

        <p class="dialog-description">${escapeHtml(product.descripcion || 'Referencia seleccionada para tu estilo diario.')}</p>

        <div class="size-head">
          <span>Talla EUR (horma nacional)</span>
          <button id="sizeGuideButton" class="size-guide-button" type="button">Ver guía de tallas ↗</button>
        </div>

        <div class="sizes">
          ${sizes
            .map(
              (size) =>
                `<button class="${size === autoSize ? 'selected' : ''}" data-size="${escapeHtml(size)}" type="button">${escapeHtml(size)}</button>`
            )
            .join('')}
        </div>

        <div class="dialog-qty-row">
          <span>Cantidad</span>
          <div class="dialog-qty-box">
            <button id="dialogQtyMinus" type="button" aria-label="Disminuir cantidad">−</button>
            <b id="dialogQtyVal">1</b>
            <button id="dialogQtyPlus" type="button" aria-label="Aumentar cantidad">+</button>
          </div>
        </div>

        <div class="dialog-ctas">
          <button id="addToCart" class="btn btn-dark" type="button" ${autoSize ? '' : 'disabled'}>
            ${autoSize ? `Agregar talla ${escapeHtml(autoSize)} a la bolsa +` : 'Elige una talla primero'}
          </button>
          <button id="buyNowWhatsapp" class="btn btn-whatsapp" type="button" ${autoSize ? '' : 'disabled'}>
            ${autoSize ? `Pedir talla ${escapeHtml(autoSize)} por WhatsApp ↗` : 'Elige talla para pedir por WhatsApp'}
          </button>
        </div>

        <div class="dialog-timeline" aria-label="Proceso de entrega">
          <div class="timeline-step">
            <strong>1. Confirmas</strong>
            <span>Validamos talla</span>
          </div>
          <div class="timeline-step">
            <strong>2. Pagas</strong>
            <span>Addi, Siste o banco</span>
          </div>
          <div class="timeline-step">
            <strong>3. Recibes</strong>
            <span>Envío nacional</span>
          </div>
        </div>

        <p class="dialog-finance-note">Disponible con Bancolombia, Addi, Sistecrédito y tarjeta · Sin contraentrega</p>
      </div>
    </div>

    <div id="sizeGuideOverlay" class="size-guide-overlay" hidden>
      <div class="size-guide-overlay-head">
        <strong>Guía de equivalencias (CO / US / EUR / CM)</strong>
        <button id="closeSizeGuide" class="btn btn-outline-light" type="button">← Volver al par</button>
      </div>
      <img src="imagenes/guia-de-tallas.png" alt="Guía de tallas para hombre y mujeres en Colombia, Estados Unidos, Europa y centímetros" />
      <p>Recuerda: los botones del catálogo están en numeración EUR. Ejemplo: Hombre 40 EUR equivale a 37 CO.</p>
    </div>
  `;

  const dialogImg = $('#dialogContent .dialog-main-img');
  attachImageFallback(dialogImg);

  const addBtn = $('#addToCart');
  const waBtn = $('#buyNowWhatsapp');

  function syncButtons() {
    if (!selectedSize) {
      addBtn.disabled = true;
      waBtn.disabled = true;
      addBtn.textContent = 'Elige una talla primero';
      waBtn.textContent = 'Elige talla para pedir por WhatsApp';
      return;
    }
    addBtn.disabled = false;
    waBtn.disabled = false;
    addBtn.textContent = `Agregar talla ${selectedSize} a la bolsa +`;
    waBtn.textContent = `Pedir talla ${selectedSize} por WhatsApp ↗`;
  }

  $$('#dialogContent .sizes button').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('#dialogContent .sizes button').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedSize = btn.dataset.size;
      syncButtons();
    });
  });

  $('#dialogQtyMinus').addEventListener('click', () => {
    if (qty > 1) {
      qty -= 1;
      $('#dialogQtyVal').textContent = String(qty);
    }
  });

  $('#dialogQtyPlus').addEventListener('click', () => {
    qty += 1;
    $('#dialogQtyVal').textContent = String(qty);
  });

  $('#sizeGuideButton').addEventListener('click', () => {
    $('#sizeGuideOverlay').hidden = false;
  });

  $('#closeSizeGuide').addEventListener('click', () => {
    $('#sizeGuideOverlay').hidden = true;
  });

  addBtn.addEventListener('click', () => {
    if (!selectedSize) return;
    addToCart(product, selectedSize, qty);
    $('#productDialog').close();
    openCart();
  });

  waBtn.addEventListener('click', () => {
    if (!selectedSize) return;
    window.open(buildSingleItemWhatsAppUrl(product, selectedSize, qty), '_blank', 'noopener');
  });

  $('#productDialog').showModal();
}

function addToCart(product, size, qty = 1) {
  const key = `${product.id}-${size}`;
  const existing = cart.find((item) => item.key === key);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({
      key,
      id: product.id,
      nombre: product.cleanName,
      colorway: product.colorway || '',
      precio: product.precio,
      imagen: product.renderImage,
      whatsappImagen: product.whatsappImage,
      size,
      quantity: qty
    });
  }
  saveCart();
  renderCart();
}

function saveCart() {
  localStorage.setItem('mdt-cart', JSON.stringify(cart));
}

function renderCart() {
  const totalQty = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  $('#cartCount').textContent = String(totalQty);
  $('#cartEmpty').hidden = cart.length > 0;
  $('#cartSummary').hidden = cart.length === 0;

  const container = $('#cartItems');
  container.innerHTML = cart
    .map(
      (item) => `
      <article class="cart-item">
        <img src="${escapeHtml(toLocalRenderImage(item.imagen))}" alt="${escapeHtml(item.nombre)}" />
        <div class="cart-item-info">
          <h3>${escapeHtml(normalizeDisplayName(item.nombre))}</h3>
          <span class="cart-item-meta">${item.colorway ? `${escapeHtml(item.colorway)} · ` : ''}Talla EUR ${escapeHtml(item.size)}</span>
          <strong class="cart-item-price">${escapeHtml(money(item.precio))}</strong>
          <div class="quantity">
            <button type="button" aria-label="Restar" data-action="minus" data-key="${escapeHtml(item.key)}">−</button>
            <b>${item.quantity}</b>
            <button type="button" aria-label="Sumar" data-action="plus" data-key="${escapeHtml(item.key)}">+</button>
            <button class="remove" type="button" aria-label="Eliminar" data-action="remove" data-key="${escapeHtml(item.key)}">Eliminar</button>
          </div>
        </div>
      </article>
    `
    )
    .join('');

  container.querySelectorAll('img').forEach(attachImageFallback);

  const total = cart.reduce((sum, item) => sum + priceNumber(item.precio) * item.quantity, 0);
  $('#cartSubtotal').textContent = peso(total);

  container.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = cart.find((entry) => entry.key === button.dataset.key);
      if (!item) return;
      if (button.dataset.action === 'plus') item.quantity += 1;
      if (button.dataset.action === 'minus') item.quantity -= 1;
      if (button.dataset.action === 'remove' || item.quantity < 1) {
        cart = cart.filter((entry) => entry.key !== item.key);
      }
      saveCart();
      renderCart();
    });
  });
}

function sendOrder() {
  if (!cart.length) return;
  const lines = cart.map((item) => {
    const label = item.colorway ? `${normalizeDisplayName(item.nombre)} (${item.colorway})` : normalizeDisplayName(item.nombre);
    const details = [`• ${item.quantity}x ${label} — Talla EUR ${item.size} — ${item.precio}`];
    if (item.id) details.push(`   Ref: ${item.id}`);
    const imageUrl = item.whatsappImagen || toWhatsappImageUrl(item.imagen);
    if (imageUrl) details.push(`   Foto: ${imageUrl}`);
    return details.join('\n');
  });

  const total = cart.reduce((sum, item) => sum + priceNumber(item.precio) * item.quantity, 0);
  const fullMessage = [
    '¡Hola, Mundo de las Tenis! 👟',
    '',
    'Quiero hacer este pedido:',
    lines.join('\n\n'),
    '',
    `Subtotal de productos: ${peso(total)}`,
    '',
    'Mi nombre es: ',
    'Mi ciudad/dirección: ',
    '',
    'Quedo atento(a) a confirmar disponibilidad, envío y método de pago.'
  ].join('\n');

  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(fullMessage)}`, '_blank', 'noopener');
}

/* =========================================
   DRAWERS, MODALS, SLIDER & QUICK FILTERS
   ========================================= */
function openCart() {
  closeMobileMenu(false);
  $('#cartPanel').classList.add('open');
  $('#cartPanel').setAttribute('aria-hidden', 'false');
  $('#overlay').hidden = false;
  document.body.classList.add('locked');
}

function closeCart(restoreScroll = true) {
  $('#cartPanel').classList.remove('open');
  $('#cartPanel').setAttribute('aria-hidden', 'true');
  if (restoreScroll && !$('#mobileMenu').classList.contains('open')) {
    $('#overlay').hidden = true;
    document.body.classList.remove('locked');
  }
}

function openMobileMenu() {
  closeCart(false);
  $('#mobileMenu').classList.add('open');
  $('#mobileMenu').setAttribute('aria-hidden', 'false');
  $('#menuToggle').setAttribute('aria-expanded', 'true');
  $('#overlay').hidden = false;
  document.body.classList.add('locked');
}

function closeMobileMenu(restoreScroll = true) {
  $('#mobileMenu').classList.remove('open');
  $('#mobileMenu').setAttribute('aria-hidden', 'true');
  $('#menuToggle').setAttribute('aria-expanded', 'false');
  if (restoreScroll && !$('#cartPanel').classList.contains('open')) {
    $('#overlay').hidden = true;
    document.body.classList.remove('locked');
  }
}

function closeAllDrawers() {
  closeCart(false);
  closeMobileMenu(false);
  $('#overlay').hidden = true;
  document.body.classList.remove('locked');
}

function applyQuickFilter(spec) {
  if (!spec) return;
  if (spec === 'reset') {
    resetAllFilters();
    return;
  }
  const [kind, value] = spec.split(':');
  activeGender = 'Todos';
  activeCategory = 'Todas';
  activeBrand = 'Todas';
  activeSize = 'Todas';
  searchTerm = '';
  $('#searchInput').value = '';
  $('#brandSelect').value = 'Todas';
  $('#sizeSelect').value = 'Todas';

  if (kind === 'gender') activeGender = value;
  if (kind === 'category') activeCategory = value;
  visibleCount = PAGE_SIZE;
  renderBrands();
  renderCatalog();
}

function showHeroSlide(index) {
  const slides = $$('.hero-slide');
  const dots = $$('.slider-dot');
  if (!slides.length) return;
  activeSlide = (index + slides.length) % slides.length;
  slides.forEach((slide, i) => {
    const isActive = i === activeSlide;
    slide.classList.toggle('active', isActive);
    slide.classList.toggle('is-entering', isActive);
  });
  dots.forEach((dot, i) => dot.classList.toggle('active', i === activeSlide));
}

function startHeroAutoplay() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  stopHeroAutoplay();
  heroTimer = setInterval(() => showHeroSlide(activeSlide + 1), HERO_AUTOPLAY_MS);
}

function stopHeroAutoplay() {
  if (heroTimer) {
    clearInterval(heroTimer);
    heroTimer = null;
  }
}

function bindEvents() {
  $('#cartButton').addEventListener('click', openCart);
  $('#closeCart').addEventListener('click', () => closeCart(true));
  $('#menuToggle').addEventListener('click', openMobileMenu);
  $('#closeMobileMenu').addEventListener('click', () => closeMobileMenu(true));
  $('#overlay').addEventListener('click', closeAllDrawers);

  $('#exploreButton').addEventListener('click', () => {
    closeAllDrawers();
    $('#catalogo').scrollIntoView({ behavior: 'smooth' });
  });

  $('#closeDialog').addEventListener('click', () => $('#productDialog').close());
  $('#productDialog').addEventListener('click', (event) => {
    if (event.target === $('#productDialog')) $('#productDialog').close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllDrawers();
  });

  $('#whatsappOrder').addEventListener('click', sendOrder);

  $('#searchInput').addEventListener('input', (event) => {
    searchTerm = event.target.value.trim().toLowerCase();
    visibleCount = PAGE_SIZE;
    renderCatalog();
  });

  $('#brandSelect').addEventListener('change', (event) => {
    activeBrand = event.target.value;
    visibleCount = PAGE_SIZE;
    renderBrands();
    renderCatalog();
  });

  $('#sizeSelect').addEventListener('change', (event) => {
    activeSize = event.target.value;
    visibleCount = PAGE_SIZE;
    renderCatalog();
  });

  $('#sortSelect').addEventListener('change', (event) => {
    sortBy = event.target.value;
    renderCatalog();
  });

  $('#clearFilters').addEventListener('click', resetAllFilters);

  $('#loadMoreBtn').addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    renderCatalog();
  });

  $('#showAllBtn').addEventListener('click', () => {
    visibleCount = products.length;
    renderCatalog();
  });

  // Header search toggle & form
  $('#searchToggle').addEventListener('click', () => {
    const bar = $('#headerSearchBar');
    const isHidden = bar.hidden;
    bar.hidden = !isHidden;
    $('#searchToggle').setAttribute('aria-expanded', String(isHidden));
    if (isHidden) $('#headerSearchInput').focus();
  });

  $('#headerSearchForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const q = $('#headerSearchInput').value.trim();
    searchTerm = q.toLowerCase();
    $('#searchInput').value = q;
    visibleCount = PAGE_SIZE;
    $('#headerSearchBar').hidden = true;
    $('#searchToggle').setAttribute('aria-expanded', 'false');
    renderCatalog();
    $('#catalogo').scrollIntoView({ behavior: 'smooth' });
  });

  $$('[data-search-term]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const q = chip.dataset.searchTerm;
      $('#headerSearchInput').value = q;
      $('#searchInput').value = q;
      searchTerm = q.toLowerCase();
      visibleCount = PAGE_SIZE;
      $('#headerSearchBar').hidden = true;
      $('#searchToggle').setAttribute('aria-expanded', 'false');
      renderCatalog();
      $('#catalogo').scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Quick filter links in nav, mobile drawer, category strip, featured footer, and site footer
  $$('[data-quick-filter]').forEach((el) => {
    el.addEventListener('click', (event) => {
      const targetHref = el.getAttribute('href');
      if (targetHref && targetHref.startsWith('#')) {
        event.preventDefault();
      }
      applyQuickFilter(el.dataset.quickFilter);
      closeAllDrawers();
      $('#catalogo').scrollIntoView({ behavior: 'smooth' });
    });
  });

  $$('[data-close-mobile]').forEach((el) => {
    el.addEventListener('click', () => {
      closeMobileMenu(true);
    });
  });

  // Hero slider controls & clickable showcase cards
  $('#heroPrev').addEventListener('click', () => {
    showHeroSlide(activeSlide - 1);
    startHeroAutoplay();
  });

  $('#heroNext').addEventListener('click', () => {
    showHeroSlide(activeSlide + 1);
    startHeroAutoplay();
  });

  $$('[data-slide-to]').forEach((dot) => {
    dot.addEventListener('click', () => {
      showHeroSlide(Number(dot.dataset.slideTo));
      startHeroAutoplay();
    });
  });

  const sliderEl = $('.hero-slider');
  sliderEl.addEventListener('mouseenter', stopHeroAutoplay);
  sliderEl.addEventListener('mouseleave', startHeroAutoplay);

  $$('[data-hero-product]').forEach((btn) => {
    btn.addEventListener('click', () => openProduct(btn.dataset.heroProduct));
  });

  // Featured carousel buttons
  $('#featuredPrev').addEventListener('click', () => {
    const track = $('#featuredTrack');
    track.scrollBy({ left: -Math.max(280, track.clientWidth * 0.72), behavior: 'smooth' });
  });

  $('#featuredNext').addEventListener('click', () => {
    const track = $('#featuredTrack');
    track.scrollBy({ left: Math.max(280, track.clientWidth * 0.72), behavior: 'smooth' });
  });
}

bindEvents();
renderCart();
startHeroAutoplay();
loadCatalog();
