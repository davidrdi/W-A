-- Pegar en: proyecto de Supabase de Trebo (davidrdi) → SQL Editor → New query → Run.
-- Reutilizamos ese proyecto (misma auth, mismo Google OAuth ya configurado)
-- en vez de crear uno nuevo. Nombres elegidos para no chocar con nada de
-- Trebo: su "favorites" favoritea eventos (event_id); la nuestra es
-- "sport_favorites" (spot_id + sport). "push_tokens" no existía, sin cambios.
-- Ambas tablas son nuevas — este script no modifica ni borra nada existente.

-- Caché persistente de todo lo caro y lento: geocodificación (Nominatim/Photon),
-- zonas de Overpass y explicaciones de la IA. Es lo que hace que las zonas estén
-- "precalculadas": el plan gratuito de Render duerme el servicio a los ~15 min,
-- y con caché solo en memoria cada despertar volvía a pegarle a las APIs públicas
-- desde cero (de ahí los 429/406) y a pagar de nuevo cada llamada a Claude.
-- Sin RLS a propósito: solo la toca el backend con la service role key.
create table if not exists public.api_cache (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists api_cache_expires_at_idx on public.api_cache (expires_at);

-- Zonas precalculadas (playas + zonas de deporte de tierra). Antes se pedían
-- en vivo a Overpass en cada petición de usuario (cacheadas unas horas/días
-- en api_cache, pero el primer usuario tras cada vencimiento pagaba la
-- consulta completa — incluida "todas las playas de España" de golpe—, lo
-- que fue la causa de los 429 de Open-Meteo al pedir luego el tiempo de
-- miles de puntos a la vez). Ahora las zonas viven aquí y un job aparte
-- (POST /internal/refresh-spots, disparado por un scheduler externo, nunca
-- por tráfico de usuarios — ver services/spotsRefresh.ts) las mantiene al
-- día. Solo se actualiza el tiempo por spot en cada petición (api_cache,
-- TTL de 1h), no la zona en sí.
--
-- `category` en vez de `sport`: una misma playa sirve para playa/surf/
-- windsurf y un mismo parque para running/paseo — lo que cambia entre
-- deportes es el scoring, no la zona (ver services/spots.ts). Un mismo
-- `id` puede aparecer en más de una categoría (p.ej. un parque que es a la
-- vez "urbanPath" y "cycleway"), de ahí la clave compuesta.
create table if not exists public.spots (
  id text not null,
  category text not null check (category in ('urbanPath', 'trail', 'cycleway', 'beach')),
  name text not null,
  lat double precision not null,
  lon double precision not null,
  amenities jsonb,
  source text not null default 'osm' check (source in ('osm', 'seed')),
  updated_at timestamptz not null default now(),
  primary key (id, category)
);

-- Sin índice geográfico real (no hay PostGIS aquí): las búsquedas por
-- localidad acotan primero por bounding box de lat/lon y calculan la
-- distancia exacta en la aplicación (ver services/spotsRepo.ts). Suficiente
-- a la escala de España.
create index if not exists spots_category_lat_lon_idx on public.spots (category, lat, lon);

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
