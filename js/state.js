export const CATEGORIES = [
  { id: "reading", label: "Читання" },
  { id: "games", label: "Ігри" },
  { id: "pet_projects", label: "Пет-проєкти" },
  { id: "learning", label: "Навчання" },
];

export const SORT_OPTIONS = [
  { id: "manual", label: "Вручну" },
  { id: "created_desc", label: "Нові спочатку" },
  { id: "created_asc", label: "Старі спочатку" },
  { id: "category", label: "За категорією" },
  { id: "title", label: "За назвою А–Я" },
  { id: "progress_desc", label: "За прогресом" },
  { id: "due", label: "За дедлайном" },
];

const SORT_KEY = "dashboard-sort";

export function loadSortMode() {
  try {
    const saved = localStorage.getItem(SORT_KEY);
    if (SORT_OPTIONS.some((o) => o.id === saved)) return saved;
  } catch {
    /* сховище недоступне — використовуємо значення за замовчуванням */
  }
  return "manual";
}

export function saveSortMode(mode) {
  try {
    localStorage.setItem(SORT_KEY, mode);
  } catch {
    /* ignore */
  }
}

const byDate = (field) => (a, b) => (a[field] ?? "").localeCompare(b[field] ?? "");
const byTitle = (a, b) => a.title.localeCompare(b.title, "uk");

/** Повертає відсортовану копію. status потрібен лише для режиму "manual". */
export function sortTasks(tasks, mode, status) {
  const catIndex = (t) => CATEGORIES.findIndex((c) => c.id === t.category);
  const comparators = {
    manual:
      status === "backlog"
        ? (a, b) => a.priority - b.priority
        : status === "done"
          ? (a, b) => byDate("completed_at")(b, a)
          : byDate("created_at"),
    created_desc: (a, b) => byDate("created_at")(b, a),
    created_asc: byDate("created_at"),
    category: (a, b) => catIndex(a) - catIndex(b) || byTitle(a, b),
    title: byTitle,
    progress_desc: (a, b) => b.progress - a.progress || byTitle(a, b),
    due: (a, b) => {
      if (!a.due_date !== !b.due_date) return a.due_date ? -1 : 1; // без дедлайну — в кінець
      return (a.due_date ?? "").localeCompare(b.due_date ?? "") || byTitle(a, b);
    },
  };
  return [...tasks].sort(comparators[mode] ?? comparators.manual);
}

/** Простий reactive-стор: мутації йдуть через setState, підписники перерендерюють UI. */
function createStore(initial) {
  let state = initial;
  const listeners = new Set();

  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const store = createStore({
  session: null,
  tasks: [],
  activeCategories: new Set(CATEGORIES.map((c) => c.id)), // всі увімкнені за замовчуванням
  backlogSearch: "",
  sortMode: loadSortMode(),
  loading: true,
  editingTaskId: null, // null = нова справа; "new" markers not needed, see main.js
});

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
