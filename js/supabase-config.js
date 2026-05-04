/* ═══════════════════════════════════════════════════════════
   VCs Corp — Supabase Configuration
   ═══════════════════════════════════════════════════════════
   IMPORTANTE: Reemplaza SUPABASE_URL y SUPABASE_ANON_KEY
   con los valores reales de tu proyecto en Supabase.
   Los encontrarás en: Project Settings > API
   ═══════════════════════════════════════════════════════════ */

const SUPABASE_URL  = 'https://nybhfztnfvttvihhetqk.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_D3eqECyRAec6NwXeFmD7EA_lKORRHS1';

// Cliente supabase inicializado con el CDN
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const bcrypt = dcodeIO.bcrypt;

/* ── Auth helpers ───────────────────────────────────────── */

// Almacenamiento de sesión con cifrado básico en sessionStorage
const SESSION_KEY = '_vcs_admin_session';

function _encodeSession(data) {
  return btoa(encodeURIComponent(JSON.stringify(data)));
}

function _decodeSession(raw) {
  try {
    return JSON.parse(decodeURIComponent(atob(raw)));
  } catch {
    return null;
  }
}

function saveSession(adminData) {
  sessionStorage.setItem(SESSION_KEY, _encodeSession(adminData));
  // Cookie con SameSite=Strict para protección CSRF
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toUTCString(); // 8h
  document.cookie = `vcs_admin=1; expires=${expires}; path=/; SameSite=Strict`;
}

function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  const s = _decodeSession(raw);
  if (!s || !s.id) return null;
  return s;
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  document.cookie = 'vcs_admin=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict';
}

function isLoggedIn() {
  return getSession() !== null;
}

/* ── Login ───────────────────────────────────────────────── */
async function adminLogin(email, password) {
  // Buscar el usuario por email
  const { data: users, error } = await _supabase
    .from('admin_users')
    .select('id, username, email, password_hash')
    .eq('email', email.toLowerCase().trim())
    .limit(1);

  if (error || !users || users.length === 0) {
    throw new Error('Credenciales incorrectas');
  }

  const user = users[0];
  // Devolver el hash para que main.js lo compare con bcrypt (ya cargado en el DOM)
  return user;
}

async function verifyAndLogin(email, password) {
  const user = await adminLogin(email, password);
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) throw new Error('Credenciales incorrectas');
  saveSession({ id: user.id, username: user.username, email: user.email });
  return user;
}

// register
async function registerAdmin(username, email, passwordHash) {
  const { data, error } = await _supabase
    .from('admin_users')
    .insert([{ username, email, password_hash: passwordHash }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* ── Brands ──────────────────────────────────────────────── */
async function getBrands() {
  const { data, error } = await _supabase
    .from('brands')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

async function createBrand(brand) {
  const { data, error } = await _supabase
    .from('brands')
    .insert([brand])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ── Models ──────────────────────────────────────────────── */
async function getModels(brandId = null) {
  let q = _supabase.from('models').select('*, brands(name, slug, color)').order('name');
  if (brandId) q = q.eq('brand_id', brandId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function createModel(model) {
  const { data, error } = await _supabase
    .from('models')
    .insert([model])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ── Products ────────────────────────────────────────────── */
async function getProducts() {
  const { data, error } = await _supabase
    .from('products')
    .select(`
      *,
      brands (id, slug, name, color, glow),
      models (id, slug, name, puffs, coil_ohm, juice_ml, juice_nic, battery_mah)
    `)
    .order('brands(name), models(name), flavor_display');
  if (error) throw error;
  return data;
}

async function createProduct(product) {
  const { data, error } = await _supabase
    .from('products')
    .insert([product])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateProduct(id, updates) {
  const { data, error } = await _supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteProduct(id) {
  const { error } = await _supabase
    .from('products')
    .delete()
    .eq('id', id);
  if (error) throw error;
}