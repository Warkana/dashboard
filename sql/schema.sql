-- Схема бази даних для персонального дашборду справ.
-- Виконати один раз у Supabase: Dashboard -> SQL Editor -> New query -> вставити весь файл -> Run.

create extension if not exists "pgcrypto";

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  category text not null check (category in ('reading', 'games', 'pet_projects', 'learning')),
  status text not null default 'backlog' check (status in ('backlog', 'active', 'done')),
  progress smallint not null default 0 check (progress between 0 and 100),
  notes text,
  priority integer not null default 0,
  due_date date,
  image_url text check (image_url is null or image_url ~* '^https?://'),
  link_url text check (link_url is null or link_url ~* '^https?://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists tasks_user_id_idx on tasks (user_id);
create index if not exists tasks_status_idx on tasks (status);

-- Міграція для вже створеної таблиці (виконати один раз, якщо tasks існує):
alter table tasks add column if not exists image_url text check (image_url is null or image_url ~* '^https?://');
alter table tasks add column if not exists link_url text check (link_url is null or link_url ~* '^https?://');

-- Автоматично підтримувати updated_at та completed_at.
create or replace function set_task_timestamps()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_timestamps on tasks;
create trigger trg_task_timestamps
  before update on tasks
  for each row
  execute function set_task_timestamps();

-- Row Level Security: кожен користувач бачить і змінює тільки свої рядки.
alter table tasks enable row level security;

drop policy if exists "own rows only" on tasks;
create policy "own rows only" on tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Увімкнути Realtime для цієї таблиці (для синхронізації між вкладками/пристроями):
-- Supabase Dashboard -> Database -> Replication -> tasks -> увімкнути.
