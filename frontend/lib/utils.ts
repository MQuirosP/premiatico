import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCRC(amount: number): string {
  return `₡${amount.toLocaleString('es-CR')}`;
}
