/* ═══════════════════════════════════════════════════════════
   VCs Corp — main.js
   Lógica de la tienda pública + router SPA básico
   ═══════════════════════════════════════════════════════════ */

const WA_NUMBER = '+529211435599';

// ── ROUTER ────────────────────────────────────────────────
function getPage() {
  const p = new URLSearchParams(window.location.search).get('page');
  return p || 'store';
}

async function route() {
  const page = getPage();
  if (page === 'login') {
    renderLogin();
  } else if (page === 'register') {
    // Solo mostrar si NO hay admin registrado aún (opcional pero recomendado)
    renderRegister();
  } else if (page === 'admin') {
    if (!isLoggedIn()) { window.location.href = '?page=login'; return; }
    renderAdmin();
  } else {
    renderStore();
  }
}

// ── TOAST ─────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${type === 'success' ? '✓' : '✕'}</span> ${msg}`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ── THEME TOGGLE ──────────────────────────────────────────
const moonSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const sunSVG  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;

document.getElementById('themeToggle')?.addEventListener('click', () => {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  const icon = document.getElementById('themeIcon');
  if (icon) icon.parentElement.innerHTML = isDark ? moonSVG : sunSVG;
});

// ── STORE STATE ───────────────────────────────────────────
let ALL_PRODUCTS  = [];
let ALL_BRANDS    = [];
let ALL_MODELS    = [];
let cart          = {};
let currentSearch = '';
let currentCat    = 'all';
let currentBrand  = 'all';
let currentModel  = 'all';
let favOnly       = false;
let filterAvail   = true;
let filterNoStock = false;

// ── RENDER STORE ──────────────────────────────────────────
async function renderStore() {
  // Mostrar skeleton
  document.getElementById('skeletonGrid').style.display = 'grid';
  document.getElementById('productsGrid').style.display = 'none';

  try {
    const [products, brands, models] = await Promise.all([
      getProducts(),
      getBrands(),
      getModels()
    ]);
    ALL_PRODUCTS = products || [];
    ALL_BRANDS   = brands  || [];
    ALL_MODELS   = models  || [];

    buildSidebar();
    renderProducts();

    // Ocultar skeleton
    document.getElementById('skeletonGrid').style.display = 'none';
    document.getElementById('productsGrid').style.display = 'grid';
  } catch (err) {
    console.error('Error cargando productos:', err);
    document.getElementById('skeletonGrid').style.display = 'none';
    document.getElementById('productsGrid').style.display = 'grid';
    document.getElementById('productsGrid').innerHTML = `
      <div class="no-results" style="grid-column:1/-1">
        <h3>Error al cargar productos</h3>
        <p>Verifica la configuración de Supabase en js/supabase-config.js</p>
      </div>`;
  }

  // Bind eventos
  bindStoreEvents();
}

// ── BUILD SIDEBAR ─────────────────────────────────────────
function buildSidebar() {
  const grid = document.getElementById('brandGrid');
  if (!grid) return;

  // Limpiar todo menos el botón "Todas las marcas"
  const allBtn = grid.querySelector('[data-brand="all"]');
  grid.innerHTML = '';
  grid.appendChild(allBtn);

  // Agrupar modelos por marca
  ALL_BRANDS.forEach(brand => {
    const brandModels = ALL_MODELS.filter(m => m.brand_id === brand.id);
    const brandCount  = ALL_PRODUCTS.filter(p => p.brand_id === brand.id).length;

    // Botón marca
    const btn = document.createElement('button');
    btn.className = 'brand-btn';
    btn.dataset.brand = brand.id;
    btn.innerHTML = `
      <span class="brand-dot" style="background:${brand.color}"></span>
      ${brand.name}
      <span class="brand-count">${brandCount}</span>`;
    grid.appendChild(btn);

    // Sub-botones de modelos
    brandModels.forEach(model => {
      const modelCount = ALL_PRODUCTS.filter(p => p.model_id === model.id).length;
      const sub = document.createElement('button');
      sub.className = 'model-subbtn';
      sub.dataset.model = model.id;
      sub.dataset.parentBrand = brand.id;
      sub.innerHTML = `${model.name} <span class="brand-count">${modelCount}</span>`;
      grid.appendChild(sub);
    });
  });

  // Eventos brand buttons
  grid.querySelectorAll('.brand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.brand-btn, .model-subbtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentBrand = btn.dataset.brand || 'all';
      currentModel = 'all';
      renderProducts();
    });
  });

  // Eventos model sub-buttons
  grid.querySelectorAll('.model-subbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.brand-btn, .model-subbtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Activar visualmente el brand padre también
      const parentBrand = btn.dataset.parentBrand;
      const parentBtn = grid.querySelector(`.brand-btn[data-brand="${parentBrand}"]`);
      if (parentBtn) parentBtn.style.borderColor = 'var(--purple)';
      currentBrand = parentBrand;
      currentModel = btn.dataset.model;
      renderProducts();
    });
  });

  // Bind availability & fav filters
  document.getElementById('filterAvailChk')?.addEventListener('change', e => { filterAvail = e.target.checked; renderProducts(); });
  document.getElementById('filterNoStockChk')?.addEventListener('change', e => { filterNoStock = e.target.checked; renderProducts(); });

  const favFilter = document.getElementById('toggleFavFilter');
  const favChk    = document.getElementById('favFilterChk');
  if (favFilter && favChk) {
    favFilter.addEventListener('click', e => {
      if (e.target.id === 'favFilterChk') return;
      favChk.checked = !favChk.checked;
      favOnly = favChk.checked;
      renderProducts();
    });
    favChk.addEventListener('change', e => { favOnly = e.target.checked; renderProducts(); });
  }
}

// ── RENDER PRODUCTS ───────────────────────────────────────
function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  const query = currentSearch.toLowerCase().trim();

  let filtered = ALL_PRODUCTS.filter(p => {
    const matchSearch = (p.flavor_display || '').toLowerCase().includes(query);
    const matchCat    = currentCat === 'all' || p.category === currentCat;
    const matchBrand  = currentBrand === 'all' || p.brand_id === currentBrand;
    const matchModel  = currentModel === 'all' || p.model_id === currentModel;
    const matchFav    = !favOnly || p.top_sales || p.recommended;
    const matchAvail  = (filterAvail && p.in_stock) || (filterNoStock && !p.in_stock);
    return matchSearch && matchCat && matchBrand && matchModel && matchFav && matchAvail;
  });

  if (!filterAvail && !filterNoStock) {
    filtered = ALL_PRODUCTS.filter(p => {
      const matchSearch = (p.flavor_display || '').toLowerCase().includes(query);
      const matchCat    = currentCat === 'all' || p.category === currentCat;
      const matchBrand  = currentBrand === 'all' || p.brand_id === currentBrand;
      const matchModel  = currentModel === 'all' || p.model_id === currentModel;
      const matchFav    = !favOnly || p.top_sales || p.recommended;
      return matchSearch && matchCat && matchBrand && matchModel && matchFav;
    });
  }

  const rc = document.getElementById('resultCount');
  if (rc) rc.textContent = filtered.length === 1 ? '1 producto' : `${filtered.length} productos`;

  updateSidebarCounts();
  grid.innerHTML = '';

  if (!filtered.length) {
    grid.innerHTML = `<div class="no-results">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <h3>Sin resultados</h3>
      <p>Intenta con otro sabor o marca</p>
    </div>`;
    return;
  }

  filtered.forEach((p, i) => {
    const brand = p.brands || {};
    const model = p.models || {};
    const brandSlug = brand.slug || 'vhill';
    const brandColor = brand.color || 'var(--vhill)';

    const specs = {
      puffs:   `${model.puffs || 3000} puffs`,
      coil:    `${model.coil_ohm || '1.0'}Ω coil`,
      juice:   `${model.juice_ml || 10}ml · ${model.juice_nic || 5}%`,
      battery: `${model.battery_mah || 1450} mAh`
    };

    const media = p.image_url
      ? `<img src="${p.image_url}" alt="${p.flavor_display}" loading="lazy">`
      : (p.emoji || '💨');

    const key = `${p.id}`;

    const card = document.createElement('div');
    card.className = 'product-card' + (p.in_stock ? '' : ' out-of-stock');
    card.dataset.brand = brandSlug;
    card.style.animationDelay = `${i * 0.04}s`;
    card.innerHTML = `
      ${p.top_sales ? '<span class="fav-badge">Top Sales</span>' : ''}
      ${!p.in_stock ? '<span class="stock-badge">Sin stock</span>' : ''}
      <div class="card-img">${media}</div>
      <div class="card-body">
        <span class="card-brand-label ${brandSlug}">
          <span class="dot"></span>
          ${brand.name || 'Marca'} ${model.name || ''}
        </span>
        <div class="card-name">${p.flavor_display}</div>
        <div class="specs-grid">
          <div class="spec-chip">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            ${specs.puffs}
          </div>
          <div class="spec-chip">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            ${specs.coil}
          </div>
          <div class="spec-chip">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            ${specs.juice}
          </div>
          <div class="spec-chip">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/><line x1="12" y1="12" x2="12" y2="16"/></svg>
            ${specs.battery}
          </div>
        </div>
        <div class="card-footer">
          <span class="card-price">$${p.price} MXN</span>
          <button class="add-btn" data-key="${key}" ${!p.in_stock ? 'disabled' : ''}>
            ${p.in_stock ? '+ Agregar' : 'No disponible'}
          </button>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      addToCart(btn.dataset.key);
    });
  });
}

// ── SIDEBAR COUNTS ────────────────────────────────────────
function updateSidebarCounts() {
  const avail   = ALL_PRODUCTS.filter(p => p.in_stock).length;
  const noStock = ALL_PRODUCTS.length - avail;
  const sc = document.getElementById('sideAvailCount');
  const ns = document.getElementById('sideNoStockCount');
  if (sc) sc.textContent = `(${avail})`;
  if (ns) ns.textContent = `(${noStock})`;
  const allCount = document.getElementById('brandCountAll');
  if (allCount) allCount.textContent = ALL_PRODUCTS.length;
}

// ── CART ─────────────────────────────────────────────────
function addToCart(key) {
  cart[key] = (cart[key] || 0) + 1;
  updateCart();
  const el = document.getElementById('cartCount');
  if (el) { el.style.transform = 'scale(1.4)'; setTimeout(() => el.style.transform = 'scale(1)', 200); }
}

function productByKey(key) {
  return ALL_PRODUCTS.find(p => p.id === key);
}

function updateCart() {
  const total    = Object.values(cart).reduce((a, b) => a + b, 0);
  const countEl  = document.getElementById('cartCount');
  if (countEl) countEl.textContent = total;

  const itemsEl  = document.getElementById('cartItems');
  const emptyEl  = document.getElementById('cartEmpty');
  const totalEl  = document.getElementById('cartTotal');
  if (!itemsEl) return;

  const keys = Object.keys(cart).filter(k => cart[k] > 0);

  if (!keys.length) {
    if (emptyEl) emptyEl.style.display = 'flex';
    if (totalEl) totalEl.textContent = '$0 MXN';
    itemsEl.querySelectorAll('.cart-item').forEach(el => el.remove());
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  itemsEl.querySelectorAll('.cart-item').forEach(el => el.remove());

  let grand = 0;
  keys.forEach(key => {
    const p = productByKey(key);
    if (!p) return;
    const qty  = cart[key];
    grand += qty * Number(p.price);
    const brand = p.brands || {};
    const model = p.models || {};
    const media = p.image_url ? `<img src="${p.image_url}" alt="${p.flavor_display}" loading="lazy">` : (p.emoji || '💨');
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="cart-item-icon">${media}</div>
      <div class="cart-item-info">
        <div class="cart-item-brand ${brand.slug || ''}">${brand.name || ''} ${model.name || ''}</div>
        <div class="cart-item-name">${p.flavor_display}</div>
        <div class="cart-item-price">$${p.price} MXN c/u</div>
        <div class="cart-item-qty">
          <button class="qty-btn" data-action="dec" data-key="${key}">−</button>
          <span class="qty-num">${qty}</span>
          <button class="qty-btn" data-action="inc" data-key="${key}">+</button>
        </div>
      </div>
      <button class="cart-item-remove" data-key="${key}">✕</button>`;
    itemsEl.insertBefore(div, emptyEl);
  });

  if (totalEl) totalEl.textContent = `$${grand} MXN`;

  itemsEl.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.key;
      if (btn.dataset.action === 'inc') cart[k]++;
      else { cart[k]--; if (cart[k] <= 0) delete cart[k]; }
      updateCart();
    });
  });
  itemsEl.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => { delete cart[btn.dataset.key]; updateCart(); });
  });
}

// ── BIND STORE EVENTS ─────────────────────────────────────
function bindStoreEvents() {
  // Search
  document.getElementById('searchInput')?.addEventListener('input', e => {
    currentSearch = e.target.value;
    renderProducts();
  });

  // Category pills
  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCat = pill.dataset.cat;
      renderProducts();
    });
  });

  // Cart drawer
  document.getElementById('cartToggle')?.addEventListener('click', openCart);
  document.getElementById('cartClose')?.addEventListener('click', closeCart);
  document.getElementById('cartOverlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeCart(); });

  // Checkout
  document.getElementById('checkoutBtn')?.addEventListener('click', () => {
    const total = Object.values(cart).reduce((a, b) => a + b, 0);
    if (!total) { showToast('Tu carrito está vacío', 'error'); return; }
    closeCart();
    setTimeout(openModal, 200);
  });

  document.getElementById('modalCancel')?.addEventListener('click', closeModal);
  document.getElementById('modalOverlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

  document.getElementById('confirmOrder')?.addEventListener('click', () => {
    const nickname = document.getElementById('fName')?.value.trim();
    if (!nickname) { showToast('Por favor escribe tu apodo', 'error'); return; }

    const items = Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([key, q]) => {
        const p = productByKey(key);
        if (!p) return '';
        const brand = p.brands || {};
        const model = p.models || {};
        return `• [${brand.name || ''} ${model.name || ''}] ${p.flavor_display} x${q}`;
      })
      .filter(Boolean)
      .join('\n');

    const grandTotal = Object.entries(cart)
      .filter(([, q]) => q > 0)
      .reduce((acc, [key, q]) => acc + (productByKey(key)?.price || 0) * q, 0);

    const message =
      `¡Hola! Soy *${nickname}* y quiero hacer el siguiente pedido:\n\n` +
      `${items}\n\n` +
      `💰 *Total: $${grandTotal} MXN*\n\n¡Gracias!`;

    const waURL = `https://wa.me/${WA_NUMBER}/?text=${encodeURIComponent(message)}`;

    document.getElementById('checkoutForm').style.display = 'none';
    const succ = document.getElementById('successState');
    succ.style.display = 'block';
    document.getElementById('successMsg').innerHTML =
      `Hola <strong>${nickname}</strong>, tu pedido fue armado.<br>
       Se abrirá WhatsApp para enviarlo. Si no abre automáticamente,
       <a href="${waURL}" target="_blank" rel="noopener noreferrer"
          style="color:var(--purple3);text-decoration:underline;">haz clic aquí</a>.`;

    cart = {};
    updateCart();
    setTimeout(() => window.open(waURL, '_blank'), 300);
  });

  // Admin nav btn
  const adminBtn = document.getElementById('adminNavBtn');
  if (adminBtn) {
    if (isLoggedIn()) {
      adminBtn.textContent = 'Panel Admin';
      adminBtn.href = '?page=admin';
      adminBtn.classList.add('active');
    }
  }
}

function openCart()  {
  const ov = document.getElementById('cartOverlay');
  ov.classList.add('open');
  requestAnimationFrame(() => ov.classList.add('visible'));
}
function closeCart() {
  const ov = document.getElementById('cartOverlay');
  ov.classList.remove('visible');
  setTimeout(() => ov.classList.remove('open'), 350);
}
function openModal()  {
  const ov = document.getElementById('modalOverlay');
  document.getElementById('checkoutForm').style.display = 'block';
  document.getElementById('successState').style.display = 'none';
  document.getElementById('fName').value = '';
  ov.classList.add('open');
  requestAnimationFrame(() => ov.classList.add('visible'));
}
function closeModal() {
  const ov = document.getElementById('modalOverlay');
  ov.classList.remove('visible');
  setTimeout(() => ov.classList.remove('open'), 350);
}

function renderRegister() {
  // Limpiar la página igual que en renderLogin
  document.querySelector('.hero')?.remove();
  document.querySelector('.store-wrap')?.remove();
  document.querySelector('footer')?.remove();
  document.querySelector('.cart-overlay')?.remove();
  document.querySelector('.modal-overlay')?.remove();

  const html = `
  <link rel="stylesheet" href="css/admin.css">
  <div class="login-page">
    <div class="login-glow"></div>
    <div class="login-card">
      <div class="login-logo">
        <span class="logo-text">VCs</span>
        <p>Crear cuenta de administrador</p>
      </div>
      <div style="text-align:center">
        <span class="login-badge">⚙️ Solo uso inicial</span>
      </div>
      <div class="login-error" id="regError">Error al registrar. Revisa los datos.</div>
      <div class="login-success" id="regSuccess" style="display:none;color:#4ade80;text-align:center;margin-bottom:1rem;font-size:.9rem;">
        ✓ Cuenta creada. <a href="?page=login" style="color:var(--purple3);">Iniciar sesión</a>
      </div>
      <div class="form-group">
        <label>Usuario</label>
        <input type="text" id="regUsername" placeholder="ADMIN">
      </div>
      <div class="form-group">
        <label>Correo electrónico</label>
        <input type="email" id="regEmail" placeholder="correo@ejemplo.com">
      </div>
      <div class="form-group">
        <label>Contraseña</label>
        <div class="password-wrap">
          <input type="password" id="regPassword" placeholder="••••••••">
          <button type="button" class="eye-btn" id="toggleRegPass" title="Ver contraseña">
            <svg id="eyeIconReg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <button class="login-btn" id="regBtn">
        <span id="regBtnText">Crear cuenta</span>
        <div class="btn-spinner" id="regSpinner"></div>
      </button>
      <div style="text-align:center;margin-top:1.25rem">
        <a href="?page=login" style="color:var(--muted);font-size:.85rem;text-decoration:none;">← Ya tengo cuenta</a>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);

  // Toggle contraseña (mismo patrón que en renderLogin)
  document.getElementById('toggleRegPass')?.addEventListener('click', () => {
    const input = document.getElementById('regPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Submit
  const doRegister = async () => {
    const username = document.getElementById('regUsername')?.value.trim();
    const email    = document.getElementById('regEmail')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const errEl    = document.getElementById('regError');
    const succEl   = document.getElementById('regSuccess');
    const btn      = document.getElementById('regBtn');
    const spinner  = document.getElementById('regSpinner');
    const btnText  = document.getElementById('regBtnText');

    errEl.classList.remove('show');
    succEl.style.display = 'none';

    if (!username || !email || !password) {
      errEl.textContent = 'Todos los campos son obligatorios.';
      errEl.classList.add('show');
      return;
    }

    btn.disabled = true;
    spinner.classList.add('show');
    btnText.textContent = 'Creando cuenta…';

    try {
      // Generar hash aquí, en el handler del botón, donde bcrypt ya está cargado
      const passwordHash = await bcrypt.hash(password, 10);
      await registerAdmin(username, email.toLowerCase().trim(), passwordHash);
      succEl.style.display = 'block';
      btn.disabled = false;
      spinner.classList.remove('show');
      btnText.textContent = 'Crear cuenta';
    } catch (err) {
      errEl.textContent = err.message.includes('duplicate') || err.message.includes('unique')
        ? 'Ya existe un admin con ese email o usuario.'
        : 'Error al registrar: ' + err.message;
      errEl.classList.add('show');
      btn.disabled = false;
      spinner.classList.remove('show');
      btnText.textContent = 'Crear cuenta';
    }
  };

  document.getElementById('regBtn')?.addEventListener('click', doRegister);
  document.getElementById('regPassword')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doRegister();
  });
}

// ── LOGIN PAGE ────────────────────────────────────────────
function renderLogin() {
  // Si ya está logado, ir a admin
  if (isLoggedIn()) { window.location.href = '?page=admin'; return; }

  document.querySelector('.hero')?.remove();
  document.querySelector('.store-wrap')?.remove();
  document.querySelector('footer')?.remove();
  document.querySelector('.cart-overlay')?.remove();
  document.querySelector('.modal-overlay')?.remove();

  const loginHTML = `
  <link rel="stylesheet" href="css/admin.css">
  <div class="login-page">
    <div class="login-glow"></div>
    <div class="login-card">
      <div class="login-logo">
        <span class="logo-text">VCs</span>
        <p>Panel de Administración</p>
      </div>
      <div style="text-align:center">
        <span class="login-badge">🔒 Acceso restringido</span>
      </div>
      <div class="login-error" id="loginError">Credenciales incorrectas. Intenta de nuevo.</div>
      <div class="form-group">
        <label>Correo electrónico</label>
        <input type="email" id="loginEmail" placeholder="correo@ejemplo.com" autocomplete="email">
      </div>
      <div class="form-group">
        <label>Contraseña</label>
        <div class="password-wrap">
          <input type="password" id="loginPassword" placeholder="••••••••" autocomplete="current-password">
          <button type="button" class="eye-btn" id="togglePass" title="Mostrar/ocultar contraseña">
            <svg id="eyeIcon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <button class="login-btn" id="loginBtn">
        <span id="loginBtnText">Iniciar sesión</span>
        <div class="btn-spinner" id="loginSpinner"></div>
      </button>
      <div style="text-align:center;margin-top:1.25rem">
        <a href="?" style="color:var(--muted);font-size:.85rem;text-decoration:none;">← Volver a la tienda</a>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', loginHTML);

  // Toggle password
  document.getElementById('togglePass')?.addEventListener('click', () => {
    const input = document.getElementById('loginPassword');
    const icon  = document.getElementById('eyeIcon');
    if (input.type === 'password') {
      input.type = 'text';
      icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
    } else {
      input.type = 'password';
      icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    }
  });

  // Login submit
  const doLogin = async () => {
    const email    = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    const errEl    = document.getElementById('loginError');
    const btn      = document.getElementById('loginBtn');
    const spinner  = document.getElementById('loginSpinner');
    const btnText  = document.getElementById('loginBtnText');

    errEl.classList.remove('show');
    btn.disabled = true;
    spinner.classList.add('show');
    btnText.textContent = 'Verificando…';

    try {
      await verifyAndLogin(email, password);
      window.location.href = '?page=admin';
    } catch (err) {
      errEl.classList.add('show');
      btn.disabled = false;
      spinner.classList.remove('show');
      btnText.textContent = 'Iniciar sesión';
    }
  };

  document.getElementById('loginBtn')?.addEventListener('click', doLogin);
  document.getElementById('loginPassword')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

// ── ADMIN PAGE ────────────────────────────────────────────
function renderAdmin() {
  // Inyectar CSS admin
  if (!document.querySelector('link[href="css/admin.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/admin.css';
    document.head.appendChild(link);
  }

  document.querySelector('.hero')?.remove();
  document.querySelector('.store-wrap')?.remove();
  document.querySelector('footer')?.remove();
  document.querySelector('.cart-overlay')?.remove();
  document.querySelector('.modal-overlay')?.remove();

  const session = getSession();

  const adminHTML = `
  <div class="admin-layout" id="adminLayout">
    <!-- Sidebar -->
    <aside class="admin-sidebar">
      <div style="margin-bottom:1.5rem;padding:0 .5rem;">
        <div style="font-size:.75rem;color:var(--muted);margin-bottom:.25rem;">Sesión activa</div>
        <div style="font-size:.9rem;font-weight:700;color:var(--purple3)">${session?.username || 'ADMIN'}</div>
        <div style="font-size:.75rem;color:var(--muted)">${session?.email || ''}</div>
      </div>

      <h3>Gestión</h3>
      <button class="admin-nav-item active" data-section="products">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        Productos
        <span class="admin-badge" id="productsCountBadge">0</span>
      </button>
      <button class="admin-nav-item" data-section="brands">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        Marcas y Modelos
      </button>

      <div class="admin-separator"></div>

      <button class="admin-nav-item" id="previewStoreBtn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        Ver tienda
      </button>

      <div class="admin-separator" style="margin-top:auto"></div>
      <button class="logout-btn" id="logoutBtn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Cerrar sesión
      </button>
    </aside>

    <!-- Main content -->
    <div class="admin-main">

      <!-- PRODUCTS SECTION -->
      <div class="admin-section active" id="section-products">
        <div class="admin-header">
          <div>
            <h1 class="admin-title">Productos <span id="adminProductCount"></span></h1>
            <p class="admin-subtitle">Gestiona el catálogo completo de productos</p>
          </div>
          <div style="display:flex;gap:.75rem;flex-wrap:wrap">
            <div style="position:relative">
              <input type="text" class="form-input" id="adminSearch" placeholder="Buscar producto…" style="padding-left:2.25rem;min-width:200px">
              <svg style="position:absolute;left:.75rem;top:50%;transform:translateY(-50%);color:var(--muted)" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <button class="btn-primary" id="newProductBtn">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nuevo producto
            </button>
          </div>
        </div>

        <!-- Stats -->
        <div class="stats-grid" id="adminStats">
          <div class="stat-card"><div class="stat-label">Total productos</div><div class="stat-value" id="statTotal">–</div></div>
          <div class="stat-card"><div class="stat-label">En stock</div><div class="stat-value green" id="statInStock">–</div></div>
          <div class="stat-card"><div class="stat-label">Sin stock</div><div class="stat-value red" id="statNoStock">–</div></div>
          <div class="stat-card"><div class="stat-label">Top Sales</div><div class="stat-value" id="statTopSales">–</div></div>
          <div class="stat-card"><div class="stat-label">Recomendados</div><div class="stat-value blue" id="statReco">–</div></div>
        </div>

        <div class="admin-products-grid" id="adminProductsGrid"></div>
      </div>

      <!-- BRANDS SECTION -->
      <div class="admin-section" id="section-brands">
        <div class="admin-header">
          <div>
            <h1 class="admin-title">Marcas <span style="color:var(--muted)">& Modelos</span></h1>
            <p class="admin-subtitle">Administra marcas y sus líneas de modelos</p>
          </div>
          <button class="btn-primary" id="newBrandBtn">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva marca
          </button>
        </div>
        <div class="brands-grid" id="brandsGrid"></div>
      </div>

    </div>
  </div>

  <!-- PRODUCT FORM MODAL -->
  <div class="product-modal-overlay" id="productModalOverlay">
    <div class="product-modal">
      <div class="product-modal-head">
        <h2 id="productModalTitle">Nuevo producto</h2>
        <button class="close-btn" id="productModalClose">✕</button>
      </div>
      <div class="product-modal-body">
        <!-- Preview izquierda -->
        <div class="modal-preview">
          <div class="modal-preview-title">Vista previa</div>
          <div class="preview-card" id="previewCard">
            <div class="preview-card-img" id="previewImg">💨</div>
            <div class="preview-card-body">
              <span class="card-brand-label vhill" id="previewBrandLabel">
                <span class="dot"></span><span id="previewBrandText">Marca Modelo</span>
              </span>
              <div class="card-name" id="previewFlavor">Sabor del producto</div>
              <div class="specs-grid">
                <div class="spec-chip" style="grid-column:1/-1"><span id="previewSpecs" style="color:var(--muted);font-size:.7rem">Especificaciones del modelo</span></div>
              </div>
              <div class="card-footer">
                <span class="card-price" id="previewPrice">$0 MXN</span>
                <span style="font-size:.7rem;color:var(--muted)" id="previewStock">En stock</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Form derecha -->
        <div class="modal-form" id="productForm">
          <div class="form-row">
            <div>
              <label class="form-label">Marca *</label>
              <select class="form-select" id="fBrand">
                <option value="">— Selecciona —</option>
              </select>
            </div>
            <div>
              <label class="form-label">Modelo *</label>
              <select class="form-select" id="fModel">
                <option value="">— Selecciona marca —</option>
              </select>
            </div>
          </div>

          <div class="form-col">
            <label class="form-label">Sabor (display) *</label>
            <input class="form-input" id="fFlavor" placeholder="Ej: Strawberry Watermelon">
          </div>

          <div class="form-row">
            <div>
              <label class="form-label">Precio (MXN) *</label>
              <input class="form-input" id="fPrice" type="number" min="0" step="10" placeholder="300">
            </div>
            <div>
              <label class="form-label">Categoría</label>
              <select class="form-select" id="fCategory">
                <option value="frutal">Frutal</option>
                <option value="menta">Mentolado</option>
                <option value="cremoso">Cremoso</option>
                <option value="bebida">Bebida</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div>
              <label class="form-label">Emoji sustituto</label>
              <input class="form-input" id="fEmoji" placeholder="🍓" maxlength="4">
            </div>
            <div>
              <label class="form-label">Unidades disponibles</label>
              <input class="form-input" id="fUnits" type="number" min="0" step="1" placeholder="0">
            </div>
          </div>

          <!-- Toggles -->
          <div class="toggle-row">
            <div class="toggle-label">
              En stock
              <span>Visible como disponible</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="fInStock" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="toggle-row">
            <div class="toggle-label">
              Top Sales
              <span>Muestra badge destacado</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="fTopSales">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="toggle-row" style="margin-bottom:1rem">
            <div class="toggle-label">
              Recomendado
              <span>Aparece en filtro de favoritos</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="fRecommended">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <!-- Imagen -->
          <label class="form-label">Imagen identificadora</label>
          <div class="image-tabs">
            <button class="image-tab active" id="imgTabFile">📁 Desde archivo</button>
            <button class="image-tab" id="imgTabUrl">🔗 Por URL</button>
          </div>
          <div id="imgFileSection">
            <div class="image-uploader" id="imageDropzone">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <p>Arrastra una imagen o haz clic para seleccionar<br><small>PNG, JPG, WEBP — máx 2MB</small></p>
              <input type="file" id="imageFileInput" accept="image/*" style="display:none">
            </div>
          </div>
          <div id="imgUrlSection" style="display:none">
            <input class="form-input" id="fImageUrl" placeholder="https://ejemplo.com/imagen.png">
          </div>
          <div id="imagePreviewWrap" style="margin-top:.75rem;display:none">
            <img id="imagePreviewThumb" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">
            <button class="btn-danger" id="clearImageBtn" style="margin-top:.5rem;width:100%">✕ Quitar imagen</button>
          </div>
        </div>
      </div>
      <div class="product-modal-foot">
        <button class="btn-secondary" id="productModalCancel">Cancelar</button>
        <button class="btn-primary" id="productModalSave">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Guardar producto
        </button>
      </div>
    </div>
  </div>

  <!-- BRAND MODAL -->
  <div class="simple-modal-overlay" id="brandModalOverlay">
    <div class="simple-modal">
      <h3 id="brandModalTitle">Nueva marca</h3>
      <div class="form-col">
        <label class="form-label">Nombre de la marca</label>
        <input class="form-input" id="bName" placeholder="Ej: Vhill">
      </div>
      <div class="form-col">
        <label class="form-label">Slug (identificador único)</label>
        <input class="form-input" id="bSlug" placeholder="Ej: vhill">
      </div>
      <div class="form-col">
        <label class="form-label">Color de la marca</label>
        <input type="color" id="bColor" value="#7c3aed" style="width:100%;height:40px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);cursor:pointer">
      </div>
      <div style="display:flex;gap:.75rem;margin-top:1.25rem">
        <button class="btn-secondary" id="brandModalCancel" style="flex:1">Cancelar</button>
        <button class="btn-primary" id="brandModalSave" style="flex:2">Guardar marca</button>
      </div>
    </div>
  </div>

  <!-- MODEL MODAL -->
  <div class="simple-modal-overlay" id="modelModalOverlay">
    <div class="simple-modal">
      <h3>Nuevo modelo</h3>
      <input type="hidden" id="mBrandId">
      <div class="form-col">
        <label class="form-label">Nombre del modelo</label>
        <input class="form-input" id="mName" placeholder="Ej: V12000">
      </div>
      <div class="form-col">
        <label class="form-label">Slug</label>
        <input class="form-input" id="mSlug" placeholder="Ej: v12000">
      </div>
      <div class="form-row">
        <div>
          <label class="form-label">Puffs</label>
          <input class="form-input" id="mPuffs" type="number" placeholder="3000">
        </div>
        <div>
          <label class="form-label">Ohm (coil)</label>
          <input class="form-input" id="mCoil" placeholder="1.2">
        </div>
      </div>
      <div class="form-row">
        <div>
          <label class="form-label">Juice (ml)</label>
          <input class="form-input" id="mJuiceMl" type="number" placeholder="8">
        </div>
        <div>
          <label class="form-label">Nicotina (%)</label>
          <input class="form-input" id="mJuiceNic" placeholder="5">
        </div>
      </div>
      <div class="form-col">
        <label class="form-label">Batería (mAh)</label>
        <input class="form-input" id="mBattery" type="number" placeholder="1200">
      </div>
      <div style="display:flex;gap:.75rem;margin-top:1.25rem">
        <button class="btn-secondary" id="modelModalCancel" style="flex:1">Cancelar</button>
        <button class="btn-primary" id="modelModalSave" style="flex:2">Guardar modelo</button>
      </div>
    </div>
  </div>

  <!-- CONFIRM DELETE -->
  <div class="confirm-modal-overlay" id="confirmDeleteOverlay">
    <div class="confirm-modal">
      <div class="confirm-icon">🗑️</div>
      <h3>¿Eliminar producto?</h3>
      <p id="confirmDeleteMsg">Esta acción no se puede deshacer.</p>
      <div class="confirm-btns">
        <button class="btn-secondary" id="confirmDeleteCancel" style="flex:1">Cancelar</button>
        <button class="btn-danger" id="confirmDeleteOk" style="flex:1;border-radius:10px;padding:.75rem">Eliminar</button>
      </div>
    </div>
  </div>
  `;

  document.body.insertAdjacentHTML('beforeend', adminHTML);

  // Cargar datos y bindear eventos
  initAdmin();
}

async function initAdmin() {
  try {
    const [products, brands, models] = await Promise.all([getProducts(), getBrands(), getModels()]);
    ALL_PRODUCTS = products || [];
    ALL_BRANDS   = brands  || [];
    ALL_MODELS   = models  || [];

    renderAdminProducts();
    renderAdminBrands();
    updateAdminStats();
  } catch (err) {
    showToast('Error al cargar datos: ' + err.message, 'error');
  }

  // Navegación admin
  document.querySelectorAll('.admin-nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      document.getElementById(`section-${btn.dataset.section}`)?.classList.add('active');
    });
  });

  document.getElementById('previewStoreBtn')?.addEventListener('click', () => window.location.href = '?');
  document.getElementById('logoutBtn')?.addEventListener('click', () => { clearSession(); window.location.href = '?'; });

  // Search admin
  document.getElementById('adminSearch')?.addEventListener('input', e => {
    renderAdminProducts(e.target.value.toLowerCase());
  });

  // New product
  document.getElementById('newProductBtn')?.addEventListener('click', () => openProductModal());

  // Product modal close
  document.getElementById('productModalClose')?.addEventListener('click', closeProductModal);
  document.getElementById('productModalCancel')?.addEventListener('click', closeProductModal);
  document.getElementById('productModalOverlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeProductModal(); });

  // Brand modal
  document.getElementById('newBrandBtn')?.addEventListener('click', () => openBrandModal());
  document.getElementById('brandModalCancel')?.addEventListener('click', () => toggleOverlay('brandModalOverlay', false));
  document.getElementById('brandModalSave')?.addEventListener('click', saveBrand);

  // Model modal
  document.getElementById('modelModalCancel')?.addEventListener('click', () => toggleOverlay('modelModalOverlay', false));
  document.getElementById('modelModalSave')?.addEventListener('click', saveModel);

  // Confirm delete
  document.getElementById('confirmDeleteCancel')?.addEventListener('click', () => toggleOverlay('confirmDeleteOverlay', false));

  // Product save
  document.getElementById('productModalSave')?.addEventListener('click', saveProduct);

  // Brand select → populate models
  document.getElementById('fBrand')?.addEventListener('change', e => {
    populateModelSelect(e.target.value);
    updatePreview();
  });

  // Live preview updates
  ['fFlavor','fPrice','fEmoji','fImageUrl'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updatePreview);
  });
  ['fInStock','fTopSales','fModel'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updatePreview);
  });

  // Image tabs
  document.getElementById('imgTabFile')?.addEventListener('click', () => {
    document.getElementById('imgFileSection').style.display = 'block';
    document.getElementById('imgUrlSection').style.display = 'none';
    document.getElementById('imgTabFile').classList.add('active');
    document.getElementById('imgTabUrl').classList.remove('active');
  });
  document.getElementById('imgTabUrl')?.addEventListener('click', () => {
    document.getElementById('imgFileSection').style.display = 'none';
    document.getElementById('imgUrlSection').style.display = 'block';
    document.getElementById('imgTabFile').classList.remove('active');
    document.getElementById('imgTabUrl').classList.add('active');
  });

  // File drag & drop
  const dropzone = document.getElementById('imageDropzone');
  if (dropzone) {
    dropzone.addEventListener('click', () => document.getElementById('imageFileInput').click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--purple)'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = ''; });
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if (file) handleImageFile(file);
    });
    document.getElementById('imageFileInput')?.addEventListener('change', e => {
      if (e.target.files[0]) handleImageFile(e.target.files[0]);
    });
  }

  document.getElementById('clearImageBtn')?.addEventListener('click', clearImage);

  // Populate brand select
  populateBrandSelect();
}

let _currentImageData = ''; // base64 o URL
let _editingProductId  = null;

function handleImageFile(file) {
  if (file.size > 2 * 1024 * 1024) { showToast('La imagen es muy grande (máx 2MB)', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    _currentImageData = e.target.result;
    showImagePreview(_currentImageData);
    updatePreview();
  };
  reader.readAsDataURL(file);
}

function showImagePreview(src) {
  const wrap  = document.getElementById('imagePreviewWrap');
  const thumb = document.getElementById('imagePreviewThumb');
  if (wrap && thumb) { thumb.src = src; wrap.style.display = 'block'; }
}

function clearImage() {
  _currentImageData = '';
  document.getElementById('imagePreviewWrap').style.display = 'none';
  document.getElementById('imagePreviewThumb').src = '';
  document.getElementById('imageFileInput').value = '';
  document.getElementById('fImageUrl').value = '';
  updatePreview();
}

function populateBrandSelect() {
  const sel = document.getElementById('fBrand');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Selecciona —</option>';
  ALL_BRANDS.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.name;
    sel.appendChild(opt);
  });
}

function populateModelSelect(brandId) {
  const sel = document.getElementById('fModel');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Selecciona modelo —</option>';
  if (!brandId) return;
  const models = ALL_MODELS.filter(m => m.brand_id === brandId);
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    sel.appendChild(opt);
  });
}

function updatePreview() {
  const brandId  = document.getElementById('fBrand')?.value;
  const modelId  = document.getElementById('fModel')?.value;
  const flavor   = document.getElementById('fFlavor')?.value || 'Sabor del producto';
  const price    = document.getElementById('fPrice')?.value  || '0';
  const emoji    = document.getElementById('fEmoji')?.value  || '💨';
  const inStock  = document.getElementById('fInStock')?.checked;
  const urlInput = document.getElementById('fImageUrl')?.value;

  const brand    = ALL_BRANDS.find(b => b.id === brandId) || {};
  const model    = ALL_MODELS.find(m => m.id === modelId) || {};

  // Imagen
  const imgSrc = _currentImageData || urlInput || '';
  const previewImg = document.getElementById('previewImg');
  if (previewImg) {
    previewImg.innerHTML = imgSrc
      ? `<img src="${imgSrc}" alt="" style="width:100%;height:100%;object-fit:cover">`
      : (emoji || '💨');
  }

  // Brand label
  const brandLabel = document.getElementById('previewBrandLabel');
  const brandText  = document.getElementById('previewBrandText');
  if (brandLabel && brandText) {
    brandLabel.className = `card-brand-label ${brand.slug || 'vhill'}`;
    brandText.textContent = `${brand.name || 'Marca'} ${model.name || ''}`;
  }

  const flavEl = document.getElementById('previewFlavor');
  if (flavEl) flavEl.textContent = flavor;

  const priceEl = document.getElementById('previewPrice');
  if (priceEl) priceEl.textContent = `$${price} MXN`;

  const stockEl = document.getElementById('previewStock');
  if (stockEl) { stockEl.textContent = inStock ? '✓ En stock' : '✕ Sin stock'; stockEl.style.color = inStock ? '#4ade80' : '#f87171'; }
}

function openProductModal(product = null) {
  _editingProductId = product?.id || null;
  _currentImageData = '';

  const title = document.getElementById('productModalTitle');
  if (title) title.textContent = product ? 'Editar producto' : 'Nuevo producto';

  // Reset form
  if (!product) {
    document.getElementById('fBrand').value    = '';
    document.getElementById('fModel').innerHTML = '<option value="">— Selecciona marca —</option>';
    document.getElementById('fFlavor').value   = '';
    document.getElementById('fPrice').value    = '';
    document.getElementById('fCategory').value = 'frutal';
    document.getElementById('fEmoji').value    = '';
    document.getElementById('fUnits').value    = '0';
    document.getElementById('fInStock').checked     = true;
    document.getElementById('fTopSales').checked    = false;
    document.getElementById('fRecommended').checked = false;
    document.getElementById('fImageUrl').value  = '';
    clearImage();
  } else {
    // Rellenar con datos existentes
    document.getElementById('fBrand').value    = product.brand_id || '';
    populateModelSelect(product.brand_id);
    setTimeout(() => { document.getElementById('fModel').value = product.model_id || ''; updatePreview(); }, 50);
    document.getElementById('fFlavor').value   = product.flavor_display || '';
    document.getElementById('fPrice').value    = product.price || '';
    document.getElementById('fCategory').value = product.category || 'frutal';
    document.getElementById('fEmoji').value    = product.emoji || '';
    document.getElementById('fUnits').value    = product.stock_units || '0';
    document.getElementById('fInStock').checked     = !!product.in_stock;
    document.getElementById('fTopSales').checked    = !!product.top_sales;
    document.getElementById('fRecommended').checked = !!product.recommended;
    document.getElementById('fImageUrl').value  = product.image_url || '';
    if (product.image_url) showImagePreview(product.image_url);
    else document.getElementById('imagePreviewWrap').style.display = 'none';
  }

  updatePreview();
  toggleOverlay('productModalOverlay', true);
}

function closeProductModal() {
  toggleOverlay('productModalOverlay', false);
  _editingProductId = null;
  _currentImageData = '';
}

async function saveProduct() {
  const brandId   = document.getElementById('fBrand')?.value;
  const modelId   = document.getElementById('fModel')?.value;
  const flavor    = document.getElementById('fFlavor')?.value?.trim();
  const price     = parseFloat(document.getElementById('fPrice')?.value);
  const category  = document.getElementById('fCategory')?.value;
  const emoji     = document.getElementById('fEmoji')?.value?.trim() || '💨';
  const units     = parseInt(document.getElementById('fUnits')?.value) || 0;
  const inStock   = document.getElementById('fInStock')?.checked;
  const topSales  = document.getElementById('fTopSales')?.checked;
  const reco      = document.getElementById('fRecommended')?.checked;
  const urlInput  = document.getElementById('fImageUrl')?.value?.trim();

  if (!brandId || !modelId || !flavor || !price) {
    showToast('Completa los campos obligatorios (*)', 'error'); return;
  }

  const imageUrl = _currentImageData || urlInput || '';

  const payload = {
    brand_id:      brandId,
    model_id:      modelId,
    flavor:        flavor.toLowerCase(),
    flavor_display: flavor,
    price,
    category,
    emoji,
    stock_units:   units,
    in_stock:      inStock,
    top_sales:     topSales,
    recommended:   reco,
    image_url:     imageUrl
  };

  const saveBtn = document.getElementById('productModalSave');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando…';

  try {
    if (_editingProductId) {
      await updateProduct(_editingProductId, payload);
      showToast('Producto actualizado ✓');
    } else {
      await createProduct(payload);
      showToast('Producto creado ✓');
    }
    const [products, brands, models] = await Promise.all([getProducts(), getBrands(), getModels()]);
    ALL_PRODUCTS = products; ALL_BRANDS = brands; ALL_MODELS = models;
    renderAdminProducts();
    updateAdminStats();
    closeProductModal();
    // Actualizar badge
    document.getElementById('productsCountBadge').textContent = ALL_PRODUCTS.length;
  } catch (err) {
    showToast('Error al guardar: ' + err.message, 'error');
  }

  saveBtn.disabled = false;
  saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Guardar producto`;
}

function renderAdminProducts(search = '') {
  const grid = document.getElementById('adminProductsGrid');
  if (!grid) return;

  let list = ALL_PRODUCTS;
  if (search) list = list.filter(p => (p.flavor_display || '').toLowerCase().includes(search));

  const countEl = document.getElementById('adminProductCount');
  if (countEl) countEl.textContent = `(${list.length})`;
  const badgeEl = document.getElementById('productsCountBadge');
  if (badgeEl) badgeEl.textContent = ALL_PRODUCTS.length;

  grid.innerHTML = '';

  list.forEach(p => {
    const brand = p.brands || {};
    const model = p.models || {};
    const media = p.image_url
      ? `<img src="${p.image_url}" alt="${p.flavor_display}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
      : (p.emoji || '💨');

    const card = document.createElement('div');
    card.className = 'admin-product-card product-card' + (p.in_stock ? '' : ' out-of-stock');
    card.dataset.brand = brand.slug || 'vhill';
    card.innerHTML = `
      <div class="admin-card-actions">
        <button class="card-action-btn edit" data-id="${p.id}" title="Editar">✏️</button>
        <button class="card-action-btn delete" data-id="${p.id}" title="Eliminar">🗑️</button>
      </div>
      ${p.top_sales ? '<span class="fav-badge">Top Sales</span>' : ''}
      ${!p.in_stock ? '<span class="stock-badge">Sin stock</span>' : ''}
      <div class="card-img">${media}</div>
      <div class="card-body">
        <span class="card-brand-label ${brand.slug || 'vhill'}">
          <span class="dot"></span>${brand.name || ''} ${model.name || ''}
        </span>
        <div class="card-name">${p.flavor_display}</div>
        <div class="card-footer">
          <span class="card-price">$${p.price} MXN</span>
          <span style="font-size:.75rem;color:${p.in_stock ? '#4ade80' : '#f87171'}">${p.in_stock ? '● En stock' : '● Sin stock'}</span>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  // Bind edit/delete
  grid.querySelectorAll('.card-action-btn.edit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const p = ALL_PRODUCTS.find(x => x.id === btn.dataset.id);
      if (p) openProductModal(p);
    });
  });

  grid.querySelectorAll('.card-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const p = ALL_PRODUCTS.find(x => x.id === btn.dataset.id);
      openConfirmDelete(p);
    });
  });
}

function openConfirmDelete(product) {
  const msgEl = document.getElementById('confirmDeleteMsg');
  if (msgEl) msgEl.textContent = `¿Eliminar "${product.flavor_display}"? Esta acción no se puede deshacer.`;

  const okBtn = document.getElementById('confirmDeleteOk');
  okBtn.onclick = async () => {
    okBtn.disabled = true;
    try {
      await deleteProduct(product.id);
      ALL_PRODUCTS = ALL_PRODUCTS.filter(p => p.id !== product.id);
      renderAdminProducts();
      updateAdminStats();
      showToast('Producto eliminado');
      toggleOverlay('confirmDeleteOverlay', false);
    } catch (err) {
      showToast('Error al eliminar: ' + err.message, 'error');
    }
    okBtn.disabled = false;
  };

  toggleOverlay('confirmDeleteOverlay', true);
}

function updateAdminStats() {
  const total    = ALL_PRODUCTS.length;
  const inStock  = ALL_PRODUCTS.filter(p => p.in_stock).length;
  const noStock  = total - inStock;
  const topSales = ALL_PRODUCTS.filter(p => p.top_sales).length;
  const reco     = ALL_PRODUCTS.filter(p => p.recommended).length;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('statTotal', total);
  set('statInStock', inStock);
  set('statNoStock', noStock);
  set('statTopSales', topSales);
  set('statReco', reco);
}

function renderAdminBrands() {
  const grid = document.getElementById('brandsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  ALL_BRANDS.forEach(brand => {
    const models = ALL_MODELS.filter(m => m.brand_id === brand.id);
    const card = document.createElement('div');
    card.className = 'brand-card';
    card.innerHTML = `
      <div class="brand-card-header">
        <div class="brand-card-name">
          <span class="brand-color-dot" style="background:${brand.color}"></span>
          ${brand.name}
        </div>
        <span style="font-size:.75rem;color:var(--muted)">${ALL_PRODUCTS.filter(p => p.brand_id === brand.id).length} productos</span>
      </div>
      <div class="model-list">
        ${models.map(m => `
          <div class="model-item">
            <div>
              <div class="model-item-name">${m.name}</div>
              <div class="model-item-meta">${m.puffs} puffs · ${m.coil_ohm}Ω · ${m.juice_ml}ml ${m.juice_nic}% nic</div>
            </div>
          </div>`).join('')}
        <button class="add-model-btn" data-brand-id="${brand.id}" data-brand-name="${brand.name}">
          + Agregar modelo
        </button>
      </div>`;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.add-model-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('mBrandId').value = btn.dataset.brandId;
      document.getElementById('mName').value  = '';
      document.getElementById('mSlug').value  = '';
      document.getElementById('mPuffs').value = '';
      document.getElementById('mCoil').value  = '';
      document.getElementById('mJuiceMl').value  = '';
      document.getElementById('mJuiceNic').value = '';
      document.getElementById('mBattery').value  = '';
      toggleOverlay('modelModalOverlay', true);
    });
  });
}

function openBrandModal() {
  document.getElementById('bName').value  = '';
  document.getElementById('bSlug').value  = '';
  document.getElementById('bColor').value = '#7c3aed';
  toggleOverlay('brandModalOverlay', true);
}

async function saveBrand() {
  const name  = document.getElementById('bName')?.value?.trim();
  const slug  = document.getElementById('bSlug')?.value?.trim().toLowerCase().replace(/\s+/g, '-');
  const color = document.getElementById('bColor')?.value;
  if (!name || !slug) { showToast('Nombre y slug son obligatorios', 'error'); return; }

  const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
  const glow = `rgba(${r},${g},${b},.25)`;

  try {
    const brand = await createBrand({ slug, name, color, glow });
    ALL_BRANDS.push(brand);
    renderAdminBrands();
    populateBrandSelect();
    showToast('Marca creada ✓');
    toggleOverlay('brandModalOverlay', false);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function saveModel() {
  const brandId = document.getElementById('mBrandId')?.value;
  const name    = document.getElementById('mName')?.value?.trim();
  const slug    = document.getElementById('mSlug')?.value?.trim().toLowerCase();
  const puffs   = parseInt(document.getElementById('mPuffs')?.value) || 0;
  const coil    = document.getElementById('mCoil')?.value?.trim();
  const ml      = parseInt(document.getElementById('mJuiceMl')?.value) || 0;
  const nic     = document.getElementById('mJuiceNic')?.value?.trim();
  const battery = parseInt(document.getElementById('mBattery')?.value) || 0;

  if (!brandId || !name || !slug) { showToast('Marca, nombre y slug son obligatorios', 'error'); return; }

  try {
    const model = await createModel({ brand_id: brandId, slug, name, puffs, coil_ohm: coil, juice_ml: ml, juice_nic: nic, battery_mah: battery });
    ALL_MODELS.push({ ...model, brands: ALL_BRANDS.find(b => b.id === brandId) });
    renderAdminBrands();
    showToast('Modelo creado ✓');
    toggleOverlay('modelModalOverlay', false);
    // Si el brand está seleccionado en el form, refrescar options
    if (document.getElementById('fBrand')?.value === brandId) populateModelSelect(brandId);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function toggleOverlay(id, show) {
  const ov = document.getElementById(id);
  if (!ov) return;
  if (show) {
    ov.classList.add('open');
    requestAnimationFrame(() => ov.classList.add('visible'));
  } else {
    ov.classList.remove('visible');
    setTimeout(() => ov.classList.remove('open'), 300);
  }
}

// ── INIT ──────────────────────────────────────────────────
route();