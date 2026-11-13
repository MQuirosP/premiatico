import { Lock } from 'lucide-react';
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t bg-white py-6 text-xs text-slate-500">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
        <p>© {new Date().getFullYear()} Premiático · Costa Rica · ¡Más chances, más emoción!</p>
        <Link
          href="/admin"
          aria-label="Administración"
          title="Administración"
          className="p-1 text-slate-300 hover:text-slate-500 transition"
        >
          <Lock className="h-3.5 w-3.5" />
        </Link>
      </div>
    </footer>
  );
}
