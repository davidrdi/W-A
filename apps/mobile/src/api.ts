import type { HealthResponse, Sport, SpotsResponse } from "@w-a/shared";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

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
