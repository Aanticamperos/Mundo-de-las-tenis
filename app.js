const WHATSAPP = '573217430829';
const FALLBACK_PRODUCTS = [];
let products = [];
let activeCategory = 'Todos';
let searchTerm = '';
let cart = JSON.parse(localStorage.getItem('mdt-cart') || '[]');

const $ = (selector) => document.querySelector(selector);
const money = (value) => value || '$ 0';
const parseCSV = (text) => {
  const rows = [];
  let current = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (c === '"' && quoted && next === '"') { value += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { current.push(value); value = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && next === '\n') i++; current.push(value); if (current.some(v => v.trim())) rows.push(current); current = []; value = ''; }
    else value += c;
  }
  if (value || current.length) { current.push(value); rows.push(current); }
  const [headers, ...data] = rows;
  return data.map(row => Object.fromEntries(headers.map((h, i) => [h.trim(), (row[i] || '').trim()])));
};

async function loadCatalog() {
  try {
    const response = await fetch(`catalogo.csv?v=${Date.now()}`);
    if (!response.ok) throw new Error('No se encontró el catálogo');
    products = parseCSV(await response.text()).filter(p => p.id && p.nombre);
    if (!products.length) { renderEmptyCatalog(); return; }
    renderCatalog();
  } catch (error) {
    $('#catalogMessage').hidden = false;
    $('#catalogMessage').innerHTML = '<strong>No pudimos cargar el catálogo.</strong> Abre la tienda desde un servidor (por ejemplo, Live Server) para leer <code>catalogo.csv</code>.';
    $('#productTotal').textContent = 'Catálogo no disponible';
  }
}

function renderEmptyCatalog() {
  $('#filters').innerHTML = '';
  $('#productTotal').textContent = 'Nueva colección próximamente';
  $('#catalogMessage').hidden = true;
  $('#productGrid').innerHTML = '<section class="catalog-launch" aria-labelledby="catalogLaunchTitle"><span class="catalog-launch-star">✦</span><p class="eyebrow">MUNDO DE LAS TENIS</p><h3 id="catalogLaunchTitle">Estamos preparando<br /><em>el próximo drop.</em></h3><p>Muy pronto encontrarás nuevas referencias. Síguenos en Instagram o escríbenos por WhatsApp para conocer los próximos lanzamientos.</p><a class="button button-dark" href="https://instagram.com/mundodelastenis" target="_blank" rel="noreferrer">Ver Instagram <span>↗</span></a></section>';
}

function renderCatalog() {
  const categories = ['Todos', ...new Set(products.map(p => p.categoria).filter(Boolean))];
  $('#filters').innerHTML = categories.map(category => `<button class="filter ${category === activeCategory ? 'active' : ''}" data-category="${category}">${category}</button>`).join('');
  document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => { activeCategory = button.dataset.category; renderCatalog(); }));
  const selection = products.filter(p => (activeCategory === 'Todos' || p.categoria === activeCategory) && `${p.nombre} ${p.categoria}`.toLowerCase().includes(searchTerm));
  $('#productTotal').textContent = `${selection.length} ${selection.length === 1 ? 'referencia' : 'referencias'}`;
  const grid = $('#productGrid'); grid.innerHTML = '';
  selection.forEach(product => {
    const node = $('#productTemplate').content.cloneNode(true);
    const img = node.querySelector('img'); img.src = product.imagen; img.alt = product.nombre;
    node.querySelector('.product-category').textContent = product.categoria;
    node.querySelector('h3').textContent = product.nombre;
    node.querySelector('strong').textContent = money(product.precio);
    const badge = node.querySelector('.product-badge'); if (product.etiqueta) { badge.hidden = false; badge.textContent = product.etiqueta; }
    node.querySelector('.product-image').addEventListener('click', () => openProduct(product.id)); grid.append(node);
  });
  if (!selection.length) grid.innerHTML = '<p class="no-results">No encontramos referencias con esa búsqueda.</p>';
}

function openProduct(id) {
  const product = products.find(item => item.id === id); if (!product) return;
  const sizes = product.tallas.split('|').filter(Boolean);
  $('#dialogContent').innerHTML = `<div class="dialog-image"><img src="${product.imagen}" alt="${product.nombre}" /></div><div class="dialog-info"><p class="eyebrow">${product.categoria}</p><h2>${product.nombre}</h2><strong>${money(product.precio)}</strong><p class="dialog-description">${product.descripcion || 'Una referencia seleccionada especialmente para tu estilo.'}</p><div class="size-head"><span>Selecciona tu talla</span><button id="sizeGuideButton" class="size-guide-button" type="button" aria-expanded="false" aria-controls="sizeGuidePanel">Guía de tallas ↗</button></div><div class="sizes">${sizes.map(size => `<button data-size="${size}" type="button">${size}</button>`).join('')}</div><section id="sizeGuidePanel" class="size-guide-panel" hidden aria-label="Guía de tallas"><div class="size-guide-head"><strong>Guía de tallas</strong><button id="closeSizeGuide" type="button" aria-label="Cerrar guía de tallas">×</button></div><img src="imagenes/guia-de-tallas.png" alt="Guía de equivalencias de tallas para hombre y mujeres en Colombia, Estados Unidos, Europa y centímetros" /></section><button id="addToCart" class="button button-dark" disabled>Elige una talla</button><p class="stock-note">✓ Consulta disponibilidad antes de pagar</p></div>`;
  let selectedSize = '';
  document.querySelectorAll('.sizes button').forEach(btn => btn.addEventListener('click', () => { document.querySelectorAll('.sizes button').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); selectedSize = btn.dataset.size; const add = $('#addToCart'); add.disabled = false; add.textContent = `Agregar talla ${selectedSize} a la bolsa  +`; }));
  $('#sizeGuideButton').addEventListener('click', () => { $('#sizeGuidePanel').hidden = false; $('#sizeGuideButton').setAttribute('aria-expanded', 'true'); });
  $('#closeSizeGuide').addEventListener('click', () => { $('#sizeGuidePanel').hidden = true; $('#sizeGuideButton').setAttribute('aria-expanded', 'false'); $('#sizeGuideButton').focus(); });
  $('#addToCart').addEventListener('click', () => { addToCart(product, selectedSize); $('#productDialog').close(); openCart(); });
  $('#productDialog').showModal();
}

function addToCart(product, size) {
  const key = `${product.id}-${size}`; const existing = cart.find(item => item.key === key);
  if (existing) existing.quantity += 1;
  else cart.push({ key, id: product.id, nombre: product.nombre, precio: product.precio, imagen: product.imagen, size, quantity: 1 });
  saveCart(); renderCart();
}
function saveCart() { localStorage.setItem('mdt-cart', JSON.stringify(cart)); }
function priceNumber(price) { return Number((price || '').replace(/[^0-9]/g, '')) || 0; }
function peso(value) { return '$ ' + new Intl.NumberFormat('es-CO').format(value); }
function renderCart() {
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0); $('#cartCount').textContent = totalQty;
  $('#cartEmpty').hidden = cart.length > 0; $('#cartSummary').hidden = cart.length === 0;
  $('#cartItems').innerHTML = cart.map(item => `<article class="cart-item"><img src="${item.imagen}" alt="${item.nombre}"/><div><p>${item.nombre}</p><span>Talla ${item.size}</span><strong>${money(item.precio)}</strong><div class="quantity"><button aria-label="Restar" data-action="minus" data-key="${item.key}">−</button><b>${item.quantity}</b><button aria-label="Sumar" data-action="plus" data-key="${item.key}">+</button><button class="remove" aria-label="Eliminar" data-action="remove" data-key="${item.key}">Eliminar</button></div></div></article>`).join('');
  const total = cart.reduce((sum, item) => sum + priceNumber(item.precio) * item.quantity, 0); $('#cartSubtotal').textContent = peso(total);
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => { const item = cart.find(entry => entry.key === button.dataset.key); if (!item) return; if (button.dataset.action === 'plus') item.quantity++; if (button.dataset.action === 'minus') item.quantity--; if (button.dataset.action === 'remove' || item.quantity < 1) cart = cart.filter(entry => entry.key !== item.key); saveCart(); renderCart(); }));
}
function openCart() { $('#cartPanel').classList.add('open'); $('#cartPanel').setAttribute('aria-hidden', 'false'); $('#overlay').hidden = false; document.body.classList.add('locked'); }
function closeCart() { $('#cartPanel').classList.remove('open'); $('#cartPanel').setAttribute('aria-hidden', 'true'); $('#overlay').hidden = true; document.body.classList.remove('locked'); }
function sendOrder() {
  const lines = cart.map(item => `• ${item.quantity}x ${item.nombre} — Talla ${item.size} — ${item.precio}`);
  const total = cart.reduce((sum, item) => sum + priceNumber(item.precio) * item.quantity, 0);
  const message = `¡Hola, Mundo de las Tenis! 👟%0A%0AQuiero hacer este pedido:%0A${encodeURIComponent(lines.join('\n'))}%0A%0ASubtotal de productos: ${encodeURIComponent(peso(total))}%0A%0AMi nombre es: %0AMi ciudad/dirección: %0A%0AQuedo atento(a) a confirmar disponibilidad, envío y método de pago.`;
  window.open(`https://wa.me/${WHATSAPP}?text=${message}`, '_blank', 'noopener');
}

$('#cartButton').addEventListener('click', openCart); $('#closeCart').addEventListener('click', closeCart); $('#overlay').addEventListener('click', closeCart); $('#exploreButton').addEventListener('click', () => { closeCart(); document.querySelector('#catalogo').scrollIntoView({ behavior: 'smooth' }); });
$('#closeDialog').addEventListener('click', () => $('#productDialog').close()); $('#productDialog').addEventListener('click', event => { if (event.target === $('#productDialog')) $('#productDialog').close(); });
$('#whatsappOrder').addEventListener('click', sendOrder); $('#searchInput').addEventListener('input', event => { searchTerm = event.target.value.trim().toLowerCase(); renderCatalog(); });
renderCart(); loadCatalog();
