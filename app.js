// ===== Config Supabase =====
const SUPABASE_URL = "https://tmoclotbsnrvfcohegld.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtb2Nsb3Ric25ydmZjb2hlZ2xkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyOTU2OTcsImV4cCI6MjEwODg3MTY5N30.lBfgm6Uzv3ZEbKHAMYQHHH9lZ7idOBau5ZraX1oPLPI";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let PRECIO_KM_ACTUAL = 0.26;
let VIAJES = [];
let PRESETS = [];
let EDIT_VIAJE_ID = null;
let EDIT_PRESET_ID = null;
let TIPO_SEL = "CIARA";
let TIPO_PRESET_SEL = "CIARA";

// ===== Utilidades =====
function fmtEUR(n) {
  return (Number(n) || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}
function switchView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === id));
}
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

// ===== Carga inicial =====
async function loadAll() {
  await Promise.all([loadConfig(), loadPresets(), loadViajes()]);
  renderPresets();
  renderPresetsConfig();
  populateMesFilter();
  renderListado();
}

async function loadConfig() {
  const { data, error } = await sb.from("config").select("*").eq("id", 1).single();
  if (!error && data) {
    PRECIO_KM_ACTUAL = Number(data.precio_km);
    document.getElementById("input-precio-km").value = PRECIO_KM_ACTUAL;
  }
}

async function loadPresets() {
  const { data, error } = await sb.from("viajes_predeterminados").select("*").order("created_at", { ascending: true });
  if (!error) PRESETS = data || [];
}

async function loadViajes() {
  const { data, error } = await sb.from("viajes").select("*").order("fecha", { ascending: false }).order("created_at", { ascending: false });
  if (!error) VIAJES = data || [];
}

// ===== Render: botones predeterminados (home) =====
function renderPresets() {
  const grid = document.getElementById("presets-grid");
  if (PRESETS.length === 0) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;">Aún no tienes viajes predeterminados.<br>Pulsa "+ Nuevo viaje predeterminado" para crear el primero.</div>`;
    return;
  }
  grid.innerHTML = PRESETS.map(p => `
    <button class="preset" onclick='openPresetConfirm(${JSON.stringify(p).replace(/'/g, "&apos;")})'>
      <div class="nombre">${esc(p.nombre)}</div>
      <div class="ruta">${esc(p.origen)} → ${esc(p.destino)}</div>
      <span class="tag ${p.tipo}">${p.tipo === "CIARA" ? "Con Ciara" : "Trabajo"}</span>
      <div class="km">${p.km} km</div>
    </button>
  `).join("");
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ===== Render: config de presets (CRUD) =====
function renderPresetsConfig() {
  const cont = document.getElementById("lista-presets-config");
  if (PRESETS.length === 0) {
    cont.innerHTML = `<div class="empty">Sin viajes predeterminados.</div>`;
    return;
  }
  cont.innerHTML = PRESETS.map(p => `
    <div class="list-item">
      <div class="main">
        <div class="ruta">${esc(p.nombre)}</div>
        <div class="meta">${esc(p.origen)} → ${esc(p.destino)} · ${p.km} km · ${p.tipo === "CIARA" ? "Con Ciara" : "Trabajo"}</div>
      </div>
      <button class="link-btn" onclick='openPresetForm(${JSON.stringify(p).replace(/'/g, "&apos;")})'>Editar</button>
      <button class="del" onclick="eliminarPreset('${p.id}')">✕</button>
    </div>
  `).join("");
}

// ===== Flujo: pulsar botón predeterminado -> abre modal confirmar/editar =====
function openPresetConfirm(preset) {
  EDIT_VIAJE_ID = null;
  document.getElementById("modal-viaje-title").textContent = "Confirmar viaje";
  setTipo(preset.tipo);
  document.getElementById("v-origen").value = preset.origen;
  document.getElementById("v-destino").value = preset.destino;
  document.getElementById("v-km").value = preset.km;
  document.getElementById("v-preciokm").value = PRECIO_KM_ACTUAL;
  document.getElementById("v-fecha").value = todayISO();
  recalcTotal();
  openModal("modal-viaje");
}

function openManualForm() {
  EDIT_VIAJE_ID = null;
  document.getElementById("modal-viaje-title").textContent = "Nuevo viaje manual";
  setTipo("CIARA");
  document.getElementById("v-origen").value = "";
  document.getElementById("v-destino").value = "";
  document.getElementById("v-km").value = "";
  document.getElementById("v-preciokm").value = PRECIO_KM_ACTUAL;
  document.getElementById("v-total").value = "";
  document.getElementById("v-fecha").value = todayISO();
  openModal("modal-viaje");
}

function openEditViaje(viaje) {
  EDIT_VIAJE_ID = viaje.id;
  document.getElementById("modal-viaje-title").textContent = "Editar viaje";
  setTipo(viaje.tipo);
  document.getElementById("v-origen").value = viaje.origen;
  document.getElementById("v-destino").value = viaje.destino;
  document.getElementById("v-km").value = viaje.km;
  document.getElementById("v-preciokm").value = viaje.precio_km;
  document.getElementById("v-total").value = viaje.total;
  document.getElementById("v-fecha").value = viaje.fecha;
  openModal("modal-viaje");
}

function setTipo(tipo) {
  TIPO_SEL = tipo;
  document.getElementById("seg-ciara").classList.toggle("sel", tipo === "CIARA");
  document.getElementById("seg-ciara").classList.toggle("CIARA", tipo === "CIARA");
  document.getElementById("seg-trabajo").classList.toggle("sel", tipo === "TRABAJO");
  document.getElementById("seg-trabajo").classList.toggle("TRABAJO", tipo === "TRABAJO");
}

function recalcTotal() {
  const km = parseFloat(document.getElementById("v-km").value) || 0;
  const pk = parseFloat(document.getElementById("v-preciokm").value) || 0;
  document.getElementById("v-total").value = (km * pk).toFixed(2);
}

async function guardarViaje() {
  const payload = {
    tipo: TIPO_SEL,
    origen: document.getElementById("v-origen").value.trim(),
    destino: document.getElementById("v-destino").value.trim(),
    km: parseFloat(document.getElementById("v-km").value) || 0,
    precio_km: parseFloat(document.getElementById("v-preciokm").value) || 0,
    total: parseFloat(document.getElementById("v-total").value) || 0,
    fecha: document.getElementById("v-fecha").value || todayISO(),
  };
  if (!payload.origen || !payload.destino) { showToast("Indica origen y destino"); return; }

  let error;
  if (EDIT_VIAJE_ID) {
    ({ error } = await sb.from("viajes").update(payload).eq("id", EDIT_VIAJE_ID));
  } else {
    ({ error } = await sb.from("viajes").insert(payload));
  }
  if (error) { showToast("Error al guardar"); console.error(error); return; }
  closeModal("modal-viaje");
  showToast("Viaje guardado");
  await loadViajes();
  populateMesFilter();
  renderListado();
}

async function eliminarViaje(id) {
  if (!confirm("¿Eliminar este viaje?")) return;
  const { error } = await sb.from("viajes").delete().eq("id", id);
  if (error) { showToast("Error al eliminar"); return; }
  await loadViajes();
  populateMesFilter();
  renderListado();
}

// ===== CRUD presets =====
function openPresetForm(preset) {
  EDIT_PRESET_ID = preset ? preset.id : null;
  document.getElementById("modal-preset-title").textContent = preset ? "Editar viaje predeterminado" : "Nuevo viaje predeterminado";
  document.getElementById("p-nombre").value = preset ? preset.nombre : "";
  document.getElementById("p-origen").value = preset ? preset.origen : "";
  document.getElementById("p-destino").value = preset ? preset.destino : "";
  document.getElementById("p-km").value = preset ? preset.km : "";
  setTipoPreset(preset ? preset.tipo : "CIARA");
  openModal("modal-preset");
}

function setTipoPreset(tipo) {
  TIPO_PRESET_SEL = tipo;
  document.getElementById("pseg-ciara").classList.toggle("sel", tipo === "CIARA");
  document.getElementById("pseg-ciara").classList.toggle("CIARA", tipo === "CIARA");
  document.getElementById("pseg-trabajo").classList.toggle("sel", tipo === "TRABAJO");
  document.getElementById("pseg-trabajo").classList.toggle("TRABAJO", tipo === "TRABAJO");
}

async function guardarPreset() {
  const payload = {
    nombre: document.getElementById("p-nombre").value.trim(),
    tipo: TIPO_PRESET_SEL,
    origen: document.getElementById("p-origen").value.trim(),
    destino: document.getElementById("p-destino").value.trim(),
    km: parseFloat(document.getElementById("p-km").value) || 0,
  };
  if (!payload.nombre || !payload.origen || !payload.destino) { showToast("Completa todos los campos"); return; }

  let error;
  if (EDIT_PRESET_ID) {
    ({ error } = await sb.from("viajes_predeterminados").update(payload).eq("id", EDIT_PRESET_ID));
  } else {
    ({ error } = await sb.from("viajes_predeterminados").insert(payload));
  }
  if (error) { showToast("Error al guardar"); console.error(error); return; }
  closeModal("modal-preset");
  showToast("Viaje predeterminado guardado");
  await loadPresets();
  renderPresets();
  renderPresetsConfig();
}

async function eliminarPreset(id) {
  if (!confirm("¿Eliminar este viaje predeterminado?")) return;
  const { error } = await sb.from("viajes_predeterminados").delete().eq("id", id);
  if (error) { showToast("Error al eliminar"); return; }
  await loadPresets();
  renderPresets();
  renderPresetsConfig();
}

// ===== Config tarifa =====
async function guardarTarifa() {
  const val = parseFloat(document.getElementById("input-precio-km").value);
  if (!val || val <= 0) { showToast("Tarifa inválida"); return; }
  const { error } = await sb.from("config").update({ precio_km: val }).eq("id", 1);
  if (error) { showToast("Error al guardar tarifa"); return; }
  PRECIO_KM_ACTUAL = val;
  showToast("Tarifa actualizada");
}

// ===== Listado + filtros =====
function populateMesFilter() {
  const meses = new Set(VIAJES.map(v => v.fecha.slice(0, 7)));
  const sel = document.getElementById("filtro-mes");
  const current = sel.value;
  sel.innerHTML = `<option value="">Todos los meses</option>` +
    Array.from(meses).sort().reverse().map(m => {
      const [y, mo] = m.split("-");
      const nombre = new Date(y, mo - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
      return `<option value="${m}">${nombre}</option>`;
    }).join("");
  sel.value = current || "";
}

function limpiarFiltros() {
  document.getElementById("filtro-mes").value = "";
  document.getElementById("filtro-tipo").value = "";
  document.getElementById("filtro-desde").value = "";
  document.getElementById("filtro-hasta").value = "";
  renderListado();
}

function renderListado() {
  const mes = document.getElementById("filtro-mes").value;
  const tipo = document.getElementById("filtro-tipo").value;
  const desde = document.getElementById("filtro-desde").value;
  const hasta = document.getElementById("filtro-hasta").value;

  let filtrados = VIAJES.filter(v => {
    if (mes && v.fecha.slice(0, 7) !== mes) return false;
    if (tipo && v.tipo !== tipo) return false;
    if (desde && v.fecha < desde) return false;
    if (hasta && v.fecha > hasta) return false;
    return true;
  });

  const totalHistorico = VIAJES.reduce((s, v) => s + Number(v.total), 0);
  const totalFiltrado = filtrados.reduce((s, v) => s + Number(v.total), 0);
  document.getElementById("total-historico").textContent = fmtEUR(totalHistorico);
  document.getElementById("total-filtrado").textContent = fmtEUR(totalFiltrado);

  const cont = document.getElementById("lista-viajes");
  if (filtrados.length === 0) {
    cont.innerHTML = `<div class="empty">No hay viajes para este filtro.</div>`;
    return;
  }
  cont.innerHTML = filtrados.map(v => `
    <div class="list-item">
      <div class="main" onclick='openEditViaje(${JSON.stringify(v).replace(/'/g, "&apos;")})'>
        <div class="ruta">${esc(v.origen)} → ${esc(v.destino)}</div>
        <div class="meta">${fmtFecha(v.fecha)} · ${v.tipo === "CIARA" ? "Con Ciara" : "Trabajo"} · ${v.km} km</div>
      </div>
      <div class="amount">${fmtEUR(v.total)}</div>
      <button class="del" onclick="eliminarViaje('${v.id}')">✕</button>
    </div>
  `).join("");
}

function fmtFecha(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

document.getElementById("filtro-mes").addEventListener("change", renderListado);
document.getElementById("filtro-tipo").addEventListener("change", renderListado);
document.getElementById("filtro-desde").addEventListener("change", renderListado);
document.getElementById("filtro-hasta").addEventListener("change", renderListado);

// ===== Service worker (offline shell) =====
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

loadAll();
