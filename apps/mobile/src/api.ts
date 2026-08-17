import type {
  ChatMessage,
  CreateFavoriteRequest,
  ExplainRequest,
  Favorite,
  FavoritesResponse,
  FollowUpResponse,
  HealthResponse,
  QueryResponse,
  ScoredSpot,
  SpotExplanation,
  SpotGroundingPayload,
  SpotScoresResponse,
  Sport,
  SpotsResponse,
  WeatherResponse,
} from "@w-a/shared";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? `Backend respondió ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok) {
    throw new Error(`Backend respondió ${response.status}`);
  }
  return response.json();
}

export async function fetchSpots(sport: Sport, locality: string): Promise<SpotsResponse> {
  const url = new URL(`${API_URL}/spots`);
  url.searchParams.set("sport", sport);
  url.searchParams.set("locality", locality);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Backend respondió ${response.status}`);
  }
  return response.json();
}

export async function explainSpot(spot: ScoredSpot): Promise<SpotExplanation> {
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

export async function askFollowUp(
  groundingPayload: SpotGroundingPayload,
  priorMessages: ChatMessage[],
  question: string,
): Promise<FollowUpResponse> {
  return postJson<FollowUpResponse>("/explain/followup", { groundingPayload, priorMessages, question });
}

export async function submitQuery(text: string): Promise<QueryResponse> {
  return postJson<QueryResponse>("/query", { text });
}

export async function fetchWeather(locality: string): Promise<WeatherResponse> {
  const url = new URL(`${API_URL}/weather`);
  url.searchParams.set("locality", locality);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Backend respondió ${response.status}`);
  }
  return response.json();
}

export async function fetchSpotScores(sport: Sport, lat: number, lon: number): Promise<SpotScoresResponse> {
  const url = new URL(`${API_URL}/spot-scores`);
  url.searchParams.set("sport", sport);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Backend respondió ${response.status}`);
  }
  return response.json();
}

export async function fetchFavorites(accessToken: string): Promise<FavoritesResponse> {
  return request<FavoritesResponse>("/favorites", { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function addFavorite(accessToken: string, input: CreateFavoriteRequest): Promise<Favorite> {
  return request<Favorite>("/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input),
  });
}

export async function removeFavorite(accessToken: string, id: string): Promise<void> {
  await request<void>(`/favorites/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function registerPushToken(accessToken: string, expoPushToken: string): Promise<void> {
  await request<void>("/push-tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ expoPushToken }),
  });
}
