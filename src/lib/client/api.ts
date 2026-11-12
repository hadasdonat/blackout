export interface Progress { [level: number]: { stars: number; ms: number } }
export interface Me { id: string; nickname: string; progress: Progress }
export interface Board { rows: { id: string; nickname: string; done: number; stars: number; totalMs: number }[]; online: { nickname: string; location: string }[]; levels: number }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined
    ? { cache: "no-store" }
    : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `השרת החזיר שגיאה ${res.status}`);
  return data as T;
}
