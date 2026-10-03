import { CATEGORIES, categoryLabel } from "./state.js";

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "short" }) : "";

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function safeUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

/** Обкладинка (клікабельна, якщо є link_url). cls: card-cover | thumb. */
function coverHtml(t, cls) {
  const img = safeUrl(t.image_url);
  const link = safeUrl(t.link_url);
  const isCard = cls === "card-cover";
  if (!img) return isCard ? `<div class="card-cover card-cover--empty"></div>` : "";
  // У картках блок обкладинки лишається (заглушка тієї ж висоти), у мініатюрах — прибирається.
  const onerror = isCard ? "this.remove()" : `this.closest('.${cls}').remove()`;
  const tag = `<img src="${escapeHtml(img)}" alt="${escapeHtml(t.title)}" loading="lazy"
    referrerpolicy="no-referrer" onerror="${onerror}" />`;
  return link
    ? `<a class="${cls}" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${tag}</a>`
    : `<div class="${cls}">${tag}</div>`;
}

function titleHtml(t) {
  const link = safeUrl(t.link_url);
  const title = escapeHtml(t.title);
  return link
    ? `<a class="title-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${title} ↗</a>`
    : title;
}

function categoryBadge(category) {
  return `<span class="category-badge" style="--cat-color: var(--cat-${category})">
    <span class="dot"></span>${categoryLabel(category)}
  </span>`;
}

function meterRow(task, { editable } = {}) {
  if (editable) {
    return `<div class="meter-row">
      <div class="meter" style="--cat-color: var(--cat-${task.category})">
        <div class="meter-fill" style="--pct:${task.progress}%"></div>
      </div>
      <input type="range" min="0" max="100" step="5" value="${task.progress}"
        data-action="set-progress" data-id="${task.id}" />
      <span class="meter-pct">${task.progress}%</span>
    </div>`;
  }
  return `<div class="meter-row">
    <div class="meter" style="--cat-color: var(--cat-${task.category})">
      <div class="meter-fill" style="--pct:${task.progress}%"></div>
    </div>
    <span class="meter-pct">${task.progress}%</span>
  </div>`;
}

/* ===== Stat tiles ========================================================= */
export function renderStats(tasks) {
  const active = tasks.filter((t) => t.status === "active");
  const backlog = tasks.filter((t) => t.status === "backlog");
  const done = tasks.filter((t) => t.status === "done");
  const avgProgress = active.length
    ? Math.round(active.reduce((sum, t) => sum + t.progress, 0) / active.length)
    : 0;

  const tiles = [
    { label: "Активні", value: active.length },
    { label: "У беклозі", value: backlog.length },
    { label: "Виконано", value: done.length },
    { label: "Середній прогрес", value: `${avgProgress}%` },
  ];

  document.getElementById("stats-row").innerHTML = tiles
    .map(
      (t) => `<div class="stat-tile">
        <div class="stat-label">${t.label}</div>
        <div class="stat-value">${t.value}</div>
      </div>`
    )
    .join("");
}

/* ===== Category filter chips ============================================== */
export function renderCategoryFilters(activeCategories) {
  document.getElementById("category-filters").innerHTML = CATEGORIES.map(
    (c) => `<button type="button" class="chip" data-action="toggle-category" data-category="${c.id}"
        style="--chip-color: var(--cat-${c.id})"
        aria-pressed="${activeCategories.has(c.id)}">
        <span class="dot"></span>${c.label}
      </button>`
  ).join("");
}

/* ===== Active section ====================================================== */
export function renderActive(tasks) {
  const list = document.getElementById("active-list");
  const empty = document.getElementById("active-empty");
  const count = document.getElementById("active-count");
  count.textContent = tasks.length;

  if (!tasks.length) {
    list.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = tasks
    .map(
      (t) => `<article class="task-card" style="--cat-color: var(--cat-${t.category})">
        ${coverHtml(t, "card-cover")}
        <div class="card-top">
          ${categoryBadge(t.category)}
        </div>
        <div class="card-title">${titleHtml(t)}</div>
        <div class="card-notes">${t.notes ? escapeHtml(t.notes) : ""}</div>
        ${meterRow(t, { editable: true })}
        <div class="card-actions">
          <button class="btn" data-action="complete" data-id="${t.id}">Готово</button>
          <button class="btn" data-action="to-backlog" data-id="${t.id}">У беклог</button>
          <button class="btn btn-ghost" data-action="edit" data-id="${t.id}">Редагувати</button>
        </div>
      </article>`
    )
    .join("");
}

/* ===== Backlog section ====================================================== */
export function renderBacklog(tasks) {
  const tbody = document.getElementById("backlog-rows");
  const empty = document.getElementById("backlog-empty");
  const count = document.getElementById("backlog-count");
  count.textContent = tasks.length;

  if (!tasks.length) {
    tbody.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  tbody.innerHTML = tasks
    .map(
      (t, idx) => `<tr>
        <td><div class="title-cell">${coverHtml(t, "thumb")}${titleHtml(t)}</div></td>
        <td>${categoryBadge(t.category)}</td>
        <td>${t.due_date ? fmtDate(t.due_date) : "—"}</td>
        <td>
          <div class="priority-controls">
            <button class="btn btn-ghost" data-action="priority-up" data-id="${t.id}" ${idx === 0 ? "disabled" : ""} title="Вище">↑</button>
            <button class="btn btn-ghost" data-action="priority-down" data-id="${t.id}" ${idx === tasks.length - 1 ? "disabled" : ""} title="Нижче">↓</button>
          </div>
        </td>
        <td>
          <div class="row-actions">
            <button class="btn" data-action="start" data-id="${t.id}">Почати</button>
            <button class="btn btn-ghost" data-action="edit" data-id="${t.id}">✎</button>
            <button class="btn btn-ghost btn-danger" data-action="delete" data-id="${t.id}">✕</button>
          </div>
        </td>
      </tr>`
    )
    .join("");
}

/* ===== Done section ========================================================= */
export function renderDone(tasks) {
  const list = document.getElementById("done-list");
  const count = document.getElementById("done-count");
  count.textContent = tasks.length;

  if (!tasks.length) {
    list.innerHTML = `<li style="justify-content:center;color:var(--text-muted)">Поки нічого не виконано</li>`;
    return;
  }

  list.innerHTML = tasks
    .map(
      (t) => `<li>
        ${coverHtml(t, "thumb")}
        <span class="done-title">${titleHtml(t)}</span>
        ${categoryBadge(t.category)}
        <span class="done-meta">${t.completed_at ? fmtDate(t.completed_at) : ""}</span>
        <div class="row-actions">
          <button class="btn btn-ghost" data-action="to-backlog" data-id="${t.id}" title="Повернути в беклог">↺</button>
          <button class="btn btn-ghost btn-danger" data-action="delete" data-id="${t.id}">✕</button>
        </div>
      </li>`
    )
    .join("");
}

/* ===== Toasts ================================================================ */
export function toast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ===== Modal ================================================================= */
export function openTaskModal(task) {
  const dialog = document.getElementById("task-modal");
  const form = document.getElementById("task-form");
  form.reset();
  document.getElementById("modal-title").textContent = task ? "Редагувати справу" : "Нова справа";
  form.elements.id.value = task?.id ?? "";
  form.elements.title.value = task?.title ?? "";
  form.elements.category.value = task?.category ?? CATEGORIES[0].id;
  form.elements.status.value = task?.status ?? "backlog";
  form.elements.progress.value = task?.progress ?? 0;
  form.elements.notes.value = task?.notes ?? "";
  form.elements.due_date.value = task?.due_date ?? "";
  form.elements.image_url.value = task?.image_url ?? "";
  form.elements.link_url.value = task?.link_url ?? "";
  document.getElementById("delete-task-btn").hidden = !task;
  dialog.showModal();
}

export function closeTaskModal() {
  document.getElementById("task-modal").close();
}
