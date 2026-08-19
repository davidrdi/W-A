import type {
  AlternativesResponse,
  ChatMessage,
  CreateFavoriteRequest,
  ExplainRequest,
  Favorite,
  FavoritesResponse,
  FollowUpResponse,
  OverviewResponse,
  QueryResponse,
  ScoredSpot,
  SpotExplanation,
  SpotGroundingPayload,
  Sport,
  SpotsResponse,
  WeatherResponse,
} from "@w-a/shared";

// Sin quitar la barra final, "https://host/" + "/spots" produce "//spots" y
// el backend responde 404 (Not Found) — normalizamos por si el valor
// configurado en Vercel/​.env trae esa barra.
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

// Fastify pone el detalle útil en `message` ("Overpass respondió 406") y deja en
// `error` el nombre genérico del status ("Internal Server Error"). Leyendo solo
// `error` la UI enseñaba siempre "Internal Server Error" y había que ir a la
// consola del navegador para enterarse de qué había fallado de verdad.
function describeError(body: { error?: string; message?: string } | null, status: number): string {
  return body?.message ?? body?.error ?? `Backend respondió ${status}`;
}

async function getJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(describeError(body, response.status));
  }
  return response.json();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(describeError(errorBody, response.status));
  }
  return response.json();
}

export function fetchSpots(sport: Sport, locality: string): Promise<SpotsResponse> {
  return getJson<SpotsResponse>("/spots", { sport, locality });
}

// Vista general: un pin por cada zona precalculada de todo el país, sin pedir
// localidad — es lo que se ve al elegir deporte, antes de buscar nada.
export function fetchOverview(sport: Sport): Promise<OverviewResponse> {
  return getJson<OverviewResponse>("/overview", { sport });
}

export function fetchWeather(locality: string): Promise<WeatherResponse> {
  return getJson<WeatherResponse>("/weather", { locality });
}

export function submitQuery(text: string): Promise<QueryResponse> {
  return postJson<QueryResponse>("/query", { text });
}

export function explainSpot(spot: ScoredSpot): Promise<SpotExplanation> {
  const request: ExplainRequest = {
    sport: spot.sport,
    spotId: spot.id,
    name: spot.name,
    lat: spot.lat,
    lon: spot.lon,
    amenities: spot.amenities,
  };
  return postJson<SpotExplanation>("/explain", request);
}

export function fetchAlternatives(
  selected: { sport: Sport; spotId: string; name: string; lat: number; lon: number },
  nearby: { spotId: string; name: string; lat: number; lon: number }[],
): Promise<AlternativesResponse> {
  return postJson<AlternativesResponse>("/explain/alternatives", { selected, nearby });
}

export function askFollowUp(
  groundingPayload: SpotGroundingPayload,
  priorMessages: ChatMessage[],
  question: string,
): Promise<FollowUpResponse> {
  return postJson<FollowUpResponse>("/explain/followup", { groundingPayload, priorMessages, question });
}

export async function fetchFavorites(accessToken: string): Promise<FavoritesResponse> {
  const response = await fetch(`${API_URL}/favorites`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(describeError(body, response.status));
  }
  return response.json();
}

export async function addFavorite(accessToken: string, input: CreateFavoriteRequest): Promise<Favorite> {
  const response = await fetch(`${API_URL}/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(describeError(body, response.status));
  }
  return response.json();
}

export async function removeFavorite(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`${API_URL}/favorites/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(describeError(body, response.status));
  }
}
