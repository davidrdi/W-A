-- Ejecutar una vez en el SQL Editor de un proyecto Supabase nuevo
-- (Project > SQL Editor > New query > pegar todo > Run).

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spot_id text not null,
  spot_name text not null,
  sport text not null,
  lat double precision not null,
  lon double precision not null,
  created_at timestamptz not null default now(),
  unique (user_id, spot_id, sport)
);

alter table public.favorites enable row level security;

-- El backend usa la service role key (bypassa RLS) y filtra por user_id él
-- mismo tras verificar el JWT — estas políticas son defensa en profundidad,
-- por si en el futuro el móvil consulta Supabase directo con la sesión del
-- usuario en vez de pasar por el backend.
create policy "favorites_select_own" on public.favorites
  for select using (auth.uid() = user_id);

create policy "favorites_insert_own" on public.favorites
  for insert with check (auth.uid() = user_id);

create policy "favorites_delete_own" on public.favorites
  for delete using (auth.uid() = user_id);

create index if not exists favorites_user_id_idx on public.favorites (user_id);
