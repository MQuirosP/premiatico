import { apiRequest } from '@/lib/api';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'OPERATOR';
}

export async function loginAdminRequest(input: {
  identifier: string;
  password: string;
}): Promise<{ admin: AdminUser }> {
  return apiRequest<{ admin: AdminUser }>('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function logoutAdminRequest(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/admin/auth/logout', {
    method: 'POST',
  });
}

export async function getAdminMeRequest(): Promise<{ admin: AdminUser }> {
  return apiRequest<{ admin: AdminUser }>('/admin/auth/me');
}
