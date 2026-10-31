import type { Product } from "./types";

const PREFIX = "commodity-desk-v2";

export function readLocal<T>(name: string, fallback: T): T {
  try {
    const value = localStorage.getItem(`${PREFIX}:${name}`);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(name: string, value: unknown): void {
  localStorage.setItem(`${PREFIX}:${name}`, JSON.stringify(value));
}

export function reportId(product: Product, week: string): string {
  const kind = product.startsWith("NG") ? "gas" : "crude";
  return `${kind}:${week}`;
}

export function downloadJson(name: string, value: unknown): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
