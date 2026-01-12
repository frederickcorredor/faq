// ===============================
// CONFIG
// ===============================
const DATA_DIR = "data/";
const NAME_KEY = "teleop_name";

// ===============================
// STATE
// ===============================
let SECTIONS = [];
let SECTION_ITEMS = {}; // { sectionId: items[] }
let activeSectionId = null;
let globalQuery = "";
let sectionQuery = "";
let teleopName = "";

// ===============================
// HELPERS
// ===============================
const normalize = (str) =>
  (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function escapeHtml(str) {
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeRegExp(str) {
  return (str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text, q) {
  if (!q) return escapeHtml(text);
  const nq = normalize(q).trim();
  if (!nq) return escapeHtml(text);

  const tokens = nq.split(/\s+/).filter(Boolean);
  let out = escapeHtml(text);

  tokens.forEach((t) => {
    if (t.length < 3) return;
    const re = new RegExp(`(${escapeRegExp(t)})`, "ig");
    out = out.replace(re, `<span class="mark">$1</span>`);
  });

  return out;
}

function applyTemplates(text) {
  const name = teleopName?.trim() ? teleopName.trim() : "_____";
  return (text || "")
    .replaceAll("{{ASESORA}}", name)
    .replaceAll("{{ASESOR}}", name);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
  return res.json();
}

function itemMatches(item, q) {
  const nq = normalize(q);
  if (!nq) return true;

  const hay = normalize(
    (item.title || "") + " " + (item.content || "") + " " + (item.tags || []).join(" ")
  );

  const tokens = nq.split(/\s+/).filter(Boolean);
  return tokens.some((t) => hay.includes(t));
}

function getItemsForActiveSection() {
  const items = SECTION_ITEMS[activeSectionId] || [];
  const q = globalQuery ? globalQuery : sectionQuery;
  return items.filter((it) => itemMatches(it, q));
}

// ===============================
// DOM
// ===============================
const navEl = document.getElementById("sectionNav");
const panelTitle = document.getElementById("panelTitle");
const panelDesc = document.getElementById("panelDesc");
const cardsEl = document.getElementById("cards");
const resultsMeta = document.getElementById("resultsMeta");

const globalSearchEl = document.getElementById("globalSearch");
const sectionSearchEl = document.getElementById("sectionSearch");
const clearGlobalBtn = document.getElementById("clearGlobal");
const clearSectionBtn = document.getElementById("clearSection");

// Modal recursos
const modal = document.getElementById("mediaModal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
document.getElementById("closeModal").addEventListener("click", () => modal.close());

// Modal nombre
const nameModal = document.getElementById("nameModal");
const nameInput = document.getElementById("nameInput");
const saveNameBtn = document.getElementById("saveName");
const skipNameBtn = document.getElementById("skipName");
const userChip = document.getElementById("userChip");
const userNameLabel = document.getElementById("userNameLabel");

// ===============================
// RENDER
// ===============================
function renderNav() {
  navEl.innerHTML = "";

  SECTIONS.forEach((s) => {
    const btn = document.createElement("button");
    btn.className = s.id === activeSectionId ? "active" : "";
    const count = (SECTION_ITEMS[s.id] || []).length;

    btn.innerHTML = `
      <span>${escapeHtml(s.title)}</span>
      <span class="badge">${count}</span>
    `;

    btn.addEventListener("click", () => {
      activeSectionId = s.id;
      sectionQuery = "";
      sectionSearchEl.value = "";
      renderNav();
      renderPanel();
    });

    navEl.appendChild(btn);
  });
}

function renderResources(resources) {
  if (!resources || resources.length === 0) return "";
  return `
    <div class="resources">
      ${resources.map((r) => {
        const type = r.type || "link";
        const safeTitle = escapeHtml(r.title || "Recurso");
        const safeNote = escapeHtml(r.note || "");
        const safePath = escapeHtml(r.path || "");
        const meta = `${type.toUpperCase()}${safeNote ? " • " + safeNote : ""}`;

        const actions = [];

        if (type === "image" || type === "video" || type === "audio") {
          const icon = type === "image" ? "👁 Ver" : type === "video" ? "🎥 Ver" : "🎧 Reproducir";
          actions.push(
            `<button class="btn small ghost" data-action="preview" data-type="${type}" data-path="${safePath}" data-title="${safeTitle}">${icon}</button>`
          );
        } else {
          actions.push(`<a class="btn small ghost" href="${safePath}" target="_blank" rel="noopener">🔗 Abrir</a>`);
        }

        if (safePath) {
          actions.push(`<a class="btn small" href="${safePath}" download>⬇ Descargar</a>`);
          actions.push(`<button class="btn small ghost" data-action="copylink" data-path="${safePath}">📎 Copiar link</button>`);
        }

        return `
          <div class="res-item">
            <div class="res-left">
              <div class="res-title">${safeTitle}</div>
              <div class="res-meta">${meta}</div>
            </div>
            <div class="res-actions">
              ${actions.join("")}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderPanel() {
  const section = SECTIONS.find((s) => s.id === activeSectionId);
  if (!section) return;

  panelTitle.textContent = section.title;
  panelDesc.textContent = section.desc;

  const q = globalQuery ? globalQuery : sectionQuery;
  const visible = getItemsForActiveSection();

  resultsMeta.textContent =
    q && q.trim()
      ? `Mostrando ${visible.length} resultado(s) para: "${q}"`
      : `Mostrando ${visible.length} elemento(s).`;

  cardsEl.innerHTML = "";

  visible.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";

    const qUse = globalQuery ? globalQuery : sectionQuery;

    const titleText = applyTemplates(item.title || "");
    const contentText = applyTemplates(item.content || "");

    const titleHtml = highlight(titleText, qUse);
    const contentHtml = highlight(contentText, qUse);

    card.innerHTML = `
      <div class="card-head">
        <div>
          <div class="card-title">${titleHtml}</div>
          <div class="chips">
            ${(item.tags || []).map(t => `<span class="chip">${escapeHtml(t)}</span>`).join("")}
          </div>
        </div>

        <div class="card-actions">
          <button class="btn small ghost toggle">Ver</button>
          <button class="btn small copy">📋 Copiar</button>
        </div>
      </div>

      <div class="card-body">
        <div class="content">${contentHtml}</div>
        ${renderResources(item.resources || [])}
      </div>
    `;

    card.querySelector(".toggle").addEventListener("click", () => {
      card.classList.toggle("active");
      card.querySelector(".toggle").textContent = card.classList.contains("active") ? "Ocultar" : "Ver";
    });

    card.querySelector(".copy").addEventListener("click", async (e) => {
      const ok = await copyToClipboard(contentText);
      const btn = e.currentTarget;
      const old = btn.textContent;
      btn.textContent = ok ? "✅ Copiado" : "⚠️ No se pudo";
      setTimeout(() => (btn.textContent = old), 1200);
    });

    cardsEl.appendChild(card);
  });
}

// ===============================
// EVENTS (search)
// ===============================
globalSearchEl.addEventListener("input", () => {
  globalQuery = globalSearchEl.value;
  renderPanel();
});

sectionSearchEl.addEventListener("input", () => {
  sectionQuery = sectionSearchEl.value;
  renderPanel();
});

clearGlobalBtn.addEventListener("click", () => {
  globalQuery = "";
  globalSearchEl.value = "";
  renderPanel();
});

clearSectionBtn.addEventListener("click", () => {
  sectionQuery = "";
  sectionSearchEl.value = "";
  renderPanel();
});

// Resources actions
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;

  const action = el.getAttribute("data-action");
  const path = el.getAttribute("data-path") || "";
  const type = el.getAttribute("data-type") || "";
  const title = el.getAttribute("data-title") || "Recurso";

  if (action === "copylink") {
    const ok = await copyToClipboard(path);
    const old = el.textContent;
    el.textContent = ok ? "✅ Link copiado" : "⚠️ No se pudo";
    setTimeout(() => (el.textContent = old), 1200);
    return;
  }

  if (action === "preview") {
    modalTitle.textContent = title;

    if (type === "image") modalBody.innerHTML = `<img src="${path}" alt="${escapeHtml(title)}" />`;
    else if (type === "video") modalBody.innerHTML = `<video src="${path}" controls></video>`;
    else if (type === "audio") modalBody.innerHTML = `<audio src="${path}" controls style="width:100%"></audio>`;
    else modalBody.innerHTML = `<p class="muted">No hay previsualización para este recurso.</p>`;

    modal.showModal();
  }
});

// ===============================
// NAME FLOW
// ===============================
function setName(name) {
  teleopName = (name || "").trim();
  localStorage.setItem(NAME_KEY, teleopName);
  userNameLabel.textContent = teleopName ? teleopName : "Sin nombre";
  renderPanel();
}

function openNameModal(prefill = true) {
  if (prefill) nameInput.value = teleopName || "";
  nameModal.showModal();
  setTimeout(() => nameInput.focus(), 50);
}

saveNameBtn.addEventListener("click", () => {
  setName(nameInput.value);
  nameModal.close();
});

skipNameBtn.addEventListener("click", () => {
  setName(teleopName || "");
  nameModal.close();
});

userChip?.addEventListener("click", () => openNameModal(true));

// ===============================
// INIT LOAD JSON
// ===============================
async function init() {
  teleopName = localStorage.getItem(NAME_KEY) || "";
  userNameLabel.textContent = teleopName ? teleopName : "Sin nombre";
  if (!teleopName) openNameModal(false);

  SECTIONS = await fetchJson(`${DATA_DIR}sections.json`);

  for (const s of SECTIONS) {
    SECTION_ITEMS[s.id] = await fetchJson(`${DATA_DIR}${s.file}`);
  }

  activeSectionId = SECTIONS[0]?.id || null;

  renderNav();
  renderPanel();
}

init().catch((err) => {
  console.error(err);
  alert("Error cargando los JSON. Abre esto desde un servidor (no file://) y verifica que exista la carpeta /data.");
});


const toggleBtn = document.querySelector('.menu-toggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

// Abrir / cerrar con botón
toggleBtn.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
});

// Cerrar tocando fuera
overlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
});

// Cerrar al tocar una opción del panel
sidebar.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
});
