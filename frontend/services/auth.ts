import { apiRequest, clearAdminSessionToken, setAdminSessionToken } from '@/lib/api';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'OPERATOR';
}

export async function loginAdminRequest(input: {
  identifier: string;
  password: string;
}): Promise<{ admin: AdminUser; token?: string }> {
  const res = await apiRequest<{ admin: AdminUser; token?: string }>('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (res.token) {
    setAdminSessionToken(res.token);
  }
  return res;
}

export async function logoutAdminRequest(): Promise<{ message: string }> {
  try {
    return await apiRequest<{ message: string }>('/admin/auth/logout', {
      method: 'POST',
    });
  } finally {
    clearAdminSessionToken();
  }
}

export async function getAdminMeRequest(): Promise<{ admin: AdminUser }> {
  return apiRequest<{ admin: AdminUser }>('/admin/auth/me');
}
