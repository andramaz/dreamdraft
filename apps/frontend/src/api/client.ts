const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiGet<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, { signal });
  if (!res.ok) {
    throw new ApiError(res.status, `GET ${path} failed with ${res.status}`);
  }
  return (await res.json()) as T;
}
