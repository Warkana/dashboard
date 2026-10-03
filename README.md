# Мій дашборд справ

Персональний дашборд для систематизації справ за категоріями: **читання, ігри,
пет-проєкти, навчання**. Показує активні справи з прогресом, беклог з пошуком
і ручним сортуванням, і архів виконаного.

Без власного сервера: статичні файли (HTML/CSS/JS) + [Supabase](https://supabase.com)
(безкоштовний tier) як сховище даних і авторизація. Хостинг — GitHub Pages.

## 1. Налаштування Supabase

1. Створіть безкоштовний акаунт і новий проєкт на [supabase.com](https://supabase.com).
2. Відкрийте **SQL Editor → New query**, вставте весь вміст файлу
   [`sql/schema.sql`](sql/schema.sql) і натисніть **Run**. Це створить таблицю
   `tasks` з Row Level Security (кожен бачить лише свої рядки).
3. (Рекомендовано) **Database → Replication** → увімкніть реплікацію для
   таблиці `tasks`, щоб працював realtime-синк між вкладками/пристроями.
4. **Authentication → Providers → Email** — переконайтесь, що Email provider
   увімкнений (саме через нього працює вхід по magic link; за потреби вимкніть
   "Confirm email" у Email Templates, якщо не хочете зайвого кліку).
5. **Authentication → URL Configuration → Redirect URLs** — додайте URL, на
   якому буде жити дашборд (напр. `https://<ваш-нік>.github.io/dashboard/`),
   щоб посилання з листа коректно повертало на сайт.
6. **Project Settings → API** — скопіюйте **Project URL** та **anon public
   key**.

## 2. Підключення ключів

Відкрийте [`js/config.js`](js/config.js) і вставте свої значення:

```js
export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "ey...";
```

> `anon`-ключ призначений для публічного клієнтського коду — його безпечно
> комітити в репозиторій. Реальний захист даних забезпечує RLS-політика з
> `sql/schema.sql` (кожен користувач бачить і змінює лише свої рядки), а не
> секретність цього ключа.

## 3. Локальний запуск

ES-модулі не працюють через `file://`, тож потрібен простий локальний сервер:

```bash
python -m http.server 8080
# або: npx serve .
```

Відкрийте `http://localhost:8080`, введіть email, перейдіть по magic link з
листа — і дашборд відкриється.

## 4. Деплой на GitHub Pages

```bash
git init
git add .
git commit -m "Initial dashboard"
git branch -M main
git remote add origin https://github.com/<ваш-нік>/<репозиторій>.git
git push -u origin main
```

Потім у репозиторії: **Settings → Pages → Build and deployment → Deploy from
a branch → main / (root)**. За кілька хвилин сайт буде доступний за адресою
`https://<ваш-нік>.github.io/<репозиторій>/`.

Не забудьте додати саме цей URL у Supabase **Authentication → URL
Configuration → Redirect URLs** (крок 1.5) — інакше magic link не поверне
користувача назад на сайт.

## Структура проєкту

```
index.html              єдина сторінка дашборду
css/styles.css          дизайн-токени (light/dark), layout, компоненти
js/config.js             SUPABASE_URL / SUPABASE_ANON_KEY (вставити свої)
js/supabaseClient.js     створення Supabase-клієнта
js/auth.js               magic-link логін/логаут
js/api.js                CRUD + realtime-підписка на таблицю tasks
js/state.js               стор у пам'яті (tasks, фільтри, категорії)
js/render.js              рендер секцій, карток, таблиці, модалки, тостів
js/main.js                точка входу: обробники подій, зв'язка всього разом
sql/schema.sql            DDL таблиці tasks + RLS-політики
```

## Обкладинки та посилання

Кожна справа має два опційні поля: **посилання на зображення** (обкладинка книжки,
картинка проєкту) і **посилання при кліку** (Goodreads, Notion тощо) — вони
незалежні. Якщо таблиця `tasks` вже створена, виконайте в SQL Editor блок
«Міграція» з [`sql/schema.sql`](sql/schema.sql) (два `alter table … add column`).

## Категорії та статуси

- Категорії: `reading`, `games`, `pet_projects`, `learning`.
- Статуси: `backlog` → `active` → `done` (можна рухати в обох напрямках).
- `progress` (0–100) редагується слайдером прямо на картці активної справи.
- `priority` — ручне сортування беклогу кнопками ↑/↓.
