import type { Overview, Product, StripItem } from "./types";

async function json<T>(path: string, key = ""): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE || ""}${path}`, {
    headers: key ? { "X-EIA-Key": key } : {},
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

export const fetchStrip = () =>
  json<{ items: StripItem[]; source: string; as_of: string }>("/api/strip");

export function fetchOverview(
  product: Product,
  expiry: string,
  forecast: string,
  eiaKey: string,
) {
  const query = new URLSearchParams({ product });
  if (expiry) query.set("expiry", expiry);
  if (forecast.trim()) query.set("forecast", forecast.trim());
  return json<Overview>(`/api/overview?${query}`, eiaKey);
}
