import type {
  ChatMessage,
  ExplainRequest,
  FollowUpResponse,
  HealthResponse,
  ScoredSpot,
  SpotExplanation,
  SpotGroundingPayload,
  Sport,
  SpotsResponse,
  WeatherResponse,
} from "@w-a/shared";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

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
