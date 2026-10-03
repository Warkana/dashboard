import { isConfigured } from "./supabaseClient.js";
import { getSession, sendMagicLink, signOut, onAuthChange } from "./auth.js";
import { fetchTasks, createTask, updateTask, deleteTask, subscribeToTasks } from "./api.js";
import { store, CATEGORIES, SORT_OPTIONS, sortTasks, saveSortMode } from "./state.js";
import {
  renderStats,
  renderCategoryFilters,
  renderActive,
  renderBacklog,
  renderDone,
  toast,
  openTaskModal,
  closeTaskModal,
} from "./render.js";

const el = (id) => document.getElementById(id);

/* ===== Theme toggle (light/dark/system, persisted per-browser) ============= */
function initTheme() {
  const saved = localStorage.getItem("dashboard-theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
  el("theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : current === "light" ? null : "dark";
    if (next) {
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("dashboard-theme", next);
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("dashboard-theme");
    }
  });
}

/* ===== Derived views + render pipeline ====================================== */
function getFilteredTasks() {
  const { tasks, activeCategories } = store.get();
  return tasks.filter((t) => activeCategories.has(t.category));
}

function renderAll() {
  const { tasks, activeCategories, backlogSearch, sortMode } = store.get();
  const filtered = getFilteredTasks();
  const inStatus = (status) => sortTasks(filtered.filter((t) => t.status === status), sortMode, status);

  renderStats(tasks);
  renderCategoryFilters(activeCategories);
  renderActive(inStatus("active"));

  const search = backlogSearch.trim().toLowerCase();
  renderBacklog(inStatus("backlog").filter((t) => !search || t.title.toLowerCase().includes(search)));

  renderDone(inStatus("done"));
}

function initSort() {
  const select = el("sort-select");
  select.innerHTML = SORT_OPTIONS.map((o) => `<option value="${o.id}">${o.label}</option>`).join("");
  select.value = store.get().sortMode;
  select.addEventListener("change", () => {
    saveSortMode(select.value);
    store.set({ sortMode: select.value });
  });
}

store.subscribe(renderAll);

/* ===== Data loading + realtime ============================================== */
async function loadTasks() {
  try {
    const tasks = await fetchTasks();
    store.set({ tasks, loading: false });
  } catch (err) {
    console.error(err);
    toast(`Не вдалося завантажити дані: ${err.message}`, "error");
  }
}

let unsubscribeRealtime = null;
function startRealtime() {
  unsubscribeRealtime?.();
  unsubscribeRealtime = subscribeToTasks(({ eventType, record, oldRecord }) => {
    const { tasks } = store.get();
    if (eventType === "INSERT") {
      if (tasks.some((t) => t.id === record.id)) return;
      store.set({ tasks: [...tasks, record] });
    } else if (eventType === "UPDATE") {
      store.set({ tasks: tasks.map((t) => (t.id === record.id ? record : t)) });
    } else if (eventType === "DELETE") {
      store.set({ tasks: tasks.filter((t) => t.id !== oldRecord.id) });
    }
  });
}

/* ===== Auth gate ============================================================= */
function showLogin() {
  el("login-screen").hidden = false;
  el("dashboard").hidden = true;
}

function showDashboard() {
  el("login-screen").hidden = true;
  el("dashboard").hidden = false;
}

async function handleSession(session) {
  store.set({ session });
  if (session) {
    showDashboard();
    await loadTasks();
    startRealtime();
  } else {
    unsubscribeRealtime?.();
    store.set({ tasks: [] });
    showLogin();
  }
}

function initAuth() {
  if (!isConfigured) {
    el("login-status").textContent =
      "Supabase не налаштовано. Відкрийте js/config.js і вставте SUPABASE_URL та SUPABASE_ANON_KEY.";
    return;
  }

  el("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = e.target.elements.email.value.trim();
    if (!email) return;
    el("login-status").textContent = "Надсилаємо посилання...";
    try {
      await sendMagicLink(email);
      el("login-status").textContent = `Перевірте пошту ${email} -- там посилання для входу.`;
    } catch (err) {
      el("login-status").textContent = `Помилка: ${err.message}`;
    }
  });

  el("logout-btn").addEventListener("click", () => signOut());

  onAuthChange(handleSession);
  getSession().then(handleSession).catch((err) => {
    console.error(err);
    showLogin();
  });
}

/* ===== Task CRUD handlers ===================================================== */
async function withErrorToast(fn) {
  try {
    await fn();
  } catch (err) {
    console.error(err);
    toast(err.message ?? "Щось пішло не так", "error");
  }
}

function nextPriorityForBacklog() {
  const backlog = store.get().tasks.filter((t) => t.status === "backlog");
  return backlog.length ? Math.max(...backlog.map((t) => t.priority)) + 1 : 0;
}

el("task-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const id = form.elements.id.value;
  const payload = {
    title: form.elements.title.value.trim(),
    category: form.elements.category.value,
    status: form.elements.status.value,
    progress: Number(form.elements.progress.value),
    notes: form.elements.notes.value.trim() || null,
    due_date: form.elements.due_date.value || null,
    image_url: form.elements.image_url.value.trim() || null,
    link_url: form.elements.link_url.value.trim() || null,
  };
  if (!payload.title) return;

  await withErrorToast(async () => {
    if (id) {
      const updated = await updateTask(id, payload);
      store.set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
      toast("Справу оновлено");
    } else {
      payload.priority = nextPriorityForBacklog();
      const created = await createTask(payload);
      store.set((s) => ({ tasks: [...s.tasks, created] }));
      toast("Справу додано");
    }
    closeTaskModal();
  });
});

el("delete-task-btn").addEventListener("click", async () => {
  const id = el("task-form").elements.id.value;
  if (!id) return;
  if (!confirm("Видалити цю справу остаточно?")) return;
  await withErrorToast(async () => {
    await deleteTask(id);
    store.set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    toast("Справу видалено");
    closeTaskModal();
  });
});

el("add-task-btn").addEventListener("click", () => openTaskModal(null));
el("modal-cancel-btn").addEventListener("click", () => closeTaskModal());

/* Event delegation for dynamically rendered cards / table rows */
async function handleAction(action, id) {
  const task = store.get().tasks.find((t) => t.id === id);
  if (!task) return;

  if (action === "edit") return openTaskModal(task);

  if (action === "delete") {
    if (!confirm(`Видалити "${task.title}"?`)) return;
    return withErrorToast(async () => {
      await deleteTask(id);
      store.set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
      toast("Справу видалено");
    });
  }

  if (action === "complete") {
    return withErrorToast(async () => {
      const updated = await updateTask(id, { status: "done", progress: 100 });
      store.set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
      toast("Готово! 🎉");
    });
  }

  if (action === "start") {
    return withErrorToast(async () => {
      const updated = await updateTask(id, { status: "active" });
      store.set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
      toast("Справу перенесено в активні");
    });
  }

  if (action === "to-backlog") {
    return withErrorToast(async () => {
      const updated = await updateTask(id, {
        status: "backlog",
        priority: nextPriorityForBacklog(),
      });
      store.set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
      toast("Повернуто в беклог");
    });
  }

  if (action === "priority-up" || action === "priority-down") {
    const backlog = store
      .get()
      .tasks.filter((t) => t.status === "backlog")
      .sort((a, b) => a.priority - b.priority);
    const idx = backlog.findIndex((t) => t.id === id);
    const swapIdx = action === "priority-up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= backlog.length) return;
    const a = backlog[idx];
    const b = backlog[swapIdx];
    return withErrorToast(async () => {
      const [updatedA, updatedB] = await Promise.all([
        updateTask(a.id, { priority: b.priority }),
        updateTask(b.id, { priority: a.priority }),
      ]);
      store.set((s) => ({
        tasks: s.tasks.map((t) => (t.id === updatedA.id ? updatedA : t.id === updatedB.id ? updatedB : t)),
      }));
    });
  }
}

function initDelegatedClicks() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || btn.dataset.action === "toggle-category") return;
    const { action, id } = btn.dataset;
    if (id) handleAction(action, id);
  });

  // Прогрес-слайдер на активних картках.
  document.addEventListener("input", (e) => {
    if (e.target.dataset.action !== "set-progress") return;
    const id = e.target.dataset.id;
    const value = Number(e.target.value);
    const row = e.target.closest(".meter-row");
    row.querySelector(".meter-fill").style.setProperty("--pct", `${value}%`);
    row.querySelector(".meter-pct").textContent = `${value}%`;
  });
  document.addEventListener("change", async (e) => {
    if (e.target.dataset.action !== "set-progress") return;
    const id = e.target.dataset.id;
    const value = Number(e.target.value);
    await withErrorToast(async () => {
      const updated = await updateTask(id, { progress: value });
      store.set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
    });
  });

  // Перемикач категорій-фільтрів.
  el("category-filters").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-action='toggle-category']");
    if (!chip) return;
    const category = chip.dataset.category;
    const { activeCategories } = store.get();
    const next = new Set(activeCategories);
    next.has(category) ? next.delete(category) : next.add(category);
    store.set({ activeCategories: next });
  });

  el("backlog-search").addEventListener("input", (e) => {
    store.set({ backlogSearch: e.target.value });
  });
}

/* ===== Boot =================================================================== */
initTheme();
initSort();
initDelegatedClicks();
initAuth();
