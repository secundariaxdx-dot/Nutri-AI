-- ════════════════════════════════════════════════════════════════════════
--  Nutri AI — esquema para la sincronización OPCIONAL con Supabase (plan gratuito)
--  Ejecuta este script completo en: Supabase → SQL Editor → New query → Run
-- ════════════════════════════════════════════════════════════════════════

-- Comidas
create table if not exists public.meals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date text not null,
  data jsonb not null,
  photo_path text,
  deleted boolean not null default false,
  updated_at timestamptz not null,               -- hora del dispositivo (resolución de conflictos)
  server_updated_at timestamptz not null default now()  -- hora del servidor (sincronización incremental)
);
create index if not exists meals_user_server_updated on public.meals (user_id, server_updated_at);

-- Perfil (uno por usuario)
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

-- Alimentos personalizados
create table if not exists public.custom_foods (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists custom_foods_user_server_updated on public.custom_foods (user_id, server_updated_at);

-- server_updated_at se actualiza siempre en el servidor
create or replace function public.touch_server_updated_at() returns trigger
language plpgsql as $$
begin
  new.server_updated_at := now();
  return new;
end $$;

drop trigger if exists meals_touch on public.meals;
create trigger meals_touch before insert or update on public.meals
  for each row execute function public.touch_server_updated_at();
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before insert or update on public.profiles
  for each row execute function public.touch_server_updated_at();
drop trigger if exists custom_foods_touch on public.custom_foods;
create trigger custom_foods_touch before insert or update on public.custom_foods
  for each row execute function public.touch_server_updated_at();

-- Seguridad a nivel de fila: cada usuario solo ve y modifica SUS datos
alter table public.meals enable row level security;
alter table public.profiles enable row level security;
alter table public.custom_foods enable row level security;

drop policy if exists "meals_own" on public.meals;
create policy "meals_own" on public.meals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "custom_foods_own" on public.custom_foods;
create policy "custom_foods_own" on public.custom_foods for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Almacenamiento privado de fotos: meal-photos/<user_id>/<meal_id>.jpg
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

drop policy if exists "photos_select_own" on storage.objects;
create policy "photos_select_own" on storage.objects for select
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos_insert_own" on storage.objects;
create policy "photos_insert_own" on storage.objects for insert
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos_update_own" on storage.objects;
create policy "photos_update_own" on storage.objects for update
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos_delete_own" on storage.objects;
create policy "photos_delete_own" on storage.objects for delete
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
