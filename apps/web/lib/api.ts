import type {
  ChatMessage,
  ExplainRequest,
  FollowUpResponse,
  QueryResponse,
  ScoredSpot,
  SpotExplanation,
  SpotGroundingPayload,
  Sport,
  SpotsResponse,
  WeatherResponse,
} from "@w-a/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

async function getJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Backend respondió ${response.status}`);
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
    throw new Error(errorBody?.error ?? `Backend respondió ${response.status}`);
  }
  return response.json();
}

export function fetchSpots(sport: Sport, locality: string): Promise<SpotsResponse> {
  return getJson<SpotsResponse>("/spots", { sport, locality });
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

export function askFollowUp(
  groundingPayload: SpotGroundingPayload,
  priorMessages: ChatMessage[],
  question: string,
): Promise<FollowUpResponse> {
  return postJson<FollowUpResponse>("/explain/followup", { groundingPayload, priorMessages, question });
}
