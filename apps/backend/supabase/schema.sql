-- Pegar en: proyecto de Supabase de Trebo (davidrdi) → SQL Editor → New query → Run.
-- Reutilizamos ese proyecto (misma auth, mismo Google OAuth ya configurado)
-- en vez de crear uno nuevo. Nombres elegidos para no chocar con nada de
-- Trebo: su "favorites" favoritea eventos (event_id); la nuestra es
-- "sport_favorites" (spot_id + sport). "push_tokens" no existía, sin cambios.
-- Ambas tablas son nuevas — este script no modifica ni borra nada existente.

create table if not exists public.sport_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spot_id text not null,
  spot_name text not null,
  sport text not null,
  lat double precision not null,
  lon double precision not null,
  created_at timestamptz not null default now(),
  -- Última fecha (YYYY-MM-DD) en que se evaluó/notificó este favorito —
  -- evita mandar el push de "buen día" más de una vez al día por spot.
  last_notified_date date,
  unique (user_id, spot_id, sport)
);

-- V2: tokens de Expo Push para las notificaciones proactivas de favoritos.
-- Un usuario puede tener varios (varios dispositivos).
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

alter table public.push_tokens enable row level security;

create policy "push_tokens_select_own" on public.push_tokens
  for select using (auth.uid() = user_id);

create policy "push_tokens_insert_own" on public.push_tokens
  for insert with check (auth.uid() = user_id);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.sport_favorites enable row level security;

-- El backend usa la service role key (bypassa RLS) y filtra por user_id él
-- mismo tras verificar el JWT — estas políticas son defensa en profundidad,
-- por si en el futuro algún cliente consulta Supabase directo con la sesión
-- del usuario en vez de pasar por el backend.
create policy "sport_favorites_select_own" on public.sport_favorites
  for select using (auth.uid() = user_id);

create policy "sport_favorites_insert_own" on public.sport_favorites
  for insert with check (auth.uid() = user_id);

create policy "sport_favorites_delete_own" on public.sport_favorites
  for delete using (auth.uid() = user_id);

create index if not exists sport_favorites_user_id_idx on public.sport_favorites (user_id);
