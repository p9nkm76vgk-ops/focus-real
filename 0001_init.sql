-- PROPUESTA (NO ejecutada ni probada aquí). Aditiva: solo crea objetos nuevos; no toca datos existentes.
-- IDs de texto estables (los genera el cliente/planificador) => reintentos idempotentes con upsert.
create table public.subjects (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null, name text not null check (length(trim(name)) > 0), color text not null default '#c9a45c',
  archived boolean not null default false, version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (user_id, id));
create table public.works (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null, kind text not null check (kind in ('task','exam')), subject_id text not null,
  title text not null check (length(trim(title)) > 0), due_date date not null, due_minute int check (due_minute between 0 and 1440),
  est_min int not null check (est_min > 0), difficulty int not null default 3 check (difficulty between 1 and 5),
  importance int not null default 3 check (importance between 1 and 5), readiness int not null default 0 check (readiness between 0 and 100),
  status text not null default 'pending' check (status in ('pending','in_progress','done','archived')), notes text not null default '',
  version int not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (user_id, id), foreign key (user_id, subject_id) references public.subjects (user_id, id) on delete restrict);
create table public.blocks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null, work_id text not null, date date not null, start_min int not null check (start_min >= 0), end_min int not null,
  status text not null default 'planned' check (status in ('planned','done','skipped','rescheduled')), manual boolean not null default false,
  part text check (part in ('main','review')), actual_min int check (actual_min >= 0),
  version int not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (user_id, id), check (end_min > start_min and end_min <= 1440),
  foreign key (user_id, work_id) references public.works (user_id, id) on delete cascade);
create index on public.blocks (user_id, date);
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'), version int not null default 1, updated_at timestamptz not null default now());

-- Control de concurrencia: cada UPDATE sube version; user_id inmutable.
create function public.touch() returns trigger language plpgsql set search_path = '' as $$
begin new.user_id := old.user_id; new.version := old.version + 1; new.updated_at := now(); return new; end $$;
create trigger t_subjects before update on public.subjects for each row execute function public.touch();
create trigger t_works    before update on public.works    for each row execute function public.touch();
create trigger t_blocks   before update on public.blocks   for each row execute function public.touch();
create trigger t_settings before update on public.user_settings for each row execute function public.touch();

-- Row Level Security: cada usuario solo ve y escribe sus filas. Sin acceso para anon.
do $$ declare t text; begin
  foreach t in array array['subjects','works','blocks','user_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop; end $$;
