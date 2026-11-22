let tokenGetter: () => Promise<string | null> = async () => null;

export function registerTokenGetter(fn: () => Promise<string | null>) {
  tokenGetter = fn;
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await tokenGetter();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }

  return data as T;
}
