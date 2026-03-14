const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const PRIO_LABELS = { urgent: "Dringend", high: "Hoch", normal: "Normal", low: "Niedrig" };
const PRIO_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };

let items = [];
let categories = [];
let activeFilter = "all";
let activeCat = "";

function fmt(n) {
  return Number(n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── API ──
async function api(url, opts) {
  const res = await fetch(url, opts);
  if (res.status === 204) return null;
  return res.json();
}

async function load() {
  [items, categories] = await Promise.all([api("/api/items"), api("/api/categories")]);
  populateCategorySelects();
  render();
}

// ── Categories ──
function populateCategorySelects() {
  const opts = `<option value="">Kategorie</option>` + categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  const optsEdit = `<option value="">Keine</option>` + categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  $("#quickCategory").innerHTML = opts;
  $("#editCategory").innerHTML = optsEdit;
  renderCategoryFilters();
  renderCategoryList();
}

function renderCategoryFilters() {
  $("#filterCats").innerHTML = categories
    .map((c) => `<button class="filter-cat-btn${activeCat === c ? " active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`)
    .join("");
}

function renderCategoryList() {
  $("#catList").innerHTML = categories
    .map(
      (c) => `
    <div class="cat-item">
      <span>${esc(c)}</span>
      <button class="btn-icon del" data-delcat="${esc(c)}">&times;</button>
    </div>`
    )
    .join("");
}

// ── Render ──
function render() {
  renderProgress();
  renderExpenseSummary();
  renderList();
}

function renderProgress() {
  const total = items.length;
  const bought = items.filter((i) => i.bought).length;
  const pct = total ? Math.round((bought / total) * 100) : 0;
  $("#progressFill").style.width = pct + "%";
  $("#progressText").textContent = total ? `${bought} von ${total} gekauft (${pct}%)` : "Noch keine Artikel";
}

function renderExpenseSummary() {
  const el = $("#expenseSummary");
  const boughtItems = items.filter((i) => i.bought && i.price > 0);
  const allWithPrice = items.filter((i) => i.price > 0);

  if (allWithPrice.length === 0) {
    el.classList.add("hidden");
    return;
  }
  el.classList.remove("hidden");

  const totalBought = boughtItems.reduce((s, i) => s + Number(i.price), 0);
  const totalAll = allWithPrice.reduce((s, i) => s + Number(i.price), 0);

  // Per category
  const catTotals = {};
  items.forEach((i) => {
    if (i.price > 0) {
      const cat = i.category || "Sonstiges";
      if (!catTotals[cat]) catTotals[cat] = { total: 0, bought: 0 };
      catTotals[cat].total += Number(i.price);
      if (i.bought) catTotals[cat].bought += Number(i.price);
    }
  });

  const maxCatTotal = Math.max(...Object.values(catTotals).map((c) => c.total), 1);

  let catHtml = Object.keys(catTotals)
    .sort()
    .map((cat) => {
      const c = catTotals[cat];
      const pct = (c.total / maxCatTotal) * 100;
      return `
        <div class="expense-cat-row">
          <span class="cat-name">${esc(cat)}</span>
          <div class="cat-bar-wrap"><div class="cat-bar" style="width:${pct}%"></div></div>
          <span class="cat-amount">${fmt(c.bought)} / ${fmt(c.total)} &euro;</span>
        </div>`;
    })
    .join("");

  el.innerHTML = `
    <div class="expense-title">Ausgaben</div>
    <div class="expense-total">
      <span class="label">Gekauft / Gesamt</span>
      <span class="amount">${fmt(totalBought)} / ${fmt(totalAll)} &euro;</span>
    </div>
    <div class="expense-cats">${catHtml}</div>
  `;
}

function getFiltered() {
  let list = [...items];
  if (activeFilter === "open") list = list.filter((i) => !i.bought);
  if (activeFilter === "bought") list = list.filter((i) => i.bought);
  if (activeCat) list = list.filter((i) => i.category === activeCat);
  list.sort((a, b) => {
    if (a.bought !== b.bought) return a.bought ? 1 : -1;
    return PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority];
  });
  return list;
}

function renderList() {
  const filtered = getFiltered();
  const listEl = $("#itemList");

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty">
        <div class="icon">&#128722;</div>
        <h3>${items.length === 0 ? "Liste ist leer" : "Keine Treffer"}</h3>
        <p>${items.length === 0 ? "Füge oben deinen ersten Artikel hinzu!" : "Ändere die Filter, um Artikel zu sehen."}</p>
      </div>`;
    return;
  }

  const groups = {};
  const noCategory = [];
  filtered.forEach((item) => {
    if (item.category) {
      (groups[item.category] = groups[item.category] || []).push(item);
    } else {
      noCategory.push(item);
    }
  });

  let html = "";

  const sortedCats = Object.keys(groups).sort();
  for (const cat of sortedCats) {
    const catTotal = groups[cat].reduce((s, i) => s + Number(i.price || 0), 0);
    const catBought = groups[cat].filter((i) => i.bought).reduce((s, i) => s + Number(i.price || 0), 0);
    const totalLabel = catTotal > 0 ? ` &mdash; ${fmt(catBought)} / ${fmt(catTotal)} &euro;` : "";
    html += `<div class="category-group">
      <div class="category-header"><span class="cat-color"></span>${esc(cat)}${totalLabel}</div>
      ${groups[cat].map(renderItem).join("")}
    </div>`;
  }

  if (noCategory.length) {
    const catTotal = noCategory.reduce((s, i) => s + Number(i.price || 0), 0);
    const catBought = noCategory.filter((i) => i.bought).reduce((s, i) => s + Number(i.price || 0), 0);
    const totalLabel = catTotal > 0 ? ` &mdash; ${fmt(catBought)} / ${fmt(catTotal)} &euro;` : "";
    html += `<div class="category-group">
      ${sortedCats.length ? `<div class="category-header"><span class="cat-color" style="background:var(--low)"></span>Sonstiges${totalLabel}</div>` : ""}
      ${noCategory.map(renderItem).join("")}
    </div>`;
  }

  listEl.innerHTML = html;
}

function renderItem(item) {
  const price = Number(item.price || 0);
  return `
    <div class="item-row${item.bought ? " bought" : ""}" data-id="${item.id}">
      <div class="checkbox" data-toggle="${item.id}">${item.bought ? "&#10003;" : ""}</div>
      <span class="prio-dot ${item.priority}"></span>
      <span class="item-name">${esc(item.name)}</span>
      ${item.quantity ? `<span class="item-qty">${esc(item.quantity)}</span>` : ""}
      ${price > 0 ? `<span class="item-price">${fmt(price)} &euro;</span>` : ""}
      <span class="item-prio-badge ${item.priority}">${PRIO_LABELS[item.priority]}</span>
      <div class="item-actions">
        <button class="btn-icon" data-edit="${item.id}" title="Bearbeiten">&#9998;</button>
        <button class="btn-icon del" data-del="${item.id}" title="Löschen">&times;</button>
      </div>
    </div>`;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// ── Quick Add ──
$("#quickAddForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#quickName").value.trim();
  if (!name) return;
  await api("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      quantity: $("#quickQty").value.trim(),
      price: parseFloat($("#quickPrice").value) || 0,
      category: $("#quickCategory").value,
      priority: $("#quickPriority").value,
    }),
  });
  $("#quickName").value = "";
  $("#quickQty").value = "";
  $("#quickPrice").value = "";
  load();
});

// ── List events ──
$("#itemList").addEventListener("click", async (e) => {
  const toggleEl = e.target.closest("[data-toggle]");
  if (toggleEl) {
    e.stopPropagation();
    const item = items.find((i) => i.id === toggleEl.dataset.toggle);
    if (item) {
      await api(`/api/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bought: !item.bought }),
      });
      load();
    }
    return;
  }

  const delEl = e.target.closest("[data-del]");
  if (delEl) {
    e.stopPropagation();
    await api(`/api/items/${delEl.dataset.del}`, { method: "DELETE" });
    load();
    return;
  }

  const editEl = e.target.closest("[data-edit]");
  if (editEl) {
    e.stopPropagation();
    openEdit(editEl.dataset.edit);
    return;
  }

  const row = e.target.closest(".item-row");
  if (row) openEdit(row.dataset.id);
});

// ── Filters ──
document.addEventListener("click", (e) => {
  const filterBtn = e.target.closest(".filter-btn");
  if (filterBtn) {
    $$(".filter-btn").forEach((b) => b.classList.remove("active"));
    filterBtn.classList.add("active");
    activeFilter = filterBtn.dataset.filter;
    activeCat = "";
    $$(".filter-cat-btn").forEach((b) => b.classList.remove("active"));
    render();
    return;
  }

  const catBtn = e.target.closest(".filter-cat-btn");
  if (catBtn) {
    const cat = catBtn.dataset.cat;
    if (activeCat === cat) {
      activeCat = "";
      catBtn.classList.remove("active");
    } else {
      activeCat = cat;
      $$(".filter-cat-btn").forEach((b) => b.classList.remove("active"));
      catBtn.classList.add("active");
    }
    render();
  }
});

// ── Edit Modal ──
function openEdit(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  $("#editId").value = item.id;
  $("#editName").value = item.name;
  $("#editQty").value = item.quantity || "";
  $("#editPrice").value = item.price || "";
  $("#editPriority").value = item.priority;
  $("#editCategory").value = item.category || "";
  $("#editModal").classList.add("active");
  setTimeout(() => $("#editName").focus(), 100);
}

function closeEdit() {
  $("#editModal").classList.remove("active");
}

$("#btnCloseEditModal").addEventListener("click", closeEdit);
$("#btnCancelEdit").addEventListener("click", closeEdit);
$("#editModal").addEventListener("click", (e) => { if (e.target === $("#editModal")) closeEdit(); });

$("#editForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#editId").value;
  await api(`/api/items/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: $("#editName").value.trim(),
      quantity: $("#editQty").value.trim(),
      price: parseFloat($("#editPrice").value) || 0,
      priority: $("#editPriority").value,
      category: $("#editCategory").value,
    }),
  });
  closeEdit();
  load();
});

// ── Category Modal ──
function openCatModal() { $("#catModal").classList.add("active"); }
function closeCatModal() { $("#catModal").classList.remove("active"); }

$("#btnManageCategories").addEventListener("click", openCatModal);
$("#btnCloseCatModal").addEventListener("click", closeCatModal);
$("#catModal").addEventListener("click", (e) => { if (e.target === $("#catModal")) closeCatModal(); });

$("#catAddForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#catName").value.trim();
  if (!name) return;
  await api("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  $("#catName").value = "";
  load();
});

$("#catList").addEventListener("click", async (e) => {
  const del = e.target.closest("[data-delcat]");
  if (del) {
    const name = del.dataset.delcat;
    if (!confirm(`Kategorie "${name}" wirklich löschen?`)) return;
    await api(`/api/categories/${encodeURIComponent(name)}`, { method: "DELETE" });
    if (activeCat === name) activeCat = "";
    load();
  }
});

// ── Clear bought ──
$("#btnClearBought").addEventListener("click", async () => {
  const bought = items.filter((i) => i.bought).length;
  if (!bought) return;
  if (!confirm(`${bought} gekaufte Artikel entfernen?`)) return;
  await api("/api/items", { method: "DELETE" });
  load();
});

// ── Keyboard ──
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeEdit();
    closeCatModal();
  }
});

// ── Init ──
load();
