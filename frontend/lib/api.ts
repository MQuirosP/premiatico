export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const ADMIN_TOKEN_STORAGE_KEY = 'premiatico_admin_token';

export function getAdminSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminSessionToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore storage errors
  }
}

export function clearAdminSessionToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const isFormData = options.body instanceof FormData;
  const adminToken = path.startsWith('/admin') ? getAdminSessionToken() : null;

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      ...options.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | ApiSuccess<T>
    | ApiFailure
    | null;

  if (response.status === 401 && path.startsWith('/admin') && !path.startsWith('/admin/auth/login')) {
    clearAdminSessionToken();
  }

  if (!response.ok || !payload || !payload.success) {
    const err = payload && !payload.success ? payload.error : null;
    throw new ApiError(
      err?.message ?? 'Error al comunicarse con el servidor',
      response.status,
      err?.code ?? 'NETWORK_ERROR',
      err?.details,
    );
  }

  return payload.data;
}
