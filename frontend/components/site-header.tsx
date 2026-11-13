'use client';

import { Search, Sparkles } from 'lucide-react';
import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-b bg-white/95 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-xl text-blue-600">
          <Sparkles className="h-6 w-6 text-amber-500" />
          <span>Premiático</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm font-semibold">
          <Link href="/#campanas" className="text-slate-600 hover:text-blue-600 transition">
            Campañas
          </Link>
          <Link
            href="/pedido"
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1.5 text-blue-700 hover:bg-blue-100 transition"
          >
            <Search className="h-3.5 w-3.5" />
            Consultar pedido
          </Link>
        </nav>
      </div>
    </header>
  );
}
